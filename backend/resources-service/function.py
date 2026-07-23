"""
Resources Service: CRUD operations for team members/resources.
Endpoints:
    POST   /resources-service                - Create resource (manager+)
    GET    /resources-service                - List all resources (viewer+)
    GET    /resources-service/{id}           - Get resource by ID (viewer+)
    GET    /resources-service/eligible-users - Get users eligible to link (manager+)
    PUT    /resources-service/{id}           - Update resource (manager+)
    DELETE /resources-service/{id}           - Delete resource (admin only)
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


def validate_resource(body: dict, partial: bool = False) -> str | None:
    if not partial and not (body.get("name") or "").strip():
        return "name is required"
    if (body.get("name") or "").strip() and len((body.get("name") or "").strip()) > 255:
        return "name must be under 255 characters"
    return None


def get_id_from_path(path: str) -> int | None:
    parts = [p for p in path.split("/") if p]
    for part in reversed(parts):
        try:
            return int(part)
        except ValueError:
            continue
    return None


@require_auth(min_role="manager")
def get_eligible_users(event: dict, context, current_user: dict = None) -> dict:
    """
    Returns users from the same email domain as the requester
    who are not already linked to a resource.
    """
    try:
        requester_email = current_user.get("email", "")
        domain = requester_email.split("@")[1] if "@" in requester_email else ""

        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, name, email, role
                FROM users
                WHERE email LIKE %s
                AND id NOT IN (
                    SELECT user_id FROM resources WHERE user_id IS NOT NULL
                )
                ORDER BY name ASC
            """, (f"%@{domain}",))
            users = [dict(r) for r in cur.fetchall()]
        return response(200, {"users": users})
    except Exception as e:
        logger.error("Get eligible users error: %s", str(e))
        return response(500, {"error": "Failed to fetch eligible users", "message": str(e)})


@require_auth(min_role="viewer")
def list_resources(event: dict, context, current_user: dict = None) -> dict:
    params = event.get("queryStringParameters") or {}
    search = params.get("search")
    department = params.get("department")

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            query = """
                SELECT r.*,
                       u.email as user_email,
                       u.role as user_role,
                       COALESCE(SUM(a.allocation_percentage), 0) as total_allocation
                FROM resources r
                LEFT JOIN users u ON r.user_id = u.id
                LEFT JOIN allocations a ON r.id = a.resource_id
                LEFT JOIN projects p ON a.project_id = p.id
                WHERE (p.status != 'completed' OR p.id IS NULL)
                AND 1=1
            """
            args = []
            if search:
                query += " AND (r.name ILIKE %s OR r.role_title ILIKE %s OR r.department ILIKE %s)"
                args.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
            if department:
                query += " AND r.department = %s"
                args.append(department)
            query += " GROUP BY r.id, u.email, u.role ORDER BY r.created_at DESC"
            cur.execute(query, args)
            resources = [dict(r) for r in cur.fetchall()]
        return response(200, {"resources": resources, "total": len(resources)})
    except Exception as e:
        logger.error("List resources error: %s", str(e))
        return response(500, {"error": "Failed to fetch resources", "message": str(e)})


