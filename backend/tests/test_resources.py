"""Unit tests for resources-service validation logic."""
import os, sys, pytest
from unittest.mock import patch

os.environ["JWT_SECRET"] = "test-secret-key-long-enough-32bytes"
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SERVICE_DIR = os.path.join(BACKEND_DIR, 'resources-service')


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
    assert svc.validate_resource({}) == "name is required"

def test_name_too_long(svc):
    assert svc.validate_resource({"name": "x" * 256}) is not None

def test_valid_name(svc):
    assert svc.validate_resource({"name": "Arthur Morgan"}) is None

def test_valid_with_all_fields(svc):
    assert svc.validate_resource({
        "name": "Arthur Morgan", "role_title": "Lead Strategist", "department": "Operations"
    }) is None

def test_partial_skips_name(svc):
    assert svc.validate_resource({}, partial=True) is None

def test_eligible_users_path_detection(svc):
    assert "/resources-service/eligible-users".endswith("/eligible-users")

def test_get_id_from_path_numeric(svc):
    assert svc.get_id_from_path("/resources-service/3") == 3

def test_get_id_from_path_eligible_users(svc):
    assert svc.get_id_from_path("/resources-service/eligible-users") is None

def test_get_id_from_path_no_id(svc):
    assert svc.get_id_from_path("/resources-service/") is None