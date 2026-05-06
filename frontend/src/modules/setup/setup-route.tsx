import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/modules/auth/use-auth'
import { useSetup } from '@/modules/setup/use-setup'
import { AuthScreenSkeleton } from '@/shared/ui/skeleton/loading-skeletons'

function SetupStateFallback({
  errorMessage,
  onRetry,
}: {
  errorMessage: string | null
  onRetry: () => void
}) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        background:
          'radial-gradient(circle at top left, rgba(15, 118, 110, 0.12), transparent 24%), linear-gradient(180deg, #f4f8fb 0%, #edf3f7 100%)',
      }}
    >
      <Paper sx={{ width: '100%', maxWidth: 440, p: 3.5, borderRadius: 4 }}>
        <Stack spacing={2}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Không thể tải trạng thái hệ thống
          </Typography>
          <Alert severity="error">{errorMessage ?? 'Vui lòng thử lại sau.'}</Alert>
          <Button variant="contained" onClick={onRetry}>
            Thử lại
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}

export function SetupProtectedRoute() {
  const location = useLocation()
  const { status: authStatus } = useAuth()
  const { status, setup, errorMessage, refreshSetupStatus } = useSetup()

  if (status === 'loading' || authStatus === 'loading') {
    return <AuthScreenSkeleton />
  }

  if (status === 'error') {
    return <SetupStateFallback errorMessage={errorMessage} onRetry={() => void refreshSetupStatus()} />
  }

  if (!setup?.setupCompleted) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function OnboardingRoute() {
  const { status: authStatus } = useAuth()
  const { status, setup, errorMessage, refreshSetupStatus } = useSetup()

  if (status === 'loading' || authStatus === 'loading') {
    return <AuthScreenSkeleton />
  }

  if (status === 'error') {
    return <SetupStateFallback errorMessage={errorMessage} onRetry={() => void refreshSetupStatus()} />
  }

  if (setup?.setupCompleted) {
    return <Navigate to={authStatus === 'authenticated' ? '/' : '/login'} replace />
  }

  return <Outlet />
}
