import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button,
  Typography, Alert, CircularProgress, InputAdornment,
  IconButton, Divider
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { login as loginApi } from '../../api/authApi';
import useAuth from '../../context/useAuth';

function LoginContent() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!form.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = 'Enter a valid email address';
    if (!form.password.trim()) newErrors.password = 'Password is required';
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
      const res = await loginApi(form.email, form.password);
      const { user, token } = res.data;
      login(user, token);
      navigate('/dashboard');
    } catch (err) {
      const message = err.response?.data?.error || 'Login failed. Please try again.';
      setApiError(message);
    } finally {
      setLoading(false);
    }
  };

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
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 48, height: 48, borderRadius: '50%',
                bgcolor: 'primary.main', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                mx: 'auto', mb: 2,
              }}
            >
              <LockOutlinedIcon sx={{ color: 'white' }} />
            </Box>
            <Typography variant="h5" fontWeight={700}>
              Welcome back
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Sign in to ACME Project Management
            </Typography>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* API error */}
          {apiError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {apiError}
            </Alert>
          )}

          {/* Form */}
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth
              label="Email address"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              error={Boolean(errors.email)}
              helperText={errors.email}
              disabled={loading}
              sx={{ mb: 2 }}
              autoComplete="email"
              autoFocus
            />
            <TextField
              fullWidth
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={handleChange}
              error={Boolean(errors.password)}
              helperText={errors.password}
              disabled={loading}
              sx={{ mb: 3 }}
              autoComplete="current-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((prev) => !prev)}
                      edge="end"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign in'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default LoginContent;