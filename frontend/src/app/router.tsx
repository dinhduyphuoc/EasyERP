import { createBrowserRouter } from 'react-router-dom'
import { DashboardLayout } from '@/app/layouts/dashboard-layout'
import { DashboardPage } from '@/pages/dashboard/page'
import { ProductsPage } from '@/pages/products/page'
import { CustomersPage } from '@/pages/customers/page'
import { NotFoundPage } from '@/pages/not-found/page'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'products',
        element: <ProductsPage />,
      },
      {
        path: 'customers',
        element: <CustomersPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
])
