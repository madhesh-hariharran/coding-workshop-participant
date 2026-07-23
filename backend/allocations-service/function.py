"""
Allocations Service: CRUD for resource-project allocations.
Endpoints:
    POST   /allocations-service       - Create allocation (manager+)
    GET    /allocations-service       - List allocations (viewer+)
    GET    /allocations-service/{id}  - Get allocation (viewer+)
    PUT    /allocations-service/{id}  - Update allocation (manager+)
    DELETE /allocations-service/{id}  - Delete allocation (manager+)
"""
import json
import logging
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(__file__))

from db import get_connection, init_schema
from auth import require_auth, response

logger = logging.getLogger()
logger.setLevel(logging.INFO)

init_schema()


def get_id_from_path(path: str) -> int | None:
    parts = [p for p in path.split("/") if p]
    for part in reversed(parts):
        try:
            return int(part)
        except ValueError:
            continue
    return None


def validate_allocation(body: dict, partial: bool = False) -> str | None:
    if not partial:
        if not body.get("resource_id"):
            return "resource_id is required"
        if not body.get("project_id"):
            return "project_id is required"
        if body.get("allocation_percentage") is None:
            return "allocation_percentage is required"

    pct = body.get("allocation_percentage")
    if pct is not None:
        try:
            pct = int(pct)
            if pct <= 0 or pct > 100:
                return "allocation_percentage must be between 1 and 100"
        except (ValueError, TypeError):
            return "allocation_percentage must be a number"

    start_date = body.get("start_date")
    end_date = body.get("end_date")
    if start_date and end_date and str(end_date) < str(start_date):
        return "end_date must be after start_date"

    return None


@require_auth(min_role="viewer")
def list_allocations(event: dict, context, current_user: dict = None) -> dict:
    params = event.get("queryStringParameters") or {}
    resource_id = params.get("resource_id")
    project_id = params.get("project_id")

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            query = """
                SELECT a.*,
                       r.name as resource_name,
                       r.role_title,
                       r.department,
                       p.name as project_name,
                       p.status as project_status
                FROM allocations a
                JOIN resources r ON a.resource_id = r.id
                JOIN projects p ON a.project_id = p.id
                WHERE 1=1
            """
            args = []
            if resource_id:
                query += " AND a.resource_id = %s"
                args.append(resource_id)
            if project_id:
                query += " AND a.project_id = %s"
                args.append(project_id)
            query += " ORDER BY a.created_at DESC"
            cur.execute(query, args)
            allocations = [dict(r) for r in cur.fetchall()]

            # Over-allocated resources warning
            cur.execute("""
                SELECT r.id, r.name,
                       SUM(a.allocation_percentage) as total_allocation
                FROM resources r
                JOIN allocations a ON r.id = a.resource_id
                JOIN projects p ON a.project_id = p.id
                WHERE p.status != 'completed'
                GROUP BY r.id, r.name
                HAVING SUM(a.allocation_percentage) > 100
            """)
            over_allocated = [dict(r) for r in cur.fetchall()]

        return response(200, {
            "allocations": allocations,
            "total": len(allocations),
            "over_allocated_resources": over_allocated
        })
    except Exception as e:
        logger.error("List allocations error: %s", str(e))
        return response(500, {"error": "Failed to fetch allocations", "message": str(e)})


