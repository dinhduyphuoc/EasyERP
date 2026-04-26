import type { SvgIconComponent } from '@mui/icons-material'
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined'
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined'
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined'
import GroupWorkOutlinedIcon from '@mui/icons-material/GroupWorkOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'

export type SettingsCardItem = {
  title: string
  description: string
  path: string
  icon: SvgIconComponent
  permissions?: string[]
}

export type SettingsCardSection = {
  id: string
  title: string
  description: string
  items: SettingsCardItem[]
}

export const settingsSections: SettingsCardSection[] = [
  {
    id: 'general',
    title: 'Platform setup',
    description: 'Core configuration for store operations, shipping, and business defaults.',
    items: [
      {
        title: 'General',
        description: 'Configure store identity, legal details, contact information, and store defaults.',
        path: '/settings/general',
        icon: SettingsOutlinedIcon,
        permissions: ['settings.read'],
      },
      {
        title: 'Address Management',
        description: 'Manage the default shipping address and reusable location information.',
        path: '/settings/address-management',
        icon: ApartmentOutlinedIcon,
        permissions: ['settings.read'],
      },
      {
        title: 'Shipping',
        description: 'Set up carrier integrations and shipping-related operational rules.',
        path: '/settings/shipping-settings',
        icon: LocalShippingOutlinedIcon,
        permissions: ['settings.read'],
      },
    ],
  },
  {
    id: 'accounts',
    title: 'Team and access',
    description: 'Control users, roles, permissions, and how work is assigned across the OMS.',
    items: [
      {
        title: 'Users',
        description: 'Create and manage user accounts, statuses, and login-related details.',
        path: '/settings/accounts',
        icon: PersonOutlineOutlinedIcon,
        permissions: ['users.read'],
      },
      {
        title: 'Permissions',
        description: 'Define role groups and control what each team can access and edit.',
        path: '/settings/role-permission-groups',
        icon: GroupWorkOutlinedIcon,
        permissions: ['users.read'],
      },
      {
        title: 'Assignment Groups',
        description: 'Group staff by responsibility for smoother routing and accountability.',
        path: '/settings/assignment-groups',
        icon: Inventory2OutlinedIcon,
        permissions: ['users.read'],
      },
    ],
  },
  {
    id: 'payments',
    title: 'Billing and payments',
    description: 'Configure payment methods, billing behavior, and finance-facing settings.',
    items: [
      {
        title: 'Payment Methods',
        description: 'Manage the default bank account and finance-facing payment details.',
        path: '/settings/payment-methods',
        icon: CreditCardOutlinedIcon,
        permissions: ['payments.read'],
      },
      {
        title: 'Billing',
        description: 'Maintain invoice templates, billing data, and finance document preferences.',
        path: '/settings/billing-invoices',
        icon: ReceiptLongOutlinedIcon,
        permissions: ['payments.read'],
      },
    ],
  },
  {
    id: 'system',
    title: 'Extensions and operations',
    description: 'Manage operational channels, integrations, notifications, and shared resources.',
    items: [
      {
        title: 'Markets',
        description: 'Coordinate sales channels and how OMS data syncs across them.',
        path: '/settings/sales-channels',
        icon: StorefrontOutlinedIcon,
        permissions: ['settings.read'],
      },
      {
        title: 'Apps',
        description: 'Configure internal alerts, automation notifications, and connected tooling.',
        path: '/settings/notifications',
        icon: NotificationsOutlinedIcon,
        permissions: ['settings.read'],
      },
      {
        title: 'Files',
        description: 'Manage shared files, storage rules, and operational assets.',
        path: '/settings/file-management',
        icon: FolderOpenOutlinedIcon,
        permissions: ['settings.read'],
      },
    ],
  },
]

export const settingsDetailPages = settingsSections.flatMap((section) => section.items)

export const settingsItemsByPath = Object.fromEntries(
  settingsDetailPages.map((item) => [item.path, item]),
) as Record<string, SettingsCardItem>
