"""Unit tests for users-service: access control and path parsing."""
import os, sys, pytest, json
from unittest.mock import patch, MagicMock

os.environ["JWT_SECRET"] = "test-secret-key-long-enough-32bytes"
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SERVICE_DIR = os.path.join(BACKEND_DIR, 'users-service')
AUTH_DIR = os.path.join(BACKEND_DIR, 'auth-service')


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


@pytest.fixture
def admin_token():
    sys.path.insert(0, AUTH_DIR)
    from auth import encode_token
    token = encode_token(1, "arthur@acme.com", "admin")
    sys.path.remove(AUTH_DIR)
    return token


@pytest.fixture
def viewer_token():
    sys.path.insert(0, AUTH_DIR)
    from auth import encode_token
    token = encode_token(4, "kratos@acme.com", "viewer")
    sys.path.remove(AUTH_DIR)
    return token


def test_get_id_from_path_valid(svc):
    assert svc.get_id_from_path("/users-service/1") == 1
    assert svc.get_id_from_path("/users-service/99") == 99


def test_get_id_from_path_none(svc):
    assert svc.get_id_from_path("/users-service/") is None
    assert svc.get_id_from_path("/users-service") is None


def test_list_users_rejects_viewer(svc, viewer_token):
    result = svc.list_users(
        {"headers": {"Authorization": f"Bearer {viewer_token}"}, "queryStringParameters": {}},
        None
    )
    assert result["statusCode"] == 403


def test_list_users_allows_admin(svc, admin_token):
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
    mock_cursor.__exit__ = MagicMock(return_value=False)
    mock_cursor.fetchall.return_value = []
    mock_conn.cursor.return_value = mock_cursor
    with patch('function.get_connection', return_value=mock_conn):
        result = svc.list_users(
            {"headers": {"Authorization": f"Bearer {admin_token}"}, "queryStringParameters": {}},
            None
        )
    assert result["statusCode"] == 200


def test_delete_user_self_protection(svc, admin_token):
    """Admin (id=1) cannot delete themselves (user_id=1)."""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
    mock_cursor.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value = mock_cursor
    with patch('function.get_connection', return_value=mock_conn):
        result = svc.delete_user(
            {"headers": {"Authorization": f"Bearer {admin_token}"}, "queryStringParameters": {}},
            None, user_id=1
        )
    body = json.loads(result["body"])
    assert result["statusCode"] == 400
    assert "error" in body