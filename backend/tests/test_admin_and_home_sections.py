"""LGDP — Tests for admin auth-gated flows, Supabase Storage upload,
and home_sections CMS (dynamic Accueil rendering).

Notes:
- Uses public preview URL (must match what user sees).
- File uploads use a tiny valid PNG (1x1) built in-memory.
"""
import io
import os
import struct
import time
import zlib

import pytest
import requests


BASE_URL = "https://lgdp-app.preview.emergentagent.com/api"
ADMIN = {"email": "admin@lgdp.ca", "password": "LgdpAdmin2026!"}
FAN = {"email": "fan@lgdp.ca", "password": "Fan2026!"}

EXPECTED_BUCKETS = {"shows", "roster", "nouvelles", "podcasts", "marchandise", "accueil"}
DEFAULT_ENABLED_KEYS = {
    "banniere",
    "dernieres_nouvelles",
    "prochain_show",
    "dernier_podcast",
    "roster",
    "marchandise",
}
ALL_HOME_KEYS = DEFAULT_ENABLED_KEYS | {"promotions"}


# ---------- helpers ----------
def _tiny_png_bytes() -> bytes:
    """Build a minimal 1x1 red PNG in-memory (no external deps)."""
    sig = b"\x89PNG\r\n\x1a\n"

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))

    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))  # 1x1, 8bit, RGB
    raw = b"\x00" + b"\xff\x00\x00"  # filter=0 + 1px red
    idat = chunk(b"IDAT", zlib.compress(raw))
    iend = chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    return sess


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{BASE_URL}/auth/login", json=ADMIN)
    assert r.status_code == 200, f"admin login: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"no admin token: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def fan_token(s):
    r = s.post(f"{BASE_URL}/auth/login", json=FAN)
    assert r.status_code == 200, f"fan login: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"no fan token: {r.json()}"
    return tok


@pytest.fixture
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def fan_h(fan_token):
    return {"Authorization": f"Bearer {fan_token}"}


# ==============================
# home_sections — public / seed
# ==============================
class TestHomeSectionsPublicSeed:
    def test_public_home_sections_returns_default_enabled(self, s):
        r = s.get(f"{BASE_URL}/home-sections")
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        keys = {i["section_key"] for i in items}
        # All 6 default enabled sections must be present
        missing = DEFAULT_ENABLED_KEYS - keys
        assert not missing, f"missing default enabled home sections: {missing}"
        # promotions should NOT be public by default (disabled unless a previous test toggled)
        # We only assert the enabled sections are here; promotions may or may not depending on prior runs.

    def test_public_home_sections_are_sorted_by_order_asc(self, s):
        r = s.get(f"{BASE_URL}/home-sections")
        assert r.status_code == 200
        orders = [i.get("order", 0) for i in r.json()]
        assert orders == sorted(orders), f"not sorted by order asc: {orders}"


# ==============================
# Admin auth guard
# ==============================
class TestAdminAuthGuard:
    def test_admin_manageable_requires_token(self, s):
        r = s.get(f"{BASE_URL}/admin/manageable")
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_admin_home_sections_requires_token(self, s):
        r = s.get(f"{BASE_URL}/admin/home-sections")
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_admin_manageable_forbidden_for_fan(self, s, fan_h):
        r = s.get(f"{BASE_URL}/admin/manageable", headers=fan_h)
        assert r.status_code == 403, f"fan should be 403 got {r.status_code} {r.text}"

    def test_admin_home_sections_forbidden_for_fan(self, s, fan_h):
        r = s.get(f"{BASE_URL}/admin/home-sections", headers=fan_h)
        assert r.status_code == 403, f"fan should be 403 got {r.status_code} {r.text}"

    def test_admin_manageable_ok_for_admin(self, s, admin_h):
        r = s.get(f"{BASE_URL}/admin/manageable", headers=admin_h)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["roster", "podcasts", "shows", "marchandise", "nouvelles", "home"]:
            assert k in data, f"missing group {k} in manageable"
            assert isinstance(data[k], list)

    def test_admin_home_sections_returns_all_including_disabled(self, s, admin_h):
        r = s.get(f"{BASE_URL}/admin/home-sections", headers=admin_h)
        assert r.status_code == 200, r.text
        keys = {i["section_key"] for i in r.json()}
        missing = ALL_HOME_KEYS - keys
        assert not missing, f"admin list missing {missing}"


# ==============================
# Storage buckets
# ==============================
class TestStorageBuckets:
    def test_buckets_endpoint_returns_expected_buckets(self, s, admin_h):
        r = s.get(f"{BASE_URL}/admin/storage/buckets", headers=admin_h)
        assert r.status_code == 200, r.text
        got = {b["name"] for b in r.json()}
        missing = EXPECTED_BUCKETS - got
        assert not missing, f"missing buckets: {missing}. got={got}"


