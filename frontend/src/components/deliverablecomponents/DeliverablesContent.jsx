import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, CircularProgress, Alert,
  Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Tooltip, InputAdornment, Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PageHeader from '../shared/PageHeader';
import StatusBadge from '../shared/StatusBadge';
import RoleGuard from '../shared/RoleGuard';
import {
  getDeliverables, createDeliverable, updateDeliverable, deleteDeliverable
} from '../../api/deliverablesApi';
import { getProjects } from '../../api/projectsApi';

const DELIVERABLE_STATUSES = ['pending', 'in_progress', 'completed'];
const EMPTY_FORM = { title: '', description: '', status: 'pending', due_date: '', project_id: '', depends_on: '' };

function validateField(name, value, form, projects) {
  const selectedProject = projects.find(p => String(p.id) === String(form.project_id));
  switch (name) {
    case 'title':
      if (!value.trim()) return 'Title is required';
      if (value.trim().length > 255) return 'Title must be under 255 characters';
      return '';
    case 'project_id':
      if (!value) return 'Project is required';
      return '';
    case 'due_date':
      if (!value) return '';
      if (selectedProject?.start_date && value < selectedProject.start_date)
        return `Due date cannot be before project start date (${selectedProject.start_date})`;
      if (selectedProject?.end_date && value > selectedProject.end_date)
        return `Due date cannot be after project end date (${selectedProject.end_date})`;
      return '';
    default:
      return '';
  }
}

