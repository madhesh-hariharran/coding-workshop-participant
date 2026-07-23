import {
  Card, CardActionArea, CardContent, Box, Typography,
  LinearProgress, IconButton, Tooltip
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

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', width: '100%' }}>
      <CardActionArea onClick={onClick} sx={{ flexGrow: 1 }}>
        <CardContent>
          {/* Name + Status */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Typography variant="h6" fontWeight={600} sx={{ flexGrow: 1, mr: 1 }}>
              {project.name}
            </Typography>
            <StatusBadge status={project.status} />
          </Box>

          {/* Description */}
          <Typography variant="body2" color="text.secondary" sx={{
            mb: 1.5, display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            minHeight: '2.5em'
          }}>
            {project.description || 'No description provided'}
          </Typography>

          {/* Due date */}
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Due: {project.end_date || 'N/A'}
          </Typography>

          {/* Budget */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Budget</Typography>
              <Typography variant="caption" fontWeight={600} color={planned > 0 ? `${budgetColor}.main` : 'text.disabled'}>
                {planned > 0 ? `${pct.toFixed(0)}%` : 'N/A'}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={planned > 0 ? displayPct : 0}
              color={budgetColor}
              sx={{ borderRadius: 1, height: 4, bgcolor: 'action.hover' }}
            />
          </Box>
        </CardContent>
      </CardActionArea>

      {/* Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1, pt: 0 }}>
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