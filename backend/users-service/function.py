"""
Users Service: User management (Admin only).
Endpoints:
    GET    /users-service          - List all users (admin only)
    GET    /users-service/{id}     - Get user by ID (admin only)
    PUT    /users-service/{id}     - Update user role (admin only)
    DELETE /users-service/{id}     - Delete user (admin only)
"""
import json
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from db import get_connection, init_schema
from auth import require_auth, response

logger = logging.getLogger()
logger.setLevel(logging.INFO)

init_schema()


def get_id_from_path(path: str) -> int | None:
    """
    Extract numeric user ID from URL path.

    Args:
        path: URL path string e.g. /users-service/1

    Returns:
        Integer ID if found, None otherwise.
    """
    parts = [p for p in path.split("/") if p]
    for part in reversed(parts):
        try:
            return int(part)
        except ValueError:
            continue
    return None


@require_auth(min_role="admin")
def list_users(event: dict, context, current_user: dict = None) -> dict:
    """
    List all registered users. Admin only.

    Query params:
        role (str): Filter by role (admin, manager, contributor, viewer).

    Returns:
        200: List of user objects (without passwords).
        403: Insufficient role.
        500: Database error.
    """
    params = event.get("queryStringParameters") or {}
    search = params.get("search")
    role_filter = params.get("role")

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            query = """
                SELECT id, name, email, role, created_at
                FROM users
                WHERE 1=1
            """
            args = []
            if search:
                query += " AND (name ILIKE %s OR email ILIKE %s)"
                args.extend([f"%{search}%", f"%{search}%"])
            if role_filter:
                query += " AND role = %s"
                args.append(role_filter)
            query += " ORDER BY created_at DESC"
            cur.execute(query, args)
            users = [dict(r) for r in cur.fetchall()]
        return response(200, {"users": users, "total": len(users)})
    except Exception as e:
        logger.error("List users error: %s", str(e))
        return response(500, {"error": "Failed to fetch users", "message": str(e)})


@require_auth(min_role="admin")
def get_user(event: dict, context, user_id: int = None, current_user: dict = None) -> dict:
    """
    Get a single user by ID. Admin only.

    Args:
        user_id: Integer user ID from URL path.

    Returns:
        200: User object without password.
        403: Insufficient role.
        404: User not found.
        500: Database error.
    """
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, email, role, created_at FROM users WHERE id = %s",
                (user_id,)
            )
            user = cur.fetchone()
        if not user:
            return response(404, {"error": "User not found"})
        return response(200, {"user": dict(user)})
    except Exception as e:
        logger.error("Get user error: %s", str(e))
        return response(500, {"error": "Failed to fetch user", "message": str(e)})


@require_auth(min_role="admin")
def update_user(event: dict, context, user_id: int = None, current_user: dict = None) -> dict:
    """
    Update a user account. Admin only.

    Args:
        user_id: Integer user ID from URL path.

    Request body:
        name (str): Updated display name. Optional.
        role (str): New role. Cannot change your own role. Optional.

    Returns:
        200: Updated user object.
        400: Attempting to change own role or no fields provided.
        403: Insufficient role.
        404: User not found.
        500: Database error.
    """
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON body"})

    # Prevent self-role change
    if str(user_id) == str(current_user["sub"]):
        return response(400, {"error": "Cannot modify your own account"})

    fields = []
    values = []

    if "role" in body:
        role = body["role"]
        if role not in ("admin", "manager", "contributor", "viewer"):
            return response(400, {"error": "Invalid role. Must be admin, manager, contributor or viewer"})
        fields.append("role = %s")
        values.append(role)

    if "name" in body:
        name = (body["name"] or "").strip()
        if not name:
            return response(400, {"error": "name cannot be empty"})
        fields.append("name = %s")
        values.append(name)

    if not fields:
        return response(400, {"error": "No fields to update"})

    values.append(user_id)

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(f"""
                UPDATE users SET {', '.join(fields)}
                WHERE id = %s
                RETURNING id, name, email, role, created_at
            """, values)
            user = cur.fetchone()
        if not user:
            return response(404, {"error": "User not found"})
        conn.commit()
        return response(200, {"user": dict(user)})
    except Exception as e:
        logger.error("Update user error: %s", str(e))
        conn.rollback()
        return response(500, {"error": "Failed to update user", "message": str(e)})


@require_auth(min_role="admin")
def delete_user(event: dict, context, user_id: int = None, current_user: dict = None) -> dict:
    """
    Delete a user account. Admin only. Cannot delete own account.

    Args:
        user_id: Integer user ID from URL path.

    Returns:
        204: User deleted successfully.
        400: Attempting to delete own account.
        403: Insufficient role.
        404: User not found.
        500: Database error.
    """
    # Prevent self-deletion
    if str(user_id) == str(current_user["sub"]):
        return response(400, {"error": "Cannot delete your own account"})

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE id = %s RETURNING id", (user_id,))
            deleted = cur.fetchone()
        if not deleted:
            return response(404, {"error": "User not found"})
        conn.commit()
        return response(204, {})
    except Exception as e:
        logger.error("Delete user error: %s", str(e))
        conn.rollback()
        return response(500, {"error": "Failed to delete user", "message": str(e)})


def handler(event=None, context=None):
    """
    Main Lambda entry point. Routes requests to the appropriate handler.

    Supported routes:
        GET    /users-service          - List users (admin only)
        GET    /users-service/{id}     - Get user (admin only)
        PUT    /users-service/{id}     - Update user (admin only)
        DELETE /users-service/{id}     - Delete user (admin only)

    Args:
        event: AWS Lambda event object.
        context: AWS Lambda context object.

    Returns:
        HTTP response dict with statusCode, headers, and body.
    """
    logger.info("Event: %s", json.dumps(event, default=str))

    http_method = (event.get("requestContext") or {}).get("http", {}).get("method", "").upper()
    raw_path = event.get("rawPath") or event.get("path") or ""
    path = raw_path.rstrip("/")

    user_id = get_id_from_path(path)

    if http_method == "GET" and not user_id:
        return list_users(event, context)
    if http_method == "GET" and user_id:
        return get_user(event, context, user_id=user_id)
    if http_method == "PUT" and user_id:
        return update_user(event, context, user_id=user_id)
    if http_method == "DELETE" and user_id:
        return delete_user(event, context, user_id=user_id)

    return response(404, {"error": f"Route not found: {http_method} {path}"})


if __name__ == "__main__":
    test_event = {
        "requestContext": {"http": {"method": "GET"}},
        "rawPath": "/users-service",
        "body": None,
        "headers": {},
        "queryStringParameters": {}
    }
    print(handler(test_event))