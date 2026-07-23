import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, CircularProgress, InputAdornment, IconButton,
  Divider, List, ListItem, ListItemIcon, ListItemText,
  Select, MenuItem, FormControl, InputLabel, FormHelperText
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { register as registerApi } from '../../api/authApi';
import useAuth from '../../context/useAuth';

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'One number', test: (p) => /\d/.test(p) },
  { label: 'One special character (!@#$%^&*)', test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

function RegisterContent() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'viewer' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [passwordBlurred, setPasswordBlurred] = useState(false);

  const passwordChecks = PASSWORD_RULES.map((rule) => ({
    ...rule,
    passed: rule.test(form.password),
  }));
  const allPasswordRulesPassed = passwordChecks.every((c) => c.passed);
  const passwordsMatch = form.password === form.confirmPassword;
  const showChecker = form.password.length > 0 && (!passwordBlurred || !allPasswordRulesPassed);

  const validate = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = 'Enter a valid email address';
    if (!allPasswordRulesPassed) newErrors.password = 'Password does not meet requirements';
    if (!form.confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    else if (!passwordsMatch) newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (apiError) setApiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await registerApi(form.name, form.email, form.password, form.role);
      const { user, token } = res.data;
      login(user, token);
      navigate('/dashboard');
    } catch (err) {
      const message = err.response?.data?.error || 'Registration failed. Please try again.';
      setApiError(message);
    } finally {
      setLoading(false);
    }
  };

  const eyeButton = (show, setShow) => ({
    endAdornment: (
      <InputAdornment position="end">
        <IconButton
          onClick={() => setShow((p) => !p)}
          onMouseDown={(e) => e.preventDefault()}
          edge="end"
          size="small"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
        </IconButton>
      </InputAdornment>
    ),
  });

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 480 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 48, height: 48, borderRadius: '50%',
                bgcolor: 'primary.main', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                mx: 'auto', mb: 2,
              }}
            >
              <PersonAddIcon sx={{ color: 'white' }} />
            </Box>
            <Typography variant="h5" fontWeight={700}>Create account</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Join ACME Project Management
            </Typography>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth label="Full name" name="name"
              value={form.name} onChange={handleChange}
              error={Boolean(errors.name)} helperText={errors.name}
              disabled={loading} sx={{ mb: 2 }} autoFocus
            />
            <TextField
              fullWidth label="Email address" name="email" type="email"
              value={form.email} onChange={handleChange}
              error={Boolean(errors.email)} helperText={errors.email}
              disabled={loading} sx={{ mb: 2 }}
            />

            <TextField
              fullWidth label="Password" name="password"
              type={showPassword ? 'text' : 'password'}
              value={form.password} onChange={handleChange}
              onFocus={() => setPasswordBlurred(false)}
              onBlur={() => setPasswordBlurred(true)}
              error={Boolean(errors.password)} helperText={errors.password}
              disabled={loading} sx={{ mb: 1 }}
              slotProps={{ input: eyeButton(showPassword, setShowPassword) }}
            />

            {showChecker && (
              <Box sx={{
                mb: 2, p: 1.5, bgcolor: 'background.default',
                borderRadius: 2, border: '1px solid', borderColor: 'divider'
              }}>
                <List dense disablePadding>
                  {passwordChecks.map((check) => (
                    <ListItem key={check.label} disablePadding sx={{ py: 0.25 }}>
                      <ListItemIcon sx={{ minWidth: 28 }}>
                        {check.passed
                          ? <CheckCircleIcon fontSize="small" color="success" />
                          : <CancelIcon fontSize="small" color="error" />}
                      </ListItemIcon>
                      <ListItemText
                        primary={check.label}
                        primaryTypographyProps={{
                          variant: 'caption',
                          color: check.passed ? 'success.main' : 'error.main',
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            <TextField
              fullWidth label="Confirm password" name="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              value={form.confirmPassword} onChange={handleChange}
              onBlur={() => setConfirmTouched(true)}
              error={Boolean(errors.confirmPassword)}
              helperText={
                errors.confirmPassword ||
                (confirmTouched && form.confirmPassword
                  ? passwordsMatch ? 'Passwords match ✓' : 'Passwords do not match'
                  : '')
              }
              FormHelperTextProps={{
                sx: {
                  color: confirmTouched && form.confirmPassword
                    ? passwordsMatch ? 'success.main' : 'error.main'
                    : undefined,
                },
              }}
              disabled={loading} sx={{ mb: 2 }}
              slotProps={{ input: eyeButton(showConfirm, setShowConfirm) }}
            />

            <FormControl fullWidth sx={{ mb: 3 }} error={Boolean(errors.role)}>
              <InputLabel>Role</InputLabel>
              <Select name="role" value={form.role} label="Role" onChange={handleChange} disabled={loading}>
                <MenuItem value="viewer">Viewer — Read only</MenuItem>
                <MenuItem value="contributor">Contributor — Create and update</MenuItem>
                <MenuItem value="manager">Manager — Full project control</MenuItem>
                <MenuItem value="admin">Admin — Full system access</MenuItem>
              </Select>
              {errors.role && <FormHelperText>{errors.role}</FormHelperText>}
            </FormControl>

            <Button
              type="submit" fullWidth variant="contained" size="large"
              disabled={loading || !allPasswordRulesPassed || !passwordsMatch}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Create account'}
            </Button>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Already have an account?{' '}
                <Link to="/login" style={{ color: 'inherit', fontWeight: 600 }}>
                  Sign in
                </Link>
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default RegisterContent;