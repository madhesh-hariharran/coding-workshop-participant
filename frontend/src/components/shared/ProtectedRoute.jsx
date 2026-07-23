import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../../context/useAuth';
import { Box, CircularProgress } from '@mui/material';

function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
export default ProtectedRoute;
