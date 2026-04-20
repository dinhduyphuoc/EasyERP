import type { ReactElement } from 'react'
import type { RouteObject } from 'react-router'
import { RouterProvider, createBrowserRouter } from 'react-router'
import { sidebarMenu } from '@/app/config/sidebar-menu'
import { DashboardLayout } from '@/app/layouts/dashboard-layout'
import { InventoryStockPage } from '@/pages/inventory/inventory-stock-page'
import { InventoryAuditListPage } from '@/pages/inventory/inventory-audit-list-page'
import { InventoryHistoryPage } from '@/pages/inventory/inventory-history-page'
import { ProductCategoryCreatePage } from '@/pages/products/product-category-create-page'
import { ProductCategoryListPage } from '@/pages/products/product-category-list-page'
import { ProductCreatePage } from '@/pages/products/product-create-page'
import { ProductListPage } from '@/pages/products/product-list-page'
import { CustomerCreatePage } from '@/pages/customers/customer-create-page'
import { CustomerListPage } from '@/pages/customers/customer-list-page'
import { OrdersCreatePage } from '@/pages/orders/orders-create-page'
import { OrdersCancelledPage } from '@/pages/orders/orders-cancelled-page'
import { OrdersDetailPage } from '@/pages/orders/orders-detail-page'
import { OrdersDraftsPage } from '@/pages/orders/orders-drafts-page'
import { OrdersIncompletePage } from '@/pages/orders/orders-incomplete-page'
import { OrdersListPage } from '@/pages/orders/orders-list-page'
import { OrdersReturnsPage } from '@/pages/orders/orders-returns-page'
import { PagePlaceholder } from '@/shared/ui/page/page-placeholder'
import { InventoryAuditCreatePage } from '@/pages/inventory/inventory-audit-create-page'

const childRoutes: RouteObject[] = []
const customRouteElements: Record<string, ReactElement> = {
  '/products': <ProductListPage />,
  '/customers': <CustomerListPage />,
  '/customers/create': <CustomerCreatePage />,
  '/orders': <OrdersListPage />,
  '/orders/drafts': <OrdersDraftsPage />,
  '/orders/incomplete': <OrdersIncompletePage />,
  '/orders/cancelled': <OrdersCancelledPage />,
  '/orders/returns': <OrdersReturnsPage />,
  '/inventory/stock': <InventoryStockPage />,
  '/inventory/audit': <InventoryAuditListPage />,
  '/inventory/audit/create': <InventoryAuditCreatePage />,
  '/products/create': <ProductCreatePage />,
  '/products/categories': <ProductCategoryListPage />,
  '/products/categories/create': <ProductCategoryCreatePage />,
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

childRoutes.push({
  path: 'products/:id/edit',
  element: <ProductCreatePage />,
})

childRoutes.push({
  path: 'customers/create',
  element: <CustomerCreatePage />,
})

childRoutes.push({
  path: 'orders/create',
  element: <OrdersCreatePage />,
})

childRoutes.push({
  path: 'orders/:id',
  element: <OrdersDetailPage />,
})

childRoutes.push({
  path: 'orders/:id/edit',
  element: <OrdersCreatePage />,
})

childRoutes.push({
  path: 'inventory/audit/create',
  element: <InventoryAuditCreatePage />,
})

childRoutes.push({
  path: 'inventory/audit/:id/edit',
  element: <InventoryAuditCreatePage />,
})

childRoutes.push({
  path: 'inventory/stock/:productVariantId/history',
  element: <InventoryHistoryPage />,
})

childRoutes.push({
  path: 'products/categories/create',
  element: <ProductCategoryCreatePage />,
})

childRoutes.push({
  path: 'products/categories/:id/edit',
  element: <ProductCategoryCreatePage />,
})

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