# ==============================
# Image upload — Supabase live
# ==============================
class TestAdminUpload:
    def test_upload_to_accueil_returns_public_url_and_reachable(self, s, admin_token):
        png = _tiny_png_bytes()
        files = {"file": ("TEST_upload.png", png, "image/png")}
        data = {"bucket": "accueil"}
        r = requests.post(
            f"{BASE_URL}/admin/upload",
            headers={"Authorization": f"Bearer {admin_token}"},
            data=data,
            files=files,
            timeout=30,
        )
        assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("ok") is True
        assert body.get("bucket") == "accueil"
        assert body.get("path"), "no path in upload response"
        url = body.get("url")
        assert url and url.startswith("http"), f"bad url: {url}"
        assert "/storage/v1/object/public/accueil/" in url, f"url shape unexpected: {url}"

        # Public reachability
        head = requests.get(url, timeout=15)
        assert head.status_code == 200, f"public url not reachable: {head.status_code} {url}"
        ctype = head.headers.get("content-type", "")
        assert ctype.startswith("image/"), f"unexpected content-type: {ctype}"

    def test_upload_and_attach_to_wrestler(self, s, admin_token):
        png = _tiny_png_bytes()
        files = {"file": ("TEST_marek.png", png, "image/png")}
        data = {
            "bucket": "roster",
            "resource_type": "wrestler",
            "resource_id": "wr_marek",
        }
        r = requests.post(
            f"{BASE_URL}/admin/upload",
            headers={"Authorization": f"Bearer {admin_token}"},
            data=data,
            files=files,
            timeout=30,
        )
        assert r.status_code == 200, f"attach upload failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("ok") is True
        new_url = body.get("url")
        assert new_url

        # Verify DB updated via public GET /wrestlers
        r2 = s.get(f"{BASE_URL}/wrestlers")
        assert r2.status_code == 200
        marek = next(
            (w for w in r2.json()
             if (w.get("wrestler_id") == "wr_marek" or w.get("id") == "wr_marek")),
            None,
        )
        assert marek, "wr_marek not found in /wrestlers"
        assert marek.get("photo") == new_url, f"photo not updated. got={marek.get('photo')}"

    def test_upload_rejects_fan(self, s, fan_token):
        png = _tiny_png_bytes()
        files = {"file": ("TEST_fan.png", png, "image/png")}
        r = requests.post(
            f"{BASE_URL}/admin/upload",
            headers={"Authorization": f"Bearer {fan_token}"},
            data={"bucket": "accueil"},
            files=files,
            timeout=30,
        )
        assert r.status_code == 403, f"fan upload should be 403, got {r.status_code}"


# ==============================
# home_sections CMS CRUD
# ==============================
class TestHomeSectionsCMS:
    def test_upsert_promotions_toggle_visibility(self, s, admin_h):
        # Enable promotions
        payload = {
            "section_key": "promotions",
            "enabled": True,
            "title": "TEST promo",
            "subtitle": "TEST subtitle",
            "order": 6,
        }
        r = s.post(f"{BASE_URL}/admin/home-sections", headers=admin_h, json=payload)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc.get("section_key") == "promotions"
        assert doc.get("enabled") is True
        assert doc.get("title") == "TEST promo"

        # Public list must include promotions now
        r2 = s.get(f"{BASE_URL}/home-sections")
        assert r2.status_code == 200
        keys = {i["section_key"] for i in r2.json()}
        assert "promotions" in keys, "promotions not visible after enabling"

        # Disable it
        payload["enabled"] = False
        r3 = s.post(f"{BASE_URL}/admin/home-sections", headers=admin_h, json=payload)
        assert r3.status_code == 200
        assert r3.json().get("enabled") is False

        # Should disappear from public list
        r4 = s.get(f"{BASE_URL}/home-sections")
        keys4 = {i["section_key"] for i in r4.json()}
        assert "promotions" not in keys4, "promotions still visible after disabling"

    def test_invalid_section_key_rejected(self, s, admin_h):
        r = s.post(
            f"{BASE_URL}/admin/home-sections",
            headers=admin_h,
            json={"section_key": "foo_invalid", "enabled": True, "order": 99},
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"

    def test_admin_home_keys_lists_seven_keys(self, s, admin_h):
        r = s.get(f"{BASE_URL}/admin/home-keys", headers=admin_h)
        assert r.status_code == 200, r.text
        keys = set(r.json().get("keys", []))
        assert keys == ALL_HOME_KEYS, f"home-keys mismatch: {keys}"
