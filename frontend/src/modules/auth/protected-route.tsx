import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/modules/auth/use-auth'
import { useSetup } from '@/modules/setup/use-setup'
import { AuthScreenSkeleton } from '@/shared/ui/skeleton/loading-skeletons'

export function ProtectedRoute() {
  const location = useLocation()
  const { status } = useAuth()
  const { status: setupStatus, setup } = useSetup()

  if (status === 'loading' || setupStatus === 'loading') {
    return <AuthScreenSkeleton />
  }

  if (!setup?.setupCompleted) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