function DeliverableForm({ open, onClose, onSave, initial, projects }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [projectDeliverables, setProjectDeliverables] = useState([]);

  const selectedProject = projects.find(p => String(p.id) === String(form.project_id));

  // Fetch deliverables for the selected project (for depends_on dropdown)
  useEffect(() => {
    if (form.project_id) {
      getDeliverables({ project_id: form.project_id }).then(res => {
        const all = res.data.deliverables || [];
        // Exclude current deliverable from depends_on options
        setProjectDeliverables(all.filter(d => !initial || d.id !== initial.id));
      }).catch(() => setProjectDeliverables([]));
    } else {
      setProjectDeliverables([]);
    }
  }, [form.project_id, initial]);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial, depends_on: initial.depends_on || '' } : EMPTY_FORM);
      setErrors({});
      setTouched({});
      setApiError('');
    }
  }, [open, initial]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedForm = { ...form, [name]: value };
    setForm(updatedForm);
    setTouched((p) => ({ ...p, [name]: true }));
    setErrors((p) => ({ ...p, [name]: validateField(name, value, updatedForm, projects) }));
    if (name === 'project_id') {
      setErrors((p) => ({ ...p, due_date: validateField('due_date', updatedForm.due_date, updatedForm, projects) }));
      // Reset depends_on when project changes
      setForm(prev => ({ ...prev, [name]: value, depends_on: '' }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((p) => ({ ...p, [name]: true }));
    setErrors((p) => ({ ...p, [name]: validateField(name, value, form, projects) }));
  };

  const handleSave = async () => {
    const fields = ['title', 'project_id', 'due_date'];
    const newErrors = {};
    fields.forEach((f) => {
      const err = validateField(f, form[f], form, projects);
      if (err) newErrors[f] = err;
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched(Object.fromEntries(fields.map(f => [f, true])));
      return;
    }
    setLoading(true);
    try {
      await onSave({
        ...form,
        project_id: parseInt(form.project_id),
        depends_on: form.depends_on ? parseInt(form.depends_on) : null,
      });
      onClose();
    } catch (err) {
      setApiError(err.response?.data?.error || 'Failed to save deliverable');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = form.title.trim() && form.project_id && !Object.values(errors).some(Boolean);

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
          <FormControl fullWidth required error={touched.project_id && Boolean(errors.project_id)}>
            <InputLabel>Project</InputLabel>
            <Select name="project_id" value={form.project_id} label="Project"
              onChange={handleChange} onBlur={handleBlur} MenuProps={{ disablePortal: true }}>
              {projects.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </Select>
            {touched.project_id && errors.project_id && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>{errors.project_id}</Typography>
            )}
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select name="status" value={form.status} label="Status" onChange={handleChange} MenuProps={{ disablePortal: true }}>
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
              (selectedProject?.start_date && selectedProject?.end_date
                ? `Project runs ${selectedProject.start_date} → ${selectedProject.end_date}`
                : selectedProject?.end_date ? `Project ends ${selectedProject.end_date}` : '')
            }
            fullWidth slotProps={{ inputLabel: { shrink: true } }}
          />
          {/* Depends on — only shown when project is selected and has other deliverables */}
          {form.project_id && projectDeliverables.length > 0 && (
            <FormControl fullWidth>
              <InputLabel>Depends on (optional)</InputLabel>
              <Select name="depends_on" value={form.depends_on}
                label="Depends on (optional)" onChange={handleChange}
                MenuProps={{ disablePortal: true }}>
                <MenuItem value="">No dependency</MenuItem>
                {projectDeliverables.map((d) => (
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
          {form.project_id && projectDeliverables.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              No other deliverables in this project to depend on.
            </Typography>
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

function DeliverablesContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [deliverables, setDeliverables] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editDeliverable, setEditDeliverable] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('status');
    if (status) setStatusFilter(status);
  }, [location]);

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (projectFilter) params.project_id = projectFilter;
      if (search) params.search = search;
      const [delRes, projRes] = await Promise.all([
        getDeliverables(params),
        getProjects(),
      ]);
      setDeliverables(delRes.data.deliverables || []);
      setProjects(projRes.data.projects || []);
    } catch {
      setError('Failed to load deliverables.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, projectFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const handleCreate = async (form) => {
    await createDeliverable(form);
    fetchData();
  };

  const handleEdit = async (form) => {
    await updateDeliverable(editDeliverable.id, form);
    fetchData();
  };

  const handleQuickStatus = async (id, status) => {
    try {
      await updateDeliverable(id, { status });
      fetchData();
    } catch {
      setError('Failed to update status');
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteDeliverable(deleteConfirm.id);
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete deliverable');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Deliverables"
        subtitle={`${deliverables.length} deliverable${deliverables.length !== 1 ? 's' : ''}`}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Search deliverables..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          size="small" sx={{ minWidth: 220 }}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
            }
          }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            {DELIVERABLE_STATUSES.map((s) => (
              <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Project</InputLabel>
          <Select value={projectFilter} label="Project" onChange={(e) => setProjectFilter(e.target.value)}>
            <MenuItem value="">All projects</MenuItem>
            {projects.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </Select>
        </FormControl>
        <Box sx={{ flexGrow: 1 }} />
        <RoleGuard minRole="contributor">
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => { setEditDeliverable(null); setFormOpen(true); }}>
            Add Deliverable
          </Button>
        </RoleGuard>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : deliverables.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary">No deliverables found</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {search || statusFilter || projectFilter ? 'Try adjusting your filters' : 'Add your first deliverable to get started'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Title</strong></TableCell>
                <TableCell><strong>Project</strong></TableCell>
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
                    <Chip label={d.project_name || 'N/A'} size="small" variant="outlined"
                      onClick={() => d.project_id && navigate(`/projects/${d.project_id}`)}
                      sx={{ cursor: d.project_id ? 'pointer' : 'default' }}
                    />
                  </TableCell>
                  <TableCell>
                    <RoleGuard minRole="contributor" fallback={<StatusBadge status={d.status} />}>
                      <Select value={d.status} size="small" variant="standard"
                        onChange={(e) => handleQuickStatus(d.id, e.target.value)}
                        sx={{ '&:before': { display: 'none' } }}
                        MenuProps={{ disablePortal: true }}>
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
                    <Tooltip title="View project">
                      <IconButton size="small" onClick={() => navigate(`/projects/${d.project_id}`)}>
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <RoleGuard minRole="contributor">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => { setEditDeliverable(d); setFormOpen(true); }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </RoleGuard>
                    <RoleGuard minRole="manager">
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(d)}>
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

      <DeliverableForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={editDeliverable ? handleEdit : handleCreate}
        initial={editDeliverable}
        projects={projects}
      />

      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle fontWeight={600}>Delete Deliverable</DialogTitle>
        <DialogContent>
          <Typography>Delete <strong>{deleteConfirm?.title}</strong>? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirm(null)} disabled={deleteLoading}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleteLoading}>
            {deleteLoading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default DeliverablesContent;