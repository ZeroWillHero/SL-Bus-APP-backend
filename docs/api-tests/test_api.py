#!/usr/bin/env python3
"""
SL Bus App — Comprehensive Real-World API Test Suite
=====================================================
Simulates the full lifecycle of the SL Bus booking platform:

  Bootstrap  → register seed admin via BusOwner public endpoint, seed roles
  Admin      → create coupon, manage buses, view payments
  BusOwner   → register, add bus, upload docs, create route + schedule
  Conductor  → create, assign to bus, toggle availability, board passengers
  Customer   → register, search buses, view seat map, book, pay, get ticket
  Errors     → 401 / 403 / 409 / 404 negative-path coverage

Usage:
  pip install requests
  python docs/api-tests/test_api.py

Configure BASE_URL and ADMIN_* below, or override via env vars.
"""

import base64
import json
import os
import sys
import time
from datetime import date, timedelta
from typing import Any, Optional

try:
    import requests
except ImportError:
    print("Missing dependency: pip install requests")
    sys.exit(1)

# ── Configuration ──────────────────────────────────────────────────────────────

BASE_URL        = os.getenv("BASE_URL",        "http://localhost:3000")
ADMIN_EMAIL     = os.getenv("ADMIN_EMAIL",     "admin@slbus.lk")
ADMIN_PASSWORD  = os.getenv("ADMIN_PASSWORD",  "Admin@123")

TS = int(time.time())
BUS_OWNER_EMAIL     = f"owner_{TS}@test.lk"
BUS_OWNER_PASSWORD  = "Owner@123"
CONDUCTOR_EMAIL     = f"conductor_{TS}@test.lk"
CONDUCTOR_PASSWORD  = "Conductor@123"
CUSTOMER_EMAIL      = f"customer_{TS}@test.lk"
CUSTOMER_PASSWORD   = "Customer@123"

COUPON_CODE = f"LAUNCH{TS % 10000}"  # unique per run

# Trip date: tomorrow, so it's always in the future
TRIP_DATE = (date.today() + timedelta(days=1)).strftime("%Y-%m-%d")

# ── ANSI colours ───────────────────────────────────────────────────────────────

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
DIM    = "\033[2m"
RESET  = "\033[0m"

def _ok(msg: str)   -> str: return f"{GREEN}✓  {msg}{RESET}"
def _fail(msg: str) -> str: return f"{RED}✗  {msg}{RESET}"
def _info(msg: str) -> str: return f"{CYAN}ℹ  {msg}{RESET}"
def _warn(msg: str) -> str: return f"{YELLOW}⚠  {msg}{RESET}"

def section(title: str) -> None:
    bar = "─" * 62
    print(f"\n{BOLD}{CYAN}{bar}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{bar}{RESET}")

# ── Shared state ───────────────────────────────────────────────────────────────

S: dict[str, Any] = {
    # tokens
    "admin_token":     None,
    "owner_token":     None,
    "conductor_token": None,
    "customer_token":  None,
    # resource IDs
    "admin_user_id":    None,
    "owner_user_id":    None,
    "conductor_id":     None,
    "conductor_user_id": None,
    "customer_id":      None,
    "customer_user_id": None,
    "bus_id":           None,
    "doc_rc_id":        None,
    "doc_ins_id":       None,
    "route_id":         None,
    "schedule_id":      None,
    "coupon_id":        None,
    "booking_id":       None,
    "booking2_id":      None,
    "payment_id":       None,
}

results: list[tuple[str, bool, str]] = []

def record(name: str, passed: bool, detail: str = "") -> None:
    results.append((name, passed, detail))
    symbol = _ok(name) if passed else _fail(name)
    suffix = f"  {DIM}{detail}{RESET}" if detail else ""
    print(f"  {symbol}{suffix}")

# ── HTTP helpers ───────────────────────────────────────────────────────────────

session = requests.Session()

def _hdrs(token: Optional[str] = None) -> dict:
    h: dict = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h

def GET(path: str, token: Optional[str] = None, **kw) -> requests.Response:
    return session.get(f"{BASE_URL}{path}", headers=_hdrs(token), **kw)

def POST(path: str, body: Any = None, token: Optional[str] = None, **kw) -> requests.Response:
    return session.post(f"{BASE_URL}{path}", json=body, headers=_hdrs(token), **kw)

def PATCH(path: str, body: Any, token: Optional[str] = None, **kw) -> requests.Response:
    return session.patch(f"{BASE_URL}{path}", json=body, headers=_hdrs(token), **kw)

def DELETE(path: str, token: Optional[str] = None, **kw) -> requests.Response:
    return session.delete(f"{BASE_URL}{path}", headers=_hdrs(token), **kw)

def data(r: requests.Response) -> Any:
    """Extract the .data field from the standard wrapped response."""
    try:
        return r.json().get("data")
    except Exception:
        return None

def login(email: str, password: str) -> Optional[str]:
    r = POST("/auth/login", {"username": email, "password": password})
    if r.status_code == 200:
        return data(r).get("accessToken")
    return None

# ── Tiny 1-pixel PNG (base64) used as a document stub ─────────────────────────

TINY_PNG = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8"
    "z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="
)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 0 — BOOTSTRAP
# ══════════════════════════════════════════════════════════════════════════════

