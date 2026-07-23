import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, Typography, CircularProgress,
  Alert, LinearProgress, Chip, List, ListItem, ListItemText,
  Divider, Button
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import StatusBadge from '../shared/StatusBadge';
import RoleGuard from '../shared/RoleGuard';
import { getProjects } from '../../api/projectsApi';
import { getDeliverables } from '../../api/deliverablesApi';
import { getAllocations } from '../../api/allocationsApi';
import { getResources } from '../../api/resourcesApi';

const COLORS = {
  active: '#4caf50',
  completed: '#1565c0',
  inProgress: '#2e7d32',
  atRisk: '#ed6c02',
  onHold: '#9e9e9e',
};

function TwoTierDonut({ projects, size = 130 }) {
  const ongoing = projects.filter(p => p.status !== 'completed');
  const completed = projects.filter(p => p.status === 'completed');
  const inProgress = projects.filter(p => p.status === 'active');
  const atRisk = projects.filter(p => p.status === 'at_risk');
  const onHold = projects.filter(p => p.status === 'on_hold');
  const total = projects.length;

  if (total === 0) return (
    <Box sx={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="body2" color="text.secondary">No data</Typography>
    </Box>
  );

  const cx = size / 2, cy = size / 2;
  const outerR = 52, innerR = 36, sw = 14;

  const makeSegs = (data, r) => {
    const c = 2 * Math.PI * r;
    let off = 0;
    return data.map(d => {
      const pct = d.value / total;
      const dash = pct * c;
      const gap = c - dash;
      const seg = { ...d, dash, gap, offset: off * c };
      off += pct;
      return seg;
    });
  };

  const outerSegs = makeSegs([
    { label: 'Active', value: ongoing.length, color: COLORS.active },
    { label: 'Completed', value: completed.length, color: COLORS.completed },
  ], outerR);

  const innerSegs = makeSegs([
    { label: 'In Progress', value: inProgress.length, color: COLORS.inProgress },
    { label: 'At Risk', value: atRisk.length, color: COLORS.atRisk },
    { label: 'On Hold', value: onHold.length, color: COLORS.onHold },
  ], innerR);

  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {outerSegs.map((s, i) => (
          <circle key={`o${i}`} cx={cx} cy={cy} r={outerR} fill="none"
            stroke={s.color} strokeWidth={sw}
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={-s.offset} opacity={0.9} />
        ))}
        {innerSegs.map((s, i) => (
          <circle key={`i${i}`} cx={cx} cy={cy} r={innerR} fill="none"
            stroke={s.color} strokeWidth={sw}
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={-s.offset} opacity={0.85} />
        ))}
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h5" fontWeight={700}>{total}</Typography>
        <Typography variant="caption" color="text.secondary">projects</Typography>
      </Box>
    </Box>
  );
}

