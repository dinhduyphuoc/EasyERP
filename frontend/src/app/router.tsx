import { Suspense, lazy, type ReactElement } from 'react'
import { Box, Paper, Skeleton, Stack } from '@mui/material'
import type { RouteObject } from 'react-router'
import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router'
import { AppDocumentTitle } from '@/app/app-document-title'
import { sidebarRouteItems } from '@/app/config/sidebar-routes'
import { DashboardLayout } from '@/app/layouts/dashboard-layout'
import { PermissionRoute } from '@/modules/auth/permission-route'
import { ProtectedRoute } from '@/modules/auth/protected-route'
import { OnboardingRoute, SetupProtectedRoute } from '@/modules/setup/setup-route'
import { ForbiddenPage } from '@/pages/auth/forbidden-page'
import { LoginPage } from '@/pages/auth/login-page'
import { InventoryAuditPageSkeleton } from '@/pages/inventory/inventory-skeletons'
import { orderApi } from '@/pages/orders/api'
import { DetailPageSkeleton } from '@/pages/orders/components'
import { ProductCategoryPageSkeleton, ProductPageSkeleton } from '@/pages/products/product-skeletons'
import { settingsRouteDefinitions } from '@/pages/settings/settings.routes'
import { PagePlaceholder } from '@/shared/ui/page/page-placeholder'

const DashboardOverviewPage = lazy(() =>
  import('@/pages/dashboard/dashboard-overview-page').then((module) => ({ default: module.DashboardOverviewPage })),
)
const AccountProfilePage = lazy(() =>
  import('@/pages/account/account-profile-page').then((module) => ({ default: module.AccountProfilePage })),
)
const AccountSettingsPage = lazy(() =>
  import('@/pages/account/account-settings-page').then((module) => ({ default: module.AccountSettingsPage })),
)
const CustomerListPage = lazy(() =>
  import('@/pages/customers/customer-list-page').then((module) => ({ default: module.CustomerListPage })),
)
const CustomerCreatePage = lazy(() =>
  import('@/pages/customers/customer-create-page').then((module) => ({ default: module.CustomerCreatePage })),
)
const InventoryStockPage = lazy(() =>
  import('@/pages/inventory/inventory-stock-page').then((module) => ({ default: module.InventoryStockPage })),
)
const InventoryAuditListPage = lazy(() =>
  import('@/pages/inventory/inventory-audit-list-page').then((module) => ({ default: module.InventoryAuditListPage })),
)
const InventoryAuditCreatePage = lazy(() =>
  import('@/pages/inventory/inventory-audit-create-page').then((module) => ({ default: module.InventoryAuditCreatePage })),
)
const InventoryHistoryPage = lazy(() =>
  import('@/pages/inventory/inventory-history-page').then((module) => ({ default: module.InventoryHistoryPage })),
)
const ProductListPage = lazy(() =>
  import('@/pages/products/product-list-page').then((module) => ({ default: module.ProductListPage })),
)
const ProductCreatePage = lazy(() =>
  import('@/pages/products/product-create-page').then((module) => ({ default: module.ProductCreatePage })),
)
const ProductCategoryListPage = lazy(() =>
  import('@/pages/products/product-category-list-page').then((module) => ({ default: module.ProductCategoryListPage })),
)
const ProductCategoryCreatePage = lazy(() =>
  import('@/pages/products/product-category-create-page').then((module) => ({ default: module.ProductCategoryCreatePage })),
)
const OrdersListPage = lazy(() =>
  import('@/pages/orders/pages/list-page').then((module) => ({ default: module.OrdersListPage })),
)
const OrdersDraftsPage = lazy(() =>
  import('@/pages/orders/pages/drafts-page').then((module) => ({ default: module.OrdersDraftsPage })),
)
const OrdersIncompletePage = lazy(() =>
  import('@/pages/orders/pages/incomplete-page').then((module) => ({ default: module.OrdersIncompletePage })),
)
const OrdersCancelledPage = lazy(() =>
  import('@/pages/orders/pages/cancelled-page').then((module) => ({ default: module.OrdersCancelledPage })),
)
const OrdersReturnsPage = lazy(() =>
  import('@/pages/orders/pages/returns-page').then((module) => ({ default: module.OrdersReturnsPage })),
)
const OrdersCreatePage = lazy(() =>
  import('@/pages/orders/pages/create-page').then((module) => ({ default: module.OrdersCreatePage })),
)
const OrdersDetailPage = lazy(() =>
  import('@/pages/orders/pages/detail-page').then((module) => ({ default: module.OrdersDetailPage })),
)
const SettingsWorkspaceLayout = lazy(() =>
  import('@/pages/settings/settings-workspace-layout').then((module) => ({ default: module.SettingsWorkspaceLayout })),
)
const SettingsGeneralPage = lazy(() =>
  import('@/pages/settings/settings-general-page').then((module) => ({ default: module.SettingsGeneralPage })),
)
const SettingsStoreDetailsPage = lazy(() =>
  import('@/pages/settings/settings-store-details-page').then((module) => ({ default: module.SettingsStoreDetailsPage })),
)
const SettingsPaymentMethodsPage = lazy(() =>
  import('@/pages/settings/settings-payment-methods-page').then((module) => ({ default: module.SettingsPaymentMethodsPage })),
)
const SettingsBillingInvoicesPage = lazy(() =>
  import('@/pages/settings/settings-billing-invoices-page').then((module) => ({ default: module.SettingsBillingInvoicesPage })),
)
const SettingsAddressManagementPage = lazy(() =>
  import('@/pages/settings/settings-address-management-page').then((module) => ({ default: module.SettingsAddressManagementPage })),
)
const SettingsAccountsPage = lazy(() =>
  import('@/pages/settings/settings-accounts-page').then((module) => ({ default: module.SettingsAccountsPage })),
)
const SettingsRolePermissionPage = lazy(() =>
  import('@/pages/settings/settings-role-permission-page').then((module) => ({ default: module.SettingsRolePermissionPage })),
)
const ShippingManagementView = lazy(() =>
  import('@/pages/shipping/shipping-management-view').then((module) => ({ default: module.ShippingManagementView })),
)
const SettingsPlaceholderPage = lazy(() =>
  import('@/pages/settings/settings-placeholder-page').then((module) => ({ default: module.SettingsPlaceholderPage })),
)
const OnboardingPage = lazy(() =>
  import('@/pages/onboarding/onboarding-page').then((module) => ({ default: module.OnboardingPage })),
)

