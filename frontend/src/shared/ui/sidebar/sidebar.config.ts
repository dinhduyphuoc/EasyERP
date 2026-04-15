import type {
  SidebarGroupItem,
  SidebarItem,
  SidebarLinkItem,
} from '@/shared/ui/sidebar/sidebar.types'

export const sidebarMenu: SidebarItem[] = [
  {
    id: 'dashboard',
    kind: 'item',
    label: 'Tổng quan',
    to: '/',
    exact: true,
  },
  {
    id: 'orders',
    kind: 'group',
    label: 'Đơn hàng',
    children: [
      { id: 'orders-list', kind: 'item', label: 'Danh sách đơn hàng', to: '/orders' },
      { id: 'orders-draft', kind: 'item', label: 'Đơn hàng nháp', to: '/orders/drafts' },
      { id: 'orders-return', kind: 'item', label: 'Trả hàng', to: '/orders/returns' },
      {
        id: 'orders-incomplete',
        kind: 'item',
        label: 'Đơn hàng chưa hoàn tất',
        to: '/orders/incomplete',
      },
    ],
  },
  {
    id: 'shipping',
    kind: 'group',
    label: 'Vận chuyển',
    children: [
      { id: 'shipping-overview', kind: 'item', label: 'Tổng quan', to: '/shipping' },
      { id: 'shipping-bills', kind: 'item', label: 'Vận đơn', to: '/shipping/bills' },
    ],
  },
  {
    id: 'products',
    kind: 'group',
    label: 'Sản phẩm',
    children: [
      { id: 'products-list', kind: 'item', label: 'Danh sách sản phẩm', to: '/products' },
      { id: 'products-create', kind: 'item', label: 'Thêm sản phẩm', to: '/products/create' },
      {
        id: 'products-categories',
        kind: 'item',
        label: 'Danh mục sản phẩm',
        to: '/products/categories',
      },
      { id: 'products-pricing', kind: 'item', label: 'Bảng giá', to: '/products/pricing' },
    ],
  },
  {
    id: 'inventory',
    kind: 'group',
    label: 'Quản lý kho',
    children: [
      { id: 'inventory-stock', kind: 'item', label: 'Tồn kho', to: '/inventory/stock' },
      {
        id: 'inventory-purchase-orders',
        kind: 'item',
        label: 'Đặt hàng nhập',
        to: '/inventory/purchase-orders',
      },
      { id: 'inventory-goods-receipt', kind: 'item', label: 'Nhập hàng', to: '/inventory/receipts' },
      {
        id: 'inventory-return',
        kind: 'item',
        label: 'Trả hàng nhập',
        to: '/inventory/returns',
      },
      { id: 'inventory-transfer', kind: 'item', label: 'Chuyển kho', to: '/inventory/transfers' },
      {
        id: 'inventory-suppliers',
        kind: 'item',
        label: 'Nhà cung cấp',
        to: '/inventory/suppliers',
      },
    ],
  },
  {
    id: 'customers',
    kind: 'item',
    label: 'Khách hàng',
    to: '/customers',
  },
  {
    id: 'promotions',
    kind: 'item',
    label: 'Khuyến mãi',
    to: '/promotions',
  },
  {
    id: 'cashbook',
    kind: 'item',
    label: 'Sổ quỹ',
    to: '/cashbook',
  },
  {
    id: 'reports',
    kind: 'item',
    label: 'Báo cáo',
    to: '/reports',
  },
]

export function isSidebarLinkActive(item: SidebarLinkItem, pathname: string): boolean {
  if (item.to === '/') {
    return pathname === '/'
  }

  if (item.exact) {
    return pathname === item.to
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

export function findActiveGroup(pathname: string): SidebarGroupItem | null {
  for (const item of sidebarMenu) {
    if (item.kind === 'group' && item.children.some((child) => isSidebarLinkActive(child, pathname))) {
      return item
    }
  }

  return null
}
