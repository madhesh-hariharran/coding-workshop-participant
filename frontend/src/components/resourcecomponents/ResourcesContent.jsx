import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, CircularProgress, Alert,
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Tooltip, InputAdornment, LinearProgress, Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PageHeader from '../shared/PageHeader';
import RoleGuard from '../shared/RoleGuard';
import {
  getResources, createResource, updateResource, deleteResource
} from '../../api/resourcesApi';

const EMPTY_FORM = { name: '', role_title: '', department: '' };

function validateField(name, value) {
  switch (name) {
    case 'name':
      if (!value.trim()) return 'Name is required';
      if (value.trim().length > 255) return 'Name must be under 255 characters';
      return '';
    case 'role_title':
      if (value.trim().length > 255) return 'Role title must be under 255 characters';
      return '';
    case 'department':
      if (value.trim().length > 255) return 'Department must be under 255 characters';
      return '';
    default:
      return '';
  }
}

function ResourceForm({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        name: initial.name || '',
        role_title: initial.role_title || '',
        department: initial.department || '',
      } : EMPTY_FORM);
      setErrors({});
      setTouched({});
      setApiError('');
    }
  }, [open, initial]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setTouched((p) => ({ ...p, [name]: true }));
    setErrors((p) => ({ ...p, [name]: validateField(name, value) }));
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((p) => ({ ...p, [name]: true }));
    setErrors((p) => ({ ...p, [name]: validateField(name, value) }));
  };

  const handleSave = async () => {
    const fields = ['name', 'role_title', 'department'];
    const newErrors = {};
    fields.forEach((f) => {
      const err = validateField(f, form[f]);
      if (err) newErrors[f] = err;
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched(Object.fromEntries(fields.map(f => [f, true])));
      return;
    }
    setLoading(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setApiError(err.response?.data?.error || 'Failed to save resource');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = form.name.trim() && !Object.values(errors).some(Boolean);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={600}>{initial ? 'Edit Resource' : 'New Resource'}</DialogTitle>
      <DialogContent>
        {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Full name" name="name" value={form.name}
            onChange={handleChange} onBlur={handleBlur}
            error={touched.name && Boolean(errors.name)}
            helperText={touched.name && errors.name}
            fullWidth required
          />
          <TextField
            label="Role title" name="role_title" value={form.role_title}
            onChange={handleChange} onBlur={handleBlur}
            error={touched.role_title && Boolean(errors.role_title)}
            helperText={(touched.role_title && errors.role_title) || 'e.g. Backend Engineer, Product Manager'}
            fullWidth
          />
          <TextField
            label="Department" name="department" value={form.department}
            onChange={handleChange} onBlur={handleBlur}
            error={touched.department && Boolean(errors.department)}
            helperText={(touched.department && errors.department) || 'e.g. Engineering, Design, Marketing'}
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading || !isFormValid}>
          {loading ? <CircularProgress size={20} /> : initial ? 'Save changes' : 'Add resource'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ResourcesContent() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editResource, setEditResource] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchResources = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      const res = await getResources(params);
      setResources(res.data.resources || []);
    } catch {
      setError('Failed to load resources.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchResources, 300);
    return () => clearTimeout(timer);
  }, [fetchResources]);

  const handleCreate = async (form) => {
    await createResource(form);
    fetchResources();
  };

  const handleEdit = async (form) => {
    await updateResource(editResource.id, form);
    fetchResources();
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteResource(deleteConfirm.id);
      setDeleteConfirm(null);
      fetchResources();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete resource');
    } finally {
      setDeleteLoading(false);
    }
  };

  const overAllocated = resources.filter(r => parseInt(r.total_allocation) > 100);

  return (
    <Box>
      <PageHeader
        title="Resources"
        subtitle={`${resources.length} team member${resources.length !== 1 ? 's' : ''}`}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {overAllocated.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }} icon={<WarningAmberIcon />}>
          {overAllocated.length} resource{overAllocated.length > 1 ? 's are' : ' is'} over-allocated:{' '}
          {overAllocated.map(r => `${r.name} (${r.total_allocation}%)`).join(', ')}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Search resources..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          size="small" sx={{ minWidth: 220 }}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
            }
          }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <RoleGuard minRole="manager">
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => { setEditResource(null); setFormOpen(true); }}>
            Add Resource
          </Button>
        </RoleGuard>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : resources.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary">No resources found</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {search ? 'Try adjusting your search' : 'Add your first team member to get started'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Role</strong></TableCell>
                <TableCell><strong>Department</strong></TableCell>
                <TableCell><strong>Allocation</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resources.map((r) => {
                const allocation = parseInt(r.total_allocation) || 0;
                const isOver = allocation > 100;
                const allocColor = isOver ? 'error' : allocation > 80 ? 'warning' : 'primary';
                return (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{r.name}</Typography>
                      {r.user_email && (
                        <Typography variant="caption" color="text.secondary">{r.user_email}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{r.role_title || 'N/A'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{r.department || 'N/A'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(allocation, 100)}
                          color={allocColor}
                          sx={{ width: 80, height: 6, borderRadius: 1, bgcolor: 'action.hover' }}
                        />
                        <Typography variant="body2" fontWeight={600} color={`${allocColor}.main`}>
                          {allocation}%
                        </Typography>
                        {isOver && (
                          <Chip label="Over" color="error" size="small" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <RoleGuard minRole="manager">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => { setEditResource(r); setFormOpen(true); }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </RoleGuard>
                      <RoleGuard minRole="admin">
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => setDeleteConfirm(r)}>
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

      <ResourceForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={editResource ? handleEdit : handleCreate}
        initial={editResource}
      />

      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle fontWeight={600}>Delete Resource</DialogTitle>
        <DialogContent>
          <Typography>
            Delete <strong>{deleteConfirm?.name}</strong>? This will also remove all their project allocations.
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

export default ResourcesContent;