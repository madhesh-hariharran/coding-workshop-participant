import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, CardActionArea, Typography, CircularProgress,
  Alert, LinearProgress, Chip, List, ListItem, ListItemText,
  ListItemSecondaryAction, Divider, Button, IconButton, Tooltip
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PeopleIcon from '@mui/icons-material/People';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PageHeader from '../shared/PageHeader';
import StatusBadge from '../shared/StatusBadge';
import RoleGuard from '../shared/RoleGuard';
import { getProjects } from '../../api/projectsApi';
import { getDeliverables } from '../../api/deliverablesApi';
import { getAllocations } from '../../api/allocationsApi';

function StatCard({ title, value, icon, color = 'primary.main', onClick, filterLabel }) {
  return (
    <Card sx={{ cursor: onClick ? 'pointer' : 'default' }}>
      <CardActionArea onClick={onClick} disabled={!onClick}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {title}
              </Typography>
              <Typography variant="h4" fontWeight={700}>{value}</Typography>
              {filterLabel && (
                <Typography variant="caption" color="primary.main" sx={{ mt: 0.5, display: 'block' }}>
                  {filterLabel}
                </Typography>
              )}
            </Box>
            <Box sx={{
              width: 48, height: 48, borderRadius: '50%',
              bgcolor: color, display: 'flex',
              alignItems: 'center', justifyContent: 'center', opacity: 0.85
            }}>
              {icon}
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function BudgetBar({ project, onClick }) {
  const planned = parseFloat(project.budget_planned) || 0;
  const consumed = parseFloat(project.budget_consumed) || 0;
  const pct = planned > 0 ? (consumed / planned) * 100 : 0;
  const displayPct = Math.min(pct, 100);
  const color = pct >= 100 ? 'error' : pct >= 70 ? 'warning' : 'primary';

  return (
    <Box sx={{ mb: 2, cursor: 'pointer' }} onClick={onClick}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" fontWeight={500}>{project.name}</Typography>
        <Typography variant="body2" fontWeight={600} color={`${color}.main`}>
          {pct.toFixed(0)}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate" value={displayPct} color={color}
        sx={{ borderRadius: 1, height: 6, bgcolor: 'action.hover' }}
      />
      <Typography variant="caption" color="text.secondary">
        ${consumed.toLocaleString()} / ${planned.toLocaleString()}
      </Typography>
    </Box>
  );
}

function DashboardContent() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [allocations, setAllocations] = useState({ over_allocated_resources: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [projRes, delRes, allocRes] = await Promise.all([
          getProjects(),
          getDeliverables(),
          getAllocations(),
        ]);
        setProjects(projRes.data.projects || []);
        setDeliverables(delRes.data.deliverables || []);
        setAllocations(allocRes.data || { over_allocated_resources: [] });
      } catch {
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>;

  const atRisk = projects.filter((p) => p.status === 'at_risk');
  const active = projects.filter((p) => p.status === 'active');
  const completed = projects.filter((p) => p.status === 'completed');
  const pending = deliverables.filter((d) => d.status === 'pending');
  const inProgress = deliverables.filter((d) => d.status === 'in_progress');
  const completedDel = deliverables.filter((d) => d.status === 'completed');
  const overAllocated = allocations.over_allocated_resources || [];
  const budgetProjects = projects.filter(p => parseFloat(p.budget_planned) > 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time overview of project health and resource utilization
          </Typography>
        </Box>
        <RoleGuard minRole="manager">
          <Button
            variant="contained" startIcon={<AddIcon />}
            onClick={() => navigate('/projects')}
          >
            New Project
          </Button>
        </RoleGuard>
      </Box>

      {/* Alerts */}
      {atRisk.length > 0 && (
        <Alert
          severity="warning" sx={{ mb: 2 }} icon={<WarningAmberIcon />}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/projects?status=at_risk')}>
              View all
            </Button>
          }
        >
          {atRisk.length} project{atRisk.length > 1 ? 's are' : ' is'} at risk —{' '}
          {atRisk.map((p) => p.name).join(', ')}
        </Alert>
      )}

      {overAllocated.length > 0 && (
        <Alert
          severity="error" sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/allocations')}>
              View allocations
            </Button>
          }
        >
          {overAllocated.length} resource{overAllocated.length > 1 ? 's are' : ' is'} over-allocated —{' '}
          {overAllocated.map((r) => `${r.name} (${r.total_allocation}%)`).join(', ')}
        </Alert>
      )}

      {/* Stat cards — clickable */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Projects" value={projects.length}
            icon={<FolderIcon sx={{ color: 'white' }} />}
            color="primary.main"
            onClick={() => navigate('/projects')}
            filterLabel="Click to view all →"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="At Risk" value={atRisk.length}
            icon={<WarningAmberIcon sx={{ color: 'white' }} />}
            color="warning.main"
            onClick={atRisk.length > 0 ? () => navigate('/projects') : null}
            filterLabel={atRisk.length > 0 ? "Click to view at-risk projects →" : null}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Completed" value={completed.length}
            icon={<CheckCircleIcon sx={{ color: 'white' }} />}
            color="success.main"
            onClick={completed.length > 0 ? () => navigate('/projects') : null}
            filterLabel={completed.length > 0 ? "Click to view completed →" : null}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Over-allocated" value={overAllocated.length}
            icon={<PeopleIcon sx={{ color: 'white' }} />}
            color="error.main"
            onClick={overAllocated.length > 0 ? () => navigate('/allocations') : null}
            filterLabel={overAllocated.length > 0 ? "Click to manage allocations →" : null}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Active projects */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>Active Projects</Typography>
                <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/projects')}>
                  View all
                </Button>
              </Box>
              {active.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No active projects</Typography>
              ) : (
                <List disablePadding>
                  {active.slice(0, 5).map((p, i) => (
                    <Box key={p.id}>
                      <ListItem
                        disablePadding sx={{ py: 1, cursor: 'pointer' }}
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        <ListItemText
                          primary={p.name}
                          secondary={p.end_date ? `Due: ${p.end_date}` : 'No deadline set'}
                        />
                        <ListItemSecondaryAction>
                          <StatusBadge status={p.status} />
                        </ListItemSecondaryAction>
                      </ListItem>
                      {i < active.slice(0, 5).length - 1 && <Divider />}
                    </Box>
                  ))}
                  {active.length > 5 && (
                    <Box sx={{ pt: 1 }}>
                      <Button size="small" onClick={() => navigate('/projects')}>
                        +{active.length - 5} more projects
                      </Button>
                    </Box>
                  )}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Budget overview */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>Budget Overview</Typography>
                <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/projects')}>
                  View all
                </Button>
              </Box>
              {budgetProjects.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No budget data available</Typography>
              ) : (
                budgetProjects.slice(0, 5).map(p => (
                  <BudgetBar key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Deliverables summary */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>Deliverables Summary</Typography>
                <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/deliverables')}>
                  View all
                </Button>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Box
                    sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 2, cursor: 'pointer' }}
                    onClick={() => navigate('/deliverables')}
                  >
                    <Typography variant="h4" fontWeight={700} color="text.secondary">{pending.length}</Typography>
                    <Typography variant="body2" color="text.secondary">Pending</Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box
                    sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 2, cursor: 'pointer' }}
                    onClick={() => navigate('/deliverables')}
                  >
                    <Typography variant="h4" fontWeight={700} color="primary.main">{inProgress.length}</Typography>
                    <Typography variant="body2" color="text.secondary">In Progress</Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box
                    sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 2, cursor: 'pointer' }}
                    onClick={() => navigate('/deliverables')}
                  >
                    <Typography variant="h4" fontWeight={700} color="success.main">{completedDel.length}</Typography>
                    <Typography variant="body2" color="text.secondary">Completed</Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* At risk projects */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>Projects at Risk</Typography>
                {atRisk.length > 0 && (
                  <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/projects')}>
                    View all
                  </Button>
                )}
              </Box>
              {atRisk.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    All projects on track
                  </Typography>
                </Box>
              ) : (
                <List disablePadding>
                  {atRisk.map((p, i) => (
                    <Box key={p.id}>
                      <ListItem
                        disablePadding sx={{ py: 1, cursor: 'pointer' }}
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        <ListItemText
                          primary={p.name}
                          secondary={p.end_date ? `Deadline: ${p.end_date}` : 'No deadline'}
                        />
                        <ListItemSecondaryAction>
                          <Chip label="At Risk" color="warning" size="small" />
                        </ListItemSecondaryAction>
                      </ListItem>
                      {i < atRisk.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default DashboardContent;