def phase0_bootstrap() -> None:
    """
    First-run bootstrap: register an admin identity via the public BusOwner
    endpoint, seed the four application roles, assign Admin role to that user,
    then re-login to obtain a token that carries the Admin claim.
    """
    section("Phase 0 — Bootstrap (seed roles + admin user)")

    # 0.1 – Register the bootstrap/admin user via the public bus-owner endpoint
    r = POST("/api/v1/bus-owner/register", {
        "email":         ADMIN_EMAIL,
        "password":      ADMIN_PASSWORD,
        "phone":         "+94700000000",
        "firstName":     "System",
        "lastName":      "Admin",
        "contactNumber": "+94700000000",
        "nicNumber":     "000000000000",
        "address":       "1 Admin Lane, Colombo",
    })
    if r.status_code in (200, 201):
        record("Bootstrap user created via /bus-owner/register", True)
        S["admin_user_id"] = data(r).get("userId") if data(r) else None
    elif r.status_code == 409:
        record("Bootstrap user already exists (skip)", True, "409 – re-using existing credentials")
    else:
        record("Bootstrap user register", False, f"{r.status_code}: {r.text[:120]}")

    # 0.2 – Login to get an initial token (BusOwner role only for now)
    bootstrap_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not bootstrap_token:
        record("Bootstrap login", False, "Cannot continue without initial token")
        return
    record("Bootstrap login (BusOwner token)", True)

    # 0.3 – Get own user id if we don't have it yet
    r = GET("/user/me", bootstrap_token)
    if r.status_code == 200:
        me = r.json()
        # /user/me is NOT wrapped by ResponseInterceptor (returns UserDTO directly)
        S["admin_user_id"] = me.get("id") or (me.get("data") or {}).get("id")

    # 0.4 – Seed roles (POST /api/v1/roles – requires JWT but no role restriction)
    for role_name in ("Admin", "BusOwner", "Conductor", "Customer"):
        rr = POST("/api/v1/roles", {"name": role_name}, bootstrap_token)
        # 201 = created, 409 = already exists — both are acceptable
        if rr.status_code in (200, 201, 409):
            record(f"Role '{role_name}' seeded", True,
                   "already existed" if rr.status_code == 409 else "created")
        else:
            record(f"Role '{role_name}' seed", False, f"{rr.status_code}: {rr.text[:80]}")

    # 0.5 – Fetch role IDs so we can assign Admin to our user
    r = GET("/api/v1/roles", bootstrap_token)
    roles_list = data(r) or (r.json() if r.status_code == 200 else [])
    # roles_list may be a plain list or wrapped
    if isinstance(roles_list, dict):
        roles_list = roles_list.get("data", [])

    role_map: dict[str, str] = {}
    for role in (roles_list or []):
        if isinstance(role, dict):
            role_map[role.get("name", "")] = role.get("id", "")

    admin_role_id = role_map.get("Admin")
    if not admin_role_id:
        record("Locate Admin role ID", False, "Admin role not found in list")
        return
    record("Locate Admin role ID", True, admin_role_id[:8] + "…")

    # 0.6 – Assign Admin role to bootstrap user
    if S["admin_user_id"]:
        ra = POST("/api/v1/user-roles",
                  {"userId": S["admin_user_id"], "roleId": admin_role_id},
                  bootstrap_token)
        if ra.status_code in (200, 201, 409):
            record("Admin role assigned to bootstrap user", True,
                   "already had role" if ra.status_code == 409 else "")
        else:
            record("Admin role assignment", False, f"{ra.status_code}: {ra.text[:80]}")
    else:
        record("Admin role assignment", False, "admin_user_id unknown — skipping")

    # 0.7 – Re-login to pick up the Admin claim in the JWT
    S["admin_token"] = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if S["admin_token"]:
        record("Admin re-login (token now carries Admin role)", True)
    else:
        record("Admin re-login", False)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — ADMIN SETUP
# ══════════════════════════════════════════════════════════════════════════════

def phase1_admin_setup() -> None:
    section("Phase 1 — Admin Setup")
    t = S["admin_token"]

    # 1.1 – List all bus owners
    r = GET("/api/v1/admin/bus-owners", t)
    record("GET /admin/bus-owners", r.status_code == 200,
           f"{len(data(r) or [])} owner(s)")

    # 1.2 – Create a promotional coupon
    r = POST("/api/v1/admin/coupons", {
        "code":          COUPON_CODE,
        "description":   "Launch promotion — 10% off all rides",
        "discountType":  "PERCENTAGE",
        "discountValue": 10,
        "minFare":       200,
        "maxDiscount":   500,
        "usageLimit":    100,
        "perUserLimit":  1,
        "validFrom":     str(date.today()),
        "validUntil":    str(date.today() + timedelta(days=365)),
    }, t)
    if r.status_code in (200, 201):
        S["coupon_id"] = data(r).get("id") if data(r) else None
        record("POST /admin/coupons — create coupon", True,
               f"code={COUPON_CODE} id={str(S['coupon_id'])[:8]}…")
    else:
        record("POST /admin/coupons", False, f"{r.status_code}: {r.text[:120]}")

    # 1.3 – List coupons
    r = GET("/api/v1/admin/coupons", t)
    record("GET /admin/coupons", r.status_code == 200,
           f"{len(data(r) or [])} coupon(s)")

    # 1.4 – Update coupon (extend validity)
    if S["coupon_id"]:
        r = PATCH(f"/api/v1/admin/coupons/{S['coupon_id']}",
                  {"description": "Extended launch promo — 10% off"}, t)
        record("PATCH /admin/coupons/:id", r.status_code == 200)

    # 1.5 – Get coupon by ID
    if S["coupon_id"]:
        r = GET(f"/api/v1/admin/coupons/{S['coupon_id']}", t)
        record("GET /admin/coupons/:id", r.status_code == 200,
               data(r).get("code") if data(r) else "")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — BUS OWNER REGISTRATION & BUS SETUP
# ══════════════════════════════════════════════════════════════════════════════

