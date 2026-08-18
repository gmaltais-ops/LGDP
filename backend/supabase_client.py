"""
LGDP — Supabase client wrapper (READY TO ACTIVATE).

Activation steps (once user provides credentials):
1. Run /app/backend/supabase_schema.sql in Supabase SQL Editor.
2. Add to /app/backend/.env:
     SUPABASE_URL=https://xxx.supabase.co
     SUPABASE_SERVICE_ROLE_KEY=eyJ...
     USE_SUPABASE=true
3. Restart backend: `sudo supervisorctl restart backend`
4. The server will call seed_supabase() automatically if tables are empty.

This module is NOT imported by server.py yet — the current MVP still uses MongoDB.
When you flip USE_SUPABASE=true, server.py will detect and swap the datastore
via db_layer.py (also included).
"""

import os
import asyncio
from functools import lru_cache
from typing import Any, Callable, TypeVar

T = TypeVar("T")

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None  # type: ignore
    Client = None  # type: ignore


def supabase_enabled() -> bool:
    return (
        os.environ.get("USE_SUPABASE", "").lower() in ("1", "true", "yes")
        and bool(os.environ.get("SUPABASE_URL"))
        and bool(os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))
        and create_client is not None
    )


@lru_cache(maxsize=1)
def get_supabase() -> "Client":
    if create_client is None:
        raise RuntimeError("supabase-py not installed. `pip install supabase`.")
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
    return create_client(url, key)


async def db_call(fn: Callable[[], T]) -> T:
    """Run a blocking supabase-py call in a worker thread."""
    return await asyncio.to_thread(fn)


# ---------- Convenience CRUD helpers (used by db_layer once activated) ----------
async def sb_select(table: str, filters: dict[str, Any] | None = None, order: tuple[str, bool] | None = None, limit: int | None = None) -> list[dict]:
    def _q():
        q = get_supabase().table(table).select("*")
        if filters:
            for k, v in filters.items():
                q = q.eq(k, v)
        if order:
            col, desc = order
            q = q.order(col, desc=desc)
        if limit:
            q = q.limit(limit)
        return q.execute()
    r = await db_call(_q)
    return r.data or []


async def sb_get_one(table: str, filters: dict[str, Any]) -> dict | None:
    def _q():
        q = get_supabase().table(table).select("*")
        for k, v in filters.items():
            q = q.eq(k, v)
        return q.limit(1).execute()
    r = await db_call(_q)
    return (r.data or [None])[0]


async def sb_insert(table: str, doc: dict) -> dict:
    r = await db_call(lambda: get_supabase().table(table).insert(doc).execute())
    return (r.data or [doc])[0]


async def sb_upsert(table: str, doc: dict, on_conflict: str) -> dict:
    r = await db_call(lambda: get_supabase().table(table).upsert(doc, on_conflict=on_conflict).execute())
    return (r.data or [doc])[0]


async def sb_update(table: str, filters: dict, patch: dict) -> None:
    def _q():
        q = get_supabase().table(table).update(patch)
        for k, v in filters.items():
            q = q.eq(k, v)
        return q.execute()
    await db_call(_q)


async def sb_delete(table: str, filters: dict) -> None:
    def _q():
        q = get_supabase().table(table).delete()
        for k, v in filters.items():
            q = q.eq(k, v)
        return q.execute()
    await db_call(_q)


async def sb_count(table: str) -> int:
    def _q():
        return get_supabase().table(table).select("*", count="exact").limit(1).execute()
    r = await db_call(_q)
    return getattr(r, "count", 0) or 0
