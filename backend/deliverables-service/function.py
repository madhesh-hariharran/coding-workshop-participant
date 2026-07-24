"""
Deliverables Service: CRUD operations for project deliverables.
Endpoints:
    POST   /deliverables-service          - Create deliverable (contributor+)
    GET    /deliverables-service          - List all deliverables (viewer+)
    GET    /deliverables-service/{id}     - Get deliverable by ID (viewer+)
    PUT    /deliverables-service/{id}     - Update deliverable (contributor+)
    DELETE /deliverables-service/{id}     - Delete deliverable (manager+)
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
    Extract numeric deliverable ID from URL path.

    Args:
        path: URL path string e.g. /deliverables-service/5

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


def has_circular_dependency(conn, deliverable_id: int, proposed_depends_on: int) -> bool:
    """
    Check if setting a depends_on relationship would create a circular dependency.

    Traverses the dependency chain upward from proposed_depends_on.
    If the current deliverable_id is encountered during traversal, a cycle exists.

    Args:
        conn: Active psycopg3 database connection.
        deliverable_id: ID of the deliverable being updated.
        proposed_depends_on: ID of the deliverable that would become the dependency.

    Returns:
        True if a circular dependency would be created, False otherwise.
    """
    """
    Check if setting deliverable_id.depends_on = proposed_depends_on
    would create a circular dependency.
    Traverses the dependency chain upward from proposed_depends_on.
    """
    visited = set()
    current = proposed_depends_on

    while current is not None:
        if current == deliverable_id:
            return True
        if current in visited:
            break
        visited.add(current)
        with conn.cursor() as cur:
            cur.execute("SELECT depends_on FROM deliverables WHERE id = %s", (current,))
            row = cur.fetchone()
            current = row["depends_on"] if row else None

    return False


def validate_deliverable(body: dict, partial: bool = False) -> str | None:
    """
    Validate deliverable request body fields.

    Args:
        body: Request body dict containing deliverable fields.
        partial: If True, skips required field checks for partial updates.

    Returns:
        Error message string if validation fails, None if valid.
    """
    if not partial:
        if not (body.get("title") or "").strip():
            return "title is required"
        if not body.get("project_id"):
            return "project_id is required"

    title = body.get("title")
    if title is not None and len(title.strip()) > 255:
        return "title must be under 255 characters"

    status = body.get("status")
    if status and status not in ("pending", "in_progress", "completed"):
        return "status must be pending, in_progress or completed"

    return None


@require_auth(min_role="viewer")
def list_deliverables(event: dict, context, current_user: dict = None) -> dict:
    """
    List deliverables with optional filtering.

    Query params:
        project_id (int): Filter by project.
        status (str): Filter by status (pending, in_progress, completed).
        search (str): Case-insensitive search on title.

    Returns:
        200: List of deliverables with project_name and depends_on_title joined.
        500: Database error.
    """
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
                       p.start_date as project_start_date,
                       p.end_date as project_end_date,
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
                query += " AND d.title ILIKE %s"
                args.append(f"%{search}%")
            query += " ORDER BY d.created_at DESC"
            cur.execute(query, args)
            deliverables = [dict(r) for r in cur.fetchall()]
        return response(200, {"deliverables": deliverables, "total": len(deliverables)})
    except Exception as e:
        logger.error("List deliverables error: %s", str(e))
        return response(500, {"error": "Failed to fetch deliverables", "message": str(e)})


@require_auth(min_role="viewer")
def get_deliverable(event: dict, context, deliverable_id: int = None, current_user: dict = None) -> dict:
    """
    Get a single deliverable by ID.

    Args:
        deliverable_id: Integer deliverable ID from URL path.

    Returns:
        200: Deliverable object with joined project and dependency info.
        404: Deliverable not found.
        500: Database error.
    """
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT d.*,
                       p.name as project_name,
                       p.start_date as project_start_date,
                       p.end_date as project_end_date,
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
    """
    Create a new deliverable scoped to a project.

    Request body:
        title (str): Deliverable title. Required.
        project_id (int): Parent project ID. Required.
        description (str): Optional description.
        status (str): One of pending, in_progress, completed. Defaults to pending.
        due_date (str): ISO date. Must be within project start and end dates.
        depends_on (int): ID of another deliverable in the same project. Optional.
        assignee_id (int): User ID of assignee. Optional.

    Returns:
        201: Created deliverable object.
        400: Validation error, circular dependency, or date violation.
        404: Project or dependency deliverable not found.
        500: Database error.
    """
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
            # Verify project exists and get its dates
            cur.execute("SELECT id, status, start_date, end_date FROM projects WHERE id = %s", (project_id,))
            project = cur.fetchone()
            if not project:
                return response(404, {"error": "Project not found"})

            # Validate due_date against project dates
            if due_date and project["start_date"] and str(due_date) < str(project["start_date"]):
                return response(400, {"error": f"Due date cannot be before project start date ({project['start_date']})"})
            if due_date and project["end_date"] and str(due_date) > str(project["end_date"]):
                return response(400, {"error": f"Due date cannot be after project end date ({project['end_date']})"})

            # Verify depends_on exists and belongs to same project
            if depends_on:
                cur.execute("SELECT id, project_id, status FROM deliverables WHERE id = %s", (depends_on,))
                dep = cur.fetchone()
                if not dep:
                    return response(404, {"error": "Dependency deliverable not found"})
                if dep["project_id"] != project_id:
                    return response(400, {"error": "Dependency must be in the same project"})

            # Verify assignee exists
            if assignee_id:
                cur.execute("SELECT id FROM users WHERE id = %s", (assignee_id,))
                if not cur.fetchone():
                    return response(404, {"error": "Assignee not found"})

            cur.execute("""
                INSERT INTO deliverables
                    (project_id, title, description, status, due_date, assignee_id, depends_on)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (project_id, title, description, status, due_date, assignee_id, depends_on))
            deliverable = dict(cur.fetchone())
        conn.commit()
        return response(201, {"deliverable": deliverable})
    except Exception as e:
        logger.error("Create deliverable error: %s", str(e))
        conn.rollback()
        return response(500, {"error": "Failed to create deliverable", "message": str(e)})


