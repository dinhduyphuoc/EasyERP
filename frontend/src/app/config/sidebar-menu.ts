import type { SvgIconComponent } from '@mui/icons-material'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import SellOutlinedIcon from '@mui/icons-material/SellOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import WalletOutlinedIcon from '@mui/icons-material/WalletOutlined'
import { sidebarRouteItems } from '@/app/config/sidebar-routes'
import type { AuthUser } from '@/modules/auth/auth.types'
import type { SidebarGroupItem, SidebarItem, SidebarLinkItem } from '@/shared/ui/sidebar/sidebar.types'

const sidebarIconsById: Record<string, SvgIconComponent> = {
  dashboard: DashboardOutlinedIcon,
  orders: ReceiptLongOutlinedIcon,
  'orders-list': ReceiptLongOutlinedIcon,
  'orders-draft': ReceiptLongOutlinedIcon,
  'orders-return': ReceiptLongOutlinedIcon,
  'orders-incomplete': ReceiptLongOutlinedIcon,
  'orders-cancelled': ReceiptLongOutlinedIcon,
  shipping: LocalShippingOutlinedIcon,
  'shipping-overview': LocalShippingOutlinedIcon,
  'shipping-bills': LocalShippingOutlinedIcon,
  products: SellOutlinedIcon,
  'products-list': SellOutlinedIcon,
  'products-create': SellOutlinedIcon,
  'products-categories': SellOutlinedIcon,
  'products-pricing': SellOutlinedIcon,
  inventory: Inventory2OutlinedIcon,
  'inventory-stock': Inventory2OutlinedIcon,
  'inventory-audit': Inventory2OutlinedIcon,
  'inventory-goods-receipt': Inventory2OutlinedIcon,
  'inventory-return': Inventory2OutlinedIcon,
  'inventory-transfer': Inventory2OutlinedIcon,
  'inventory-suppliers': Inventory2OutlinedIcon,
  customers: GroupsOutlinedIcon,
  promotions: CampaignOutlinedIcon,
  cashbook: WalletOutlinedIcon,
  reports: AssessmentOutlinedIcon,
  settings: SettingsOutlinedIcon,
}

export const sidebarMenu: SidebarItem[] = sidebarRouteItems.map((item) =>
  item.kind === 'item'
    ? {
        ...item,
        icon: sidebarIconsById[item.id],
      }
    : {
        ...item,
        icon: sidebarIconsById[item.id],
        children: item.children.map((child) => ({
          ...child,
          icon: sidebarIconsById[child.id],
        })),
      },
)

const sidebarPermissionMap: Record<string, string[]> = {
  '/': ['reports.read', 'orders.read', 'products.read', 'inventory.read', 'customers.read'],
  '/orders': ['orders.read'],
  '/orders/drafts': ['orders.read'],
  '/orders/returns': ['orders.read'],
  '/orders/incomplete': ['orders.read'],
  '/orders/cancelled': ['orders.read'],
  '/shipping': ['orders.read', 'orders.create', 'settings.read'],
  '/shipping/bills': ['orders.read'],
  '/products': ['products.read'],
  '/products/create': ['products.create'],
  '/products/categories': ['products.read'],
  '/products/pricing': ['products.read'],
  '/inventory/stock': ['inventory.read'],
  '/inventory/audit': ['inventory.read'],
  '/inventory/receipts': ['inventory.read'],
  '/inventory/returns': ['warehouse.return'],
  '/inventory/transfers': ['inventory.read'],
  '/inventory/suppliers': ['inventory.read'],
  '/customers': ['customers.read'],
  '/promotions': ['reports.read'],
  '/cashbook': ['payments.read'],
  '/reports': ['reports.read'],
  '/settings': ['settings.read'],
}

const hasAnyPermission = (user: AuthUser | null, permissions: string[]) => {
  if (!user) {
    return false
  }

  return permissions.some((permission) => user.permissions.includes(permission))
}

export function filterSidebarMenuByPermission(user: AuthUser | null): SidebarItem[] {
  return sidebarMenu.reduce<SidebarItem[]>((accumulator, item) => {
    if (item.kind === 'item') {
      const permissions = sidebarPermissionMap[item.to]
      if (!permissions || hasAnyPermission(user, permissions)) {
        accumulator.push(item)
      }

      return accumulator
    }

    const children = item.children.filter((child) => {
      const permissions = sidebarPermissionMap[child.to]
      return !permissions || hasAnyPermission(user, permissions)
    })

    if (children.length > 0) {
      accumulator.push({
        ...item,
        children,
      })
    }

    return accumulator
  }, [])
}

export function isSidebarLinkActive(item: SidebarLinkItem, pathname: string): boolean {
  if (item.to === '/') {
    return pathname === '/'
  }

  if (item.exact) {
    return pathname === item.to
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

export function findActiveGroup(pathname: string, items: SidebarItem[] = sidebarMenu): SidebarGroupItem | null {
  for (const item of items) {
    if (item.kind === 'group' && item.children.some((child) => isSidebarLinkActive(child, pathname))) {
      return item
    }
  }

  return null
}
