import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, CircularProgress, Alert,
  Button, Grid, Chip, LinearProgress, Tabs, Tab, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Select, MenuItem, FormControl, InputLabel, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, InputAdornment
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import StatusBadge from '../shared/StatusBadge';
import RoleGuard from '../shared/RoleGuard';
import { getProject, updateProject } from '../../api/projectsApi';
import { getDeliverables, createDeliverable, updateDeliverable, deleteDeliverable } from '../../api/deliverablesApi';
import { getAllocations } from '../../api/allocationsApi';

const DELIVERABLE_STATUSES = ['pending', 'in_progress', 'completed'];
const PROJECT_STATUSES = ['active', 'at_risk', 'on_hold', 'completed'];

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

function validateDeliverableField(name, value, project) {
  switch (name) {
    case 'title':
      if (!value.trim()) return 'Title is required';
      if (value.trim().length > 255) return 'Title must be under 255 characters';
      return '';
    case 'due_date':
      if (!value) return '';
      if (project?.start_date && value < project.start_date)
        return `Due date cannot be before project start date (${project.start_date})`;
      if (project?.end_date && value > project.end_date)
        return `Due date cannot be after project end date (${project.end_date})`;
      return '';
    default:
      return '';
  }
}

// Inline editable field component
function InlineField({ label, value, onSave, type = 'text', minRole = 'manager', prefix = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(value || '');
    setEditing(false);
  };

  if (editing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TextField
          value={draft} onChange={(e) => setDraft(e.target.value)}
          type={type} size="small" autoFocus
          slotProps={type === 'date' ? { inputLabel: { shrink: true } } : {}}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
        />
        <IconButton size="small" color="primary" onClick={handleSave} disabled={saving}>
          <CheckIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={handleCancel} disabled={saving}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  return (
    <RoleGuard minRole={minRole} fallback={
      <Typography variant="body2">{prefix}{value || 'N/A'}</Typography>
    }>
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', '&:hover .edit-icon': { opacity: 1 } }}
        onClick={() => { setDraft(value || ''); setEditing(true); }}
      >
        <Typography variant="body2">{prefix}{value || <span style={{ color: '#aaa' }}>Click to set {label}</span>}</Typography>
        <EditIcon className="edit-icon" fontSize="small" sx={{ opacity: 0, transition: 'opacity 0.2s', color: 'text.secondary', fontSize: 14 }} />
      </Box>
    </RoleGuard>
  );
}

function DeliverableForm({ open, onClose, onSave, initial, projectId, project, deliverables }) {
  const EMPTY = { title: '', description: '', status: 'pending', due_date: '', project_id: projectId, depends_on: '' };
  const [form, setForm] = useState(initial || EMPTY);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  // Available deliverables for depends_on (exclude current one)
  const availableDeliverables = deliverables.filter(d => !initial || d.id !== initial.id);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial, depends_on: initial.depends_on || '' } : EMPTY);
      setErrors({});
      setTouched({});
      setApiError('');
    }
  }, [open, initial]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setTouched((p) => ({ ...p, [name]: true }));
    setErrors((p) => ({ ...p, [name]: validateDeliverableField(name, value, project) }));
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((p) => ({ ...p, [name]: true }));
    setErrors((p) => ({ ...p, [name]: validateDeliverableField(name, value, project) }));
  };

  const handleSave = async () => {
    const titleError = validateDeliverableField('title', form.title, project);
    const dateError = validateDeliverableField('due_date', form.due_date, project);
    if (titleError || dateError) {
      setErrors({ title: titleError, due_date: dateError });
      setTouched({ title: true, due_date: true });
      return;
    }
    setLoading(true);
    try {
      await onSave({
        ...form,
        depends_on: form.depends_on ? parseInt(form.depends_on) : null,
      });
      onClose();
    } catch (err) {
      setApiError(err.response?.data?.error || 'Failed to save deliverable');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = form.title.trim() && !Object.values(errors).some(Boolean);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={600}>{initial ? 'Edit Deliverable' : 'New Deliverable'}</DialogTitle>
      <DialogContent>
        {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Title" name="title" value={form.title}
            onChange={handleChange} onBlur={handleBlur}
            error={touched.title && Boolean(errors.title)}
            helperText={touched.title && errors.title}
            fullWidth required
          />
          <TextField
            label="Description" name="description" value={form.description}
            onChange={handleChange} fullWidth multiline rows={2}
          />
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select name="status" value={form.status} label="Status" onChange={handleChange}>
              {DELIVERABLE_STATUSES.map((s) => (
                <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Due date" name="due_date" type="date" value={form.due_date}
            onChange={handleChange} onBlur={handleBlur}
            error={touched.due_date && Boolean(errors.due_date)}
            helperText={
              (touched.due_date && errors.due_date) ||
              (project?.start_date && project?.end_date
                ? `Project runs ${project.start_date} → ${project.end_date}`
                : '')
            }
            fullWidth slotProps={{ inputLabel: { shrink: true } }}
          />
          {availableDeliverables.length > 0 && (
            <FormControl fullWidth>
              <InputLabel>Depends on (optional)</InputLabel>
              <Select
                name="depends_on" value={form.depends_on} label="Depends on (optional)"
                onChange={handleChange} MenuProps={{ disablePortal: true }}
              >
                <MenuItem value="">No dependency</MenuItem>
                {availableDeliverables.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StatusBadge status={d.status} />
                      <Typography variant="body2">{d.title}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading || !isFormValid}>
          {loading ? <CircularProgress size={20} /> : initial ? 'Save changes' : 'Add deliverable'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function BudgetDisplay({ planned, consumed, budgetPct, budgetColor, isOverBudget }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">Budget</Typography>
        {isOverBudget && <Chip label="Over budget" color="error" size="small" />}
        <Typography variant="body2" fontWeight={700} color={`${budgetColor}.main`} sx={{ ml: 'auto' }}>
          {budgetPct.toFixed(1)}%
        </Typography>
      </Box>
      <Box sx={{ position: 'relative', height: 8, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
        <Box sx={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${Math.min(budgetPct, 100)}%`,
          bgcolor: `${budgetColor}.main`, borderRadius: 1,
          transition: 'width 0.3s ease',
        }} />
        {isOverBudget && <Box sx={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '4px', bgcolor: 'error.dark' }} />}
      </Box>
      <Typography variant="caption" color="text.secondary">
        ${consumed.toLocaleString()} consumed of ${planned.toLocaleString()} planned
      </Typography>
    </Box>
  );
}

function ProjectDetailContent() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [deliverables, setDeliverables] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [editingStatus, setEditingStatus] = useState(false);
  const [deliverableForm, setDeliverableForm] = useState({ open: false, initial: null });
  const [deleteDeliverableConfirm, setDeleteDeliverableConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [projRes, delRes, allocRes] = await Promise.all([
        getProject(id),
        getDeliverables({ project_id: id }),
        getAllocations({ project_id: id }),
      ]);
      setProject(projRes.data.project);
      setDeliverables(delRes.data.deliverables || []);
      setAllocations(allocRes.data.allocations || []);
    } catch {
      setError('Failed to load project details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleFieldSave = async (field, value) => {
    try {
      const res = await updateProject(id, { [field]: value });
      setProject(res.data.project);
    } catch (err) {
      setError(err.response?.data?.error || `Failed to update ${field}`);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await updateProject(id, { status: newStatus });
      setProject(res.data.project);
    } catch {
      setError('Failed to update status');
    } finally {
      setEditingStatus(false);
    }
  };

  const handleAddDeliverable = async (form) => {
    await createDeliverable({ ...form, project_id: parseInt(id) });
    fetchAll();
  };

  const handleEditDeliverable = async (form) => {
    await updateDeliverable(deliverableForm.initial.id, form);
    fetchAll();
  };

  const handleDeleteDeliverable = async () => {
    setDeleteLoading(true);
    try {
      await deleteDeliverable(deleteDeliverableConfirm.id);
      setDeleteDeliverableConfirm(null);
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete deliverable');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleQuickStatusChange = async (deliverableId, newStatus) => {
    try {
      await updateDeliverable(deliverableId, { status: newStatus });
      fetchAll();
    } catch {
      setError('Failed to update deliverable status');
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>{error}</Alert>;
  if (!project) return <Alert severity="warning">Project not found</Alert>;

  const planned = parseFloat(project.budget_planned) || 0;
  const consumed = parseFloat(project.budget_consumed) || 0;
  const budgetPct = planned > 0 ? (consumed / planned) * 100 : 0;
  const budgetColor = budgetPct >= 100 ? 'error' : budgetPct >= 70 ? 'warning' : 'primary';
  const isOverBudget = budgetPct > 100;
  const completedDeliverables = deliverables.filter(d => d.status === 'completed').length;
  const progressPct = deliverables.length > 0 ? (completedDeliverables / deliverables.length) * 100 : 0;

  return (
    <Box>
      {/* Breadcrumb */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
        <IconButton onClick={() => navigate(-1)} size="small"><ArrowBackIcon /></IconButton>
        <Typography
          variant="body2" color="text.secondary"
          sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
          onClick={() => navigate(-1)}
        >
          Back
        </Typography>
        <Typography variant="body2" color="text.secondary">›</Typography>
        <Typography variant="body2" fontWeight={600}>{project.name}</Typography>
      </Box>

      {/* Project header — all fields inline editable */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            {/* Name — inline editable */}
            <RoleGuard minRole="manager" fallback={
              <Typography variant="h5" fontWeight={700} gutterBottom>{project.name}</Typography>
            }>
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">Project Name</Typography>
                <InlineField
                  label="project name"
                  value={project.name}
                  onSave={(v) => handleFieldSave('name', v)}
                  minRole="manager"
                />
              </Box>
            </RoleGuard>

            {/* Description */}
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary">Description</Typography>
              <InlineField
                label="description"
                value={project.description}
                onSave={(v) => handleFieldSave('description', v)}
                minRole="manager"
              />
            </Box>
          </Box>

          {/* Status + dates */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            {editingStatus ? (
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <Select
                  value={project.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  autoFocus onBlur={() => setEditingStatus(false)}
                  MenuProps={{ disablePortal: true }}
                >
                  {PROJECT_STATUSES.map((s) => (
                    <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <RoleGuard minRole="manager" fallback={<StatusBadge status={project.status} />}>
                <Tooltip title="Click to change status">
                  <Box sx={{ cursor: 'pointer' }} onClick={() => setEditingStatus(true)}>
                    <StatusBadge status={project.status} />
                  </Box>
                </Tooltip>
              </RoleGuard>
            )}

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">Start:</Typography>
              <InlineField label="start date" value={project.start_date} onSave={(v) => handleFieldSave('start_date', v)} type="date" minRole="manager" />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">Due:</Typography>
              <InlineField label="end date" value={project.end_date} onSave={(v) => handleFieldSave('end_date', v)} type="date" minRole="manager" />
            </Box>
          </Box>

          {/* Budget inline editable */}
          <Grid container spacing={2} sx={{ mb: 1 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">Budget Planned ($)</Typography>
              <InlineField label="budget planned" value={project.budget_planned} onSave={(v) => handleFieldSave('budget_planned', v)} type="number" minRole="manager" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">Budget Consumed ($)</Typography>
              <InlineField label="budget consumed" value={project.budget_consumed} onSave={(v) => handleFieldSave('budget_consumed', v)} type="number" minRole="manager" />
            </Grid>
          </Grid>

          {/* Budget + Progress bars */}
          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            {planned > 0 && (
              <Grid item xs={12} md={6}>
                <BudgetDisplay
                  planned={planned} consumed={consumed}
                  budgetPct={budgetPct} budgetColor={budgetColor}
                  isOverBudget={isOverBudget}
                />
              </Grid>
            )}
            {deliverables.length > 0 && (
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">Deliverables progress</Typography>
                  <Typography variant="body2" fontWeight={700} color="success.main">{progressPct.toFixed(0)}%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={progressPct} color="success" sx={{ height: 8, borderRadius: 1, mb: 0.5 }} />
                <Typography variant="caption" color="text.secondary">
                  {completedDeliverables} of {deliverables.length} completed
                </Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={`Deliverables (${deliverables.length})`} />
          <Tab label={`Allocations (${allocations.length})`} />
        </Tabs>
      </Box>

      {/* Deliverables Tab */}
      <TabPanel value={tab} index={0}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <RoleGuard minRole="contributor">
            <Button variant="contained" startIcon={<AddIcon />}
              onClick={() => setDeliverableForm({ open: true, initial: null })}>
              Add Deliverable
            </Button>
          </RoleGuard>
        </Box>
        {deliverables.length === 0 ? (
          <Card><CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">No deliverables yet. Add your first deliverable above.</Typography>
          </CardContent></Card>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Title</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Due Date</strong></TableCell>
                  <TableCell><strong>Depends On</strong></TableCell>
                  <TableCell align="right"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {deliverables.map((d) => (
                  <TableRow key={d.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{d.title}</Typography>
                      {d.description && <Typography variant="caption" color="text.secondary">{d.description}</Typography>}
                    </TableCell>
                    <TableCell>
                      <RoleGuard minRole="contributor" fallback={<StatusBadge status={d.status} />}>
                        <Select
                          value={d.status} size="small" variant="standard"
                          onChange={(e) => handleQuickStatusChange(d.id, e.target.value)}
                          sx={{ '&:before': { display: 'none' } }}
                          MenuProps={{ disablePortal: true }}
                        >
                          {DELIVERABLE_STATUSES.map((s) => (
                            <MenuItem key={s} value={s}><StatusBadge status={s} /></MenuItem>
                          ))}
                        </Select>
                      </RoleGuard>
                    </TableCell>
                    <TableCell><Typography variant="body2">{d.due_date || 'N/A'}</Typography></TableCell>
                    <TableCell>
                      {d.depends_on_title ? (
                        <Chip label={d.depends_on_title} size="small" variant="outlined" />
                      ) : (
                        <Typography variant="body2" color="text.disabled">None</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <RoleGuard minRole="contributor">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => setDeliverableForm({ open: true, initial: d })}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </RoleGuard>
                      <RoleGuard minRole="manager">
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => setDeleteDeliverableConfirm(d)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </RoleGuard>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Allocations Tab */}
      <TabPanel value={tab} index={1}>
        {allocations.length === 0 ? (
          <Card><CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">No resources allocated to this project yet.</Typography>
            <Button variant="outlined" sx={{ mt: 2 }} onClick={() => navigate('/allocations')}>
              Manage Allocations
            </Button>
          </CardContent></Card>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Resource</strong></TableCell>
                  <TableCell><strong>Role</strong></TableCell>
                  <TableCell><strong>Department</strong></TableCell>
                  <TableCell><strong>Allocation</strong></TableCell>
                  <TableCell><strong>Period</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allocations.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell><Typography variant="body2" fontWeight={500}>{a.resource_name}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{a.role_title || 'N/A'}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{a.department || 'N/A'}</Typography></TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate" value={a.allocation_percentage}
                          sx={{ width: 60, height: 6, borderRadius: 1, bgcolor: 'action.hover' }}
                          color={a.allocation_percentage > 80 ? 'warning' : 'primary'}
                        />
                        <Typography variant="body2">{a.allocation_percentage}%</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {a.start_date || 'N/A'} → {a.end_date || 'N/A'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      <DeliverableForm
        open={deliverableForm.open}
        onClose={() => setDeliverableForm({ open: false, initial: null })}
        onSave={deliverableForm.initial ? handleEditDeliverable : handleAddDeliverable}
        initial={deliverableForm.initial}
        projectId={parseInt(id)}
        project={project}
        deliverables={deliverables}
      />

      <Dialog open={Boolean(deleteDeliverableConfirm)} onClose={() => setDeleteDeliverableConfirm(null)}>
        <DialogTitle fontWeight={600}>Delete Deliverable</DialogTitle>
        <DialogContent>
          <Typography>Delete <strong>{deleteDeliverableConfirm?.title}</strong>? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDeliverableConfirm(null)} disabled={deleteLoading}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteDeliverable} disabled={deleteLoading}>
            {deleteLoading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ProjectDetailContent;