import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, CircularProgress, Alert,
  Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Tooltip, InputAdornment, Chip
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PageHeader from '../shared/PageHeader';
import StatusBadge from '../shared/StatusBadge';
import { getUsers, updateUser, deleteUser } from '../../api/usersApi';
import useAuth from '../../context/useAuth';

const ROLES = ['admin', 'manager', 'contributor', 'viewer'];

const ROLE_DESCRIPTIONS = {
  admin: 'Full system access — manage users, all CRUD operations',
  manager: 'Full project control — create/edit projects, allocate resources',
  contributor: 'Create and update deliverables',
  viewer: 'Read-only access to all data',
};

function EditUserForm({ open, onClose, onSave, initial }) {
  const [role, setRole] = useState(initial?.role || 'viewer');
  const [name, setName] = useState(initial?.name || '');
  const [nameError, setNameError] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (open) {
      setRole(initial?.role || 'viewer');
      setName(initial?.name || '');
      setNameError('');
      setApiError('');
    }
  }, [open, initial]);

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    if (!val.trim()) setNameError('Name is required');
    else if (val.trim().length > 255) setNameError('Name must be under 255 characters');
    else setNameError('');
  };

  const handleSave = async () => {
    if (!name.trim()) { setNameError('Name is required'); return; }
    setLoading(true);
    try {
      await onSave({ name: name.trim(), role });
      onClose();
    } catch (err) {
      setApiError(err.response?.data?.error || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={600}>Edit User</DialogTitle>
      <DialogContent>
        {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {/* Read-only email */}
          <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">Email (cannot be changed)</Typography>
            <Typography variant="body2" fontWeight={500}>{initial?.email}</Typography>
          </Box>

          <TextField
            label="Full name" value={name} onChange={handleNameChange}
            error={Boolean(nameError)} helperText={nameError}
            fullWidth required
          />

          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              value={role}
              label="Role"
              onChange={(e) => setRole(e.target.value)}
              MenuProps={{ disablePortal: true }}
            >
              {ROLES.map((r) => (
                <MenuItem key={r} value={r}>
                  <Box>
                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{r}</Typography>
                    <Typography variant="caption" color="text.secondary">{ROLE_DESCRIPTIONS[r]}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {role !== initial?.role && (
            <Alert severity="warning" sx={{ py: 0.5 }}>
              Changing role from <strong>{initial?.role}</strong> to <strong>{role}</strong>.
              This will immediately affect what the user can do.
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}
          disabled={loading || !name.trim() || Boolean(nameError)}>
          {loading ? <CircularProgress size={20} /> : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function UsersContent() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editUser, setEditUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const res = await getUsers(params);
      setUsers(res.data.users || []);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleEdit = async (form) => {
    await updateUser(editUser.id, form);
    fetchUsers();
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteUser(deleteConfirm.id);
      setDeleteConfirm(null);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user');
    } finally {
      setDeleteLoading(false);
    }
  };

  const isSelf = (userId) => String(userId) === String(currentUser?.id);

  return (
    <Box>
      <PageHeader
        title="Users"
        subtitle={`${users.length} user${users.length !== 1 ? 's' : ''} — Admin access only`}
      />

      <Alert severity="info" sx={{ mb: 3 }} icon={<AdminPanelSettingsIcon />}>
        This page is only visible to admins. You can manage user roles and remove accounts here.
        You cannot modify or delete your own account.
      </Alert>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Search by name or email..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          size="small" sx={{ minWidth: 250 }}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
            }
          }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Role</InputLabel>
          <Select value={roleFilter} label="Role" onChange={(e) => setRoleFilter(e.target.value)}>
            <MenuItem value="">All roles</MenuItem>
            {ROLES.map((r) => (
              <MenuItem key={r} value={r} sx={{ textTransform: 'capitalize' }}>{r}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : users.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary">No users found</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {search || roleFilter ? 'Try adjusting your filters' : 'No users registered yet'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Email</strong></TableCell>
                <TableCell><strong>Role</strong></TableCell>
                <TableCell><strong>Joined</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow
                  key={u.id}
                  hover
                  sx={{ bgcolor: isSelf(u.id) ? 'action.selected' : 'inherit' }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={500}>{u.name}</Typography>
                      {isSelf(u.id) && <Chip label="You" size="small" color="primary" />}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{u.email}</Typography>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={u.role} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(u.created_at).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {isSelf(u.id) ? (
                      <Tooltip title="Cannot modify your own account">
                        <span>
                          <IconButton size="small" disabled>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    ) : (
                      <>
                        <Tooltip title="Edit user">
                          <IconButton size="small" onClick={() => setEditUser(u)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete user">
                          <IconButton size="small" color="error" onClick={() => setDeleteConfirm(u)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <EditUserForm
        open={Boolean(editUser)}
        onClose={() => setEditUser(null)}
        onSave={handleEdit}
        initial={editUser}
      />

      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle fontWeight={600}>Delete User</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>This action cannot be undone.</Alert>
          <Typography>
            Delete <strong>{deleteConfirm?.name}</strong> ({deleteConfirm?.email})?
            They will lose all access to the system.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirm(null)} disabled={deleteLoading}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleteLoading}>
            {deleteLoading ? <CircularProgress size={20} /> : 'Delete user'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default UsersContent;