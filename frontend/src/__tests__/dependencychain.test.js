/**
 * Unit tests for DependencyChain tree building logic.
 * Tests pure tree construction — no rendering needed.
 */

function buildTree(deliverables) {
  const map = {};
  deliverables.forEach(d => { map[d.id] = { ...d, children: [] }; });

  const hasParent = new Set();
  const sorted = [...deliverables].sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return a.id - b.id;
  });

  sorted.forEach(d => {
    if (d.depends_on && map[d.depends_on]) {
      map[d.depends_on].children.push(map[d.id]);
      hasParent.add(d.id);
    }
  });

  const roots = deliverables
    .filter(d => !hasParent.has(d.id))
    .map(d => map[d.id]);

  return { roots, map };
}

function isBlocked(node, map) {
  if (!node.depends_on) return false;
  const dep = map[node.depends_on];
  if (!dep) return false;
  return dep.status !== 'completed';
}

describe('DependencyChain tree building', () => {
  const linearChain = [
    { id: 1, title: 'A', status: 'completed', depends_on: null, due_date: '2026-07-01' },
    { id: 2, title: 'B', status: 'in_progress', depends_on: 1, due_date: '2026-08-01' },
    { id: 3, title: 'C', status: 'pending', depends_on: 2, due_date: '2026-09-01' },
  ];

  test('linear chain has one root', () => {
    const { roots } = buildTree(linearChain);
    expect(roots).toHaveLength(1);
    expect(roots[0].title).toBe('A');
  });

  test('linear chain root has one child', () => {
    const { roots } = buildTree(linearChain);
    expect(roots[0].children).toHaveLength(1);
    expect(roots[0].children[0].title).toBe('B');
  });

  test('linear chain depth-2 has one child', () => {
    const { roots } = buildTree(linearChain);
    expect(roots[0].children[0].children).toHaveLength(1);
    expect(roots[0].children[0].children[0].title).toBe('C');
  });

  const branchingTree = [
    { id: 1, title: 'Root', status: 'completed', depends_on: null, due_date: '2026-07-01' },
    { id: 2, title: 'Child A', status: 'pending', depends_on: 1, due_date: '2026-08-01' },
    { id: 3, title: 'Child B', status: 'pending', depends_on: 1, due_date: '2026-08-15' },
  ];

  test('branching tree has one root', () => {
    const { roots } = buildTree(branchingTree);
    expect(roots).toHaveLength(1);
  });

  test('root with two children renders both as children', () => {
    const { roots } = buildTree(branchingTree);
    expect(roots[0].children).toHaveLength(2);
  });

  test('two independent deliverables produce two roots', () => {
    const independent = [
      { id: 1, title: 'A', status: 'pending', depends_on: null },
      { id: 2, title: 'B', status: 'pending', depends_on: null },
    ];
    const { roots } = buildTree(independent);
    expect(roots).toHaveLength(2);
  });
});

describe('isBlocked', () => {
  const map = {
    1: { id: 1, title: 'A', status: 'completed', depends_on: null, children: [] },
    2: { id: 2, title: 'B', status: 'pending', depends_on: 1, children: [] },
    3: { id: 3, title: 'C', status: 'pending', depends_on: 2, children: [] },
  };

  test('node with no depends_on is not blocked', () => {
    expect(isBlocked(map[1], map)).toBe(false);
  });

  test('node depending on completed node is not blocked', () => {
    expect(isBlocked(map[2], map)).toBe(false);
  });

  test('node depending on pending node is blocked', () => {
    expect(isBlocked(map[3], map)).toBe(true);
  });
});