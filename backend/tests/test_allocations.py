"""Unit tests for allocations-service validation logic."""
import os, sys, pytest
from unittest.mock import patch, MagicMock

os.environ["JWT_SECRET"] = "test-secret-key-long-enough-32bytes"
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SERVICE_DIR = os.path.join(BACKEND_DIR, 'allocations-service')


@pytest.fixture(autouse=True)
def svc():
    sys.path.insert(0, SERVICE_DIR)
    with patch('function.init_schema'):
        import function as f
        yield f
    sys.path.remove(SERVICE_DIR)
    for k in list(sys.modules.keys()):
        if k in ('function', 'db', 'auth') or k.startswith('function.'):
            del sys.modules[k]


def test_resource_id_required(svc):
    assert svc.validate_allocation({}) == "resource_id is required"

def test_project_id_required(svc):
    assert svc.validate_allocation({"resource_id": 1}) == "project_id is required"

def test_percentage_required(svc):
    assert svc.validate_allocation({"resource_id": 1, "project_id": 1}) == "allocation_percentage is required"

def test_percentage_zero_invalid(svc):
    assert svc.validate_allocation({"resource_id": 1, "project_id": 1, "allocation_percentage": 0}) is not None

def test_percentage_over_100_invalid(svc):
    result = svc.validate_allocation({"resource_id": 1, "project_id": 1, "allocation_percentage": 101})
    assert result is not None and "100" in result

def test_percentage_100_valid(svc):
    assert svc.validate_allocation({"resource_id": 1, "project_id": 1, "allocation_percentage": 100}) is None

def test_percentage_1_valid(svc):
    assert svc.validate_allocation({"resource_id": 1, "project_id": 1, "allocation_percentage": 1}) is None

def test_percentage_50_valid(svc):
    assert svc.validate_allocation({"resource_id": 1, "project_id": 1, "allocation_percentage": 50}) is None

def test_end_date_before_start_date(svc):
    result = svc.validate_allocation({
        "resource_id": 1, "project_id": 1, "allocation_percentage": 50,
        "start_date": "2026-12-01", "end_date": "2026-01-01"
    })
    assert result == "end_date must be after start_date"

def test_valid_dates(svc):
    assert svc.validate_allocation({
        "resource_id": 1, "project_id": 1, "allocation_percentage": 50,
        "start_date": "2026-01-01", "end_date": "2026-12-31"
    }) is None

def test_partial_skips_required(svc):
    assert svc.validate_allocation({}, partial=True) is None

def test_partial_validates_percentage(svc):
    assert svc.validate_allocation({"allocation_percentage": 150}, partial=True) is not None

def test_non_numeric_percentage(svc):
    assert svc.validate_allocation({"resource_id": 1, "project_id": 1, "allocation_percentage": "abc"}) is not None

def test_get_id_from_path(svc):
    assert svc.get_id_from_path("/allocations-service/7") == 7
    assert svc.get_id_from_path("/allocations-service/") is None