"""Unit tests for auth-service: email and password validation."""
import os, sys, pytest
from unittest.mock import patch

os.environ["JWT_SECRET"] = "test-secret-key-long-enough-32bytes"
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SERVICE_DIR = os.path.join(BACKEND_DIR, 'auth-service')


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


def test_validate_email_empty(svc):
    assert svc.validate_email("") is not None

def test_validate_email_invalid_format(svc):
    assert svc.validate_email("notanemail") is not None

def test_validate_email_no_domain(svc):
    assert svc.validate_email("test@") is not None

def test_validate_email_valid(svc):
    assert svc.validate_email("arthur.morgan@acme.com") is None

def test_validate_email_valid_subdomain(svc):
    assert svc.validate_email("user@mail.acme.com") is None

def test_validate_password_too_short(svc):
    assert svc.validate_password("Ab1!") is not None

def test_validate_password_no_uppercase(svc):
    assert svc.validate_password("alllower1!") is not None

def test_validate_password_no_digit(svc):
    assert svc.validate_password("NoDigitHere!") is not None

def test_validate_password_strong(svc):
    assert svc.validate_password("Demo@1234") is None

def test_validate_password_minimum_valid(svc):
    assert svc.validate_password("Ab1!abcd") is None