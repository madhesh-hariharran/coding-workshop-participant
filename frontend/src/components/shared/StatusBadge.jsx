import { Chip } from '@mui/material';

const STATUS_CONFIG = {
  // Project statuses
  active: { label: 'Active', color: 'success' },
  at_risk: { label: 'At Risk', color: 'warning' },
  on_hold: { label: 'On Hold', color: 'default' },
  completed: { label: 'Completed', color: 'info' },
  // Deliverable statuses
  pending: { label: 'Pending', color: 'default' },
  in_progress: { label: 'In Progress', color: 'primary' },
  // Role badges
  admin: { label: 'Admin', color: 'error' },
  manager: { label: 'Manager', color: 'warning' },
  contributor: { label: 'Contributor', color: 'info' },
  viewer: { label: 'Viewer', color: 'default' },
};

function StatusBadge({ status, size = 'small' }) {
  const config = STATUS_CONFIG[status] || { label: status, color: 'default' };
  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      sx={{ fontWeight: 600, textTransform: 'capitalize' }}
    />
  );
}

export default StatusBadge;