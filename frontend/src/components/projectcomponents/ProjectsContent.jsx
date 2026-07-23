import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, CardActionArea, Typography, Grid,
  TextField, MenuItem, Select, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Alert, CircularProgress, IconButton, Tooltip,
  InputAdornment, LinearProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import PageHeader from '../shared/PageHeader';
import StatusBadge from '../shared/StatusBadge';
import RoleGuard from '../shared/RoleGuard';
import {
  getProjects, createProject, updateProject, deleteProject
} from '../../api/projectsApi';

const EMPTY_FORM = {
  name: '', description: '', status: 'active',
  start_date: '', end_date: '', budget_planned: '', budget_consumed: ''
};

const STATUS_OPTIONS = ['active', 'at_risk', 'on_hold', 'completed'];

// Real-time field-level validation
function validateField(name, value, form) {
  switch (name) {
    case 'name':
      if (!value.trim()) return 'Project name is required';
      if (value.trim().length > 255) return 'Project name must be under 255 characters';
      return '';
    case 'end_date':
      if (value && form.start_date && value < form.start_date)
        return 'End date must be after start date';
      return '';
    case 'start_date':
      if (value && form.end_date && form.end_date < value)
        return 'Start date must be before end date';
      return '';
    case 'budget_planned':
      if (value === '') return '';
      if (isNaN(Number(value))) return 'Budget planned must be a valid number';
      if (Number(value) < 0) return 'Budget planned must be a positive number';
      return '';
    case 'budget_consumed':
      if (value === '') return '';
      if (isNaN(Number(value))) return 'Budget consumed must be a valid number';
      if (Number(value) < 0) return 'Budget consumed must be a positive number';
      
      return '';
    default:
      return '';
  }
}