@require_auth(min_role="viewer")
def get_resource(event: dict, context, resource_id: int = None, current_user: dict = None) -> dict:
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT r.*,
                       u.email as user_email,
                       u.role as user_role,
                       COALESCE(SUM(a.allocation_percentage), 0) as total_allocation
                FROM resources r
                LEFT JOIN users u ON r.user_id = u.id
                LEFT JOIN allocations a ON r.id = a.resource_id
                LEFT JOIN projects p ON a.project_id = p.id
                WHERE r.id = %s
                AND (p.status != 'completed' OR p.id IS NULL)
                GROUP BY r.id, u.email, u.role
            """, (resource_id,))
            resource = cur.fetchone()
        if not resource:
            return response(404, {"error": "Resource not found"})
        return response(200, {"resource": dict(resource)})
    except Exception as e:
        logger.error("Get resource error: %s", str(e))
        return response(500, {"error": "Failed to fetch resource", "message": str(e)})


@require_auth(min_role="manager")
def create_resource(event: dict, context, current_user: dict = None) -> dict:
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON body"})

    error = validate_resource(body)
    if error:
        return response(400, {"error": error})

    name = body.get("name", "").strip()
    role_title = body.get("role_title", "").strip() or None
    department = body.get("department", "").strip() or None
    user_id = body.get("user_id") or None

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            if user_id:
                cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
                if not cur.fetchone():
                    return response(404, {"error": "User not found"})
                # Check user not already linked
                cur.execute("SELECT id FROM resources WHERE user_id = %s", (user_id,))
                if cur.fetchone():
                    return response(400, {"error": "This user is already linked to another resource"})

            cur.execute("""
                INSERT INTO resources (name, role_title, department, user_id)
                VALUES (%s, %s, %s, %s)
                RETURNING *
            """, (name, role_title, department, user_id))
            resource = dict(cur.fetchone())
        conn.commit()
        return response(201, {"resource": resource})
    except Exception as e:
        logger.error("Create resource error: %s", str(e))
        conn.rollback()
        return response(500, {"error": "Failed to create resource", "message": str(e)})


@require_auth(min_role="manager")
def update_resource(event: dict, context, resource_id: int = None, current_user: dict = None) -> dict:
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON body"})

    error = validate_resource(body, partial=True)
    if error:
        return response(400, {"error": error})

    fields = []
    values = []
    allowed = ["name", "role_title", "department", "user_id"]

    for field in allowed:
        if field in body:
            fields.append(f"{field} = %s")
            values.append(body[field])

    if not fields:
        return response(400, {"error": "No fields to update"})

    values.append(resource_id)

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            # If user_id being updated, verify not already linked to another resource
            if "user_id" in body and body["user_id"]:
                cur.execute(
                    "SELECT id FROM resources WHERE user_id = %s AND id != %s",
                    (body["user_id"], resource_id)
                )
                if cur.fetchone():
                    return response(400, {"error": "This user is already linked to another resource"})

            cur.execute(f"""
                UPDATE resources SET {', '.join(fields)}
                WHERE id = %s RETURNING *
            """, values)
            resource = cur.fetchone()
        if not resource:
            return response(404, {"error": "Resource not found"})
        conn.commit()
        return response(200, {"resource": dict(resource)})
    except Exception as e:
        logger.error("Update resource error: %s", str(e))
        conn.rollback()
        return response(500, {"error": "Failed to update resource", "message": str(e)})


@require_auth(min_role="admin")
def delete_resource(event: dict, context, resource_id: int = None, current_user: dict = None) -> dict:
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM resources WHERE id = %s RETURNING id", (resource_id,))
            deleted = cur.fetchone()
        if not deleted:
            return response(404, {"error": "Resource not found"})
        conn.commit()
        return response(204, {})
    except Exception as e:
        logger.error("Delete resource error: %s", str(e))
        conn.rollback()
        return response(500, {"error": "Failed to delete resource", "message": str(e)})


def handler(event=None, context=None):
    logger.info("Event: %s", json.dumps(event, default=str))

    http_method = (event.get("requestContext") or {}).get("http", {}).get("method", "").upper()
    raw_path = event.get("rawPath") or event.get("path") or ""
    path = raw_path.rstrip("/")

    # Special route for eligible users
    if http_method == "GET" and path.endswith("/eligible-users"):
        return get_eligible_users(event, context)

    resource_id = get_id_from_path(path)

    if http_method == "GET" and not resource_id:
        return list_resources(event, context)
    if http_method == "GET" and resource_id:
        return get_resource(event, context, resource_id=resource_id)
    if http_method == "POST":
        return create_resource(event, context)
    if http_method == "PUT" and resource_id:
        return update_resource(event, context, resource_id=resource_id)
    if http_method == "DELETE" and resource_id:
        return delete_resource(event, context, resource_id=resource_id)

    return response(404, {"error": f"Route not found: {http_method} {path}"})


if __name__ == "__main__":
    test_event = {
        "requestContext": {"http": {"method": "GET"}},
        "rawPath": "/resources-service",
        "body": None,
        "headers": {},
        "queryStringParameters": {}
    }
    print(handler(test_event))