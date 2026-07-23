import {
  Card, CardActionArea, CardContent, Box, Typography,
  LinearProgress, IconButton, Tooltip, Chip
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import StatusBadge from '../shared/StatusBadge';
import RoleGuard from '../shared/RoleGuard';

function ProjectCard({ project, onEdit, onDelete, onClick }) {
  const planned = parseFloat(project.budget_planned) || 0;
  const consumed = parseFloat(project.budget_consumed) || 0;
  const pct = planned > 0 ? (consumed / planned) * 100 : 0;
  const displayPct = Math.min(pct, 100);
  const budgetColor = pct >= 100 ? 'error' : pct >= 70 ? 'warning' : 'primary';
  const isOverBudget = pct >= 100;

  return (
    <Card sx={{ width: '100%', display: 'flex', flexDirection: 'column', border: '1px solid', borderColor: 'divider' }}>
      <CardActionArea onClick={onClick} sx={{ flexGrow: 1, alignItems: 'flex-start' }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ lineHeight: 1.3, mb: 0.75 }}>
            {project.name}
          </Typography>
          <Box sx={{ mb: 1.5 }}>
            <StatusBadge status={project.status} />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{
            mb: 1.5, flexGrow: 1,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden'
          }}>
            {project.description || 'No description provided'}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
            Due: {project.end_date || 'N/A'}
          </Typography>
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">Budget</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {isOverBudget && <Chip label="Over" color="error" size="small" sx={{ height: 16, fontSize: 10 }} />}
                <Typography variant="caption" fontWeight={600}
                  color={planned > 0 ? `${budgetColor}.main` : 'text.disabled'}>
                  {planned > 0 ? `${pct.toFixed(0)}%` : 'N/A'}
                </Typography>
              </Box>
            </Box>
            <LinearProgress variant="determinate" value={planned > 0 ? displayPct : 0}
              color={budgetColor} sx={{ borderRadius: 1, height: 4, bgcolor: 'action.hover' }} />
          </Box>
        </CardContent>
      </CardActionArea>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1, py: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <RoleGuard minRole="manager">
          <Tooltip title="Edit project">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(project); }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </RoleGuard>
        <RoleGuard minRole="admin">
          <Tooltip title="Delete project">
            <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onDelete(project); }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </RoleGuard>
      </Box>
    </Card>
  );
}

export default ProjectCard;