function ProjectForm({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(initial || EMPTY_FORM);
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

    // Validate changed field
    const fieldError = validateField(name, value, updatedForm);
    setErrors((p) => ({ ...p, [name]: fieldError }));

    // Re-validate related fields
    if (name === 'start_date') {
      setErrors((p) => ({ ...p, end_date: validateField('end_date', updatedForm.end_date, updatedForm) }));
    }
    if (name === 'end_date') {
      setErrors((p) => ({ ...p, start_date: validateField('start_date', updatedForm.start_date, updatedForm) }));
    }
    if (name === 'budget_planned') {
      setErrors((p) => ({ ...p, budget_consumed: validateField('budget_consumed', updatedForm.budget_consumed, updatedForm) }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((p) => ({ ...p, [name]: true }));
    setErrors((p) => ({ ...p, [name]: validateField(name, value, form) }));
  };

  const validateAll = () => {
    const allFields = ['name', 'start_date', 'end_date', 'budget_planned', 'budget_consumed'];
    const newErrors = {};
    allFields.forEach((field) => {
      const err = validateField(field, form[field], form);
      if (err) newErrors[field] = err;
    });
    setErrors(newErrors);
    setTouched(Object.fromEntries(allFields.map((f) => [f, true])));
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateAll()) return;
    setLoading(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setApiError(err.response?.data?.error || 'Failed to save project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = !Object.values(errors).some(Boolean) && form.name.trim();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={600}>{initial ? 'Edit Project' : 'New Project'}</DialogTitle>
      <DialogContent>
        {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Project name" name="name" value={form.name}
            onChange={handleChange} onBlur={handleBlur}
            error={touched.name && Boolean(errors.name)}
            helperText={touched.name && errors.name}
            fullWidth required
          />
          <TextField
            label="Description" name="description" value={form.description}
            onChange={handleChange} fullWidth multiline rows={2}
          />
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select name="status" value={form.status} label="Status" onChange={handleChange}>
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>
                  {s.replace('_', ' ')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Start date" name="start_date" type="date"
              value={form.start_date} onChange={handleChange} onBlur={handleBlur}
              error={touched.start_date && Boolean(errors.start_date)}
              helperText={touched.start_date && errors.start_date}
              fullWidth slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="End date" name="end_date" type="date"
              value={form.end_date} onChange={handleChange} onBlur={handleBlur}
              error={touched.end_date && Boolean(errors.end_date)}
              helperText={touched.end_date && errors.end_date}
              fullWidth slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Budget planned ($)" name="budget_planned"
              value={form.budget_planned} onChange={handleChange} onBlur={handleBlur}
              error={touched.budget_planned && Boolean(errors.budget_planned)}
              helperText={touched.budget_planned && errors.budget_planned}
              fullWidth
            />
            <TextField
              label="Budget consumed ($)" name="budget_consumed"
              value={form.budget_consumed} onChange={handleChange} onBlur={handleBlur}
              error={touched.budget_consumed && Boolean(errors.budget_consumed)}
              helperText={touched.budget_consumed && errors.budget_consumed}
              fullWidth
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          variant="contained" onClick={handleSave}
          disabled={loading || !isFormValid}
        >
          {loading ? <CircularProgress size={20} /> : initial ? 'Save changes' : 'Create project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ProjectCard({ project, onEdit, onDelete, onClick }) {
  const planned = parseFloat(project.budget_planned) || 0;
  const consumed = parseFloat(project.budget_consumed) || 0;
  const pct = planned > 0 ? Math.min((consumed / planned) * 100, 100) : 0;
  const budgetColor = pct >= 90 ? 'error' : pct >= 70 ? 'warning' : 'primary';

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardActionArea onClick={onClick} sx={{ flexGrow: 1 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Typography variant="h6" fontWeight={600} sx={{ flexGrow: 1, mr: 1 }}>
              {project.name}
            </Typography>
            <StatusBadge status={project.status} />
          </Box>
          {project.description && (
            <Typography variant="body2" color="text.secondary" sx={{
              mb: 2, display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
            }}>
              {project.description}
            </Typography>
          )}
          {project.end_date && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Due: {project.end_date}
            </Typography>
          )}
          {planned > 0 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">Budget</Typography>
                <Typography variant="caption" color="text.secondary">{pct.toFixed(0)}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={pct} color={budgetColor} sx={{ borderRadius: 1, height: 4 }} />
            </Box>
          )}
        </CardContent>
      </CardActionArea>
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

function ProjectsContent() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const res = await getProjects(params);
      setProjects(res.data.projects || []);
    } catch {
      setError('Failed to load projects.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchProjects, 300);
    return () => clearTimeout(timer);
  }, [fetchProjects]);

  const handleCreate = async (form) => {
    await createProject(form);
    fetchProjects();
  };

  const handleEdit = async (form) => {
    await updateProject(editProject.id, form);
    fetchProjects();
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteProject(deleteConfirm.id);
      setDeleteConfirm(null);
      fetchProjects();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete project');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} project${projects.length !== 1 ? 's' : ''}`}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ minWidth: 220 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }
          }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>
                {s.replace('_', ' ')}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ flexGrow: 1 }} />
        <RoleGuard minRole="manager">
          <Button
            variant="contained" startIcon={<AddIcon />}
            onClick={() => { setEditProject(null); setFormOpen(true); }}
          >
            New Project
          </Button>
        </RoleGuard>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary">No projects found</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {search || statusFilter ? 'Try adjusting your filters' : 'Create your first project to get started'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {projects.map((p) => (
            <Grid item xs={12} sm={6} md={4} key={p.id}>
              <ProjectCard
                project={p}
                onClick={() => navigate(`/projects/${p.id}`)}
                onEdit={(proj) => { setEditProject(proj); setFormOpen(true); }}
                onDelete={setDeleteConfirm}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <ProjectForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={editProject ? handleEdit : handleCreate}
        initial={editProject}
      />

      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle fontWeight={600}>Delete Project</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
            This will also delete all deliverables and allocations for this project.
          </Typography>
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

export default ProjectsContent;