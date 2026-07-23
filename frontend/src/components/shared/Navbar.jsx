import {
  AppBar, Toolbar, IconButton, Typography,
  Box, Tooltip, Avatar, Menu, MenuItem, Divider, Switch, FormControlLabel
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../context/useAuth';

function Navbar({ drawerWidth, onMenuClick, darkMode, setDarkMode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleLogout = () => {
    handleMenuClose();
    logout();
    navigate('/login');
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        width: { md: `calc(100% - ${drawerWidth}px)` },
        ml: { md: `${drawerWidth}px` },
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2, display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        <Typography variant="h6" noWrap sx={{ flexGrow: 1, fontWeight: 700 }}>
          ACME Project Management
        </Typography>

        {/* Theme toggle switch */}
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
          <Typography variant="body2" sx={{ color: 'inherit', opacity: darkMode ? 0.5 : 1 }}>
            Light
          </Typography>
          <Switch
            checked={darkMode}
            onChange={() => setDarkMode((prev) => !prev)}
            color="default"
            sx={{
              '& .MuiSwitch-thumb': { bgcolor: 'white' },
              '& .MuiSwitch-track': { bgcolor: 'rgba(255,255,255,0.3)' },
            }}
          />
          <Typography variant="body2" sx={{ color: 'inherit', opacity: darkMode ? 1 : 0.5 }}>
            Dark
          </Typography>
        </Box>

        <Tooltip title={user?.name || 'Account'}>
          <IconButton onClick={handleMenuOpen} sx={{ ml: 1 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: 14 }}>
              {user?.name?.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
        </Tooltip>

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="subtitle2" fontWeight={600}>{user?.name}</Typography>
            <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
            <Typography variant="caption" display="block" color="primary" sx={{ textTransform: 'capitalize' }}>
              {user?.role}
            </Typography>
          </Box>
          <Divider />
          <MenuItem onClick={handleLogout}>Logout</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;