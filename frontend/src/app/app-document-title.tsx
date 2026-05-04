import { useEffect } from 'react'
import { matchPath, useLocation } from 'react-router'
import { sidebarRouteItems } from '@/app/config/sidebar-routes'
import { settingsItemsByPath } from '@/pages/settings/settings.config'

const APP_NAME = 'EasyERP'

const staticRouteTitles = new Map<string, string>([
  ['/login', 'Đăng nhập'],
  ['/403', 'Không có quyền truy cập'],
  ['/settings', 'Cài đặt'],
  ['/settings/general/store-details', 'Thông tin cửa hàng'],
  ['/settings/general/payment-methods', 'Phương thức thanh toán'],
  ['/account/profile', 'Thông tin tài khoản'],
  ['/account/settings', 'Cấu hình tài khoản'],
])

const dynamicRouteTitles: Array<{ pattern: string; title: string }> = [
  { pattern: '/customers/create', title: 'Thêm khách hàng' },
  { pattern: '/customers/:id', title: 'Chỉnh sửa khách hàng' },
  { pattern: '/orders/create', title: 'Tạo đơn hàng' },
  { pattern: '/orders/:id/edit', title: 'Chỉnh sửa đơn hàng' },
  { pattern: '/orders/:id', title: 'Chi tiết đơn hàng' },
  { pattern: '/products/create', title: 'Thêm sản phẩm' },
  { pattern: '/products/:id/edit', title: 'Chỉnh sửa sản phẩm' },
  { pattern: '/products/categories/create', title: 'Thêm danh mục' },
  { pattern: '/products/categories/:id/edit', title: 'Chỉnh sửa danh mục' },
  { pattern: '/inventory/audit/create', title: 'Tạo phiếu kiểm kho' },
  { pattern: '/inventory/audit/:id/edit', title: 'Chỉnh sửa phiếu kiểm kho' },
  { pattern: '/inventory/stock/:productVariantId/history', title: 'Lịch sử tồn kho' },
]

const flattenedSidebarTitles = sidebarRouteItems.flatMap((item) =>
  item.kind === 'item' ? [[item.to, item.label] as const] : item.children.map((child) => [child.to, child.label] as const),
)

for (const [path, title] of flattenedSidebarTitles) {
  staticRouteTitles.set(path, title)
}

for (const [path, item] of Object.entries(settingsItemsByPath)) {
  staticRouteTitles.set(path, item.title)
}

function formatTitle(pageTitle: string) {
  return `${APP_NAME} - ${pageTitle}`
}

function humanizePathname(pathname: string) {
  const lastSegment = pathname.split('/').filter(Boolean).at(-1)
  if (!lastSegment) {
    return 'Tổng quan'
  }

  return lastSegment
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function resolvePageTitle(pathname: string) {
  const staticTitle = staticRouteTitles.get(pathname)
  if (staticTitle) {
    return staticTitle
  }

  const dynamicTitle = dynamicRouteTitles.find((route) => matchPath({ path: route.pattern, end: true }, pathname))
  if (dynamicTitle) {
    return dynamicTitle.title
  }

  return humanizePathname(pathname)
}

export function AppDocumentTitle() {
  const location = useLocation()

  useEffect(() => {
    document.title = formatTitle(resolvePageTitle(location.pathname))
  }, [location.pathname])

  return null
}
