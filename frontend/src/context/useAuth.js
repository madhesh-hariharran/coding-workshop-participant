import { useContext } from 'react';
import AuthContext from './AuthContext';

/**
 * useAuth — hook to access auth state and actions.
 * Must be used inside AuthProvider.
 */
function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default useAuth;