const childRoutes: RouteObject[] = []

const withPermission = (permissions: string[], element: ReactElement) => (
  <PermissionRoute permissions={permissions}>{element}</PermissionRoute>
)

const RoutePageSkeleton = () => (
  <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, py: 3 }}>
    <Stack spacing={2.5}>
      <Skeleton variant="rounded" height={76} sx={{ borderRadius: 4 }} />
      <Paper variant="outlined" sx={{ borderRadius: 3, p: 2.5 }}>
        <Stack spacing={2}>
          <Skeleton variant="text" width="28%" height={34} />
          <Skeleton variant="rounded" height={88} sx={{ borderRadius: 3 }} />
          <Skeleton variant="rounded" height={320} sx={{ borderRadius: 3 }} />
        </Stack>
      </Paper>
    </Stack>
  </Box>
)

const renderLazyPage = (element: ReactElement, fallback: ReactElement = <RoutePageSkeleton />) => (
  <Suspense fallback={fallback}>{element}</Suspense>
)

const AppRouteShell = () => (
  <>
    <AppDocumentTitle />
    <Outlet />
  </>
)

const customRouteElements: Record<string, ReactElement> = {
  '/': renderLazyPage(<DashboardOverviewPage />),
  '/products': renderLazyPage(<ProductListPage />),
  '/customers': renderLazyPage(<CustomerListPage />),
  '/customers/create': renderLazyPage(<CustomerCreatePage />),
  '/orders': renderLazyPage(<OrdersListPage />),
  '/orders/drafts': renderLazyPage(<OrdersDraftsPage />),
  '/orders/incomplete': renderLazyPage(<OrdersIncompletePage />),
  '/orders/cancelled': renderLazyPage(<OrdersCancelledPage />),
  '/orders/returns': renderLazyPage(<OrdersReturnsPage />),
  '/inventory/stock': renderLazyPage(<InventoryStockPage />),
  '/inventory/audit': renderLazyPage(<InventoryAuditListPage />),
  '/inventory/audit/create': renderLazyPage(<InventoryAuditCreatePage />, <InventoryAuditPageSkeleton />),
  '/products/create': renderLazyPage(<ProductCreatePage />, <ProductPageSkeleton />),
  '/products/categories': renderLazyPage(<ProductCategoryListPage />),
  '/products/categories/create': renderLazyPage(<ProductCategoryCreatePage />, <ProductCategoryPageSkeleton />),
  '/account/profile': renderLazyPage(<AccountProfilePage />),
  '/account/settings': renderLazyPage(<AccountSettingsPage />),
}