@require_auth(min_role="viewer")
def get_allocation(event: dict, context, allocation_id: int = None, current_user: dict = None) -> dict:
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT a.*,
                       r.name as resource_name,
                       r.role_title,
                       r.department,
                       p.name as project_name,
                       p.status as project_status
                FROM allocations a
                JOIN resources r ON a.resource_id = r.id
                JOIN projects p ON a.project_id = p.id
                WHERE a.id = %s
            """, (allocation_id,))
            allocation = cur.fetchone()
        if not allocation:
            return response(404, {"error": "Allocation not found"})
        return response(200, {"allocation": dict(allocation)})
    except Exception as e:
        logger.error("Get allocation error: %s", str(e))
        return response(500, {"error": "Failed to fetch allocation", "message": str(e)})


@require_auth(min_role="manager")
def create_allocation(event: dict, context, current_user: dict = None) -> dict:
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON body"})

    error = validate_allocation(body)
    if error:
        return response(400, {"error": error})

    resource_id = body.get("resource_id")
    project_id = body.get("project_id")
    allocation_percentage = int(body.get("allocation_percentage"))
    start_date = body.get("start_date") or None
    end_date = body.get("end_date") or None

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            # Verify resource exists
            cur.execute("SELECT id FROM resources WHERE id = %s", (resource_id,))
            if not cur.fetchone():
                return response(404, {"error": "Resource not found"})

            # Verify project exists and check status/dates
            cur.execute("SELECT id, status, end_date, start_date FROM projects WHERE id = %s", (project_id,))
            project = cur.fetchone()
            if not project:
                return response(404, {"error": "Project not found"})

            # Block allocation to completed projects
            if project["status"] == "completed":
                return response(400, {"error": "Cannot allocate resources to a completed project"})

            # Block allocation to projects past their end date
            if project["end_date"] and str(project["end_date"]) < str(date.today()):
                return response(400, {"error": f"Cannot allocate resources to a project that has already ended ({project['end_date']})"})

            # Check for duplicate allocation
            cur.execute("""
                SELECT id FROM allocations
                WHERE resource_id = %s AND project_id = %s
            """, (resource_id, project_id))
            if cur.fetchone():
                return response(400, {"error": "Resource is already allocated to this project"})

            # Check total allocation — warn but allow over 100%
            cur.execute("""
                SELECT COALESCE(SUM(a.allocation_percentage), 0) as total
                FROM allocations a
                JOIN projects p ON a.project_id = p.id
                WHERE a.resource_id = %s AND p.status != 'completed'
            """, (resource_id,))
            current_total = int(cur.fetchone()["total"])
            new_total = current_total + allocation_percentage
            is_over_allocated = new_total > 100

            cur.execute("""
                INSERT INTO allocations
                    (resource_id, project_id, allocation_percentage, start_date, end_date)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING *
            """, (resource_id, project_id, allocation_percentage, start_date, end_date))
            allocation = dict(cur.fetchone())
        conn.commit()

        result = {"allocation": allocation}
        if is_over_allocated:
            result["warning"] = f"Resource is now over-allocated at {new_total}% total across all projects"

        return response(201, result)
    except Exception as e:
        logger.error("Create allocation error: %s", str(e))
        conn.rollback()
        return response(500, {"error": "Failed to create allocation", "message": str(e)})


@require_auth(min_role="manager")
def update_allocation(event: dict, context, allocation_id: int = None, current_user: dict = None) -> dict:
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON body"})

    error = validate_allocation(body, partial=True)
    if error:
        return response(400, {"error": error})

    fields = []
    values = []
    allowed = ["allocation_percentage", "start_date", "end_date"]

    for field in allowed:
        if field in body:
            fields.append(f"{field} = %s")
            values.append(body[field])

    if not fields:
        return response(400, {"error": "No fields to update"})

    values.append(allocation_id)

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(f"""
                UPDATE allocations SET {', '.join(fields)}
                WHERE id = %s RETURNING *
            """, values)
            allocation = cur.fetchone()
        if not allocation:
            return response(404, {"error": "Allocation not found"})
        conn.commit()

        allocation = dict(allocation)

        # Check if update causes over-allocation
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COALESCE(SUM(a.allocation_percentage), 0) as total
                FROM allocations a
                JOIN projects p ON a.project_id = p.id
                WHERE a.resource_id = %s AND p.status != 'completed'
            """, (allocation["resource_id"],))
            total = int(cur.fetchone()["total"])

        result = {"allocation": allocation}
        if total > 100:
            result["warning"] = f"Resource is over-allocated at {total}% total across all projects"

        return response(200, result)
    except Exception as e:
        logger.error("Update allocation error: %s", str(e))
        conn.rollback()
        return response(500, {"error": "Failed to update allocation", "message": str(e)})


@require_auth(min_role="manager")
def delete_allocation(event: dict, context, allocation_id: int = None, current_user: dict = None) -> dict:
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM allocations WHERE id = %s RETURNING id", (allocation_id,))
            deleted = cur.fetchone()
        if not deleted:
            return response(404, {"error": "Allocation not found"})
        conn.commit()
        return response(204, {})
    except Exception as e:
        logger.error("Delete allocation error: %s", str(e))
        conn.rollback()
        return response(500, {"error": "Failed to delete allocation", "message": str(e)})


def handler(event=None, context=None):
    logger.info("Event: %s", json.dumps(event, default=str))

    http_method = (event.get("requestContext") or {}).get("http", {}).get("method", "").upper()
    raw_path = event.get("rawPath") or event.get("path") or ""
    path = raw_path.rstrip("/")

    allocation_id = get_id_from_path(path)

    if http_method == "GET" and not allocation_id:
        return list_allocations(event, context)
    if http_method == "GET" and allocation_id:
        return get_allocation(event, context, allocation_id=allocation_id)
    if http_method == "POST":
        return create_allocation(event, context)
    if http_method == "PUT" and allocation_id:
        return update_allocation(event, context, allocation_id=allocation_id)
    if http_method == "DELETE" and allocation_id:
        return delete_allocation(event, context, allocation_id=allocation_id)

    return response(404, {"error": f"Route not found: {http_method} {path}"})


if __name__ == "__main__":
    test_event = {
        "requestContext": {"http": {"method": "GET"}},
        "rawPath": "/allocations-service",
        "body": None,
        "headers": {},
        "queryStringParameters": {}
    }
    print(handler(test_event))