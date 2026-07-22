"""
Auth Service: Handles user registration and login.
Endpoints:
    POST /auth-service/register
    POST /auth-service/login
    GET  /auth-service/me
"""
import json
import logging
import os
import re
import sys

import bcrypt

# Allow imports from the same service folder (shared files are copied here)
sys.path.insert(0, os.path.dirname(__file__))

from db import get_connection, init_schema
from auth import encode_token, require_auth, response

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize schema on cold start
init_schema()


def validate_email(email: str) -> str | None:
    """Returns error message or None if valid."""
    pattern = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        return "Invalid email format"
    return None


def validate_password(password: str) -> str | None:
    """Returns error message or None if valid."""
    if len(password) < 8:
        return "Password must be at least 8 characters"
    if not re.search(r'[A-Z]', password):
        return "Password must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return "Password must contain at least one lowercase letter"
    if not re.search(r'\d', password):
        return "Password must contain at least one number"
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return "Password must contain at least one special character"
    return None


def register(body: dict) -> dict:
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    password = (body.get("password") or "").strip()
    role = (body.get("role") or "viewer").strip().lower()

    if not name or not email or not password:
        return response(400, {"error": "name, email and password are required"})

    email_error = validate_email(email)
    if email_error:
        return response(400, {"error": email_error})

    password_error = validate_password(password)
    if password_error:
        return response(400, {"error": password_error})

    if role not in ("admin", "manager", "contributor", "viewer"):
        return response(400, {"error": "Invalid role. Must be admin, manager, contributor or viewer"})

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cur.fetchone():
                return response(400, {"error": "Email already registered"})

            cur.execute(
                """
                INSERT INTO users (name, email, password, role)
                VALUES (%s, %s, %s, %s)
                RETURNING id, name, email, role, created_at
                """,
                (name, email, hashed, role),
            )
            user = dict(cur.fetchone())
        conn.commit()
        token = encode_token(user["id"], user["email"], user["role"])
        return response(201, {"user": user, "token": token})
    except Exception as e:
        logger.error("Register error: %s", str(e))
        if conn:
            conn.rollback()
        return response(500, {"error": "Registration failed", "message": str(e)})
    finally:
        if conn:
            conn.close()


def login(body: dict) -> dict:
    email = (body.get("email") or "").strip().lower()
    password = (body.get("password") or "").strip()

    if not email or not password:
        return response(400, {"error": "email and password are required"})

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, email, password, role, created_at FROM users WHERE email = %s",
                (email,),
            )
            user = cur.fetchone()
    except Exception as e:
        logger.error("Login DB error: %s", str(e))
        return response(500, {"error": "Login failed", "message": str(e)})
    finally:
        if conn:
            conn.close()

    if not user or not bcrypt.checkpw(password.encode(), user["password"].encode()):
        return response(401, {"error": "Invalid email or password"})

    user = dict(user)
    del user["password"]
    token = encode_token(user["id"], user["email"], user["role"])
    return response(200, {"user": user, "token": token})


@require_auth(min_role="viewer")
def me(event: dict, context, current_user: dict = None) -> dict:
    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, email, role, created_at FROM users WHERE id = %s",
                (current_user["sub"],),
            )
            user = cur.fetchone()
        if not user:
            return response(404, {"error": "User not found"})
        return response(200, {"user": dict(user)})
    except Exception as e:
        logger.error("Me error: %s", str(e))
        return response(500, {"error": "Failed to fetch user", "message": str(e)})
    finally:
        if conn:
            conn.close()


def handler(event=None, context=None):
    logger.info("Event: %s", json.dumps(event, default=str))

    http_method = (event.get("requestContext") or {}).get("http", {}).get("method", "").upper()
    raw_path = event.get("rawPath") or event.get("path") or ""
    path = raw_path.rstrip("/")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON body"})

    if http_method == "POST" and path.endswith("/register"):
        return register(body)

    if http_method == "POST" and path.endswith("/login"):
        return login(body)

    if http_method == "GET" and path.endswith("/me"):
        return me(event, context)

    return response(404, {"error": f"Route not found: {http_method} {path}"})


if __name__ == "__main__":
    # Local test
    test_event = {
        "requestContext": {"http": {"method": "POST"}},
        "rawPath": "/auth-service/register",
        "body": json.dumps({
            "name": "Admin User",
            "email": "admin@acme.com",
            "password": "Admin@123",
            "role": "admin"
        }),
    }
    print(handler(test_event))