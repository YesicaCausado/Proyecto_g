#!/usr/bin/env python3
"""Diagnóstico del endpoint de notificaciones contra el backend en :8000."""
import requests, json, sys

BASE = "http://localhost:8000"

def try_login(username, password):
    try:
        r = requests.post(
            f"{BASE}/api/v1/auth/login",
            json={"username": username, "password": password},
            timeout=10,
        )
        print(f"[login {username}] status={r.status_code}")
        if r.status_code == 200:
            return r.json()
        print(f"  body: {r.text[:300]}")
    except Exception as e:
        print(f"[login {username}] EXCEPTION: {e}")
    return None

def try_notifications(token, label):
    try:
        r = requests.get(
            f"{BASE}/api/v1/notifications",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        print(f"[notifications {label}] status={r.status_code}")
        print(f"  raw: {r.text[:2000]}")
        return r
    except Exception as e:
        print(f"[notifications {label}] EXCEPTION: {e}")
        return None

creds = [
    ("demo", "demo"),
    ("demo", "demo1234"),
    ("profesor", "profesor"),
    ("admin", "admin1234"),
]

for u, p in creds:
    data = try_login(u, p)
    if data and data.get("access_token"):
        try_notifications(data["access_token"], u)
        print("=" * 70)