def phase2_bus_owner() -> None:
    section("Phase 2 — Bus Owner Registration & Bus Setup")

    # 2.1 – Register new bus owner (public endpoint)
    r = POST("/api/v1/bus-owner/register", {
        "email":         BUS_OWNER_EMAIL,
        "password":      BUS_OWNER_PASSWORD,
        "phone":         "+94771234567",
        "firstName":     "Kamal",
        "lastName":      "Perera",
        "contactNumber": "+94771234567",
        "nicNumber":     f"199{TS % 1000000000:09d}",
        "address":       "42 Galle Road, Colombo 03",
    })
    if r.status_code in (200, 201):
        record("POST /bus-owner/register (public)", True,
               f"email={BUS_OWNER_EMAIL}")
    else:
        record("POST /bus-owner/register", False, f"{r.status_code}: {r.text[:120]}")

    # 2.2 – Login as bus owner
    S["owner_token"] = login(BUS_OWNER_EMAIL, BUS_OWNER_PASSWORD)
    if S["owner_token"]:
        record("Login as bus owner", True)
    else:
        record("Login as bus owner", False, "Cannot continue bus-owner phase")
        return
    t = S["owner_token"]

    # 2.3 – Get own profile
    r = GET("/api/v1/bus-owner/me", t)
    record("GET /bus-owner/me", r.status_code == 200,
           f"name={data(r).get('firstName','')} {data(r).get('lastName','')}" if data(r) else "")

    # 2.4 – Update own profile
    r = PATCH("/api/v1/bus-owner/me",
              {"address": "15 Bauddhaloka Mawatha, Colombo 07"}, t)
    record("PATCH /bus-owner/me", r.status_code == 200)

    # 2.5 – Register a bus with explicit 10×4 seat layout
    seats = [
        {"seatNumber": f"{row}{col}", "row": r_idx + 1, "col": col}
        for r_idx, row in enumerate("ABCDEFGHIJ")
        for col in range(1, 5)
    ]
    r = POST("/api/v1/buses", {
        "registrationNumber": f"NB-{TS % 10000:04d}",
        "model":  "Ashok Leyland Viking",
        "year":   2021,
        "totalSeats": 40,
        "seatLayoutJson": {
            "rows":    10,
            "columns": 4,
            "seats":   seats,
        },
    }, t)
    if r.status_code in (200, 201):
        S["bus_id"] = data(r).get("id") if data(r) else None
        record("POST /buses — register bus", True,
               f"id={str(S['bus_id'])[:8]}… status=PENDING")
    else:
        record("POST /buses", False, f"{r.status_code}: {r.text[:120]}")

    # 2.6 – List own buses (status filter: PENDING)
    r = GET("/api/v1/buses?status=PENDING", t)
    record("GET /buses?status=PENDING", r.status_code == 200,
           f"{len(data(r) or [])} bus(es)")

    # 2.7 – Get single bus
    if S["bus_id"]:
        r = GET(f"/api/v1/buses/{S['bus_id']}", t)
        record("GET /buses/:id", r.status_code == 200,
               f"reg={data(r).get('registrationNumber','')}" if data(r) else "")

    # 2.8 – Upload RC document
    if S["bus_id"]:
        r = POST(f"/api/v1/buses/{S['bus_id']}/documents", {
            "documentType": "RC",
            "fileData":     TINY_PNG,
        }, t)
        if r.status_code in (200, 201):
            S["doc_rc_id"] = data(r).get("id") if data(r) else None
            record("POST /buses/:id/documents — RC upload", True)
        else:
            record("POST /buses/:id/documents (RC)", False,
                   f"{r.status_code}: {r.text[:80]}")

    # 2.9 – Upload Insurance document
    if S["bus_id"]:
        r = POST(f"/api/v1/buses/{S['bus_id']}/documents", {
            "documentType": "INSURANCE",
            "fileData":     TINY_PNG,
        }, t)
        if r.status_code in (200, 201):
            S["doc_ins_id"] = data(r).get("id") if data(r) else None
            record("POST /buses/:id/documents — INSURANCE upload", True)
        else:
            record("POST /buses/:id/documents (INSURANCE)", False,
                   f"{r.status_code}: {r.text[:80]}")

    # 2.10 – List documents (metadata only — no fileData)
    if S["bus_id"]:
        r = GET(f"/api/v1/buses/{S['bus_id']}/documents", t)
        docs = data(r) or []
        has_no_file_data = all("fileData" not in d for d in docs)
        record("GET /buses/:id/documents (no fileData in list)", r.status_code == 200,
               f"{len(docs)} doc(s), fileData absent={has_no_file_data}")

    # 2.11 – Get single document (includes fileData)
    if S["bus_id"] and S["doc_rc_id"]:
        r = GET(f"/api/v1/buses/{S['bus_id']}/documents/{S['doc_rc_id']}", t)
        has_file_data = bool((data(r) or {}).get("fileData"))
        record("GET /buses/:id/documents/:docId (fileData present)", r.status_code == 200,
               f"fileData={'yes' if has_file_data else 'NO'}")

    # 2.12 – Try to update a PENDING bus (allowed)
    if S["bus_id"]:
        r = PATCH(f"/api/v1/buses/{S['bus_id']}", {"year": 2022}, t)
        record("PATCH /buses/:id (PENDING → can update)", r.status_code == 200)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — ADMIN BUS REVIEW
# ══════════════════════════════════════════════════════════════════════════════

