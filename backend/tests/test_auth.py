"""Unit tests for shared auth.py: JWT, role hierarchy, decorators."""
import os, sys, pytest
from unittest.mock import patch

os.environ["JWT_SECRET"] = "test-secret-key-long-enough-32bytes"
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
AUTH_DIR = os.path.join(BACKEND_DIR, 'auth-service')

if AUTH_DIR not in sys.path:
    sys.path.insert(0, AUTH_DIR)

from auth import (
    encode_token, decode_token, get_token_from_event,
    require_auth, ROLE_HIERARCHY, response
)


def test_encode_returns_string():
    token = encode_token(1, "arthur@acme.com", "admin")
    assert isinstance(token, str) and len(token) > 10


def test_decode_correct_payload():
    token = encode_token(1, "arthur@acme.com", "admin")
    p = decode_token(token)
    assert p["sub"] == "1"
    assert p["email"] == "arthur@acme.com"
    assert p["role"] == "admin"


def test_sub_is_string():
    """PyJWT 2.x requires sub to be string."""
    token = encode_token(42, "test@acme.com", "viewer")
    p = decode_token(token)
    assert isinstance(p["sub"], str)
    assert p["sub"] == "42"


def test_invalid_token_raises():
    import jwt
    with pytest.raises(jwt.InvalidTokenError):
        decode_token("not.a.valid.token")


def test_get_token_bearer():
    assert get_token_from_event({"headers": {"Authorization": "Bearer abc123"}}) == "abc123"


def test_get_token_missing():
    assert get_token_from_event({}) is None
    assert get_token_from_event({"headers": {}}) is None


def test_role_hierarchy():
    assert ROLE_HIERARCHY["admin"] > ROLE_HIERARCHY["manager"]
    assert ROLE_HIERARCHY["manager"] > ROLE_HIERARCHY["contributor"]
    assert ROLE_HIERARCHY["contributor"] > ROLE_HIERARCHY["viewer"]


def test_require_auth_no_token():
    @require_auth(min_role="viewer")
    def dummy(e, c, current_user=None): return {"statusCode": 200}
    assert dummy({"headers": {}}, None)["statusCode"] == 401


def test_require_auth_insufficient_role():
    token = encode_token(1, "v@acme.com", "viewer")
    @require_auth(min_role="manager")
    def dummy(e, c, current_user=None): return {"statusCode": 200}
    assert dummy({"headers": {"Authorization": f"Bearer {token}"}}, None)["statusCode"] == 403


def test_require_auth_sufficient_role():
    token = encode_token(1, "a@acme.com", "admin")
    @require_auth(min_role="manager")
    def dummy(e, c, current_user=None): return {"statusCode": 200}
    assert dummy({"headers": {"Authorization": f"Bearer {token}"}}, None)["statusCode"] == 200


def test_response_format():
    import json
    res = response(200, {"key": "value"})
    assert res["statusCode"] == 200
    assert json.loads(res["body"])["key"] == "value"


def test_response_error():
    import json
    res = response(404, {"error": "Not found"})
    assert res["statusCode"] == 404
    assert json.loads(res["body"])["error"] == "Not found"