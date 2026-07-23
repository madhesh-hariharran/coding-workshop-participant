import { createTheme } from '@mui/material/styles';

/**
 * Light theme — used when system preference is light or user toggles manually.
 * To change brand colors, update primary.main and secondary.main in both themes.
 */
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',       // brand blue — change this to your preferred color
    },
    secondary: {
      main: '#9c27b0',       // purple accent — change this to your preferred color
    },
    error: {
      main: '#d32f2f',       // red — used for delete actions and error states
    },
    warning: {
      main: '#ed6c02',       // orange — used for at_risk projects and over-allocation
    },
    info: {
      main: '#0288d1',       // light blue — used for informational alerts
    },
    success: {
      main: '#2e7d32',       // green — used for completed status
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        },
      },
    },
  },
});

/**
 * Dark theme — used when system preference is dark or user toggles manually.
 * Primary colors are lightened for dark backgrounds to maintain contrast.
 */
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',       // lighter blue for dark background contrast
    },
    secondary: {
      main: '#ce93d8',       // lighter purple for dark background contrast
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ffa726',
    },
    info: {
      main: '#29b6f6',
    },
    success: {
      main: '#66bb6a',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        },
      },
    },
  },
});