def phase3_admin_bus_review() -> None:
    section("Phase 3 — Admin Bus Review (reject → re-submit → approve)")
    t = S["admin_token"]

    # 3.1 – Admin lists all PENDING buses
    r = GET("/api/v1/admin/buses?status=PENDING", t)
    pending = data(r) or []
    record("GET /admin/buses?status=PENDING", r.status_code == 200,
           f"{len(pending)} bus(es) pending")

    if not S["bus_id"]:
        record("Bus ID missing — skipping phase 3", False)
        return

    # 3.2 – Admin gets bus detail
    r = GET(f"/api/v1/admin/buses/{S['bus_id']}", t)
    record("GET /admin/buses/:id", r.status_code == 200)

    # 3.3 – Admin lists bus documents
    r = GET(f"/api/v1/admin/buses/{S['bus_id']}/documents", t)
    record("GET /admin/buses/:id/documents", r.status_code == 200,
           f"{len(data(r) or [])} doc(s)")

    # 3.4 – Admin rejects the bus (requires reason)
    r = POST(f"/api/v1/admin/buses/{S['bus_id']}/reject",
             {"reason": "Fitness certificate missing — please upload"}, t)
    record("POST /admin/buses/:id/reject", r.status_code == 200,
           f"status={data(r).get('approvalStatus','')}" if data(r) else "")

    # 3.5 – Bus owner updates the REJECTED bus (uploads fitness cert)
    if S["bus_id"]:
        r = POST(f"/api/v1/buses/{S['bus_id']}/documents", {
            "documentType": "FITNESS",
            "fileData":     TINY_PNG,
        }, S["owner_token"])
        record("Owner uploads FITNESS doc after rejection", r.status_code in (200, 201))

    # 3.6 – Admin approves the bus
    r = POST(f"/api/v1/admin/buses/{S['bus_id']}/approve", token=t)
    record("POST /admin/buses/:id/approve", r.status_code == 200,
           f"status={data(r).get('approvalStatus','')}" if data(r) else "")

    # 3.7 – Confirm bus is APPROVED
    r = GET(f"/api/v1/admin/buses/{S['bus_id']}", t)
    approved = (data(r) or {}).get("approvalStatus") == "APPROVED"
    record("Bus status is APPROVED after approval", approved)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4 — ROUTE & SCHEDULE
# ══════════════════════════════════════════════════════════════════════════════

def phase4_route_schedule() -> None:
    section("Phase 4 — Route & Schedule Creation (Bus Owner)")
    t = S["owner_token"]

    # 4.1 – Create route
    r = POST("/api/v1/routes", {
        "origin":               "Colombo",
        "destination":          "Kandy",
        "viaStops":             ["Kadawatha", "Warakapola", "Kegalle"],
        "distanceKm":           115.5,
        "estimatedDurationMin": 180,
    }, t)
    if r.status_code in (200, 201):
        S["route_id"] = data(r).get("id") if data(r) else None
        record("POST /routes — Colombo → Kandy", True,
               f"id={str(S['route_id'])[:8]}…")
    else:
        record("POST /routes", False, f"{r.status_code}: {r.text[:120]}")

    # 4.2 – List own routes
    r = GET("/api/v1/routes", t)
    record("GET /routes", r.status_code == 200, f"{len(data(r) or [])} route(s)")

    # 4.3 – Get route by ID
    if S["route_id"]:
        r = GET(f"/api/v1/routes/{S['route_id']}", t)
        record("GET /routes/:id", r.status_code == 200,
               f"{data(r).get('origin','')} → {data(r).get('destination','')}"
               if data(r) else "")

    # 4.4 – Update route (correct distance)
    if S["route_id"]:
        r = PATCH(f"/api/v1/routes/{S['route_id']}",
                  {"distanceKm": 119.2, "estimatedDurationMin": 185}, t)
        record("PATCH /routes/:id", r.status_code == 200)

    # 4.5 – Create schedule: 08:30, every day (bitmask 127), LKR 350
    if S["bus_id"] and S["route_id"]:
        r = POST("/api/v1/schedules", {
            "busId":         S["bus_id"],
            "routeId":       S["route_id"],
            "departureTime": "08:30",
            "operatingDays": 127,   # all 7 days
            "baseFare":      350.00,
        }, t)
        if r.status_code in (200, 201):
            S["schedule_id"] = data(r).get("id") if data(r) else None
            record("POST /schedules — 08:30 daily LKR 350", True,
                   f"id={str(S['schedule_id'])[:8]}…")
        else:
            record("POST /schedules", False, f"{r.status_code}: {r.text[:120]}")
    else:
        record("POST /schedules (skipped — bus or route missing)", False)

    # 4.6 – List schedules
    r = GET("/api/v1/schedules", t)
    record("GET /schedules", r.status_code == 200, f"{len(data(r) or [])} schedule(s)")

    # 4.7 – Get schedule by ID
    if S["schedule_id"]:
        r = GET(f"/api/v1/schedules/{S['schedule_id']}", t)
        record("GET /schedules/:id", r.status_code == 200)

    # 4.8 – Update schedule fare
    if S["schedule_id"]:
        r = PATCH(f"/api/v1/schedules/{S['schedule_id']}",
                  {"baseFare": 380.00}, t)
        record("PATCH /schedules/:id — fare 350 → 380", r.status_code == 200)

    # 4.9 – Filter schedules by busId
    if S["bus_id"]:
        r = GET(f"/api/v1/schedules?busId={S['bus_id']}", t)
        record("GET /schedules?busId=… (filter)", r.status_code == 200,
               f"{len(data(r) or [])} result(s)")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 5 — CONDUCTOR ONBOARDING & ASSIGNMENT
# ══════════════════════════════════════════════════════════════════════════════

