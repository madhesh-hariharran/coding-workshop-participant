import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, CircularProgress, Alert,
  Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Tooltip, LinearProgress, Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PageHeader from '../shared/PageHeader';
import RoleGuard from '../shared/RoleGuard';
import {
  getAllocations, createAllocation, updateAllocation, deleteAllocation
} from '../../api/allocationsApi';
import { getProjects } from '../../api/projectsApi';
import { getResources } from '../../api/resourcesApi';

const EMPTY_FORM = {
  resource_id: '', project_id: '',
  allocation_percentage: '', start_date: '', end_date: ''
};

function validateField(name, value, form, selectedProject) {
  switch (name) {
    case 'resource_id':
      if (!value) return 'Resource is required';
      return '';
    case 'project_id':
      if (!value) return 'Project is required';
      return '';
    case 'allocation_percentage':
      if (!value && value !== 0) return 'Allocation percentage is required';
      if (isNaN(Number(value))) return 'Must be a valid number';
      if (Number(value) <= 0) return 'Must be greater than 0';
      if (Number(value) > 100) return 'Cannot exceed 100%';
      return '';
    case 'start_date':
      if (!value) return '';
      if (selectedProject?.start_date && value < selectedProject.start_date)
        return `Cannot be before project start date (${selectedProject.start_date})`;
      if (selectedProject?.end_date && value > selectedProject.end_date)
        return `Cannot be after project end date (${selectedProject.end_date})`;
      if (form.end_date && value > form.end_date)
        return 'Start date must be before end date';
      return '';
    case 'end_date':
      if (!value) return '';
      if (selectedProject?.end_date && value > selectedProject.end_date)
        return `Cannot be after project end date (${selectedProject.end_date})`;
      if (selectedProject?.start_date && value < selectedProject.start_date)
        return `Cannot be before project start date (${selectedProject.start_date})`;
      if (form.start_date && value < form.start_date)
        return 'End date must be after start date';
      return '';
    default:
      return '';
  }
}

