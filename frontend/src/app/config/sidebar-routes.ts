import type { SidebarItem } from '@/shared/ui/sidebar/sidebar.types'

export const sidebarRouteItems: SidebarItem[] = [
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
      {
        id: 'orders-list',
        kind: 'item',
        label: 'Danh sách đơn hàng',
        to: '/orders',
        exact: true,
      },
      { id: 'orders-draft', kind: 'item', label: 'Đơn hàng nháp', to: '/orders/drafts' },
      { id: 'orders-return', kind: 'item', label: 'Trả hàng', to: '/orders/returns' },
      {
        id: 'orders-incomplete',
        kind: 'item',
        label: 'Đơn hàng chưa hoàn tất',
        to: '/orders/incomplete',
      },
      { id: 'orders-cancelled', kind: 'item', label: 'Đơn đã hủy', to: '/orders/cancelled' },
    ],
  },
  {
    id: 'shipping',
    kind: 'group',
    label: 'Vận chuyển',
    children: [
      {
        id: 'shipping-overview',
        kind: 'item',
        label: 'Tổng quan',
        to: '/shipping',
        exact: true,
      },
      { id: 'shipping-bills', kind: 'item', label: 'Vận đơn', to: '/shipping/bills' },
    ],
  },
  {
    id: 'products',
    kind: 'group',
    label: 'Sản phẩm',
    children: [
      {
        id: 'products-list',
        kind: 'item',
        label: 'Danh sách sản phẩm',
        to: '/products',
        exact: true,
      },
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
        id: 'inventory-audit',
        kind: 'item',
        label: 'Kiểm kho',
        to: '/inventory/audit',
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
  {
    id: 'settings',
    kind: 'item',
    label: 'Cài đặt',
    to: '/settings',
  },
]
