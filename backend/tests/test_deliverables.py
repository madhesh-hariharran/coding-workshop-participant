"""Unit tests for deliverables-service: validation and circular dependency."""
import os, sys, pytest
from unittest.mock import patch, MagicMock

os.environ["JWT_SECRET"] = "test-secret-key-long-enough-32bytes"
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SERVICE_DIR = os.path.join(BACKEND_DIR, 'deliverables-service')


@pytest.fixture(autouse=True)
def svc():
    sys.path.insert(0, SERVICE_DIR)
    with patch('function.init_schema'):
        import function as f
        yield f
    sys.path.remove(SERVICE_DIR)
    for k in list(sys.modules.keys()):
        if k in ('function', 'db', 'auth'):
            del sys.modules[k]


def make_conn(side_effects):
    conn = MagicMock()
    cursor = MagicMock()
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    cursor.fetchone.side_effect = side_effects
    conn.cursor.return_value = cursor
    return conn


def test_circular_self(svc):
    conn = make_conn([{"depends_on": None}])
    assert svc.has_circular_dependency(conn, 1, 1) is True

def test_circular_direct(svc):
    """A→B, try to make A depend on B — circular."""
    conn = make_conn([{"depends_on": 1}, {"depends_on": None}])
    assert svc.has_circular_dependency(conn, 1, 2) is True

def test_circular_three_chain(svc):
    """A→B→C, try to make A depend on C — circular."""
    conn = make_conn([{"depends_on": 2}, {"depends_on": 1}, {"depends_on": None}])
    assert svc.has_circular_dependency(conn, 1, 3) is True

def test_no_circular_independent(svc):
    """New deliverable depending on existing chain — no cycle."""
    conn = make_conn([{"depends_on": None}])
    assert svc.has_circular_dependency(conn, 5, 4) is False

def test_title_required(svc):
    assert svc.validate_deliverable({}) == "title is required"

def test_project_id_required(svc):
    assert svc.validate_deliverable({"title": "Test"}) == "project_id is required"

def test_valid_deliverable(svc):
    assert svc.validate_deliverable({"title": "Test", "project_id": 1}) is None

def test_invalid_status(svc):
    assert svc.validate_deliverable({"title": "T", "project_id": 1, "status": "invalid"}) is not None

def test_valid_statuses(svc):
    for s in ("pending", "in_progress", "completed"):
        assert svc.validate_deliverable({"title": "T", "project_id": 1, "status": s}) is None

def test_partial_skips_required(svc):
    assert svc.validate_deliverable({}, partial=True) is None

def test_title_too_long(svc):
    assert svc.validate_deliverable({"title": "x" * 256, "project_id": 1}) is not None

def test_get_id_from_path(svc):
    assert svc.get_id_from_path("/deliverables-service/5") == 5
    assert svc.get_id_from_path("/deliverables-service/") is None