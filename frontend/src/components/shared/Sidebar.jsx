import {
  Drawer, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Toolbar, Box, Divider, Chip
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PeopleIcon from '@mui/icons-material/People';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../context/useAuth';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon />, minRole: 'viewer' },
  { label: 'Projects', path: '/projects', icon: <FolderIcon />, minRole: 'viewer' },
  { label: 'Deliverables', path: '/deliverables', icon: <CheckCircleIcon />, minRole: 'viewer' },
  { label: 'Resources', path: '/resources', icon: <PeopleIcon />, minRole: 'viewer' },
  { label: 'Allocations', path: '/allocations', icon: <AssignmentIndIcon />, minRole: 'viewer' },
  { label: 'Users', path: '/users', icon: <AdminPanelSettingsIcon />, minRole: 'admin' },
];

function SidebarContent({ onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const handleNav = (path) => {
    navigate(path);
    if (onClose) onClose();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FolderIcon color="primary" />
          <Box>
            <ListItemText
              primary="ACME Inc."
              primaryTypographyProps={{ fontWeight: 700, fontSize: 15 }}
            />
          </Box>
        </Box>
      </Toolbar>
      <Divider />
      <List sx={{ flexGrow: 1, pt: 1 }}>
        {NAV_ITEMS.filter((item) => hasRole(item.minRole)).map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => handleNav(item.path)}
                selected={isActive}
                sx={{
                  mx: 1,
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                    '&:hover': { bgcolor: 'primary.dark' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Chip label="v1.0.0" size="small" variant="outlined" />
      </Box>
    </Box>
  );
}

function Sidebar({ drawerWidth, mobileOpen, onClose, isMobile }) {
  return (
    <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
      {/* Mobile drawer — temporary */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: drawerWidth },
        }}
      >
        <SidebarContent onClose={onClose} />
      </Drawer>

      {/* Desktop drawer — permanent */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
        }}
        open
      >
        <SidebarContent />
      </Drawer>
    </Box>
  );
}

export default Sidebar;