import { alpha, createTheme } from '@mui/material/styles'

const defaultPaperShadow =
  'inset 0px 0px 0px 1px rgba(0, 0, 0, 0.1), inset 0px -2px 0px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.1)'

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0f766e',
      dark: '#115e59',
      light: '#14b8a6',
    },
    secondary: {
      main: '#f97316',
    },
    background: {
      default: '#edf4f7',
      paper: '#ffffff',
    },
    text: {
      primary: '#132238',
      secondary: '#516071',
    },
    divider: alpha('#132238', 0.08),
  },
  shape: {
    borderRadius: 4,
  },
  typography: {
    fontFamily: "'Be Vietnam Pro', 'Segoe UI', sans-serif",
    h3: {
      fontWeight: 700,
      letterSpacing: '-0.03em',
    },
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.03em',
    },
    h5: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 700,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: defaultPaperShadow,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: 'none',
        },
      },
    },
  },
})
