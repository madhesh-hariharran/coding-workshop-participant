import { createContext } from 'react';

/**
 * AuthContext — internal context object.
 * Do not import this outside the context folder.
 * Use useAuth hook instead.
 */
const AuthContext = createContext(null);

export default AuthContext;