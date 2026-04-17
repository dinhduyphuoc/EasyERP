import type { ReactElement } from 'react'
import type { RouteObject } from 'react-router'
import { RouterProvider, createBrowserRouter } from 'react-router'
import { sidebarMenu } from '@/app/config/sidebar-menu'
import { DashboardLayout } from '@/app/layouts/dashboard-layout'
import { ProductListPage } from '@/pages/products/product-list-page'
import { PagePlaceholder } from '@/shared/ui/page/page-placeholder'

const childRoutes: RouteObject[] = []
const customRouteElements: Record<string, ReactElement> = {
  '/products': <ProductListPage />,
}

for (const item of sidebarMenu) {
  if (item.kind === 'item') {
    if (item.to === '/') {
      childRoutes.push({
        index: true,
        element: customRouteElements[item.to] ?? <PagePlaceholder title={item.label} path={item.to} />,
      })
      continue
    }

    childRoutes.push({
      path: item.to.slice(1),
      element: customRouteElements[item.to] ?? <PagePlaceholder title={item.label} path={item.to} />,
    })
    continue
  }

  for (const child of item.children) {
    childRoutes.push({
      path: child.to.slice(1),
      element: customRouteElements[child.to] ?? <PagePlaceholder title={child.label} path={child.to} />,
    })
  }
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
    children: childRoutes,
  },
])

export function AppRouter(): ReactElement {
  return <RouterProvider router={router} />
}
