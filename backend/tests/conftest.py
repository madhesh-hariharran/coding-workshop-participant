"""
Shared test utilities. Uses importlib to load service modules by exact path,
bypassing Python's module cache which causes cross-service contamination.
"""
import os
import sys
import importlib.util
import pytest

os.environ["JWT_SECRET"] = "test-secret-key-long-enough-32bytes"
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def load_module(service_name, module_name='function'):
    """Load a module from a specific service directory by file path."""
    module_path = os.path.join(BACKEND_DIR, service_name, f'{module_name}.py')
    spec = importlib.util.spec_from_file_location(
        f"{service_name}.{module_name}", module_path
    )
    mod = importlib.util.module_from_spec(spec)
    # Add service dir to sys.path temporarily so relative imports work
    service_dir = os.path.join(BACKEND_DIR, service_name)
    sys.path.insert(0, service_dir)
    try:
        spec.loader.exec_module(mod)
    finally:
        sys.path.remove(service_dir)
    return mod


@pytest.fixture
def admin_user():
    return {"sub": "1", "email": "arthur.morgan@acme.com", "role": "admin"}


@pytest.fixture
def manager_user():
    return {"sub": "2", "email": "joel.miller@acme.com", "role": "manager"}


@pytest.fixture
def contributor_user():
    return {"sub": "3", "email": "ellie.williams@acme.com", "role": "contributor"}


@pytest.fixture
def viewer_user():
    return {"sub": "4", "email": "kratos.spartan@acme.com", "role": "viewer"}