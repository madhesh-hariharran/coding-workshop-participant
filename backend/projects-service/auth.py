"""
Shared JWT authentication and RBAC middleware.
"""
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET environment variable is not set")

ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
TOKEN_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))

ROLE_HIERARCHY = {
    "admin": 4,
    "manager": 3,
    "contributor": 2,
    "viewer": 1,
}


def encode_token(user_id: int, email: str, role: str) -> str:
    """
    Encode a JWT token for a user.

    The sub claim is stored as a string per PyJWT 2.x specification.
    Token expires after TOKEN_EXPIRY_HOURS (default 24 hours).

    Args:
        user_id: Integer user ID. Stored as string in sub claim.
        email: User email address.
        role: User role (admin, manager, contributor, viewer).

    Returns:
        Signed JWT token string.
    """
    payload = {
        "sub": str(user_id),  # must be string per JWT spec
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and verify a JWT token.

    Args:
        token: JWT token string.

    Returns:
        Decoded payload dict containing sub, email, role, exp, iat.

    Raises:
        jwt.InvalidTokenError: If token is invalid, expired, or tampered.
    """
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def get_token_from_event(event: dict) -> str | None:
    """
    Extract Bearer token from Lambda event Authorization header.

    Args:
        event: Lambda event dict. Reads from event[headers][Authorization].

    Returns:
        Token string without Bearer prefix, or None if not present.
    """
    headers = event.get("headers") or {}
    auth_header = headers.get("authorization") or headers.get("Authorization") or ""
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def response(status_code: int, body: dict) -> dict:
    """
    Build a Lambda HTTP response dict.

    Args:
        status_code: HTTP status code integer.
        body: Response body dict. Serialized to JSON string.

    Returns:
        Dict with statusCode, headers (Content-Type, CORS), and body as JSON string.
    """
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, default=str),
    }


def require_auth(min_role: str = "viewer"):
    """
    Decorator factory for role-based access control.

    Extracts and verifies the JWT token from the event Authorization header.
    Checks the user role against the minimum required role using ROLE_HIERARCHY.
    Injects current_user into the wrapped function as a keyword argument.

    Args:
        min_role: Minimum required role. One of viewer, contributor, manager, admin.

    Returns:
        Decorator that wraps a Lambda handler function.

    Usage:
        @require_auth(min_role="manager")
        def create_project(event, context, current_user=None):
            user_id = int(current_user["sub"])

    Raises (via HTTP response):
        401: Missing or invalid token.
        403: User role below minimum required role.
    """
    """
    Decorator that validates JWT and enforces minimum role.
    Injects current_user into the wrapped function's kwargs.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(event, context, *args, **kwargs):
            token = get_token_from_event(event)
            if not token:
                return response(401, {"error": "Missing or invalid authorization header"})
            try:
                payload = decode_token(token)
            except jwt.ExpiredSignatureError:
                return response(401, {"error": "Token has expired"})
            except jwt.InvalidTokenError as e:
                logger.error("Invalid token error: %s", str(e))
                return response(401, {"error": "Invalid token"})

            user_role = payload.get("role", "viewer")
            if ROLE_HIERARCHY.get(user_role, 0) < ROLE_HIERARCHY.get(min_role, 0):
                return response(403, {"error": "Insufficient permissions"})

            kwargs["current_user"] = payload
            return func(event, context, *args, **kwargs)
        return wrapper
    return decorator