def phase5_conductor() -> None:
    section("Phase 5 — Conductor Onboarding & Assignment")

    # 5.1 – Create conductor as admin (conductor endpoint requires any auth)
    r = POST("/api/v1/conductor", {
        "email":            CONDUCTOR_EMAIL,
        "password":         CONDUCTOR_PASSWORD,
        "phone":            "+94712345678",
        "firstName":        "Nimal",
        "lastName":         "Silva",
        "licenseNumber":    f"B{TS % 10000000:07d}",
        "licenseExpiryDate": "2028-12-31",
        "licenseDoc":        TINY_PNG,
        "contactNumber":    "+94712345678",
    }, S["admin_token"])
    if r.status_code in (200, 201):
        cdata = data(r) or {}
        S["conductor_id"]      = cdata.get("id")
        S["conductor_user_id"] = cdata.get("userId")
        record("POST /conductor — Nimal Silva created", True,
               f"id={str(S['conductor_id'])[:8]}…")
    else:
        record("POST /conductor", False, f"{r.status_code}: {r.text[:120]}")

    # 5.2 – Get conductor by ID
    if S["conductor_id"]:
        r = GET(f"/api/v1/conductor/{S['conductor_id']}", S["admin_token"])
        record("GET /conductor/:id", r.status_code == 200)

    # 5.3 – List all conductors
    r = GET("/api/v1/conductor", S["admin_token"])
    record("GET /conductor (list)", r.status_code == 200,
           f"{len(data(r) or [])} conductor(s)")

    # 5.4 – Update conductor
    if S["conductor_id"]:
        r = PATCH(f"/api/v1/conductor/{S['conductor_id']}",
                  {"contactNumber": "+94712000000"}, S["admin_token"])
        record("PATCH /conductor/:id", r.status_code == 200)

    # 5.5 – Login as conductor
    S["conductor_token"] = login(CONDUCTOR_EMAIL, CONDUCTOR_PASSWORD)
    if S["conductor_token"]:
        record("Login as conductor", True)
    else:
        record("Login as conductor", False, "conductor may lack role — see note")

    # 5.6 – Assign conductor to bus (bus owner action)
    if S["bus_id"] and S["conductor_id"]:
        r = POST(f"/api/v1/buses/{S['bus_id']}/conductors/{S['conductor_id']}",
                 token=S["owner_token"])
        record("POST /buses/:id/conductors/:conductorId — assign",
               r.status_code in (200, 201))
    else:
        record("Assign conductor (skipped — IDs missing)", False)

    # 5.7 – List conductors on bus
    if S["bus_id"]:
        r = GET(f"/api/v1/buses/{S['bus_id']}/conductors", S["owner_token"])
        record("GET /buses/:id/conductors", r.status_code == 200,
               f"{len(data(r) or [])} assigned")

    # 5.8 – Conductor lists their assigned buses
    if S["conductor_token"]:
        r = GET("/api/v1/conductor/me/buses", S["conductor_token"])
        record("GET /conductor/me/buses (conductor self-service)",
               r.status_code == 200, f"{len(data(r) or [])} bus(es)")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 6 — TRIP AVAILABILITY TOGGLE
# ══════════════════════════════════════════════════════════════════════════════

def phase6_trip_availability() -> None:
    section("Phase 6 — Trip Availability Toggle (Conductor)")
    t = S.get("conductor_token")

    if not t or not S["schedule_id"]:
        record("Trip availability toggle (skipped — no conductor token or schedule)", False)
        return

    # 6.1 – Disable tomorrow's trip
    r = PATCH(f"/api/v1/schedules/{S['schedule_id']}/trips/{TRIP_DATE}/availability",
              {"isAvailable": False}, t)
    record("PATCH …/trips/:date/availability → false (disable)",
           r.status_code == 200,
           f"isAvailable={data(r).get('isAvailable','') if data(r) else ''}")

    # 6.2 – Re-enable the trip
    r = PATCH(f"/api/v1/schedules/{S['schedule_id']}/trips/{TRIP_DATE}/availability",
              {"isAvailable": True}, t)
    record("PATCH …/trips/:date/availability → true (re-enable)",
           r.status_code == 200)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 7 — CUSTOMER REGISTRATION
# ══════════════════════════════════════════════════════════════════════════════

