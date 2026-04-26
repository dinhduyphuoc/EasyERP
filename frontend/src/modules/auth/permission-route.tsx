import type { PropsWithChildren } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/modules/auth/use-auth'

type PermissionRouteProps = {
  permissions: string[]
} & PropsWithChildren

export function PermissionRoute({ permissions, children }: PermissionRouteProps) {
  const location = useLocation()
  const { hasAnyPermission } = useAuth()

  if (!hasAnyPermission(permissions)) {
    return <Navigate to="/403" replace state={{ from: location.pathname }} />
  }

  return children ?? <Outlet />
}
