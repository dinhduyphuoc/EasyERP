import type {
  SidebarGroupItem,
  SidebarItem,
  SidebarLinkItem,
} from '@/shared/ui/sidebar/sidebar.types'

import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import SellOutlinedIcon from '@mui/icons-material/SellOutlined'
import WalletOutlinedIcon from '@mui/icons-material/WalletOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

export const sidebarMenu: SidebarItem[] = [
  {
    id: 'dashboard',
    kind: 'item',
    label: 'Tổng quan',
    to: '/',
    exact: true,
    icon: DashboardOutlinedIcon,
  },
  {
    id: 'orders',
    kind: 'group',
    label: 'Đơn hàng',
    icon: ReceiptLongOutlinedIcon,
    children: [
      {
        id: 'orders-list',
        kind: 'item',
        label: 'Danh sách đơn hàng',
        to: '/orders',
        exact: true,
        icon: ReceiptLongOutlinedIcon,
      },
      { id: 'orders-draft', kind: 'item', label: 'Đơn hàng nháp', to: '/orders/drafts', icon: ReceiptLongOutlinedIcon },
      { id: 'orders-return', kind: 'item', label: 'Trả hàng', to: '/orders/returns', icon: ReceiptLongOutlinedIcon },
      {
        id: 'orders-incomplete',
        kind: 'item',
        label: 'Đơn hàng chưa hoàn tất',
        to: '/orders/incomplete',
        icon: ReceiptLongOutlinedIcon,
      },
    ],
  },
  {
    id: 'shipping',
    kind: 'group',
    label: 'Vận chuyển',
    icon: LocalShippingOutlinedIcon,
    children: [
      {
        id: 'shipping-overview',
        kind: 'item',
        label: 'Tổng quan',
        to: '/shipping',
        exact: true,
        icon: LocalShippingOutlinedIcon,
      },
      { id: 'shipping-bills', kind: 'item', label: 'Vận đơn', to: '/shipping/bills', icon: LocalShippingOutlinedIcon },
    ],
  },
  {
    id: 'products',
    kind: 'group',
    label: 'Sản phẩm',
    icon: SellOutlinedIcon,
    children: [
      {
        id: 'products-list',
        kind: 'item',
        label: 'Danh sách sản phẩm',
        to: '/products',
        exact: true,
        icon: SellOutlinedIcon,
      },
      { id: 'products-create', kind: 'item', label: 'Thêm sản phẩm', to: '/products/create', icon: SellOutlinedIcon },
      {
        id: 'products-categories',
        kind: 'item',
        label: 'Danh mục sản phẩm',
        to: '/products/categories',
        icon: SellOutlinedIcon,
      },
      { id: 'products-pricing', kind: 'item', label: 'Bảng giá', to: '/products/pricing', icon: SellOutlinedIcon },
    ],
  },
  {
    id: 'inventory',
    kind: 'group',
    label: 'Quản lý kho',
    icon: Inventory2OutlinedIcon,
    children: [
      { id: 'inventory-stock', kind: 'item', label: 'Tồn kho', to: '/inventory/stock', icon: Inventory2OutlinedIcon },
      {
        id: 'inventory-audit',
        kind: 'item',
        label: 'Kiểm kho',
        to: '/inventory/audit',
        icon: Inventory2OutlinedIcon,
      },
      { id: 'inventory-goods-receipt', kind: 'item', label: 'Nhập hàng', to: '/inventory/receipts', icon: Inventory2OutlinedIcon },
      {
        id: 'inventory-return',
        kind: 'item',
        label: 'Trả hàng nhập',
        to: '/inventory/returns',
        icon: Inventory2OutlinedIcon,
      },
      { id: 'inventory-transfer', kind: 'item', label: 'Chuyển kho', to: '/inventory/transfers', icon: Inventory2OutlinedIcon },
      {
        id: 'inventory-suppliers',
        kind: 'item',
        label: 'Nhà cung cấp',
        to: '/inventory/suppliers',
        icon: Inventory2OutlinedIcon,
      },
    ],
  },
  {
    id: 'customers',
    kind: 'item',
    label: 'Khách hàng',
    to: '/customers',
    icon: GroupsOutlinedIcon,
  },
  {
    id: 'promotions',
    kind: 'item',
    label: 'Khuyến mãi',
    to: '/promotions',
    icon: CampaignOutlinedIcon,
  },
  {
    id: 'cashbook',
    kind: 'item',
    label: 'Sổ quỹ',
    to: '/cashbook',
    icon: WalletOutlinedIcon,
  },
  {
    id: 'reports',
    kind: 'item',
    label: 'Báo cáo',
    to: '/reports',
    icon: AssessmentOutlinedIcon,
  },
  {
    id: 'settings',
    kind: 'item',
    label: 'Cài đặt',
    to: '/settings',
    icon: SettingsOutlinedIcon,
  }
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