function DashboardContent() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [allocations, setAllocations] = useState({ over_allocated_resources: [] });
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [projRes, delRes, allocRes, resRes] = await Promise.all([
          getProjects(), getDeliverables(), getAllocations(), getResources(),
        ]);
        setProjects(projRes.data.projects || []);
        setDeliverables(delRes.data.deliverables || []);
        setAllocations(allocRes.data || { over_allocated_resources: [] });
        setResources(resRes.data.resources || []);
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

  const atRisk = projects.filter(p => p.status === 'at_risk');
  const active = projects.filter(p => p.status === 'active');
  const completed = projects.filter(p => p.status === 'completed');
  const onHold = projects.filter(p => p.status === 'on_hold');
  const ongoing = projects.filter(p => p.status !== 'completed');
  const overAllocated = allocations.over_allocated_resources || [];
  const overBudget = projects.filter(p => {
    const planned = parseFloat(p.budget_planned) || 0;
    const consumed = parseFloat(p.budget_consumed) || 0;
    return planned > 0 && consumed > planned;
  });

  const pendingDel = deliverables.filter(d => d.status === 'pending');
  const inProgressDel = deliverables.filter(d => d.status === 'in_progress');
  const completedDel = deliverables.filter(d => d.status === 'completed');

  const today = new Date().toISOString().split('T')[0];
  const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const upcoming = deliverables
    .filter(d => d.due_date && d.due_date >= today && d.due_date <= in14Days && d.status !== 'completed')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5);

  const budgetProjects = projects.filter(p => parseFloat(p.budget_planned) > 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time overview of project health and resource utilization
          </Typography>
        </Box>
        <RoleGuard minRole="manager">
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => navigate('/projects', { state: { openForm: true } })}>
            New Project
          </Button>
        </RoleGuard>
      </Box>

      {atRisk.length > 0 && (
        <Alert severity="warning" sx={{ mb: 1 }} icon={<WarningAmberIcon />}
          action={<Button color="inherit" size="small" onClick={() => navigate('/projects?status=at_risk')}>View</Button>}>
          {atRisk.length} project{atRisk.length > 1 ? 's are' : ' is'} at risk —{' '}
          {atRisk.map(p => p.name).join(', ')}
        </Alert>
      )}
      {overBudget.length > 0 && (
        <Alert severity="error" sx={{ mb: 1 }}
          action={<Button color="inherit" size="small" onClick={() => navigate('/projects?budget=over')}>View</Button>}>
          {overBudget.length} project{overBudget.length > 1 ? 's are' : ' is'} over budget —{' '}
          {overBudget.map(p => p.name).join(', ')}
        </Alert>
      )}
      {overAllocated.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}
          action={<Button color="inherit" size="small" onClick={() => navigate('/allocations')}>View</Button>}>
          {overAllocated.length} resource{overAllocated.length > 1 ? 's are' : ' is'} over-allocated
        </Alert>
      )}

      {/* Row 1 — 3 equal cards using flexbox */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        {/* Project Health */}
        <Card sx={{ flex: 1, minWidth: 0 }}>
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="h6" fontWeight={600}>Project Health</Typography>
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/projects')}>View all</Button>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexGrow: 1 }}>
              <TwoTierDonut projects={projects} size={120} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.5, letterSpacing: 0.5 }}>
                  CATEGORY
                </Typography>
                {[
                  { label: 'Active', value: ongoing.length, color: COLORS.active },
                  { label: 'Completed', value: completed.length, color: COLORS.completed },
                ].map(d => (
                  <Box key={d.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: d.color, flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ flex: 1 }}>{d.label}</Typography>
                    <Typography variant="body2" fontWeight={700}>{d.value}</Typography>
                  </Box>
                ))}
                <Divider sx={{ my: 0.75 }} />
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.5, letterSpacing: 0.5 }}>
                  ACTIVE STATUS
                </Typography>
                {[
                  { label: 'In Progress', value: active.length, color: COLORS.inProgress },
                  { label: 'At Risk', value: atRisk.length, color: COLORS.atRisk },
                  { label: 'On Hold', value: onHold.length, color: COLORS.onHold },
                ].map(d => (
                  <Box key={d.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: d.color, flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ flex: 1 }}>{d.label}</Typography>
                    <Typography variant="caption" fontWeight={700}>{d.value}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Deliverables */}
        <Card sx={{ flex: 1, minWidth: 0 }}>
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="h6" fontWeight={600}>Deliverables</Typography>
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/deliverables')}>View all</Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              {[
                { label: 'Pending', count: pendingDel.length, color: 'text.secondary' },
                { label: 'In Progress', count: inProgressDel.length, color: 'primary.main' },
                { label: 'Completed', count: completedDel.length, color: 'success.main' },
              ].map((item) => (
                <Box key={item.label} sx={{
                  flex: 1, textAlign: 'center', p: 1.5, bgcolor: 'background.default',
                  borderRadius: 2, cursor: 'pointer', border: '1px solid', borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover' }
                }} onClick={() => navigate(`/deliverables?status=${item.label === 'Pending' ? 'pending' : item.label === 'Completed' ? 'completed' : 'in_progress'}`)}>
                  <Typography variant="h4" fontWeight={700} color={item.color}>{item.count}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{item.label}</Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ mt: 'auto' }}>
              {deliverables.length > 0 ? (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">Overall completion</Typography>
                    <Typography variant="caption" fontWeight={600}>
                      {Math.round((completedDel.length / deliverables.length) * 100)}%
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate"
                    value={(completedDel.length / deliverables.length) * 100}
                    color="success" sx={{ height: 6, borderRadius: 1 }}
                  />
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">No deliverables yet</Typography>
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Resource Utilization */}
        <Card sx={{ flex: 1, minWidth: 0 }}>
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="h6" fontWeight={600}>Resource Utilization</Typography>
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/resources')}>View all</Button>
            </Box>
            {resources.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No resources added yet</Typography>
            ) : (
              resources.slice(0, 5).map((r) => {
                const alloc = parseInt(r.total_allocation) || 0;
                const isOver = alloc > 100;
                const color = isOver ? 'error' : alloc > 80 ? 'warning' : 'primary';
                return (
                  <Box key={r.id} sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: '65%' }}>{r.name}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" fontWeight={600} color={`${color}.main`}>{alloc}%</Typography>
                        {isOver && <Chip label="Over" color="error" size="small" sx={{ height: 16, fontSize: 10 }} />}
                      </Box>
                    </Box>
                    <LinearProgress variant="determinate" value={Math.min(alloc, 100)} color={color}
                      sx={{ height: 4, borderRadius: 1, bgcolor: 'action.hover' }} />
                  </Box>
                );
              })
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Row 2 — 2 equal cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Card sx={{ flex: 1, minWidth: 0 }}>
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccessTimeIcon color="warning" fontSize="small" />
                <Typography variant="h6" fontWeight={600}>Upcoming Deadlines</Typography>
                <Chip label="14 days" size="small" color="warning" variant="outlined" />
              </Box>
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/deliverables')}>View all</Button>
            </Box>
            {upcoming.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircleIcon color="success" sx={{ fontSize: 32 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  No deadlines in the next 14 days
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {upcoming.map((d, i) => {
                  const daysLeft = Math.ceil((new Date(d.due_date) - new Date()) / (1000 * 60 * 60 * 24));
                  const urgent = daysLeft <= 3;
                  return (
                    <Box key={d.id}>
                      <ListItem disablePadding sx={{ py: 0.75, cursor: 'pointer' }}
                        onClick={() => navigate(`/projects/${d.project_id}`)}>
                        <ListItemText
                          primary={d.title} secondary={d.project_name}
                        />
                        <Chip
                          label={daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d`}
                          size="small" color={urgent ? 'error' : 'warning'}
                        />
                      </ListItem>
                      {i < upcoming.length - 1 && <Divider />}
                    </Box>
                  );
                })}
              </List>
            )}
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 0 }}>
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AttachMoneyIcon color="primary" fontSize="small" />
                <Typography variant="h6" fontWeight={600}>Budget Health</Typography>
                {overBudget.length > 0 && (
                  <Chip label={`${overBudget.length} over budget`} size="small" color="error" variant="outlined" />
                )}
              </Box>
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/projects')}>View all</Button>
            </Box>
            {budgetProjects.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No budget data available</Typography>
            ) : (
              <Box sx={{ flexGrow: 1 }}>
                {budgetProjects.slice(0, 5).map((p) => {
                  const planned = parseFloat(p.budget_planned);
                  const consumed = parseFloat(p.budget_consumed) || 0;
                  const pct = (consumed / planned) * 100;
                  const color = pct >= 100 ? 'error' : pct >= 70 ? 'warning' : 'primary';
                  return (
                    <Box key={p.id} sx={{ mb: 1.5, cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.id}`)}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: '70%' }}>{p.name}</Typography>
                        <Typography variant="body2" fontWeight={600} color={`${color}.main`}>{pct.toFixed(0)}%</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={Math.min(pct, 100)} color={color}
                        sx={{ height: 5, borderRadius: 1, bgcolor: 'action.hover' }} />
                      <Typography variant="caption" color="text.secondary">
                        ${consumed.toLocaleString()} / ${planned.toLocaleString()}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Active Projects — full width, flexbox grid */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight={600}>Active Projects</Typography>
              <Typography variant="caption" color="text.secondary">
                All projects not yet completed — In Progress, At Risk, On Hold
              </Typography>
            </Box>
            <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/projects')}>View all</Button>
          </Box>
          {ongoing.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No active projects</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {ongoing.slice(0, 8).map((p) => {
                const planned = parseFloat(p.budget_planned) || 0;
                const consumed = parseFloat(p.budget_consumed) || 0;
                const budgetPct = planned > 0 ? Math.min((consumed / planned) * 100, 100) : 0;
                const projDels = deliverables.filter(d => d.project_id === p.id);
                const projCompleted = projDels.filter(d => d.status === 'completed').length;
                const projProgress = projDels.length > 0 ? (projCompleted / projDels.length) * 100 : 0;
                return (
                  <Box key={p.id} sx={{
                    flex: { xs: '1 1 calc(50% - 8px)', md: '1 1 calc(25% - 12px)' },
                    maxWidth: { xs: 'calc(50% - 8px)', md: 'calc(25% - 12px)' },
                    p: 2, border: '1px solid', borderColor: 'divider',
                    borderRadius: 2, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column',
                    '&:hover': { bgcolor: 'action.hover' }, transition: 'background 0.15s'
                  }} onClick={() => navigate(`/projects/${p.id}`)}>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5, wordBreak: 'break-word' }}>
                      {p.name}
                    </Typography>
                    <Box sx={{ mb: 1 }}>
                      <StatusBadge status={p.status} />
                    </Box>
                    {p.end_date && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                        Due: {p.end_date}
                      </Typography>
                    )}
                    {projDels.length > 0 && (
                      <Box sx={{ mb: 0.75 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">Deliverables</Typography>
                          <Typography variant="caption">{projCompleted}/{projDels.length}</Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={projProgress} color="success"
                          sx={{ height: 3, borderRadius: 1, mt: 0.25, bgcolor: 'action.hover' }} />
                      </Box>
                    )}
                    {planned > 0 && (
                      <Box sx={{ mt: 'auto' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">Budget</Typography>
                          <Typography variant="caption">{budgetPct.toFixed(0)}%</Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={budgetPct}
                          color={budgetPct >= 90 ? 'error' : budgetPct >= 70 ? 'warning' : 'primary'}
                          sx={{ height: 3, borderRadius: 1, mt: 0.25, bgcolor: 'action.hover' }} />
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default DashboardContent;