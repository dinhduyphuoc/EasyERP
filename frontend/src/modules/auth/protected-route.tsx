import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/modules/auth/use-auth'
import { AuthScreenSkeleton } from '@/shared/ui/skeleton/loading-skeletons'

export function ProtectedRoute() {
  const location = useLocation()
  const { status } = useAuth()

  if (status === 'loading') {
    return <AuthScreenSkeleton />
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