function AllocationForm({ open, onClose, onSave, initial, projects, resources }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const selectedResource = resources.find(r => String(r.id) === String(form.resource_id));
  const selectedProject = projects.find(p => String(p.id) === String(form.project_id));
  const currentAllocation = parseInt(selectedResource?.total_allocation) || 0;
  const newTotal = currentAllocation + parseInt(form.allocation_percentage || 0);
  const wouldOverAllocate = !initial && form.allocation_percentage && newTotal > 100;

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        resource_id: initial.resource_id || '',
        project_id: initial.project_id || '',
        allocation_percentage: initial.allocation_percentage || '',
        start_date: initial.start_date || '',
        end_date: initial.end_date || '',
      } : EMPTY_FORM);
      setErrors({});
      setTouched({});
      setApiError('');
    }
  }, [open, initial]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedForm = { ...form, [name]: value };
    const proj = projects.find(p => String(p.id) === String(updatedForm.project_id));
    setForm(updatedForm);
    setTouched((p) => ({ ...p, [name]: true }));
    setErrors((p) => ({ ...p, [name]: validateField(name, value, updatedForm, proj) }));

    // Re-validate dates when project or either date changes
    if (name === 'project_id') {
      setErrors((p) => ({
        ...p,
        start_date: validateField('start_date', updatedForm.start_date, updatedForm, proj),
        end_date: validateField('end_date', updatedForm.end_date, updatedForm, proj),
      }));
    }
    if (name === 'start_date') {
      setErrors((p) => ({ ...p, end_date: validateField('end_date', updatedForm.end_date, updatedForm, proj) }));
    }
    if (name === 'end_date') {
      setErrors((p) => ({ ...p, start_date: validateField('start_date', updatedForm.start_date, updatedForm, proj) }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((p) => ({ ...p, [name]: true }));
    setErrors((p) => ({ ...p, [name]: validateField(name, value, form, selectedProject) }));
  };

  const handleSave = async () => {
    const fields = ['resource_id', 'project_id', 'allocation_percentage', 'start_date', 'end_date'];
    const newErrors = {};
    fields.forEach((f) => {
      const err = validateField(f, form[f], form, selectedProject);
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
        resource_id: parseInt(form.resource_id),
        project_id: parseInt(form.project_id),
        allocation_percentage: parseInt(form.allocation_percentage),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      });
      onClose();
    } catch (err) {
      setApiError(err.response?.data?.error || 'Failed to save allocation');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = form.resource_id && form.project_id &&
    form.allocation_percentage && !Object.values(errors).some(Boolean);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={600}>{initial ? 'Edit Allocation' : 'New Allocation'}</DialogTitle>
      <DialogContent>
        {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>

          {/* When editing — show resource and project as read-only info */}
          {initial ? (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ flex: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">Resource</Typography>
                <Typography variant="body2" fontWeight={600}>{initial.resource_name}</Typography>
                {initial.role_title && <Typography variant="caption" color="text.secondary">{initial.role_title}</Typography>}
              </Box>
              <Box sx={{ flex: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">Project</Typography>
                <Typography variant="body2" fontWeight={600}>{initial.project_name}</Typography>
              </Box>
            </Box>
          ) : (
            <>
              <FormControl fullWidth required error={touched.resource_id && Boolean(errors.resource_id)}>
                <InputLabel>Resource</InputLabel>
                <Select name="resource_id" value={form.resource_id} label="Resource"
                  onChange={handleChange} onBlur={handleBlur}>
                  {resources.map((r) => (
                    <MenuItem key={r.id} value={r.id}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="body2">{r.name}</Typography>
                          {r.role_title && <Typography variant="caption" color="text.secondary">{r.role_title}</Typography>}
                        </Box>
                        <Chip
                          label={`${r.total_allocation}% allocated`}
                          size="small"
                          color={parseInt(r.total_allocation) > 80 ? 'warning' : 'default'}
                        />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
                {touched.resource_id && errors.resource_id && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                    {errors.resource_id}
                  </Typography>
                )}
              </FormControl>

              <FormControl fullWidth required error={touched.project_id && Boolean(errors.project_id)}>
                <InputLabel>Project</InputLabel>
                <Select name="project_id" value={form.project_id} label="Project"
                  onChange={handleChange} onBlur={handleBlur}>
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <Typography variant="body2">{p.name}</Typography>
                        <Chip label={p.status} size="small" sx={{ textTransform: 'capitalize' }} />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
                {touched.project_id && errors.project_id && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                    {errors.project_id}
                  </Typography>
                )}
              </FormControl>
            </>
          )}

          {/* Live allocation preview */}
          {selectedResource && !initial && (
            <Alert severity={wouldOverAllocate ? 'warning' : currentAllocation > 80 ? 'warning' : 'info'} sx={{ py: 0.5 }}>
              {selectedResource.name} is currently at {currentAllocation}% allocation.
              {form.allocation_percentage && ` Adding ${form.allocation_percentage}% → total ${newTotal}%`}
              {wouldOverAllocate && ' ⚠️ This will exceed 100%'}
            </Alert>
          )}

          <TextField
            label="Allocation %" name="allocation_percentage"
            value={form.allocation_percentage}
            onChange={handleChange} onBlur={handleBlur}
            error={touched.allocation_percentage && Boolean(errors.allocation_percentage)}
            helperText={
              (touched.allocation_percentage && errors.allocation_percentage) ||
              'Enter a value between 1 and 100'
            }
            type="number"
            slotProps={{ htmlInput: { min: 1, max: 100 } }}
            fullWidth required
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Start date" name="start_date" type="date"
              value={form.start_date} onChange={handleChange} onBlur={handleBlur}
              error={touched.start_date && Boolean(errors.start_date)}
              helperText={
                (touched.start_date && errors.start_date) ||
                (selectedProject?.start_date ? `Project starts ${selectedProject.start_date}` : '')
              }
              fullWidth slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="End date" name="end_date" type="date"
              value={form.end_date} onChange={handleChange} onBlur={handleBlur}
              error={touched.end_date && Boolean(errors.end_date)}
              helperText={
                (touched.end_date && errors.end_date) ||
                (selectedProject?.end_date ? `Project ends ${selectedProject.end_date}` : '')
              }
              fullWidth slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading || !isFormValid}>
          {loading ? <CircularProgress size={20} /> : initial ? 'Save changes' : 'Create allocation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AllocationsContent() {
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState([]);
  const [overAllocated, setOverAllocated] = useState([]);
  const [projects, setProjects] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editAllocation, setEditAllocation] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (projectFilter) params.project_id = projectFilter;
      if (resourceFilter) params.resource_id = resourceFilter;
      const [allocRes, projRes, resRes] = await Promise.all([
        getAllocations(params),
        getProjects(),
        getResources(),
      ]);
      setAllocations(allocRes.data.allocations || []);
      setOverAllocated(allocRes.data.over_allocated_resources || []);
      setProjects(projRes.data.projects || []);
      setResources(resRes.data.resources || []);
    } catch {
      setError('Failed to load allocations.');
    } finally {
      setLoading(false);
    }
  }, [projectFilter, resourceFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (form) => {
    await createAllocation(form);
    fetchData();
  };

  const handleEdit = async (form) => {
    await updateAllocation(editAllocation.id, form);
    fetchData();
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteAllocation(deleteConfirm.id);
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete allocation');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Allocations"
        subtitle={`${allocations.length} allocation${allocations.length !== 1 ? 's' : ''}`}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {overAllocated.length > 0 && (
        <Alert severity="error" sx={{ mb: 3 }} icon={<WarningAmberIcon />}>
          <strong>Over-allocated resources:</strong>{' '}
          {overAllocated.map(r => `${r.name} (${r.total_allocation}%)`).join(', ')}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Filter by project</InputLabel>
          <Select value={projectFilter} label="Filter by project"
            onChange={(e) => setProjectFilter(e.target.value)}>
            <MenuItem value="">All projects</MenuItem>
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Filter by resource</InputLabel>
          <Select value={resourceFilter} label="Filter by resource"
            onChange={(e) => setResourceFilter(e.target.value)}>
            <MenuItem value="">All resources</MenuItem>
            {resources.map((r) => (
              <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ flexGrow: 1 }} />
        <RoleGuard minRole="manager">
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => { setEditAllocation(null); setFormOpen(true); }}>
            New Allocation
          </Button>
        </RoleGuard>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : allocations.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary">No allocations found</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {projectFilter || resourceFilter
                ? 'Try adjusting your filters'
                : 'Allocate resources to projects to get started'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Resource</strong></TableCell>
                <TableCell><strong>Project</strong></TableCell>
                <TableCell><strong>Allocation</strong></TableCell>
                <TableCell><strong>Period</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allocations.map((a) => {
                const pct = a.allocation_percentage;
                const allocColor = pct > 80 ? 'warning' : 'primary';
                return (
                  <TableRow key={a.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{a.resource_name}</Typography>
                      {a.role_title && (
                        <Typography variant="caption" color="text.secondary">{a.role_title}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={a.project_name}
                        size="small" variant="outlined"
                        onClick={() => navigate(`/projects/${a.project_id}`)}
                        sx={{ cursor: 'pointer' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate" value={pct}
                          color={allocColor}
                          sx={{ width: 80, height: 6, borderRadius: 1, bgcolor: 'action.hover' }}
                        />
                        <Typography variant="body2" fontWeight={600}>{pct}%</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {a.start_date || 'N/A'} → {a.end_date || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <RoleGuard minRole="manager">
                        <Tooltip title="Edit">
                          <IconButton size="small"
                            onClick={() => { setEditAllocation(a); setFormOpen(true); }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => setDeleteConfirm(a)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </RoleGuard>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <AllocationForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={editAllocation ? handleEdit : handleCreate}
        initial={editAllocation}
        projects={projects}
        resources={resources}
      />

      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle fontWeight={600}>Delete Allocation</DialogTitle>
        <DialogContent>
          <Typography>
            Remove <strong>{deleteConfirm?.resource_name}</strong> from{' '}
            <strong>{deleteConfirm?.project_name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirm(null)} disabled={deleteLoading}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleteLoading}>
            {deleteLoading ? <CircularProgress size={20} /> : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AllocationsContent;