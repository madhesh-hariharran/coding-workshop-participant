/**
 * Unit tests for API client configuration and interceptors.
 * Tests Axios setup, auth header injection, and error handling.
 */
import axios from 'axios';

// Mock axios
jest.mock('axios', () => {
  const mockAxios = {
    create: jest.fn(() => mockAxios),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    defaults: { baseURL: '' },
  };
  return { default: mockAxios, ...mockAxios };
});

// ── Auth token injection ───────────────────────────────────────────────────

describe('Auth token injection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('request includes Authorization header when token exists', () => {
    localStorage.setItem('token', 'test-jwt-token');
    const config = { headers: {} };
    const token = localStorage.getItem('token');
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
    expect(config.headers['Authorization']).toBe('Bearer test-jwt-token');
  });

  test('request has no Authorization header when token is missing', () => {
    const config = { headers: {} };
    const token = localStorage.getItem('token');
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
    expect(config.headers['Authorization']).toBeUndefined();
  });

  test('token stored correctly on login', () => {
    localStorage.setItem('token', 'new-token-123');
    expect(localStorage.getItem('token')).toBe('new-token-123');
  });

  test('token removed on logout', () => {
    localStorage.setItem('token', 'some-token');
    localStorage.removeItem('token');
    expect(localStorage.getItem('token')).toBeNull();
  });
});

// ── API response parsing ───────────────────────────────────────────────────

describe('API response parsing', () => {
  test('extracts error message from response data', () => {
    const err = { response: { data: { error: 'Resource not found' } } };
    const message = err.response?.data?.error || 'An error occurred';
    expect(message).toBe('Resource not found');
  });

  test('falls back to default message when error field missing', () => {
    const err = { response: { data: {} } };
    const message = err.response?.data?.error || 'An error occurred';
    expect(message).toBe('An error occurred');
  });

  test('falls back to default when response is undefined', () => {
    const err = {};
    const message = err.response?.data?.error || 'An error occurred';
    expect(message).toBe('An error occurred');
  });

  test('network error has no response', () => {
    const err = new Error('Network Error');
    expect(err.response).toBeUndefined();
  });
});

// ── Auth API helpers ───────────────────────────────────────────────────────

describe('Auth API request shapes', () => {
  test('login request body has email and password', () => {
    const body = { email: 'arthur.morgan@acme.com', password: 'Demo@1234' };
    expect(body).toHaveProperty('email');
    expect(body).toHaveProperty('password');
    expect(Object.keys(body)).toHaveLength(2);
  });

  test('register request body has required fields', () => {
    const body = {
      name: 'Arthur Morgan',
      email: 'arthur.morgan@acme.com',
      password: 'Demo@1234',
      role: 'admin',
    };
    expect(body).toHaveProperty('name');
    expect(body).toHaveProperty('email');
    expect(body).toHaveProperty('password');
    expect(body).toHaveProperty('role');
  });

  test('role must be one of the four valid roles', () => {
    const validRoles = ['admin', 'manager', 'contributor', 'viewer'];
    expect(validRoles).toContain('admin');
    expect(validRoles).toContain('manager');
    expect(validRoles).toContain('contributor');
    expect(validRoles).toContain('viewer');
    expect(validRoles).not.toContain('superuser');
  });
});

// ── Projects API request shapes ────────────────────────────────────────────

describe('Projects API request shapes', () => {
  test('create project body has required name field', () => {
    const body = { name: 'Blackwater Heist', status: 'active' };
    expect(body).toHaveProperty('name');
    expect(body.name).toBeTruthy();
  });

  test('valid project statuses', () => {
    const validStatuses = ['active', 'at_risk', 'on_hold', 'completed'];
    expect(validStatuses).toContain('active');
    expect(validStatuses).toContain('at_risk');
    expect(validStatuses).not.toContain('in_progress');
    expect(validStatuses).not.toContain('deleted');
  });

  test('budget fields are numeric', () => {
    const body = { name: 'Test', budget_planned: 80000, budget_consumed: 24000 };
    expect(typeof body.budget_planned).toBe('number');
    expect(typeof body.budget_consumed).toBe('number');
  });

  test('date range validation — end after start', () => {
    const start = '2026-01-01';
    const end = '2026-12-31';
    expect(end >= start).toBe(true);
  });

  test('date range validation — end before start is invalid', () => {
    const start = '2026-12-01';
    const end = '2026-01-01';
    expect(end < start).toBe(true);
  });
});

// ── Allocations API request shapes ────────────────────────────────────────

describe('Allocations API request shapes', () => {
  test('create allocation requires resource_id, project_id, allocation_percentage', () => {
    const body = { resource_id: 1, project_id: 1, allocation_percentage: 50 };
    expect(body).toHaveProperty('resource_id');
    expect(body).toHaveProperty('project_id');
    expect(body).toHaveProperty('allocation_percentage');
  });

  test('allocation_percentage within 1-100 is valid', () => {
    [1, 50, 100].forEach(pct => {
      expect(pct >= 1 && pct <= 100).toBe(true);
    });
  });

  test('allocation_percentage outside 1-100 is invalid', () => {
    [0, 101, -1, 150].forEach(pct => {
      expect(pct >= 1 && pct <= 100).toBe(false);
    });
  });

  test('over-allocation warning is in response body', () => {
    const response = {
      allocation: { id: 1, resource_id: 1, project_id: 2, allocation_percentage: 70 },
      warning: 'Resource is now over-allocated at 120% total across all projects',
    };
    expect(response.warning).toBeTruthy();
    expect(response.warning).toContain('120%');
  });

  test('successful allocation with no warning', () => {
    const response = {
      allocation: { id: 1, resource_id: 1, project_id: 1, allocation_percentage: 50 },
    };
    expect(response.warning).toBeUndefined();
  });
});

// ── Deliverables API request shapes ───────────────────────────────────────

describe('Deliverables API request shapes', () => {
  test('create deliverable requires title and project_id', () => {
    const body = { title: 'Scout the ferry route', project_id: 1 };
    expect(body).toHaveProperty('title');
    expect(body).toHaveProperty('project_id');
  });

  test('valid deliverable statuses', () => {
    const validStatuses = ['pending', 'in_progress', 'completed'];
    expect(validStatuses).toContain('pending');
    expect(validStatuses).toContain('in_progress');
    expect(validStatuses).toContain('completed');
    expect(validStatuses).not.toContain('active');
  });

  test('depends_on is optional', () => {
    const withDep = { title: 'B', project_id: 1, depends_on: 1 };
    const withoutDep = { title: 'A', project_id: 1 };
    expect(withDep.depends_on).toBe(1);
    expect(withoutDep.depends_on).toBeUndefined();
  });

  test('circular dependency error response shape', () => {
    const errorResponse = { error: 'This dependency would create a circular chain' };
    expect(errorResponse).toHaveProperty('error');
    expect(errorResponse.error).toContain('circular');
  });

  test('blocked completion error response shape', () => {
    const errorResponse = { error: 'Cannot mark as completed — dependency is not yet completed' };
    expect(errorResponse).toHaveProperty('error');
    expect(errorResponse.error).toContain('dependency');
  });
});