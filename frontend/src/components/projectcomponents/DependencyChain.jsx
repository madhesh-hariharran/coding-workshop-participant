import { Box, Typography, Chip } from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import StatusBadge from '../shared/StatusBadge';

function buildTree(deliverables) {
  const map = {};
  deliverables.forEach(d => { map[d.id] = { ...d, dependents: [] }; });

  const childIds = new Set();
  deliverables.forEach(d => {
    if (d.depends_on && map[d.depends_on]) {
      map[d.depends_on].dependents.push(map[d.id]);
      childIds.add(d.id);
    }
  });

  // Roots: nodes that are not a child of anyone
  const roots = deliverables
    .filter(d => !childIds.has(d.id))
    .map(d => map[d.id]);

  return { roots, map };
}

function isBlocked(node, map) {
  // A node is blocked if its dependency exists and is NOT completed
  if (!node.depends_on) return false;
  const dep = map[node.depends_on];
  if (!dep) return false;
  return dep.status !== 'completed';
}

function DeliverableNode({ node, map, depth = 0 }) {
  const blocked = isBlocked(node, map);

  return (
    <Box sx={{ ml: depth > 0 ? 3 : 0 }}>
      {depth > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', ml: 2, mb: 0.5 }}>
          <Box sx={{ width: 2, height: 16, bgcolor: 'divider' }} />
          <ArrowDownwardIcon sx={{ fontSize: 14, color: 'text.disabled', ml: -0.75 }} />
        </Box>
      )}
      <Box sx={{
        p: 1.5,
        border: '1px solid',
        borderColor: node.status === 'completed' ? 'success.light' : blocked ? 'warning.light' : 'divider',
        borderRadius: 2,
        bgcolor: node.status === 'completed' ? 'rgba(46,125,50,0.06)' : blocked ? 'rgba(237,108,2,0.04)' : 'background.paper',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        flexWrap: 'wrap',
      }}>
        <Box>
          <Typography variant="body2" fontWeight={600}>{node.title}</Typography>
          {node.due_date && (
            <Typography variant="caption" color="text.secondary">Due: {node.due_date}</Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <StatusBadge status={node.status} />
          {blocked && (
            <Chip
              icon={<WarningAmberIcon sx={{ fontSize: 14 }} />}
              label="Blocked"
              size="small"
              color="warning"
              variant="outlined"
            />
          )}
        </Box>
      </Box>

      {node.dependents.map((child) => (
        <DeliverableNode key={child.id} node={child} map={map} depth={depth + 1} />
      ))}
    </Box>
  );
}

function DependencyChain({ deliverables }) {
  if (!deliverables || deliverables.length === 0) {
    return <Typography variant="body2" color="text.secondary">No deliverables to show.</Typography>;
  }

  const hasDependencies = deliverables.some(d => d.depends_on);
  if (!hasDependencies) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          No dependencies set between deliverables.
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Set a "Depends on" when adding or editing a deliverable to create a chain.
        </Typography>
      </Box>
    );
  }

  const { roots, map } = buildTree(deliverables);

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Shows the order deliverables must be completed. A blocked deliverable's dependency is not yet done.
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {roots.map(root => (
          <DeliverableNode key={root.id} node={root} map={map} depth={0} />
        ))}
      </Box>
    </Box>
  );
}

export default DependencyChain;