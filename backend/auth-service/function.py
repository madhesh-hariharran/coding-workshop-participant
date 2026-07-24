"""
Auth Service: Handles user registration, login, and identity verification.

Endpoints:
    POST /auth-service/register - Register a new user
    POST /auth-service/login    - Login and receive JWT token
    GET  /auth-service/me       - Get current authenticated user
"""
import json
import logging
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))

import bcrypt
from db import get_connection, init_schema
from auth import encode_token, response, require_auth

logger = logging.getLogger()
logger.setLevel(logging.INFO)

init_schema()


def validate_email(email: str) -> str | None:
    """
    Validate email format using regex.

    Args:
        email: Email string to validate.

    Returns:
        Error message string if invalid, None if valid.
    """
    if not email or not email.strip():
        return "Email is required"
    pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    if not re.match(pattern, email.strip()):
        return "Invalid email format"
    return None


def validate_password(password: str) -> str | None:
    """
    Validate password strength requirements.

    Requirements:
        - Minimum 8 characters
        - At least one uppercase letter
        - At least one digit
        - At least one special character

    Args:
        password: Password string to validate.

    Returns:
        Error message string if invalid, None if valid.
    """
    if not password or len(password) < 8:
        return "Password must be at least 8 characters"
    if not re.search(r'[A-Z]', password):
        return "Password must contain at least one uppercase letter"
    if not re.search(r'\d', password):
        return "Password must contain at least one digit"
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return "Password must contain at least one special character"
    return None


def register(event: dict, context) -> dict:
    """
    Register a new user account.

    Request body:
        name (str): Full name of the user. Required.
        email (str): Unique email address. Required.
        password (str): Password meeting strength requirements. Required.
        role (str): One of admin, manager, contributor, viewer. Defaults to viewer.

    Returns:
        201: User object and JWT token on success.
        400: Validation error or duplicate email.
        500: Database error.
    """
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON body"})

    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    role = body.get("role", "viewer")

    if not name:
        return response(400, {"error": "Name is required"})

    email_error = validate_email(email)
    if email_error:
        return response(400, {"error": email_error})

    password_error = validate_password(password)
    if password_error:
        return response(400, {"error": password_error})

    valid_roles = ("admin", "manager", "contributor", "viewer")
    if role not in valid_roles:
        return response(400, {"error": f"Role must be one of: {', '.join(valid_roles)}"})

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cur.fetchone():
                return response(400, {"error": "Email already registered"})

            hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
            cur.execute("""
                INSERT INTO users (name, email, password, role)
                VALUES (%s, %s, %s, %s)
                RETURNING id, name, email, role, created_at
            """, (name, email, hashed, role))
            user = dict(cur.fetchone())
        conn.commit()

        token = encode_token(user["id"], user["email"], user["role"])
        return response(201, {"user": user, "token": token})
    except Exception as e:
        logger.error("Register error: %s", str(e))
        conn.rollback()
        return response(500, {"error": "Registration failed", "message": str(e)})


def login(event: dict, context) -> dict:
    """
    Authenticate a user and return a JWT token.

    Request body:
        email (str): Registered email address. Required.
        password (str): Account password. Required.

    Returns:
        200: User object and JWT token on success.
        400: Missing fields or invalid credentials.
        500: Database error.
    """
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON body"})

    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email:
        return response(400, {"error": "Email is required"})
    if not password:
        return response(400, {"error": "Password is required"})

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, name, email, password, role, created_at
                FROM users WHERE email = %s
            """, (email,))
            user = cur.fetchone()

        if not user or not bcrypt.checkpw(password.encode(), user["password"].encode()):
            return response(400, {"error": "Invalid email or password"})

        user_data = {k: v for k, v in dict(user).items() if k != "password"}
        token = encode_token(user["id"], user["email"], user["role"])
        return response(200, {"user": user_data, "token": token})
    except Exception as e:
        logger.error("Login error: %s", str(e))
        return response(500, {"error": "Login failed", "message": str(e)})


@require_auth(min_role="viewer")
def me(event: dict, context, current_user: dict = None) -> dict:
    """
    Return the currently authenticated user's profile.

    Headers:
        Authorization: Bearer <token>

    Returns:
        200: User object (without password).
        401: Missing or invalid token.
        404: User not found.
        500: Database error.
    """
    user_id = int(current_user["sub"])
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, name, email, role, created_at
                FROM users WHERE id = %s
            """, (user_id,))
            user = cur.fetchone()
        if not user:
            return response(404, {"error": "User not found"})
        return response(200, {"user": dict(user)})
    except Exception as e:
        logger.error("Me error: %s", str(e))
        return response(500, {"error": "Failed to fetch user", "message": str(e)})


def handler(event=None, context=None):
    """
    Main Lambda entry point. Routes requests to the appropriate handler.

    Supported routes:
        POST /auth-service/register
        POST /auth-service/login
        GET  /auth-service/me

    Args:
        event: AWS Lambda event object containing HTTP method, path, headers, and body.
        context: AWS Lambda context object.

    Returns:
        HTTP response dict with statusCode, headers, and body.
    """
    logger.info("Event: %s", json.dumps(event, default=str))

    http_method = (event.get("requestContext") or {}).get("http", {}).get("method", "").upper()
    raw_path = event.get("rawPath") or event.get("path") or ""
    path = raw_path.rstrip("/")

    if http_method == "POST" and path.endswith("/register"):
        return register(event, context)
    if http_method == "POST" and path.endswith("/login"):
        return login(event, context)
    if http_method == "GET" and path.endswith("/me"):
        return me(event, context)

    return response(404, {"error": f"Route not found: {http_method} {path}"})