import { Box, CircularProgress } from '@mui/material'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/modules/auth/use-auth'

export function ProtectedRoute() {
  const location = useLocation()
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background:
            'radial-gradient(circle at top left, rgba(15, 118, 110, 0.12), transparent 24%), linear-gradient(180deg, #f4f8fb 0%, #edf3f7 100%)',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
