import useAuth from '../../context/useAuth';

/**
 * RoleGuard — conditionally renders children based on user role.
 * Usage: <RoleGuard minRole="manager"><DeleteButton /></RoleGuard>
 */
function RoleGuard({ minRole, children, fallback = null }) {
  const { hasRole } = useAuth();
  return hasRole(minRole) ? children : fallback;
}

export default RoleGuard;