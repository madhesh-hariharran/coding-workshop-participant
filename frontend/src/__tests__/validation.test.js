/**
 * Unit tests for form validation logic.
 * These are pure functions — no rendering, no mocking needed.
 */

// ── Project form validation ────────────────────────────────────────────────

function validateProjectField(name, value, form = {}) {
  switch (name) {
    case 'name':
      if (!value.trim()) return 'Project name is required';
      if (value.trim().length > 255) return 'Project name must be under 255 characters';
      return '';
    case 'end_date':
      if (value && form.start_date && value < form.start_date)
        return 'End date must be after start date';
      return '';
    case 'start_date':
      if (value && form.end_date && form.end_date < value)
        return 'Start date must be before end date';
      return '';
    case 'budget_planned':
      if (value === '') return '';
      if (isNaN(Number(value))) return 'Must be a valid number';
      if (Number(value) < 0) return 'Must be a positive number';
      return '';
    case 'budget_consumed':
      if (value === '') return '';
      if (isNaN(Number(value))) return 'Must be a valid number';
      if (Number(value) < 0) return 'Must be a positive number';
      return '';
    default:
      return '';
  }
}

describe('Project form validation', () => {
  test('name is required', () => {
    expect(validateProjectField('name', '')).toBe('Project name is required');
    expect(validateProjectField('name', '   ')).toBe('Project name is required');
  });

  test('name over 255 characters is invalid', () => {
    expect(validateProjectField('name', 'x'.repeat(256))).toBeTruthy();
  });

  test('valid name passes', () => {
    expect(validateProjectField('name', 'Blackwater Heist')).toBe('');
  });

  test('end_date before start_date is invalid', () => {
    expect(validateProjectField('end_date', '2026-01-01', { start_date: '2026-12-01' }))
      .toBe('End date must be after start date');
  });

  test('valid date range passes', () => {
    expect(validateProjectField('end_date', '2026-12-31', { start_date: '2026-01-01' }))
      .toBe('');
  });

  test('negative budget_planned is invalid', () => {
    expect(validateProjectField('budget_planned', '-100')).toBeTruthy();
  });

  test('zero budget is valid', () => {
    expect(validateProjectField('budget_planned', '0')).toBe('');
  });

  test('non-numeric budget is invalid', () => {
    expect(validateProjectField('budget_planned', 'abc')).toBeTruthy();
  });
});

// ── Deliverable form validation ────────────────────────────────────────────

function validateDeliverableField(name, value, project = {}) {
  switch (name) {
    case 'title':
      if (!value || !value.trim()) return 'Title is required';
      if (value.trim().length > 255) return 'Title must be under 255 characters';
      return '';
    case 'due_date':
      if (!value) return '';
      if (project?.start_date && value < project.start_date)
        return `Cannot be before project start date (${project.start_date})`;
      if (project?.end_date && value > project.end_date)
        return `Cannot be after project end date (${project.end_date})`;
      return '';
    default:
      return '';
  }
}

describe('Deliverable form validation', () => {
  test('title is required', () => {
    expect(validateDeliverableField('title', '')).toBe('Title is required');
    expect(validateDeliverableField('title', '   ')).toBe('Title is required');
  });

  test('title over 255 characters is invalid', () => {
    expect(validateDeliverableField('title', 'x'.repeat(256))).toBeTruthy();
  });

  test('valid title passes', () => {
    expect(validateDeliverableField('title', 'Scout the ferry route')).toBe('');
  });

  test('due_date before project start_date is invalid', () => {
    expect(validateDeliverableField('due_date', '2026-01-01', { start_date: '2026-06-01' }))
      .toContain('start date');
  });

  test('due_date after project end_date is invalid', () => {
    expect(validateDeliverableField('due_date', '2027-01-01', { end_date: '2026-12-31' }))
      .toContain('end date');
  });

  test('due_date within project range is valid', () => {
    expect(validateDeliverableField('due_date', '2026-08-01', {
      start_date: '2026-07-01', end_date: '2026-12-31'
    })).toBe('');
  });

  test('empty due_date is valid', () => {
    expect(validateDeliverableField('due_date', '')).toBe('');
  });
});

// ── Allocation form validation ─────────────────────────────────────────────

