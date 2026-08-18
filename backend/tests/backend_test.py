"""LGDP backend regression tests."""
import os
import uuid
import pytest
import requests

BASE_URL = "https://lgdp-app.preview.emergentagent.com/api"
FAN = {"email": "fan@lgdp.ca", "password": "Fan2026!"}


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def fan_token(client):
    r = client.post(f"{BASE_URL}/auth/login", json=FAN)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token") or data.get("session_token")
    assert tok, f"no token in response: {data}"
    return tok


@pytest.fixture(scope="session")
def auth_headers(fan_token):
    return {"Authorization": f"Bearer {fan_token}", "Content-Type": "application/json"}


# --------- Public / catalog endpoints ---------
@pytest.mark.parametrize("path", [
    "/", "/wrestlers", "/matches", "/championships",
    "/episodes", "/events", "/products", "/news",
])
def test_public_endpoints(client, path):
    r = client.get(f"{BASE_URL}{path}")
    assert r.status_code == 200, f"{path} -> {r.status_code}"
    if path != "/":
        assert isinstance(r.json(), list)


def test_seed_collections_populated(client):
    for path in ["/wrestlers", "/episodes", "/events", "/products", "/news", "/matches", "/championships"]:
        r = client.get(f"{BASE_URL}{path}")
        data = r.json()
        assert len(data) > 0, f"{path} empty - seed missing"


def test_episode_detail(client):
    eps = client.get(f"{BASE_URL}/episodes").json()
    ep_id = eps[0].get("id") or eps[0].get("_id")
    r = client.get(f"{BASE_URL}/episodes/{ep_id}")
    assert r.status_code == 200
    assert r.json().get("id") == ep_id or r.json().get("_id") == ep_id


def test_event_detail(client):
    events = client.get(f"{BASE_URL}/events").json()
    ev_id = events[0].get("id") or events[0].get("_id")
    r = client.get(f"{BASE_URL}/events/{ev_id}")
    assert r.status_code == 200


# --------- Auth ---------
def test_register_new_user(client):
    email = f"TEST_{uuid.uuid4().hex[:8]}@lgdp.ca"
    r = client.post(f"{BASE_URL}/auth/register", json={
        "email": email, "password": "TestPass123!", "name": "Test User"
    })
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"no token: {data}"


def test_login_fan(client):
    r = client.post(f"{BASE_URL}/auth/login", json=FAN)
    assert r.status_code == 200
    data = r.json()
    assert data.get("token") or data.get("access_token")


def test_auth_me(client, auth_headers):
    r = client.get(f"{BASE_URL}/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json().get("email") == FAN["email"]


def test_auth_logout(client, auth_headers):
    r = client.post(f"{BASE_URL}/auth/logout", headers=auth_headers)
    assert r.status_code in (200, 204)


# --------- Tickets ---------
def test_ticket_purchase_and_list(client, auth_headers):
    events = client.get(f"{BASE_URL}/events").json()
    ev_id = events[0].get("id") or events[0].get("_id")
    payload = {"event_id": ev_id, "quantity": 2, "tier": "General",
               "unit_price": 25.0, "payment_nonce": "cnon:test"}
    r = client.post(f"{BASE_URL}/tickets/purchase", headers=auth_headers, json=payload)
    if r.status_code not in (200, 201):
        # Try minimal payload
        r = client.post(f"{BASE_URL}/tickets/purchase", headers=auth_headers,
                        json={"event_id": ev_id, "quantity": 1})
    assert r.status_code in (200, 201), f"ticket purchase: {r.status_code} {r.text}"
    body = r.json()
    pid = str(body.get("payment_id", "")) + str(body)
    assert "MOCK_SQ_" in pid or body.get("status") in ("paid", "success", "confirmed"), f"unexpected: {body}"

    r2 = client.get(f"{BASE_URL}/tickets/me", headers=auth_headers)
    assert r2.status_code == 200
    assert isinstance(r2.json(), list)
    assert len(r2.json()) > 0


# --------- Orders ---------
def test_order_creation_and_list(client, auth_headers):
    products = client.get(f"{BASE_URL}/products").json()
    prod = products[0]
    pid = prod.get("id") or prod.get("_id")
    price = prod.get("price", 25.0)
    payload = {"items": [{"product_id": pid, "quantity": 1, "unit_price": price,
                          "size": (prod.get("sizes") or [None])[0]}],
               "payment_nonce": "cnon:test", "shipping_address": "123 Rue, Montreal"}
    r = client.post(f"{BASE_URL}/orders", headers=auth_headers, json=payload)
    assert r.status_code in (200, 201), f"order: {r.status_code} {r.text}"

    r2 = client.get(f"{BASE_URL}/orders/me", headers=auth_headers)
    assert r2.status_code == 200
    assert isinstance(r2.json(), list)


# --------- Favorites ---------
def test_favorites_toggle(client, auth_headers):
    eps = client.get(f"{BASE_URL}/episodes").json()
    ep_id = eps[0].get("id") or eps[0].get("_id")
    r = client.post(f"{BASE_URL}/favorites/toggle", headers=auth_headers,
                    json={"episode_id": ep_id})
    assert r.status_code in (200, 201), f"favorite toggle: {r.status_code} {r.text}"

    r2 = client.get(f"{BASE_URL}/favorites", headers=auth_headers)
    assert r2.status_code == 200
    assert isinstance(r2.json(), list)