@require_auth(min_role="contributor")
def update_deliverable(event: dict, context, deliverable_id: int = None, current_user: dict = None) -> dict:
    """
    Update an existing deliverable.

    Args:
        deliverable_id: Integer deliverable ID from URL path.

    Request body:
        Any subset of deliverable fields.
        If status is completed, the depends_on deliverable must also be completed.
        If depends_on is set, circular dependency check is performed.

    Returns:
        200: Updated deliverable object.
        400: Circular dependency, blocked completion, or date violation.
        404: Deliverable not found.
        500: Database error.
    """
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON body"})

    error = validate_deliverable(body, partial=True)
    if error:
        return response(400, {"error": error})

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            # Get current deliverable
            cur.execute("""
                SELECT d.*, p.start_date as project_start_date, p.end_date as project_end_date
                FROM deliverables d
                JOIN projects p ON d.project_id = p.id
                WHERE d.id = %s
            """, (deliverable_id,))
            current = cur.fetchone()
            if not current:
                return response(404, {"error": "Deliverable not found"})

            # Circular dependency check
            if "depends_on" in body and body["depends_on"] is not None:
                if body["depends_on"] == deliverable_id:
                    return response(400, {"error": "A deliverable cannot depend on itself"})
                if has_circular_dependency(conn, deliverable_id, body["depends_on"]):
                    return response(400, {"error": "This dependency would create a circular chain"})

                # Verify depends_on is in same project
                cur.execute("SELECT project_id FROM deliverables WHERE id = %s", (body["depends_on"],))
                dep = cur.fetchone()
                if not dep:
                    return response(404, {"error": "Dependency deliverable not found"})
                if dep["project_id"] != current["project_id"]:
                    return response(400, {"error": "Dependency must be in the same project"})

            # If marking as completed, check dependency is completed
            if body.get("status") == "completed" and current["depends_on"]:
                cur.execute("SELECT status FROM deliverables WHERE id = %s", (current["depends_on"],))
                dep_del = cur.fetchone()
                if dep_del and dep_del["status"] != "completed":
                    return response(400, {"error": "Cannot mark as completed — dependency is not yet completed"})

            # Validate due_date
            due_date = body.get("due_date")
            if due_date:
                if current["project_start_date"] and str(due_date) < str(current["project_start_date"]):
                    return response(400, {"error": f"Due date cannot be before project start date ({current['project_start_date']})"})
                if current["project_end_date"] and str(due_date) > str(current["project_end_date"]):
                    return response(400, {"error": f"Due date cannot be after project end date ({current['project_end_date']})"})

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

            cur.execute(f"""
                UPDATE deliverables SET {', '.join(fields)}
                WHERE id = %s RETURNING *
            """, values)
            deliverable = cur.fetchone()
        conn.commit()
        return response(200, {"deliverable": dict(deliverable)})
    except Exception as e:
        logger.error("Update deliverable error: %s", str(e))
        conn.rollback()
        return response(500, {"error": "Failed to update deliverable", "message": str(e)})


@require_auth(min_role="manager")
def delete_deliverable(event: dict, context, deliverable_id: int = None, current_user: dict = None) -> dict:
    """
    Delete a deliverable.

    Args:
        deliverable_id: Integer deliverable ID from URL path.

    Returns:
        204: Deliverable deleted successfully.
        400: Other deliverables depend on this one.
        404: Deliverable not found.
        500: Database error.
    """
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            # Check if any other deliverable depends on this one
            cur.execute("SELECT id, title FROM deliverables WHERE depends_on = %s", (deliverable_id,))
            dependents = cur.fetchall()
            if dependents:
                names = ", ".join([d["title"] for d in dependents])
                return response(400, {"error": f"Cannot delete — other deliverables depend on this: {names}"})

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
    """
    Main Lambda entry point. Routes requests to the appropriate handler.

    Supported routes:
        POST   /deliverables-service          - Create deliverable (contributor+)
        GET    /deliverables-service          - List deliverables (viewer+)
        GET    /deliverables-service/{id}     - Get deliverable (viewer+)
        PUT    /deliverables-service/{id}     - Update deliverable (contributor+)
        DELETE /deliverables-service/{id}     - Delete deliverable (manager+)

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

    deliverable_id = get_id_from_path(path)

    if http_method == "GET" and not deliverable_id:
        return list_deliverables(event, context)
    if http_method == "GET" and deliverable_id:
        return get_deliverable(event, context, deliverable_id=deliverable_id)
    if http_method == "POST":
        return create_deliverable(event, context)
    if http_method in ("PUT", "PATCH") and deliverable_id:
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