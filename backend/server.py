from fastapi import FastAPI, APIRouter, HTTPException, Header, Request, UploadFile, File, Form
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt
import httpx
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

# Supabase Storage (images only — DB is still MongoDB per current state)
try:
    from supabase import create_client as _sb_create_client
except ImportError:
    _sb_create_client = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT config (secret from env or generated)
JWT_SECRET = os.environ.get('JWT_SECRET', 'lgdp-secret-change-me-in-prod-8c3a5f9b2d1e')
JWT_ALGO = 'HS256'
JWT_EXP_DAYS = 30

# Supabase Storage client (backend-only, uses SECRET key — never exposed to frontend)
_SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
_SUPABASE_KEY = os.environ.get('SUPABASE_SECRET_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
_supabase = None
if _SUPABASE_URL and _SUPABASE_KEY and _sb_create_client:
    try:
        _supabase = _sb_create_client(_SUPABASE_URL, _SUPABASE_KEY)
    except Exception as _e:
        logging.getLogger("lgdp").warning(f"Supabase Storage init failed: {_e}")

STORAGE_BUCKETS = {"shows", "roster", "nouvelles", "podcasts", "marchandise", "accueil"}
ALLOWED_MIME = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


def storage_public_url(bucket: str, path: str) -> str:
    """Build the public URL for an object in a public bucket."""
    if not _SUPABASE_URL:
        return ""
    return f"{_SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"


def require_storage():
    if _supabase is None:
        raise HTTPException(503, "Supabase Storage non configuré (SUPABASE_URL / SUPABASE_SECRET_KEY manquants)")


app = FastAPI(title="LGDP API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("lgdp")


# ============================================================
# Utility helpers
# ============================================================
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def make_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": int(now_utc().timestamp()),
        "exp": int((now_utc() + timedelta(days=JWT_EXP_DAYS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(authorization: Optional[str]) -> Optional[Dict[str, Any]]:
    """Returns user dict or None. Supports both JWT tokens and Emergent session tokens."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()

    # Try JWT first
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload.get("sub")
        if user_id:
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
            if user:
                return user
    except jwt.PyJWTError:
        pass

    # Try Emergent session token
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    exp = session.get("expires_at")
    if isinstance(exp, datetime):
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < now_utc():
            return None
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    return user


async def require_user(authorization: Optional[str]) -> Dict[str, Any]:
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Non authentifié")
    return user


# ============================================================
# Models
# ============================================================
class RegisterBody(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class EmergentSessionBody(BaseModel):
    session_token: str


class UserPublic(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    is_admin: bool = False
    created_at: str


class WrestlerCreate(BaseModel):
    name: str
    nickname: Optional[str] = None
    photo: Optional[str] = None
    bio: Optional[str] = None
    style: Optional[str] = None
    wins: int = 0
    losses: int = 0


class MatchCreate(BaseModel):
    wrestler_one: str
    wrestler_two: str
    event: Optional[str] = None
    date: str
    winner: Optional[str] = None
    match_type: Optional[str] = None
    status: str = "upcoming"  # upcoming | completed


class ChampionshipCreate(BaseModel):
    title: str
    current_holder: Optional[str] = None
    image: Optional[str] = None
    history: List[str] = []


class EpisodeCreate(BaseModel):
    title: str
    episode_number: int
    description: Optional[str] = None
    cover_image: Optional[str] = None
    audio_url: str
    duration: Optional[int] = 0  # seconds
    release_date: Optional[str] = None


class EventCreate(BaseModel):
    name: str
    date: str
    location: str
    description: Optional[str] = None
    poster: Optional[str] = None
    capacity: int = 500
    price: float = 25.0


class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    image: Optional[str] = None
    stock: int = 10
    category: Optional[str] = None


class TicketPurchase(BaseModel):
    event_id: str
    quantity: int = 1


class OrderCreate(BaseModel):
    product_id: str
    quantity: int = 1


# ============================================================
# Root
# ============================================================
@api_router.get("/")
async def root():
    return {"message": "LGDP API — Les Gars du Podcast", "status": "ok"}


# ============================================================
# Auth: Register / Login / Me / Logout
# ============================================================
@api_router.post("/auth/register")
async def register(body: RegisterBody):
    existing = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail="Un compte existe déjà avec cet email")

    user_id = make_id("user")
    doc = {
        "user_id": user_id,
        "email": body.email.lower(),
        "name": body.name,
        "password_hash": hash_pw(body.password),
        "picture": None,
        "is_admin": False,
        "auth_provider": "password",
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)
    token = make_jwt(user_id)
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return {"token": token, "user": doc}


@api_router.post("/auth/login")
async def login(body: LoginBody):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    if not verify_pw(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    token = make_jwt(user["user_id"])
    user.pop("password_hash", None)
    return {"token": token, "user": user}


@api_router.post("/auth/emergent-session")
async def emergent_session(body: EmergentSessionBody, request: Request):
    """Called by frontend after Emergent Google Auth returns a session_id.
    Actually here frontend sends session_id (the temp one) — we resolve it."""
    session_id = body.session_token
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Session Emergent invalide")
    data = r.json()
    email = data.get("email", "").lower()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=401, detail="Réponse Emergent invalide")

    # Upsert user
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = make_id("user")
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "is_admin": False,
            "auth_provider": "google",
            "created_at": iso(now_utc()),
        }
        await db.users.insert_one(user)
    else:
        if picture and not user.get("picture"):
            await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"picture": picture}})
            user["picture"] = picture

    # Store session
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {
            "$set": {
                "session_token": session_token,
                "user_id": user["user_id"],
                "expires_at": now_utc() + timedelta(days=7),
                "created_at": now_utc(),
            }
        },
        upsert=True,
    )
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"token": session_token, "user": user}


@api_router.get("/auth/me")
async def me(authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    user.pop("password_hash", None)
    return user


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ============================================================
# Wrestlers
# ============================================================
@api_router.get("/wrestlers")
async def list_wrestlers():
    items = await db.wrestlers.find({}, {"_id": 0}).to_list(1000)
    return items


@api_router.get("/wrestlers/{wid}")
async def get_wrestler(wid: str):
    w = await db.wrestlers.find_one({"wrestler_id": wid}, {"_id": 0})
    if not w:
        raise HTTPException(404, "Lutteur introuvable")
    return w


@api_router.post("/wrestlers")
async def create_wrestler(body: WrestlerCreate, authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin requis")
    doc = body.dict()
    doc["wrestler_id"] = make_id("wr")
    doc["created_at"] = iso(now_utc())
    await db.wrestlers.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ============================================================
# Matches
# ============================================================
@api_router.get("/matches")
async def list_matches(status: Optional[str] = None):
    q = {}
    if status:
        q["status"] = status
    items = await db.matches.find(q, {"_id": 0}).sort("date", 1).to_list(1000)
    return items


@api_router.post("/matches")
async def create_match(body: MatchCreate, authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin requis")
    doc = body.dict()
    doc["match_id"] = make_id("mt")
    doc["created_at"] = iso(now_utc())
    await db.matches.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ============================================================
# Championships
# ============================================================
@api_router.get("/championships")
async def list_championships():
    return await db.championships.find({}, {"_id": 0}).to_list(1000)


# ============================================================
# Podcast Episodes
# ============================================================
@api_router.get("/episodes")
async def list_episodes():
    items = await db.episodes.find({}, {"_id": 0}).sort("episode_number", -1).to_list(1000)
    return items


@api_router.get("/episodes/{eid}")
async def get_episode(eid: str):
    e = await db.episodes.find_one({"episode_id": eid}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Épisode introuvable")
    return e


@api_router.post("/episodes")
async def create_episode(body: EpisodeCreate, authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin requis")
    doc = body.dict()
    doc["episode_id"] = make_id("ep")
    doc["created_at"] = iso(now_utc())
    if not doc.get("release_date"):
        doc["release_date"] = iso(now_utc())
    await db.episodes.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ============================================================
# Favorites (episodes)
# ============================================================
class FavoriteBody(BaseModel):
    episode_id: str


@api_router.get("/favorites")
async def list_favorites(authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    favs = await db.favorites.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    ep_ids = [f["episode_id"] for f in favs]
    episodes = await db.episodes.find({"episode_id": {"$in": ep_ids}}, {"_id": 0}).to_list(1000)
    return episodes


@api_router.post("/favorites/toggle")
async def toggle_favorite(body: FavoriteBody, authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    existing = await db.favorites.find_one({"user_id": user["user_id"], "episode_id": body.episode_id})
    if existing:
        await db.favorites.delete_one({"user_id": user["user_id"], "episode_id": body.episode_id})
        return {"favorited": False}
    await db.favorites.insert_one(
        {"user_id": user["user_id"], "episode_id": body.episode_id, "created_at": iso(now_utc())}
    )
    return {"favorited": True}


# ============================================================
# Events
# ============================================================
@api_router.get("/events")
async def list_events():
    return await db.events.find({}, {"_id": 0}).sort("date", 1).to_list(1000)


@api_router.get("/events/{eid}")
async def get_event(eid: str):
    e = await db.events.find_one({"event_id": eid}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Événement introuvable")
    return e


# ============================================================
# Tickets — Square MOCKED
# ============================================================
@api_router.post("/tickets/purchase")
async def purchase_ticket(body: TicketPurchase, authorization: Optional[str] = Header(None)):
    """MOCKED Square payment — simulates successful checkout."""
    user = await require_user(authorization)
    event = await db.events.find_one({"event_id": body.event_id}, {"_id": 0})
    if not event:
        raise HTTPException(404, "Événement introuvable")

    ticket_id = make_id("tk")
    doc = {
        "ticket_id": ticket_id,
        "user_id": user["user_id"],
        "event_id": body.event_id,
        "event_name": event["name"],
        "event_date": event["date"],
        "event_location": event["location"],
        "quantity": body.quantity,
        "total": round(event["price"] * body.quantity, 2),
        "square_payment_id": f"MOCK_SQ_{uuid.uuid4().hex[:16].upper()}",
        "status": "confirmed",
        "purchase_date": iso(now_utc()),
    }
    await db.tickets.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "ticket": doc, "message": "Achat confirmé (paiement Square simulé)"}


@api_router.get("/tickets/me")
async def my_tickets(authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    return await db.tickets.find({"user_id": user["user_id"]}, {"_id": 0}).sort("purchase_date", -1).to_list(1000)


# ============================================================
# Products / Orders
# ============================================================
@api_router.get("/products")
async def list_products(category: Optional[str] = None):
    q = {}
    if category:
        q["category"] = category
    return await db.products.find(q, {"_id": 0}).to_list(1000)


@api_router.get("/products/{pid}")
async def get_product(pid: str):
    p = await db.products.find_one({"product_id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Produit introuvable")
    return p


@api_router.post("/orders")
async def create_order(body: OrderCreate, authorization: Optional[str] = Header(None)):
    """MOCKED Square payment for merch."""
    user = await require_user(authorization)
    product = await db.products.find_one({"product_id": body.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Produit introuvable")
    if product.get("stock", 0) < body.quantity:
        raise HTTPException(400, "Stock insuffisant")

    order = {
        "order_id": make_id("ord"),
        "user_id": user["user_id"],
        "product_id": body.product_id,
        "product_name": product["name"],
        "product_image": product.get("image"),
        "quantity": body.quantity,
        "total": round(product["price"] * body.quantity, 2),
        "square_payment_id": f"MOCK_SQ_{uuid.uuid4().hex[:16].upper()}",
        "status": "confirmed",
        "date": iso(now_utc()),
    }
    await db.orders.insert_one(order)
    await db.products.update_one({"product_id": body.product_id}, {"$inc": {"stock": -body.quantity}})
    order.pop("_id", None)
    return {"ok": True, "order": order, "message": "Commande confirmée (paiement Square simulé)"}


@api_router.get("/orders/me")
async def my_orders(authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    return await db.orders.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1).to_list(1000)


# ============================================================
# News feed (aggregated)
# ============================================================
@api_router.get("/news")
async def list_news():
    return await db.news.find({}, {"_id": 0}).sort("date", -1).to_list(50)


# ============================================================
# Admin stats
# ============================================================
@api_router.get("/admin/stats")
async def admin_stats(authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin requis")
    return {
        "users": await db.users.count_documents({}),
        "tickets_sold": await db.tickets.count_documents({}),
        "orders": await db.orders.count_documents({}),
        "episodes": await db.episodes.count_documents({}),
        "wrestlers": await db.wrestlers.count_documents({}),
        "events": await db.events.count_documents({}),
    }


# ============================================================
# Admin — Image Management (Supabase Storage + MongoDB URL sync)
# ============================================================
async def _require_admin(authorization: Optional[str]) -> Dict[str, Any]:
    user = await require_user(authorization)
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin requis")
    return user


# Map resource type → (collection, id_field, image_field, bucket)
RESOURCE_MAP: Dict[str, Dict[str, str]] = {
    "wrestler":   {"col": "wrestlers",     "id_field": "wrestler_id",     "img_field": "photo",        "bucket": "roster"},
    "episode":    {"col": "episodes",      "id_field": "episode_id",      "img_field": "cover_image",  "bucket": "podcasts"},
    "event":      {"col": "events",        "id_field": "event_id",        "img_field": "poster",       "bucket": "shows"},
    "product":    {"col": "products",      "id_field": "product_id",      "img_field": "image",        "bucket": "marchandise"},
    "news":       {"col": "news",          "id_field": "news_id",         "img_field": "image",        "bucket": "nouvelles"},
    "home":       {"col": "home_sections", "id_field": "section_id",      "img_field": "image_url",    "bucket": "accueil"},
}


def _safe_ext(filename: str) -> str:
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Extension non autorisée. Utilisez: {', '.join(ALLOWED_EXT)}")
    return ext


def _validate_bucket(bucket: str) -> str:
    if bucket not in STORAGE_BUCKETS:
        raise HTTPException(400, f"Bucket inconnu. Choix: {sorted(STORAGE_BUCKETS)}")
    return bucket


@api_router.get("/admin/storage/buckets")
async def admin_list_buckets(authorization: Optional[str] = Header(None)):
    await _require_admin(authorization)
    require_storage()
    def _q():
        return _supabase.storage.list_buckets()
    buckets = await asyncio.to_thread(_q)
    return [{"name": b.name, "public": b.public} for b in buckets]


@api_router.get("/admin/storage/{bucket}")
async def admin_list_bucket_files(bucket: str, authorization: Optional[str] = Header(None)):
    await _require_admin(authorization)
    _validate_bucket(bucket)
    require_storage()
    def _q():
        return _supabase.storage.from_(bucket).list("", {"limit": 200, "sortBy": {"column": "created_at", "order": "desc"}})
    files = await asyncio.to_thread(_q)
    out = []
    for f in files or []:
        name = f.get("name") if isinstance(f, dict) else getattr(f, "name", None)
        if not name or name.startswith("."):
            continue
        out.append({"name": name, "url": storage_public_url(bucket, name)})
    return out


@api_router.post("/admin/upload")
async def admin_upload_image(
    bucket: str = Form(...),
    file: UploadFile = File(...),
    resource_type: Optional[str] = Form(None),
    resource_id: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None),
):
    """
    Upload an image to Supabase Storage.
    If resource_type + resource_id are provided, also update the matching MongoDB record's image field.
    """
    await _require_admin(authorization)
    require_storage()
    _validate_bucket(bucket)

    # Validate content type + size
    if file.content_type and file.content_type not in ALLOWED_MIME:
        raise HTTPException(400, f"Type MIME non autorisé: {file.content_type}")
    ext = _safe_ext(file.filename or "")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Fichier trop lourd (max 10 MB)")
    if len(data) == 0:
        raise HTTPException(400, "Fichier vide")

    # Store as: {resource_type or 'misc'}/{timestamp}_{uuid}.{ext}
    prefix = (resource_type or "misc").replace("/", "_")
    fname = f"{prefix}/{int(datetime.now(timezone.utc).timestamp())}_{uuid.uuid4().hex[:8]}{ext}"

    def _upload():
        return _supabase.storage.from_(bucket).upload(
            path=fname,
            file=data,
            file_options={"content-type": file.content_type or f"image/{ext.lstrip('.')}", "upsert": "false"},
        )
    try:
        await asyncio.to_thread(_upload)
    except Exception as e:
        raise HTTPException(500, f"Upload échec: {str(e)[:200]}")

    url = storage_public_url(bucket, fname)

    # Optionally attach URL to a resource
    if resource_type and resource_id:
        cfg = RESOURCE_MAP.get(resource_type)
        if not cfg:
            raise HTTPException(400, f"resource_type inconnu: {resource_type}")
        col = db[cfg["col"]]
        res = await col.update_one({cfg["id_field"]: resource_id}, {"$set": {cfg["img_field"]: url}})
        if res.matched_count == 0:
            raise HTTPException(404, f"{resource_type} `{resource_id}` introuvable")

    return {"ok": True, "url": url, "path": fname, "bucket": bucket}


@api_router.delete("/admin/storage/{bucket}/{path:path}")
async def admin_delete_image(
    bucket: str, path: str,
    authorization: Optional[str] = Header(None),
):
    await _require_admin(authorization)
    _validate_bucket(bucket)
    require_storage()

    def _rm():
        return _supabase.storage.from_(bucket).remove([path])
    try:
        await asyncio.to_thread(_rm)
    except Exception as e:
        raise HTTPException(500, f"Suppression échec: {str(e)[:200]}")

    # Also clear any resource that referenced this URL
    url = storage_public_url(bucket, path)
    for _rtype, cfg in RESOURCE_MAP.items():
        try:
            await db[cfg["col"]].update_many({cfg["img_field"]: url}, {"$set": {cfg["img_field"]: None}})
        except Exception:
            pass
    return {"ok": True}


class SetImageBody(BaseModel):
    resource_type: str
    resource_id: str
    url: Optional[str] = None  # None to clear


@api_router.patch("/admin/resource-image")
async def admin_set_resource_image(
    body: SetImageBody,
    authorization: Optional[str] = Header(None),
):
    """Attach an existing Storage URL (or clear) to a resource without re-uploading."""
    await _require_admin(authorization)
    cfg = RESOURCE_MAP.get(body.resource_type)
    if not cfg:
        raise HTTPException(400, f"resource_type inconnu: {body.resource_type}")
    res = await db[cfg["col"]].update_one(
        {cfg["id_field"]: body.resource_id},
        {"$set": {cfg["img_field"]: body.url}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Resource introuvable")
    return {"ok": True, "url": body.url}


@api_router.get("/admin/manageable")
async def admin_manageable(authorization: Optional[str] = Header(None)):
    """Return every editable resource with its current image URL (grouped for admin UI)."""
    await _require_admin(authorization)

    async def _list(col_name: str, id_field: str, img_field: str, label_field: str):
        docs = await db[col_name].find({}, {"_id": 0}).to_list(500)
        out = []
        for d in docs:
            out.append({
                "id": d.get(id_field),
                "label": d.get(label_field) or d.get(id_field),
                "url": d.get(img_field),
            })
        return out

    return {
        "roster":       await _list("wrestlers",     "wrestler_id",  "photo",       "name"),
        "podcasts":     await _list("episodes",      "episode_id",   "cover_image", "title"),
        "shows":        await _list("events",        "event_id",     "poster",      "name"),
        "marchandise":  await _list("products",      "product_id",   "image",       "name"),
        "nouvelles":    await _list("news",          "news_id",      "image",       "title"),
        "home":         await _list("home_sections", "section_id",   "image_url",   "title"),
    }


# ============================================================
# Home Sections — CMS-lite for the Accueil screen
# ============================================================
HOME_KEYS = ["banniere", "prochain_show", "dernieres_nouvelles", "roster", "dernier_podcast", "marchandise", "promotions"]


class HomeSectionBody(BaseModel):
    section_key: str
    title: Optional[str] = None
    subtitle: Optional[str] = None
    image_url: Optional[str] = None
    link: Optional[str] = None
    enabled: bool = True
    order: int = 0


@api_router.get("/home-sections")
async def list_home_sections():
    """Public — used by the Accueil screen. Returns enabled sections in order."""
    items = await db.home_sections.find({"enabled": True}, {"_id": 0}).sort("order", 1).to_list(50)
    return items


@api_router.get("/admin/home-sections")
async def admin_list_home_sections(authorization: Optional[str] = Header(None)):
    """Admin — ALL sections (enabled + disabled)."""
    await _require_admin(authorization)
    items = await db.home_sections.find({}, {"_id": 0}).sort("order", 1).to_list(50)
    return items


@api_router.post("/admin/home-sections")
async def admin_upsert_home_section(body: HomeSectionBody, authorization: Optional[str] = Header(None)):
    await _require_admin(authorization)
    if body.section_key not in HOME_KEYS:
        raise HTTPException(400, f"section_key doit être dans: {HOME_KEYS}")
    existing = await db.home_sections.find_one({"section_key": body.section_key}, {"_id": 0})
    if existing:
        await db.home_sections.update_one(
            {"section_key": body.section_key},
            {"$set": {**body.dict(), "updated_at": iso(now_utc())}},
        )
        section_id = existing["section_id"]
    else:
        section_id = make_id("hs")
        await db.home_sections.insert_one({
            "section_id": section_id,
            **body.dict(),
            "created_at": iso(now_utc()),
            "updated_at": iso(now_utc()),
        })
    doc = await db.home_sections.find_one({"section_id": section_id}, {"_id": 0})
    return doc


@api_router.delete("/admin/home-sections/{section_id}")
async def admin_delete_home_section(section_id: str, authorization: Optional[str] = Header(None)):
    await _require_admin(authorization)
    res = await db.home_sections.delete_one({"section_id": section_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Section introuvable")
    return {"ok": True}


@api_router.get("/admin/home-keys")
async def admin_home_keys(authorization: Optional[str] = Header(None)):
    await _require_admin(authorization)
    return {"keys": HOME_KEYS}





# ============================================================
# Seed data (Quebec wrestling flavor)
# ============================================================
@api_router.post("/seed")
async def seed_data():
    """Populates the DB with Quebec-flavored demo data. Idempotent."""

    # --- Admin user
    admin_email = "admin@lgdp.ca"
    admin = await db.users.find_one({"email": admin_email})
    if not admin:
        await db.users.insert_one({
            "user_id": make_id("user"),
            "email": admin_email,
            "name": "Admin LGDP",
            "password_hash": hash_pw("LgdpAdmin2026!"),
            "picture": None,
            "is_admin": True,
            "auth_provider": "password",
            "created_at": iso(now_utc()),
        })

    # --- Demo fan user
    fan_email = "fan@lgdp.ca"
    fan = await db.users.find_one({"email": fan_email})
    if not fan:
        await db.users.insert_one({
            "user_id": make_id("user"),
            "email": fan_email,
            "name": "Fan LGDP",
            "password_hash": hash_pw("Fan2026!"),
            "picture": None,
            "is_admin": False,
            "auth_provider": "password",
            "created_at": iso(now_utc()),
        })

    # --- Wrestlers
    wrestlers = [
        {
            "wrestler_id": "wr_marek",
            "name": "Marek « Le Boucher » Tremblay",
            "nickname": "Le Boucher de Hochelaga",
            "photo": "https://images.unsplash.com/photo-1563844528129-067e06a638e5?w=800&q=80",
            "bio": "Vétéran du circuit québécois, connu pour ses power slams dévastateurs et son attitude sans compromis.",
            "style": "Brutal",
            "wins": 42,
            "losses": 11,
        },
        {
            "wrestler_id": "wr_xavier",
            "name": "Xavier « Le Corbeau » Bélanger",
            "nickname": "Le Corbeau",
            "photo": "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=80",
            "bio": "High flyer aérien de Québec, spécialiste des sauts du haut de la troisième corde.",
            "style": "High Flyer",
            "wins": 28,
            "losses": 15,
        },
        {
            "wrestler_id": "wr_pierre",
            "name": "Pierre-Luc « Le Prof » Gagné",
            "nickname": "Le Prof",
            "photo": "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&q=80",
            "bio": "Technicien redoutable, ancien champion universitaire de lutte olympique.",
            "style": "Technique",
            "wins": 35,
            "losses": 9,
        },
        {
            "wrestler_id": "wr_johnny",
            "name": "Johnny « La Légende » Lavoie",
            "nickname": "La Légende du Plateau",
            "photo": "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80",
            "bio": "20 ans de carrière, trois fois champion LGDP. Le visage historique de la fédération.",
            "style": "Légende locale",
            "wins": 156,
            "losses": 47,
        },
        {
            "wrestler_id": "wr_sasha",
            "name": "Sasha « Tempête » Bouchard",
            "nickname": "La Tempête",
            "photo": "https://images.unsplash.com/photo-1594381898411-846e7d193883?w=800&q=80",
            "bio": "Championne poids lourd invaincue de la saison 2025-2026.",
            "style": "Brutal",
            "wins": 18,
            "losses": 0,
        },
        {
            "wrestler_id": "wr_dominic",
            "name": "Dominic « Le Kid » Roy",
            "nickname": "Le Kid",
            "photo": "https://images.unsplash.com/photo-1552196563-55cd4e45efb3?w=800&q=80",
            "bio": "Recrue de l'année, un futur champion. Style rapide et imprévisible.",
            "style": "High Flyer",
            "wins": 12,
            "losses": 4,
        },
    ]
    for w in wrestlers:
        await db.wrestlers.update_one({"wrestler_id": w["wrestler_id"]}, {"$set": w}, upsert=True)

    # --- Matches
    matches = [
        {
            "match_id": "mt_001",
            "wrestler_one": "Marek Tremblay",
            "wrestler_two": "Johnny Lavoie",
            "event": "LGDP LIVE — Hochelaga",
            "date": "2026-06-14T20:00:00Z",
            "winner": None,
            "match_type": "Championnat Poids Lourd",
            "status": "upcoming",
        },
        {
            "match_id": "mt_002",
            "wrestler_one": "Xavier Bélanger",
            "wrestler_two": "Dominic Roy",
            "event": "LGDP LIVE — Hochelaga",
            "date": "2026-06-14T21:00:00Z",
            "winner": None,
            "match_type": "Match aérien 1-vs-1",
            "status": "upcoming",
        },
        {
            "match_id": "mt_003",
            "wrestler_one": "Pierre-Luc Gagné",
            "wrestler_two": "Marek Tremblay",
            "event": "LGDP Fight Night 12",
            "date": "2026-05-01T20:00:00Z",
            "winner": "Marek Tremblay",
            "match_type": "Combat de qualification",
            "status": "completed",
        },
        {
            "match_id": "mt_004",
            "wrestler_one": "Sasha Bouchard",
            "wrestler_two": "Johnny Lavoie",
            "event": "LGDP Fight Night 12",
            "date": "2026-05-01T21:30:00Z",
            "winner": "Sasha Bouchard",
            "match_type": "Match sans DQ",
            "status": "completed",
        },
    ]
    for m in matches:
        await db.matches.update_one({"match_id": m["match_id"]}, {"$set": m}, upsert=True)

    # --- Championships
    championships = [
        {
            "championship_id": "ch_heavy",
            "title": "Championnat Poids Lourd LGDP",
            "current_holder": "Marek « Le Boucher » Tremblay",
            "image": "https://images.unsplash.com/photo-1544984243-ec57ea16fe25?w=800&q=80",
            "history": ["Johnny Lavoie (2021)", "Pierre-Luc Gagné (2023)", "Marek Tremblay (2025)"],
        },
        {
            "championship_id": "ch_junior",
            "title": "Championnat Junior LGDP",
            "current_holder": "Xavier « Le Corbeau » Bélanger",
            "image": "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=80",
            "history": ["Dominic Roy (2024)", "Xavier Bélanger (2025)"],
        },
        {
            "championship_id": "ch_tag",
            "title": "Championnat par Équipe LGDP",
            "current_holder": "Les Frères Bouchard",
            "image": "https://images.unsplash.com/photo-1594381898411-846e7d193883?w=800&q=80",
            "history": ["Les Cousins de Chicoutimi (2023)", "Les Frères Bouchard (2025)"],
        },
    ]
    for c in championships:
        await db.championships.update_one({"championship_id": c["championship_id"]}, {"$set": c}, upsert=True)

    # --- Podcast episodes (using public sample audio)
    episodes = [
        {
            "episode_id": "ep_045",
            "episode_number": 45,
            "title": "Le Boucher débarque en studio",
            "description": "Marek Tremblay nous parle de son parcours, de sa préparation pour le championnat et de sa haine légendaire envers Johnny Lavoie.",
            "cover_image": "https://images.unsplash.com/photo-1668537338628-85b9970bf17f?w=800&q=80",
            "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            "duration": 2745,
            "release_date": "2026-05-10T10:00:00Z",
        },
        {
            "episode_id": "ep_044",
            "episode_number": 44,
            "title": "Post-mortem Fight Night 12",
            "description": "On revient sur le shocker: Sasha Bouchard démolit Johnny Lavoie. Les gars analysent match par match.",
            "cover_image": "https://images.unsplash.com/photo-1590602846989-a05e4e7c9c67?w=800&q=80",
            "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
            "duration": 3120,
            "release_date": "2026-05-03T10:00:00Z",
        },
        {
            "episode_id": "ep_043",
            "episode_number": 43,
            "title": "Le futur de la lutte au Québec",
            "description": "Table ronde avec les recrues LGDP. Où s'en va la lutte pro au Québec en 2026?",
            "cover_image": "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&q=80",
            "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
            "duration": 2580,
            "release_date": "2026-04-26T10:00:00Z",
        },
        {
            "episode_id": "ep_042",
            "episode_number": 42,
            "title": "Johnny Lavoie: 20 ans de lutte",
            "description": "Entrevue exclusive avec la Légende. Ses combats mythiques, ses regrets, l'avenir.",
            "cover_image": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
            "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
            "duration": 3600,
            "release_date": "2026-04-19T10:00:00Z",
        },
        {
            "episode_id": "ep_041",
            "episode_number": 41,
            "title": "Bar room brawl à Chicoutimi",
            "description": "Chaos total lors du dernier show. Les gars racontent ce qui s'est passé en coulisses.",
            "cover_image": "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&q=80",
            "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
            "duration": 2200,
            "release_date": "2026-04-12T10:00:00Z",
        },
    ]
    for e in episodes:
        await db.episodes.update_one({"episode_id": e["episode_id"]}, {"$set": e}, upsert=True)

    # --- Events
    events = [
        {
            "event_id": "ev_hoch",
            "name": "LGDP LIVE — Hochelaga",
            "date": "2026-06-14T20:00:00Z",
            "location": "Aréna Maurice-Richard, Montréal",
            "description": "Le retour du Boucher! Championnat Poids Lourd en jeu. Six matchs, une soirée explosive dans le fief de Hochelaga.",
            "poster": "https://images.unsplash.com/photo-1515175192010-cf3250992719?w=1200&q=80",
            "capacity": 1200,
            "price": 45.0,
        },
        {
            "event_id": "ev_qc",
            "name": "LGDP LIVE — Québec",
            "date": "2026-07-19T20:00:00Z",
            "location": "Centre Vidéotron, Québec",
            "description": "Première invasion LGDP à Québec. Un carnage annoncé.",
            "poster": "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1200&q=80",
            "capacity": 3500,
            "price": 55.0,
        },
        {
            "event_id": "ev_chi",
            "name": "LGDP LIVE — Chicoutimi",
            "date": "2026-08-23T19:30:00Z",
            "location": "Aréna Roland-Beaulieu, Chicoutimi",
            "description": "La revanche des Frères Bouchard sur leur territoire.",
            "poster": "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=1200&q=80",
            "capacity": 800,
            "price": 35.0,
        },
    ]
    for e in events:
        await db.events.update_one({"event_id": e["event_id"]}, {"$set": e}, upsert=True)

    # --- Products
    products = [
        {
            "product_id": "pr_tshirt1",
            "name": "T-Shirt LGDP Classique",
            "description": "Le t-shirt officiel LGDP. Coton 100%, sérigraphie premium. Fabriqué au Québec.",
            "price": 34.99,
            "image": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80",
            "stock": 50,
            "category": "vetements",
        },
        {
            "product_id": "pr_cap1",
            "name": "Casquette Rouge LGDP",
            "description": "Casquette snapback rouge intense avec logo brodé or.",
            "price": 29.99,
            "image": "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80",
            "stock": 35,
            "category": "accessoires",
        },
        {
            "product_id": "pr_hoodie1",
            "name": "Hoodie « Le Boucher »",
            "description": "Hoodie noir édition Marek Tremblay. Doublure sherpa, poche kangourou.",
            "price": 74.99,
            "image": "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80",
            "stock": 20,
            "category": "vetements",
        },
        {
            "product_id": "pr_poster1",
            "name": "Affiche LGDP LIVE Hochelaga",
            "description": "Affiche collector de l'événement. Impression grand format 45x60cm.",
            "price": 19.99,
            "image": "https://images.unsplash.com/photo-1533158326339-7f3cf2404354?w=800&q=80",
            "stock": 100,
            "category": "collectors",
        },
        {
            "product_id": "pr_belt1",
            "name": "Mini Ceinture Championnat LGDP",
            "description": "Réplique mini de la ceinture Championnat Poids Lourd LGDP. Métal + cuir.",
            "price": 149.99,
            "image": "https://images.unsplash.com/photo-1544984243-ec57ea16fe25?w=800&q=80",
            "stock": 12,
            "category": "collectors",
        },
        {
            "product_id": "pr_tuque",
            "name": "Tuque LGDP Hiver",
            "description": "Tuque tricotée noire avec pompon rouge. Chaude, québécoise, fière.",
            "price": 24.99,
            "image": "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&q=80",
            "stock": 40,
            "category": "accessoires",
        },
    ]
    for p in products:
        await db.products.update_one({"product_id": p["product_id"]}, {"$set": p}, upsert=True)

    # --- News
    news_items = [
        {
            "news_id": "n_001",
            "title": "Marek Tremblay défie Johnny Lavoie pour le titre",
            "description": "Le Boucher lance le gant à la Légende pour LGDP LIVE Hochelaga. Un choc générationnel en juin.",
            "image": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80",
            "category": "annonce",
            "date": "2026-05-11T09:00:00Z",
        },
        {
            "news_id": "n_002",
            "title": "Sasha Bouchard toujours invaincue",
            "description": "18-0. La Tempête continue de tout ravager sur son passage. Qui pour l'arrêter?",
            "image": "https://images.unsplash.com/photo-1594381898411-846e7d193883?w=1200&q=80",
            "category": "resultat",
            "date": "2026-05-02T22:30:00Z",
        },
        {
            "news_id": "n_003",
            "title": "Épisode 45: Le Boucher au micro",
            "description": "Nouveau podcast disponible. Marek Tremblay se livre sans filtre.",
            "image": "https://images.unsplash.com/photo-1668537338628-85b9970bf17f?w=1200&q=80",
            "category": "podcast",
            "date": "2026-05-10T10:00:00Z",
        },
        {
            "news_id": "n_004",
            "title": "Billets LGDP LIVE Québec en vente",
            "description": "Première invasion à Québec le 19 juillet. Les billets partent vite.",
            "image": "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1200&q=80",
            "category": "billetterie",
            "date": "2026-05-08T12:00:00Z",
        },
    ]
    for n in news_items:
        await db.news.update_one({"news_id": n["news_id"]}, {"$set": n}, upsert=True)

    # --- Home Sections (defaults — all enabled, ordered)
    default_home = [
        {"section_key": "banniere",             "title": "LGDP LIVE",              "subtitle": "LE PODCAST QUI FRAPPE PLUS FORT", "order": 0, "enabled": True},
        {"section_key": "dernieres_nouvelles",  "title": "Nouvelles",              "subtitle": None, "order": 1, "enabled": True},
        {"section_key": "prochain_show",        "title": "Événements à venir",     "subtitle": None, "order": 2, "enabled": True},
        {"section_key": "dernier_podcast",      "title": "Dernier podcast",        "subtitle": None, "order": 3, "enabled": True},
        {"section_key": "roster",               "title": "Roster LGDP",            "subtitle": "Les durs de la fédération", "order": 4, "enabled": True},
        {"section_key": "marchandise",          "title": "Boutique",               "subtitle": "Le stuff des vrais fans", "order": 5, "enabled": True},
        {"section_key": "promotions",           "title": "Promotions",             "subtitle": None, "order": 6, "enabled": False},
    ]
    for h in default_home:
        existing = await db.home_sections.find_one({"section_key": h["section_key"]}, {"_id": 0})
        if not existing:
            await db.home_sections.insert_one({
                "section_id": make_id("hs"),
                **h,
                "image_url": None,
                "link": None,
                "created_at": iso(now_utc()),
                "updated_at": iso(now_utc()),
            })

    return {
        "ok": True,
        "seeded": {
            "wrestlers": len(wrestlers),
            "matches": len(matches),
            "championships": len(championships),
            "episodes": len(episodes),
            "events": len(events),
            "products": len(products),
            "news": len(news_items),
            "home_sections": len(default_home),
        },
    }


# ============================================================
# Mount router + CORS + startup indexes
# ============================================================
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.wrestlers.create_index("wrestler_id", unique=True)
        await db.episodes.create_index("episode_id", unique=True)
        await db.events.create_index("event_id", unique=True)
        await db.products.create_index("product_id", unique=True)
        # Auto-seed on first launch
        wcount = await db.wrestlers.count_documents({})
        if wcount == 0:
            logger.info("Empty DB detected, auto-seeding demo data...")
            await seed_data()
        else:
            # Ensure home_sections defaults exist even if wrestlers were already seeded
            hs_count = await db.home_sections.count_documents({})
            if hs_count == 0:
                logger.info("home_sections empty — seeding defaults...")
                await seed_data()
    except Exception as e:
        logger.warning(f"Startup init failed: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
