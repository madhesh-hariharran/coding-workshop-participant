import { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, CircularProgress,
  Alert, LinearProgress, Chip, List, ListItem, ListItemText,
  ListItemSecondaryAction, Divider
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PeopleIcon from '@mui/icons-material/People';
import PageHeader from '../shared/PageHeader';
import StatusBadge from '../shared/StatusBadge';
import { getProjects } from '../../api/projectsApi';
import { getDeliverables } from '../../api/deliverablesApi';
import { getAllocations } from '../../api/allocationsApi';

function StatCard({ title, value, icon, color = 'primary.main' }) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={700}>
              {value}
            </Typography>
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
    </Card>
  );
}

function BudgetBar({ project }) {
  const planned = parseFloat(project.budget_planned) || 0;
  const consumed = parseFloat(project.budget_consumed) || 0;
  const pct = planned > 0 ? Math.min((consumed / planned) * 100, 100) : 0;
  const color = pct >= 90 ? 'error' : pct >= 70 ? 'warning' : 'primary';

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" fontWeight={500}>{project.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          ${consumed.toLocaleString()} / ${planned.toLocaleString()}
        </Typography>
      </Box>
      <LinearProgress variant="determinate" value={pct} color={color} sx={{ borderRadius: 1, height: 6 }} />
      <Typography variant="caption" color="text.secondary">{pct.toFixed(0)}% consumed</Typography>
    </Box>
  );
}

function DashboardContent() {
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
  const overAllocated = allocations.over_allocated_resources || [];

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        subtitle="Real-time overview of project health and resource utilization"
      />

      {/* At-risk alert */}
      {atRisk.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }} icon={<WarningAmberIcon />}>
          {atRisk.length} project{atRisk.length > 1 ? 's are' : ' is'} at risk —{' '}
          {atRisk.map((p) => p.name).join(', ')}
        </Alert>
      )}

      {/* Over-allocation alert */}
      {overAllocated.length > 0 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {overAllocated.length} resource{overAllocated.length > 1 ? 's are' : ' is'} over-allocated —{' '}
          {overAllocated.map((r) => `${r.name} (${r.total_allocation}%)`).join(', ')}
        </Alert>
      )}

      {/* Stat cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Projects"
            value={projects.length}
            icon={<FolderIcon sx={{ color: 'white' }} />}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="At Risk"
            value={atRisk.length}
            icon={<WarningAmberIcon sx={{ color: 'white' }} />}
            color="warning.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Completed"
            value={completed.length}
            icon={<CheckCircleIcon sx={{ color: 'white' }} />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Over-allocated"
            value={overAllocated.length}
            icon={<PeopleIcon sx={{ color: 'white' }} />}
            color="error.main"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Active projects list */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Active Projects
              </Typography>
              {active.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No active projects</Typography>
              ) : (
                <List disablePadding>
                  {active.map((p, i) => (
                    <Box key={p.id}>
                      <ListItem disablePadding sx={{ py: 1 }}>
                        <ListItemText
                          primary={p.name}
                          secondary={p.end_date ? `Due: ${p.end_date}` : 'No deadline set'}
                        />
                        <ListItemSecondaryAction>
                          <StatusBadge status={p.status} />
                        </ListItemSecondaryAction>
                      </ListItem>
                      {i < active.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Budget overview */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Budget Overview
              </Typography>
              {projects.filter(p => parseFloat(p.budget_planned) > 0).length === 0 ? (
                <Typography variant="body2" color="text.secondary">No budget data available</Typography>
              ) : (
                projects
                  .filter(p => parseFloat(p.budget_planned) > 0)
                  .map(p => <BudgetBar key={p.id} project={p} />)
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Deliverables summary */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Deliverables Summary
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 2, flex: 1 }}>
                  <Typography variant="h4" fontWeight={700} color="text.secondary">{pending.length}</Typography>
                  <Typography variant="body2" color="text.secondary">Pending</Typography>
                </Box>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 2, flex: 1 }}>
                  <Typography variant="h4" fontWeight={700} color="primary.main">{inProgress.length}</Typography>
                  <Typography variant="body2" color="text.secondary">In Progress</Typography>
                </Box>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 2, flex: 1 }}>
                  <Typography variant="h4" fontWeight={700} color="success.main">
                    {deliverables.filter(d => d.status === 'completed').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Completed</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* At risk projects detail */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Projects at Risk
              </Typography>
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
                      <ListItem disablePadding sx={{ py: 1 }}>
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