function validateAllocationField(name, value, form = {}) {
  switch (name) {
    case 'resource_id':
      if (!value) return 'Resource is required';
      return '';
    case 'project_id':
      if (!value) return 'Project is required';
      return '';
    case 'allocation_percentage':
      if (!value && value !== 0) return 'Allocation percentage is required';
      if (isNaN(Number(value))) return 'Must be a valid number';
      if (Number(value) <= 0) return 'Must be greater than 0';
      if (Number(value) > 100) return 'Cannot exceed 100% for a single project';
      return '';
    case 'start_date':
      if (!value) return '';
      if (form.end_date && value > form.end_date) return 'Start date must be before end date';
      return '';
    case 'end_date':
      if (!value) return '';
      if (form.start_date && value < form.start_date) return 'End date must be after start date';
      return '';
    default:
      return '';
  }
}

describe('Allocation form validation', () => {
  test('resource_id is required', () => {
    expect(validateAllocationField('resource_id', '')).toBeTruthy();
    expect(validateAllocationField('resource_id', null)).toBeTruthy();
  });

  test('project_id is required', () => {
    expect(validateAllocationField('project_id', '')).toBeTruthy();
  });

  test('allocation_percentage is required', () => {
    expect(validateAllocationField('allocation_percentage', '')).toBeTruthy();
  });

  test('allocation_percentage of 0 is invalid', () => {
    expect(validateAllocationField('allocation_percentage', 0)).toBeTruthy();
  });

  test('allocation_percentage over 100 is invalid', () => {
    expect(validateAllocationField('allocation_percentage', 101)).toContain('100');
  });

  test('allocation_percentage of 100 is valid', () => {
    expect(validateAllocationField('allocation_percentage', 100)).toBe('');
  });

  test('allocation_percentage of 1 is valid', () => {
    expect(validateAllocationField('allocation_percentage', 1)).toBe('');
  });

  test('non-numeric percentage is invalid', () => {
    expect(validateAllocationField('allocation_percentage', 'abc')).toBeTruthy();
  });

  test('end_date before start_date is invalid', () => {
    expect(validateAllocationField('end_date', '2026-01-01', { start_date: '2026-12-01' }))
      .toBeTruthy();
  });

  test('valid date range passes', () => {
    expect(validateAllocationField('end_date', '2026-12-31', { start_date: '2026-01-01' }))
      .toBe('');
  });
});

// ── Login form validation ──────────────────────────────────────────────────

function validateLoginField(name, value) {
  if (name === 'email') {
    if (!value.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address';
    return '';
  }
  if (name === 'password') {
    if (!value.trim()) return 'Password is required';
    return '';
  }
  return '';
}

describe('Login form validation', () => {
  test('email is required', () => {
    expect(validateLoginField('email', '')).toBe('Email is required');
  });

  test('invalid email format rejected', () => {
    expect(validateLoginField('email', 'notanemail')).toBeTruthy();
    expect(validateLoginField('email', 'test@')).toBeTruthy();
  });

  test('valid email passes', () => {
    expect(validateLoginField('email', 'arthur.morgan@acme.com')).toBe('');
  });

  test('password is required', () => {
    expect(validateLoginField('password', '')).toBe('Password is required');
  });

  test('non-empty password passes', () => {
    expect(validateLoginField('password', 'Demo@1234')).toBe('');
  });
});

// ── Circular dependency detection ──────────────────────────────────────────

function checkCircularDependency(dependsOnId, currentId, deliverables) {
  if (!dependsOnId || !currentId) return false;
  const map = {};
  deliverables.forEach(d => { map[d.id] = d; });
  let current = parseInt(dependsOnId);
  const visited = new Set();
  while (current) {
    if (current === parseInt(currentId)) return true;
    if (visited.has(current)) break;
    visited.add(current);
    current = map[current]?.depends_on || null;
  }
  return false;
}

describe('Circular dependency detection', () => {
  const deliverables = [
    { id: 1, title: 'A', depends_on: null },
    { id: 2, title: 'B', depends_on: 1 },
    { id: 3, title: 'C', depends_on: 2 },
  ];

  test('no circular — new deliverable depending on existing chain', () => {
    expect(checkCircularDependency(3, 4, deliverables)).toBe(false);
  });

  test('direct circular — A trying to depend on B which depends on A', () => {
    expect(checkCircularDependency(2, 1, deliverables)).toBe(true);
  });

  test('three-chain circular — A trying to depend on C', () => {
    expect(checkCircularDependency(3, 1, deliverables)).toBe(true);
  });

  test('self dependency', () => {
    expect(checkCircularDependency(1, 1, deliverables)).toBe(true);
  });

  test('no circular — independent deliverable', () => {
    expect(checkCircularDependency(1, 5, deliverables)).toBe(false);
  });
});