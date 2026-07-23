import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/shared/ProtectedRoute';
import Layout from './components/shared/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Deliverables from './pages/Deliverables';
import Resources from './pages/Resources';
import Allocations from './pages/Allocations';
import Users from './pages/Users';

function App({ darkMode, setDarkMode }) {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes — wrapped in Layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout darkMode={darkMode} setDarkMode={setDarkMode} />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/deliverables" element={<Deliverables />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/allocations" element={<Allocations />} />
            <Route path="/users" element={<Users />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;