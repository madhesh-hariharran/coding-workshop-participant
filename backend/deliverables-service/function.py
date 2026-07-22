"""
Deliverables Service: CRUD operations for project deliverables.
Endpoints:
    POST   /deliverables-service              - Create deliverable (contributor+)
    GET    /deliverables-service              - List all deliverables (viewer+)
    GET    /deliverables-service/{id}         - Get deliverable by ID (viewer+)
    PUT    /deliverables-service/{id}         - Update deliverable (contributor+)
    DELETE /deliverables-service/{id}         - Delete deliverable (manager+)
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


def validate_deliverable(body: dict, partial: bool = False) -> str | None:
    if not partial and not (body.get("title") or "").strip():
        return "title is required"
    if not partial and not body.get("project_id"):
        return "project_id is required"
    status = body.get("status")
    if status and status not in ("pending", "in_progress", "completed"):
        return "status must be pending, in_progress or completed"
    return None


def get_id_from_path(path: str) -> int | None:
    parts = [p for p in path.split("/") if p]
    for part in reversed(parts):
        try:
            return int(part)
        except ValueError:
            continue
    return None


@require_auth(min_role="viewer")
def list_deliverables(event: dict, context, current_user: dict = None) -> dict:
    params = event.get("queryStringParameters") or {}
    project_id = params.get("project_id")
    status_filter = params.get("status")
    search = params.get("search")

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            query = """
                SELECT d.*,
                       p.name as project_name,
                       u.name as assignee_name,
                       dep.title as depends_on_title
                FROM deliverables d
                LEFT JOIN projects p ON d.project_id = p.id
                LEFT JOIN users u ON d.assignee_id = u.id
                LEFT JOIN deliverables dep ON d.depends_on = dep.id
                WHERE 1=1
            """
            args = []
            if project_id:
                query += " AND d.project_id = %s"
                args.append(project_id)
            if status_filter:
                query += " AND d.status = %s"
                args.append(status_filter)
            if search:
                query += " AND (d.title ILIKE %s OR d.description ILIKE %s)"
                args.extend([f"%{search}%", f"%{search}%"])
            query += " ORDER BY d.created_at DESC"
            cur.execute(query, args)
            deliverables = [dict(r) for r in cur.fetchall()]
        return response(200, {"deliverables": deliverables, "total": len(deliverables)})
    except Exception as e:
        logger.error("List deliverables error: %s", str(e))
        return response(500, {"error": "Failed to fetch deliverables", "message": str(e)})


@require_auth(min_role="viewer")
def get_deliverable(event: dict, context, deliverable_id: int = None, current_user: dict = None) -> dict:
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT d.*,
                       p.name as project_name,
                       u.name as assignee_name,
                       dep.title as depends_on_title
                FROM deliverables d
                LEFT JOIN projects p ON d.project_id = p.id
                LEFT JOIN users u ON d.assignee_id = u.id
                LEFT JOIN deliverables dep ON d.depends_on = dep.id
                WHERE d.id = %s
            """, (deliverable_id,))
            deliverable = cur.fetchone()
        if not deliverable:
            return response(404, {"error": "Deliverable not found"})
        return response(200, {"deliverable": dict(deliverable)})
    except Exception as e:
        logger.error("Get deliverable error: %s", str(e))
        return response(500, {"error": "Failed to fetch deliverable", "message": str(e)})


@require_auth(min_role="contributor")
def create_deliverable(event: dict, context, current_user: dict = None) -> dict:
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON body"})

    error = validate_deliverable(body)
    if error:
        return response(400, {"error": error})

    title = body.get("title", "").strip()
    description = body.get("description", "").strip() or None
    project_id = body.get("project_id")
    status = body.get("status", "pending")
    due_date = body.get("due_date") or None
    assignee_id = body.get("assignee_id") or None
    depends_on = body.get("depends_on") or None

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            # Verify project exists
            cur.execute("SELECT id FROM projects WHERE id = %s", (project_id,))
            if not cur.fetchone():
                return response(404, {"error": "Project not found"})

            # Verify depends_on exists if provided
            if depends_on:
                cur.execute("SELECT id FROM deliverables WHERE id = %s", (depends_on,))
                if not cur.fetchone():
                    return response(404, {"error": "Depends-on deliverable not found"})

            cur.execute("""
                INSERT INTO deliverables
                    (title, description, project_id, status, due_date, assignee_id, depends_on)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (title, description, project_id, status, due_date, assignee_id, depends_on))
            deliverable = dict(cur.fetchone())
        conn.commit()
        return response(201, {"deliverable": deliverable})
    except Exception as e:
        logger.error("Create deliverable error: %s", str(e))
        conn.rollback()
        return response(500, {"error": "Failed to create deliverable", "message": str(e)})


@require_auth(min_role="contributor")
def update_deliverable(event: dict, context, deliverable_id: int = None, current_user: dict = None) -> dict:
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON body"})

    error = validate_deliverable(body, partial=True)
    if error:
        return response(400, {"error": error})

    fields = []
    values = []
    allowed = ["title", "description", "status", "due_date", "assignee_id", "depends_on"]

    for field in allowed:
        if field in body:
            fields.append(f"{field} = %s")
            values.append(body[field])

    if not fields:
        return response(400, {"error": "No fields to update"})

    fields.append("updated_at = NOW()")
    values.append(deliverable_id)

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(f"""
                UPDATE deliverables SET {', '.join(fields)}
                WHERE id = %s RETURNING *
            """, values)
            deliverable = cur.fetchone()
        if not deliverable:
            return response(404, {"error": "Deliverable not found"})
        conn.commit()
        return response(200, {"deliverable": dict(deliverable)})
    except Exception as e:
        logger.error("Update deliverable error: %s", str(e))
        conn.rollback()
        return response(500, {"error": "Failed to update deliverable", "message": str(e)})


@require_auth(min_role="manager")
def delete_deliverable(event: dict, context, deliverable_id: int = None, current_user: dict = None) -> dict:
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM deliverables WHERE id = %s RETURNING id", (deliverable_id,))
            deleted = cur.fetchone()
        if not deleted:
            return response(404, {"error": "Deliverable not found"})
        conn.commit()
        return response(204, {})
    except Exception as e:
        logger.error("Delete deliverable error: %s", str(e))
        conn.rollback()
        return response(500, {"error": "Failed to delete deliverable", "message": str(e)})


def handler(event=None, context=None):
    logger.info("Event: %s", json.dumps(event, default=str))

    http_method = (event.get("requestContext") or {}).get("http", {}).get("method", "").upper()
    raw_path = event.get("rawPath") or event.get("path") or ""
    path = raw_path.rstrip("/")

    deliverable_id = get_id_from_path(path)

    if http_method == "GET" and not deliverable_id:
        return list_deliverables(event, context)
    if http_method == "GET" and deliverable_id:
        return get_deliverable(event, context, deliverable_id=deliverable_id)
    if http_method == "POST":
        return create_deliverable(event, context)
    if http_method == "PUT" and deliverable_id:
        return update_deliverable(event, context, deliverable_id=deliverable_id)
    if http_method == "DELETE" and deliverable_id:
        return delete_deliverable(event, context, deliverable_id=deliverable_id)

    return response(404, {"error": f"Route not found: {http_method} {path}"})


if __name__ == "__main__":
    test_event = {
        "requestContext": {"http": {"method": "GET"}},
        "rawPath": "/deliverables-service",
        "body": None,
        "headers": {},
        "queryStringParameters": {}
    }
    print(handler(test_event))