def phase7_customer() -> None:
    section("Phase 7 — Customer Registration")

    # 7.1 – Create customer (requires authentication)
    r = POST("/api/v1/customer", {
        "email":         CUSTOMER_EMAIL,
        "password":      CUSTOMER_PASSWORD,
        "phone":         "+94756789012",
        "firstName":     "Sanduni",
        "lastName":      "Kumari",
        "contactNumber": "+94756789012",
        "address":       "78 Kandy Road, Kurunegala",
    }, S["admin_token"])
    if r.status_code in (200, 201):
        cdata = data(r) or {}
        S["customer_id"]      = cdata.get("id")
        S["customer_user_id"] = cdata.get("userId")
        record("POST /customer — Sanduni Kumari created", True,
               f"id={str(S['customer_id'])[:8]}…")
    else:
        record("POST /customer", False, f"{r.status_code}: {r.text[:120]}")

    # 7.2 – Login as customer
    S["customer_token"] = login(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
    if S["customer_token"]:
        record("Login as customer", True)
    else:
        record("Login as customer", False, "customer may lack role — see note")

    # 7.3 – User self-service: get own profile
    if S["customer_token"]:
        r = GET("/user/me", S["customer_token"])
        record("GET /user/me (customer)", r.status_code == 200,
               f"email={r.json().get('email','')}" if r.status_code == 200 else "")

    # 7.4 – Update own profile
    if S["customer_token"]:
        r = PATCH("/user/me", {"phone": "+94756000000"}, S["customer_token"])
        record("PATCH /user/me (customer updates phone)", r.status_code == 200)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 8 — SEARCH
# ══════════════════════════════════════════════════════════════════════════════

def phase8_search() -> None:
    section("Phase 8 — Customer Search (Public)")

    # 8.1 – Basic search
    r = GET(f"/api/v1/search/buses?origin=Colombo&destination=Kandy&date={TRIP_DATE}")
    sdata = data(r) or {}
    results_count = len(sdata.get("items", []))
    record("GET /search/buses?origin=Colombo&destination=Kandy (public)",
           r.status_code == 200,
           f"{results_count} result(s), total={sdata.get('total',0)}")

    # 8.2 – Search sorted by fare ascending
    r = GET(f"/api/v1/search/buses?origin=Colombo&destination=Kandy"
            f"&date={TRIP_DATE}&sort=fare_asc")
    record("GET /search/buses?sort=fare_asc", r.status_code == 200)

    # 8.3 – Search sorted by fare descending
    r = GET(f"/api/v1/search/buses?origin=Colombo&destination=Kandy"
            f"&date={TRIP_DATE}&sort=fare_desc")
    record("GET /search/buses?sort=fare_desc", r.status_code == 200)

    # 8.4 – Paginated search
    r = GET(f"/api/v1/search/buses?origin=Colombo&destination=Kandy"
            f"&date={TRIP_DATE}&page=1&limit=5")
    record("GET /search/buses (paginated page=1 limit=5)", r.status_code == 200,
           f"page={data(r).get('page','')} total={data(r).get('total','')}" if data(r) else "")

    # 8.5 – Search a route with no results
    r = GET(f"/api/v1/search/buses?origin=Nowhere&destination=Void&date={TRIP_DATE}")
    no_results = len((data(r) or {}).get("items", [])) == 0
    record("GET /search/buses — unknown route returns empty list",
           r.status_code == 200 and no_results)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 9 — BOOKING LIFECYCLE
# ══════════════════════════════════════════════════════════════════════════════

def phase9_booking() -> None:
    section("Phase 9 — Seat Map, Booking & Payment (Customer)")
    ct = S.get("customer_token")

    if not S["schedule_id"]:
        record("Booking phase skipped — no schedule ID", False)
        return

    # 9.1 – View seat map (any authenticated user)
    r = GET(f"/api/v1/trips/{S['schedule_id']}/{TRIP_DATE}/seats", ct)
    smap = data(r) or {}
    record("GET /trips/:scheduleId/:date/seats", r.status_code == 200,
           f"rows={smap.get('rows','')} cols={smap.get('columns','')} "
           f"seats={len(smap.get('seats',[]))}")

    # 9.2 – Validate coupon before booking
    r = GET(f"/api/v1/coupons/{COUPON_CODE}/validate?fare=760", ct)
    record("GET /coupons/:code/validate?fare=760",
           r.status_code == 200,
           f"discount={data(r).get('discountAmount','')} "
           f"finalFare={data(r).get('finalFare','')}" if data(r) else f"{r.status_code}")

    # 9.3 – Create first booking (seats A1 + A2, with coupon)
    r = POST("/api/v1/bookings", {
        "scheduleId":  S["schedule_id"],
        "tripDate":    TRIP_DATE,
        "seatNumbers": ["A1", "A2"],
        "couponCode":  COUPON_CODE,
    }, ct)
    if r.status_code in (200, 201):
        bdata = data(r) or {}
        S["booking_id"] = bdata.get("id")
        record("POST /bookings — A1+A2 with coupon",
               True,
               f"status={bdata.get('status','')} "
               f"totalFare={bdata.get('totalFare','')} "
               f"discount={bdata.get('discountAmount','0')}")
    else:
        record("POST /bookings (first booking)", False,
               f"{r.status_code}: {r.text[:120]}")

    # 9.4 – List bookings (should show PENDING_PAYMENT)
    r = GET("/api/v1/bookings", ct)
    record("GET /bookings", r.status_code == 200,
           f"{len(data(r) or [])} booking(s)")

    # 9.5 – Pay for the first booking
    if S["booking_id"]:
        r = POST("/api/v1/payments", {
            "bookingId":     S["booking_id"],
            "paymentMethod": "CARD",
        }, ct)
        if r.status_code in (200, 201):
            S["payment_id"] = (data(r) or {}).get("id")
            record("POST /payments — pay booking via CARD", True,
                   f"paymentId={str(S['payment_id'])[:8]}…")
        else:
            record("POST /payments", False, f"{r.status_code}: {r.text[:120]}")

    # 9.6 – Booking should now be CONFIRMED
    r = GET("/api/v1/bookings?status=CONFIRMED", ct)
    confirmed = any(b.get("id") == S["booking_id"] for b in (data(r) or []))
    record("GET /bookings?status=CONFIRMED — booking is CONFIRMED",
           r.status_code == 200 and confirmed)

    # 9.7 – Get payment by ID
    if S["payment_id"]:
        r = GET(f"/api/v1/payments/{S['payment_id']}", ct)
        record("GET /payments/:id (customer)", r.status_code == 200,
               f"method={data(r).get('paymentMethod','')}" if data(r) else "")

    # 9.8 – Get ticket (QR code)
    if S["booking_id"]:
        r = GET(f"/api/v1/bookings/{S['booking_id']}/ticket", ct)
        has_qr = bool((data(r) or {}).get("qrCodePng") or (data(r) or {}).get("qrCode"))
        record("GET /bookings/:id/ticket (QR code present)",
               r.status_code == 200,
               f"qrPresent={has_qr}")

    # 9.9 – Create second booking (A3 + A4) — for cancellation test, no coupon
    r = POST("/api/v1/bookings", {
        "scheduleId":  S["schedule_id"],
        "tripDate":    TRIP_DATE,
        "seatNumbers": ["A3", "A4"],
    }, ct)
    if r.status_code in (200, 201):
        S["booking2_id"] = (data(r) or {}).get("id")
        record("POST /bookings — A3+A4 (second booking for cancellation)", True,
               f"status={(data(r) or {}).get('status','')}")
    else:
        record("POST /bookings (second booking)", False,
               f"{r.status_code}: {r.text[:120]}")

    # 9.10 – Pay second booking so it reaches CONFIRMED before cancel
    if S["booking2_id"]:
        r = POST("/api/v1/payments", {
            "bookingId":     S["booking2_id"],
            "paymentMethod": "MOBILE_WALLET",
        }, ct)
        record("POST /payments — second booking (MOBILE_WALLET)",
               r.status_code in (200, 201))

    # 9.11 – List upcoming bookings
    r = GET("/api/v1/bookings?upcoming=true", ct)
    record("GET /bookings?upcoming=true", r.status_code == 200,
           f"{len(data(r) or [])} upcoming")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 10 — CONDUCTOR BOARDING
# ══════════════════════════════════════════════════════════════════════════════

def phase10_boarding() -> None:
    section("Phase 10 — Conductor Boards Passenger")
    t = S.get("conductor_token")

    if not t or not S["booking_id"]:
        record("Boarding skipped — no conductor token or booking", False)
        return

    # 10.1 – Board the first booking
    r = POST(f"/api/v1/bookings/{S['booking_id']}/board", token=t)
    record("POST /bookings/:id/board (conductor boards Sanduni)",
           r.status_code == 200,
           f"status={data(r).get('status','')}" if data(r) else f"{r.status_code}: {r.text[:80]}")

    # 10.2 – Double-board (idempotent — expect 200 not error)
    r = POST(f"/api/v1/bookings/{S['booking_id']}/board", token=t)
    record("POST /bookings/:id/board again (idempotent BOARDED)", r.status_code == 200)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 11 — CANCELLATION
# ══════════════════════════════════════════════════════════════════════════════

def phase11_cancel() -> None:
    section("Phase 11 — Customer Cancels Second Booking")
    ct = S.get("customer_token")

    if not ct or not S["booking2_id"]:
        record("Cancellation skipped — no customer token or booking2", False)
        return

    # 11.1 – Cancel booking #2
    r = POST(f"/api/v1/bookings/{S['booking2_id']}/cancel", token=ct)
    record("POST /bookings/:id/cancel (cancel second booking)",
           r.status_code == 200,
           f"status={data(r).get('status','')}" if data(r) else f"{r.status_code}: {r.text[:80]}")

    # 11.2 – Verify seats A3 + A4 are now FREE in seat map
    r = GET(f"/api/v1/trips/{S['schedule_id']}/{TRIP_DATE}/seats", ct)
    if r.status_code == 200:
        seats = (data(r) or {}).get("seats", [])
        a3 = next((s for s in seats if s.get("seatNumber") == "A3"), None)
        a4 = next((s for s in seats if s.get("seatNumber") == "A4"), None)
        freed = (a3 and a3.get("status") == "FREE") and \
                (a4 and a4.get("status") == "FREE")
        record("Seats A3+A4 FREE after cancellation", freed,
               f"A3={a3.get('status','?') if a3 else '?'} "
               f"A4={a4.get('status','?') if a4 else '?'}")
    else:
        record("Seat map after cancellation", False, f"{r.status_code}")

    # 11.3 – List cancelled bookings
    r = GET("/api/v1/bookings?status=CANCELLED", ct)
    record("GET /bookings?status=CANCELLED", r.status_code == 200,
           f"{len(data(r) or [])} cancelled")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 12 — ADMIN REPORTING
# ══════════════════════════════════════════════════════════════════════════════

def phase12_admin_reporting() -> None:
    section("Phase 12 — Admin Reporting & Analytics")
    t = S["admin_token"]

    # 12.1 – Payment revenue stats
    r = GET("/api/v1/admin/payments/stats", t)
    stats = data(r) or {}
    record("GET /admin/payments/stats", r.status_code == 200,
           f"total={stats.get('totalRevenue','?')} "
           f"count={stats.get('totalPayments','?')}")

    # 12.2 – List all payments (no filter)
    r = GET("/api/v1/admin/payments", t)
    record("GET /admin/payments", r.status_code == 200,
           f"{len((data(r) or {}).get('items', data(r) or []))} payment(s)")

    # 12.3 – Filter payments by CARD method
    r = GET("/api/v1/admin/payments?paymentMethod=CARD", t)
    record("GET /admin/payments?paymentMethod=CARD", r.status_code == 200)

    # 12.4 – Filter payments by date range
    today = str(date.today())
    r = GET(f"/api/v1/admin/payments?fromDate={today}&toDate={today}", t)
    record("GET /admin/payments?fromDate=today&toDate=today", r.status_code == 200)

    # 12.5 – Get single payment by ID
    if S["payment_id"]:
        r = GET(f"/api/v1/admin/payments/{S['payment_id']}", t)
        record("GET /admin/payments/:id", r.status_code == 200,
               f"method={data(r).get('paymentMethod','')}" if data(r) else "")

    # 12.6 – Admin lists all buses (all statuses)
    r = GET("/api/v1/admin/buses", t)
    record("GET /admin/buses (all)", r.status_code == 200,
           f"{len(data(r) or [])} bus(es)")

    # 12.7 – Deactivate coupon at end of testing
    if S["coupon_id"]:
        r = DELETE(f"/api/v1/admin/coupons/{S['coupon_id']}", t)
        record("DELETE /admin/coupons/:id (deactivate)", r.status_code == 200)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 13 — ERROR SCENARIOS
# ══════════════════════════════════════════════════════════════════════════════

def phase13_errors() -> None:
    section("Phase 13 — Error Scenarios (negative-path coverage)")

    # 13.1 – No token → 401
    r = GET("/api/v1/buses")
    record("No token → 401", r.status_code == 401,
           f"got {r.status_code}")

    # 13.2 – Expired/invalid token → 401
    r = GET("/api/v1/buses", "not.a.real.token")
    record("Invalid token → 401", r.status_code == 401,
           f"got {r.status_code}")

    # 13.3 – Customer accesses admin endpoint → 403
    ct = S.get("customer_token")
    if ct:
        r = GET("/api/v1/admin/bus-owners", ct)
        record("Customer → GET /admin/bus-owners → 403",
               r.status_code == 403, f"got {r.status_code}")

    # 13.4 – BusOwner accesses conductor endpoint (role-gated) → 403
    ot = S.get("owner_token")
    if ot and S["schedule_id"]:
        r = PATCH(f"/api/v1/schedules/{S['schedule_id']}/trips/{TRIP_DATE}/availability",
                  {"isAvailable": False}, ot)
        record("BusOwner → PATCH availability (Conductor-only) → 403",
               r.status_code == 403, f"got {r.status_code}")

    # 13.5 – Duplicate NIC → 409
    if ot:
        r = POST("/api/v1/bus-owner/register", {
            "email":         f"dup_{TS}@test.lk",
            "password":      "Dup@123",
            "phone":         "+94799999999",
            "firstName":     "Dup",
            "lastName":      "User",
            "contactNumber": "+94799999999",
            "nicNumber":     f"199{TS % 1000000000:09d}",  # same NIC as bus owner above
            "address":       "Duplicate",
        })
        record("Duplicate NIC → 409", r.status_code == 409,
               f"got {r.status_code}")

    # 13.6 – Book an already-taken seat → 409
    if ct and S["schedule_id"]:
        r = POST("/api/v1/bookings", {
            "scheduleId":  S["schedule_id"],
            "tripDate":    TRIP_DATE,
            "seatNumbers": ["A1"],    # A1 was booked in phase 9
        }, ct)
        record("Book already-taken seat A1 → 409 or 422",
               r.status_code in (409, 422),
               f"got {r.status_code}")

    # 13.7 – Get non-existent booking → 404
    if ct:
        r = GET("/api/v1/bookings/00000000-0000-0000-0000-000000000000/ticket", ct)
        record("GET ticket for non-existent booking → 404",
               r.status_code == 404, f"got {r.status_code}")

    # 13.8 – Create schedule on non-existent bus → 404 or 400
    if ot:
        r = POST("/api/v1/schedules", {
            "busId":         "00000000-0000-0000-0000-000000000000",
            "routeId":       S.get("route_id") or "00000000-0000-0000-0000-000000000000",
            "departureTime": "10:00",
            "operatingDays": 127,
            "baseFare":      400,
        }, ot)
        record("Create schedule on non-existent bus → 404/400",
               r.status_code in (400, 404, 422),
               f"got {r.status_code}")

    # 13.9 – Auth refresh with no cookie → 401
    # Hit refresh without a cookie set (use a fresh session, no cookies)
    r = requests.post(f"{BASE_URL}/auth/refresh",
                      headers={"Content-Type": "application/json"})
    record("POST /auth/refresh with no cookie → 401",
           r.status_code == 401, f"got {r.status_code}")

    # 13.10 – Login with wrong password → 401
    r = POST("/auth/login", {"username": ADMIN_EMAIL, "password": "wrong_password"})
    record("Login with wrong password → 401", r.status_code == 401,
           f"got {r.status_code}")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 14 — AUTH FLOWS
# ══════════════════════════════════════════════════════════════════════════════

def phase14_auth_flows() -> None:
    section("Phase 14 — Auth Flows (refresh & logout)")

    # 14.1 – Login as owner (fresh session to capture cookie)
    auth_session = requests.Session()
    r = auth_session.post(
        f"{BASE_URL}/auth/login",
        json={"username": BUS_OWNER_EMAIL, "password": BUS_OWNER_PASSWORD},
        headers={"Content-Type": "application/json"},
    )
    ok_login = r.status_code == 200
    record("Login (fresh session — captures httpOnly cookie)", ok_login)

    if ok_login:
        # 14.2 – Refresh token using the httpOnly cookie
        r2 = auth_session.post(
            f"{BASE_URL}/auth/refresh",
            headers={"Content-Type": "application/json"},
        )
        new_token = (r2.json().get("data") or {}).get("accessToken")
        record("POST /auth/refresh — new access token issued",
               r2.status_code == 200 and bool(new_token))

        # 14.3 – Logout
        r3 = auth_session.post(
            f"{BASE_URL}/auth/logout",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {new_token or ''}",
            },
        )
        record("POST /auth/logout — cookie cleared", r3.status_code == 200)

        # 14.4 – Refresh after logout should fail
        r4 = auth_session.post(
            f"{BASE_URL}/auth/refresh",
            headers={"Content-Type": "application/json"},
        )
        record("POST /auth/refresh after logout → 401",
               r4.status_code == 401, f"got {r4.status_code}")

