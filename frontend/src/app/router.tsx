import type { ReactElement } from 'react'
import type { RouteObject } from 'react-router'
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router'
import { sidebarMenu } from '@/app/config/sidebar-menu'
import { DashboardLayout } from '@/app/layouts/dashboard-layout'
import { PermissionRoute } from '@/modules/auth/permission-route'
import { ProtectedRoute } from '@/modules/auth/protected-route'
import { AccountProfilePage } from '@/pages/account/account-profile-page'
import { AccountSettingsPage } from '@/pages/account/account-settings-page'
import { ForbiddenPage } from '@/pages/auth/forbidden-page'
import { LoginPage } from '@/pages/auth/login-page'
import { InventoryStockPage } from '@/pages/inventory/inventory-stock-page'
import { InventoryAuditListPage } from '@/pages/inventory/inventory-audit-list-page'
import { InventoryHistoryPage } from '@/pages/inventory/inventory-history-page'
import { ProductCategoryCreatePage } from '@/pages/products/product-category-create-page'
import { ProductCategoryListPage } from '@/pages/products/product-category-list-page'
import { ProductCreatePage } from '@/pages/products/product-create-page'
import { ProductListPage } from '@/pages/products/product-list-page'
import { CustomerCreatePage } from '@/pages/customers/customer-create-page'
import { CustomerListPage } from '@/pages/customers/customer-list-page'
import {
  OrdersCreatePage,
  OrdersCancelledPage,
  OrdersDetailPage,
  OrdersDraftsPage,
  OrdersIncompletePage,
  OrdersListPage,
  OrdersReturnsPage,
} from '@/pages/orders'
import { PagePlaceholder } from '@/shared/ui/page/page-placeholder'
import { InventoryAuditCreatePage } from '@/pages/inventory/inventory-audit-create-page'
import { SettingsAccountsPage } from '@/pages/settings/settings-accounts-page'
import { SettingsAddressManagementPage } from '@/pages/settings/settings-address-management-page'
import { SettingsRolePermissionPage } from '@/pages/settings/settings-role-permission-page'
import { SettingsGeneralPage } from '@/pages/settings/settings-general-page'
import { SettingsPaymentMethodsPage } from '@/pages/settings/settings-payment-methods-page'
import { SettingsPlaceholderPage } from '@/pages/settings/settings-placeholder-page'
import { SettingsStoreDetailsPage } from '@/pages/settings/settings-store-details-page'
import { settingsDetailPages } from '@/pages/settings/settings.config'
import { SettingsWorkspaceLayout } from '@/pages/settings/settings-workspace-layout'
import { ShippingManagementView } from '@/pages/shipping/shipping-management-view'

const childRoutes: RouteObject[] = []
const withPermission = (permissions: string[], element: ReactElement) => (
  <PermissionRoute permissions={permissions}>{element}</PermissionRoute>
)
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
  '/account/profile': <AccountProfilePage />,
  '/account/settings': <AccountSettingsPage />,
}

for (const item of sidebarMenu) {
  if (item.kind === 'item') {
    if (item.to === '/settings') {
      continue
    }

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
  path: 'customers/:id',
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

childRoutes.push({
  path: 'account/profile',
  element: <AccountProfilePage />,
})

childRoutes.push({
  path: 'account/settings',
  element: <AccountSettingsPage />,
})



const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/403',
    element: <ForbiddenPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <DashboardLayout />,
        children: childRoutes,
      },
      {
        path: '/settings',
        element: withPermission(['settings.read'], <SettingsWorkspaceLayout />),
        children: [
          {
            index: true,
            element: <Navigate to="general" replace />,
          },
          {
            path: 'store',
            element: <Navigate to="/settings/general" replace />,
          },
          {
            path: 'general/store-details',
            element: withPermission(['settings.read'], <SettingsStoreDetailsPage />),
          },
          {
            path: 'general/payment-methods',
            element: withPermission(['payments.read'], <SettingsPaymentMethodsPage />),
          },
          ...settingsDetailPages.map((item) => ({
            path: item.path.replace('/settings/', ''),
            element:
              item.path === '/settings/general'
                ? withPermission(['settings.read'], <SettingsGeneralPage />)
                : item.path === '/settings/address-management'
                  ? withPermission(['settings.read'], <SettingsAddressManagementPage />)
                  : item.path === '/settings/payment-methods'
                    ? withPermission(['payments.read'], <SettingsPaymentMethodsPage />)
                    : item.path === '/settings/accounts'
                    ? withPermission(['users.read'], <SettingsAccountsPage />)
                    : item.path === '/settings/role-permission-groups'
                      ? withPermission(['users.read'], <SettingsRolePermissionPage />)
                      : item.path === '/settings/shipping-settings'
                        ? withPermission(['settings.read'], <ShippingManagementView />)
                        : withPermission(item.permissions ?? ['settings.read'], <SettingsPlaceholderPage />),
          })),
        ],
      },
    ],
  },
])

export function AppRouter(): ReactElement {
  return <RouterProvider router={router} />
}
