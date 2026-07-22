"""
Projects Service: CRUD operations for projects.
Endpoints:
    POST   /projects-service          - Create project (manager+)
    GET    /projects-service          - List all projects (viewer+)
    GET    /projects-service/{id}     - Get project by ID (viewer+)
    PUT    /projects-service/{id}     - Update project (manager+)
    DELETE /projects-service/{id}     - Delete project (admin only)
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


def validate_project(body: dict, partial: bool = False) -> str | None:
    if not partial and not (body.get("name") or "").strip():
        return "name is required"
    status = body.get("status")
    if status and status not in ("active", "at_risk", "on_hold", "completed"):
        return "status must be active, at_risk, on_hold or completed"
    budget_planned = body.get("budget_planned")
    if budget_planned is not None:
        try:
            if float(budget_planned) < 0:
                return "budget_planned must be non-negative"
        except (ValueError, TypeError):
            return "budget_planned must be a number"
    budget_consumed = body.get("budget_consumed")
    if budget_consumed is not None:
        try:
            if float(budget_consumed) < 0:
                return "budget_consumed must be non-negative"
        except (ValueError, TypeError):
            return "budget_consumed must be a number"
    return None


@require_auth(min_role="viewer")
def list_projects(event: dict, context, current_user: dict = None) -> dict:
    params = event.get("queryStringParameters") or {}
    status_filter = params.get("status")
    search = params.get("search")

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            query = """
                SELECT p.*, u.name as owner_name
                FROM projects p
                LEFT JOIN users u ON p.owner_id = u.id
                WHERE 1=1
            """
            args = []
            if status_filter:
                query += " AND p.status = %s"
                args.append(status_filter)
            if search:
                query += " AND (p.name ILIKE %s OR p.description ILIKE %s)"
                args.extend([f"%{search}%", f"%{search}%"])
            query += " ORDER BY p.created_at DESC"
            cur.execute(query, args)
            projects = [dict(r) for r in cur.fetchall()]
        return response(200, {"projects": projects, "total": len(projects)})
    except Exception as e:
        logger.error("List projects error: %s", str(e))
        return response(500, {"error": "Failed to fetch projects", "message": str(e)})


@require_auth(min_role="viewer")
def get_project(event: dict, context, project_id: int = None, current_user: dict = None) -> dict:
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.*, u.name as owner_name
                FROM projects p
                LEFT JOIN users u ON p.owner_id = u.id
                WHERE p.id = %s
            """, (project_id,))
            project = cur.fetchone()
        if not project:
            return response(404, {"error": "Project not found"})
        return response(200, {"project": dict(project)})
    except Exception as e:
        logger.error("Get project error: %s", str(e))
        return response(500, {"error": "Failed to fetch project", "message": str(e)})


@require_auth(min_role="manager")
def create_project(event: dict, context, current_user: dict = None) -> dict:
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON body"})

    error = validate_project(body)
    if error:
        return response(400, {"error": error})

    name = body.get("name", "").strip()
    description = body.get("description", "").strip() or None
    status = body.get("status", "active")
    start_date = body.get("start_date") or None
    end_date = body.get("end_date") or None
    budget_planned = body.get("budget_planned", 0)
    budget_consumed = body.get("budget_consumed", 0)
    owner_id = body.get("owner_id") or int(current_user["sub"])

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO projects
                    (name, description, status, start_date, end_date,
                     budget_planned, budget_consumed, owner_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (name, description, status, start_date, end_date,
                  budget_planned, budget_consumed, owner_id))
            project = dict(cur.fetchone())
        conn.commit()
        return response(201, {"project": project})
    except Exception as e:
        logger.error("Create project error: %s", str(e))
        conn.rollback()
        return response(500, {"error": "Failed to create project", "message": str(e)})


@require_auth(min_role="manager")
def update_project(event: dict, context, project_id: int = None, current_user: dict = None) -> dict:
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON body"})

    error = validate_project(body, partial=True)
    if error:
        return response(400, {"error": error})

    fields = []
    values = []
    allowed = ["name", "description", "status", "start_date",
               "end_date", "budget_planned", "budget_consumed", "owner_id"]

    for field in allowed:
        if field in body:
            fields.append(f"{field} = %s")
            values.append(body[field])

    if not fields:
        return response(400, {"error": "No fields to update"})

    fields.append("updated_at = NOW()")
    values.append(project_id)

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(f"""
                UPDATE projects SET {', '.join(fields)}
                WHERE id = %s RETURNING *
            """, values)
            project = cur.fetchone()
        if not project:
            return response(404, {"error": "Project not found"})
        conn.commit()
        return response(200, {"project": dict(project)})
    except Exception as e:
        logger.error("Update project error: %s", str(e))
        conn.rollback()
        return response(500, {"error": "Failed to update project", "message": str(e)})


@require_auth(min_role="admin")
def delete_project(event: dict, context, project_id: int = None, current_user: dict = None) -> dict:
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM projects WHERE id = %s RETURNING id", (project_id,))
            deleted = cur.fetchone()
        if not deleted:
            return response(404, {"error": "Project not found"})
        conn.commit()
        return response(204, {})
    except Exception as e:
        logger.error("Delete project error: %s", str(e))
        conn.rollback()
        return response(500, {"error": "Failed to delete project", "message": str(e)})


def get_project_id_from_path(path: str) -> int | None:
    """
    Extract project ID from path.
    Handles both /projects-service/1 and /1 (proxy strips service name).
    """
    parts = [p for p in path.split("/") if p]
    for part in reversed(parts):
        try:
            return int(part)
        except ValueError:
            continue
    return None


def handler(event=None, context=None):
    logger.info("Event: %s", json.dumps(event, default=str))

    http_method = (event.get("requestContext") or {}).get("http", {}).get("method", "").upper()
    raw_path = event.get("rawPath") or event.get("path") or ""
    path = raw_path.rstrip("/")

    project_id = get_project_id_from_path(path)

    if http_method == "GET" and not project_id:
        return list_projects(event, context)
    if http_method == "GET" and project_id:
        return get_project(event, context, project_id=project_id)
    if http_method == "POST":
        return create_project(event, context)
    if http_method == "PUT" and project_id:
        return update_project(event, context, project_id=project_id)
    if http_method == "DELETE" and project_id:
        return delete_project(event, context, project_id=project_id)

    return response(404, {"error": f"Route not found: {http_method} {path}"})


if __name__ == "__main__":
    test_event = {
        "requestContext": {"http": {"method": "GET"}},
        "rawPath": "/projects-service",
        "body": None,
        "headers": {},
        "queryStringParameters": {}
    }
    print(handler(test_event))