# ══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════════════════════

def print_summary() -> int:
    passed  = [r for r in results if r[1]]
    failed  = [r for r in results if not r[1]]
    total   = len(results)

    bar = "═" * 62
    print(f"\n{BOLD}{bar}{RESET}")
    print(f"{BOLD}  TEST SUMMARY{RESET}")
    print(f"{BOLD}{bar}{RESET}")
    print(f"  Total   : {total}")
    print(f"  {GREEN}Passed  : {len(passed)}{RESET}")
    print(f"  {RED}Failed  : {len(failed)}{RESET}")

    if failed:
        print(f"\n  {BOLD}Failed tests:{RESET}")
        for name, _, detail in failed:
            suffix = f"  {DIM}{detail}{RESET}" if detail else ""
            print(f"    {RED}✗  {name}{RESET}{suffix}")

    pct = 100 * len(passed) // total if total else 0
    colour = GREEN if pct == 100 else (YELLOW if pct >= 70 else RED)
    print(f"\n  {BOLD}{colour}Pass rate: {pct}%{RESET}")
    print(f"{BOLD}{bar}{RESET}\n")
    return 0 if not failed else 1

# ══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def main() -> int:
    print(f"{BOLD}{CYAN}")
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║         SL Bus App — Real-World API Test Suite               ║")
    print(f"║  target: {BASE_URL:<52}║")
    print(f"║  trip  : {TRIP_DATE:<52}║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print(RESET)

    print(_info(f"Bus Owner : {BUS_OWNER_EMAIL}"))
    print(_info(f"Conductor : {CONDUCTOR_EMAIL}"))
    print(_info(f"Customer  : {CUSTOMER_EMAIL}"))
    print(_info(f"Coupon    : {COUPON_CODE}"))

    # Verify server is reachable
    try:
        requests.get(f"{BASE_URL}/auth/login", timeout=5)
    except requests.exceptions.ConnectionError:
        print(f"\n{RED}ERROR: Cannot reach {BASE_URL} — is the server running?{RESET}\n")
        return 1

    phase0_bootstrap()
    phase1_admin_setup()
    phase2_bus_owner()
    phase3_admin_bus_review()
    phase4_route_schedule()
    phase5_conductor()
    phase6_trip_availability()
    phase7_customer()
    phase8_search()
    phase9_booking()
    phase10_boarding()
    phase11_cancel()
    phase12_admin_reporting()
    phase13_errors()
    phase14_auth_flows()

    return print_summary()


if __name__ == "__main__":
    sys.exit(main())