for (const item of sidebarRouteItems) {
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
  element: renderLazyPage(<ProductCreatePage />, <ProductPageSkeleton />),
})

childRoutes.push({
  path: 'customers/create',
  element: renderLazyPage(<CustomerCreatePage />),
})

childRoutes.push({
  path: 'customers/:id',
  element: renderLazyPage(<CustomerCreatePage />),
})

childRoutes.push({
  path: 'orders/create',
  element: renderLazyPage(<OrdersCreatePage />, <RoutePageSkeleton />),
})

childRoutes.push({
  path: 'orders/:id',
  loader: async ({ params }) => {
    if (!params.id) {
      throw new Response('Order id is required', { status: 400 })
    }

    return orderApi.getOrderById(params.id)
  },
  element: renderLazyPage(<OrdersDetailPage />, <DetailPageSkeleton />),
})

childRoutes.push({
  path: 'orders/:id/edit',
  element: renderLazyPage(<OrdersCreatePage />, <RoutePageSkeleton />),
})

childRoutes.push({
  path: 'inventory/audit/create',
  element: renderLazyPage(<InventoryAuditCreatePage />, <InventoryAuditPageSkeleton />),
})

childRoutes.push({
  path: 'inventory/audit/:id/edit',
  element: renderLazyPage(<InventoryAuditCreatePage />, <InventoryAuditPageSkeleton />),
})

childRoutes.push({
  path: 'inventory/stock/:productVariantId/history',
  element: renderLazyPage(<InventoryHistoryPage />),
})

childRoutes.push({
  path: 'products/categories/create',
  element: renderLazyPage(<ProductCategoryCreatePage />, <ProductCategoryPageSkeleton />),
})

childRoutes.push({
  path: 'products/categories/:id/edit',
  element: renderLazyPage(<ProductCategoryCreatePage />, <ProductCategoryPageSkeleton />),
})

childRoutes.push({
  path: 'account/profile',
  element: renderLazyPage(<AccountProfilePage />),
})

childRoutes.push({
  path: 'account/settings',
  element: renderLazyPage(<AccountSettingsPage />),
})

const router = createBrowserRouter([
  {
    element: <AppRouteShell />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        element: <OnboardingRoute />,
        children: [
          {
            path: '/onboarding',
            element: renderLazyPage(<OnboardingPage />),
          },
        ],
      },
      {
        path: '/403',
        element: <ForbiddenPage />,
      },
      {
        element: <SetupProtectedRoute />,
        children: [
          {
            element: <ProtectedRoute />,
            children: [
              {
                path: '/',
                element: renderLazyPage(<DashboardLayout />),
                children: childRoutes,
              },
              {
                path: '/settings',
                element: withPermission(['settings.read'], renderLazyPage(<SettingsWorkspaceLayout />)),
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
                    element: withPermission(['settings.read'], renderLazyPage(<SettingsStoreDetailsPage />)),
                  },
                  {
                    path: 'general/payment-methods',
                    element: withPermission(['payments.read'], renderLazyPage(<SettingsPaymentMethodsPage />)),
                  },
                  ...settingsRouteDefinitions.map((item) => ({
                    path: item.path.replace('/settings/', ''),
                    element:
                      item.path === '/settings/general'
                        ? withPermission(['settings.read'], renderLazyPage(<SettingsGeneralPage />))
                        : item.path === '/settings/address-management'
                          ? withPermission(['settings.read'], renderLazyPage(<SettingsAddressManagementPage />))
                          : item.path === '/settings/payment-methods'
                            ? withPermission(['payments.read'], renderLazyPage(<SettingsPaymentMethodsPage />))
                            : item.path === '/settings/billing-invoices'
                              ? withPermission(['payments.read'], renderLazyPage(<SettingsBillingInvoicesPage />))
                              : item.path === '/settings/accounts'
                                ? withPermission(['users.read'], renderLazyPage(<SettingsAccountsPage />))
                                : item.path === '/settings/role-permission-groups'
                                  ? withPermission(['users.read'], renderLazyPage(<SettingsRolePermissionPage />))
                                  : item.path === '/settings/shipping-settings'
                                    ? withPermission(['settings.read'], renderLazyPage(<ShippingManagementView />))
                                    : withPermission(
                                        item.permissions ?? ['settings.read'],
                                        renderLazyPage(<SettingsPlaceholderPage />),
                                      ),
                  })),
                ],
              },
            ],
          },
        ],
      },
    ],
  },
])

export function AppRouter(): ReactElement {
  return <RouterProvider router={router} />
}
