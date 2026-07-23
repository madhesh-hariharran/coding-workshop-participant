"""Unit tests for projects-service validation logic."""
import os, sys, pytest
from unittest.mock import patch

os.environ["JWT_SECRET"] = "test-secret-key-long-enough-32bytes"
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SERVICE_DIR = os.path.join(BACKEND_DIR, 'projects-service')


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


def test_name_required(svc):
    assert svc.validate_project({}) == "name is required"

def test_name_too_long(svc):
    result = svc.validate_project({"name": "x" * 256})
    assert result is not None and "255" in result

def test_valid_statuses(svc):
    for status in ("active", "at_risk", "on_hold", "completed"):
        assert svc.validate_project({"name": "Test", "status": status}) is None

def test_invalid_status(svc):
    assert svc.validate_project({"name": "Test", "status": "in_progress"}) is not None

def test_end_date_before_start_date(svc):
    assert svc.validate_project({
        "name": "Test", "start_date": "2026-12-01", "end_date": "2026-01-01"
    }) == "end_date must be after start_date"

def test_valid_date_range(svc):
    assert svc.validate_project({
        "name": "Test", "start_date": "2026-01-01", "end_date": "2026-12-31"
    }) is None

def test_negative_budget_planned(svc):
    assert svc.validate_project({"name": "Test", "budget_planned": -100}) is not None

def test_zero_budget_valid(svc):
    assert svc.validate_project({"name": "Test", "budget_planned": 0}) is None

def test_partial_skips_name(svc):
    assert svc.validate_project({}, partial=True) is None

def test_partial_still_validates_status(svc):
    assert svc.validate_project({"status": "invalid"}, partial=True) is not None

def test_path_id_extraction(svc):
    assert svc.get_project_id_from_path("/projects-service/42") == 42
    assert svc.get_project_id_from_path("/projects-service/") is None
    assert svc.get_project_id_from_path("/projects-service") is None