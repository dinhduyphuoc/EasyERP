export type SettingsRouteDefinition = {
  path: string
  permissions?: string[]
}

export const settingsRouteDefinitions: SettingsRouteDefinition[] = [
  { path: '/settings/general', permissions: ['settings.read'] },
  { path: '/settings/address-management', permissions: ['settings.read'] },
  { path: '/settings/shipping-settings', permissions: ['settings.read'] },
  { path: '/settings/accounts', permissions: ['users.read'] },
  { path: '/settings/role-permission-groups', permissions: ['users.read'] },
  { path: '/settings/assignment-groups', permissions: ['users.read'] },
  { path: '/settings/payment-methods', permissions: ['payments.read'] },
  { path: '/settings/billing-invoices', permissions: ['payments.read'] },
  { path: '/settings/sales-channels', permissions: ['settings.read'] },
  { path: '/settings/notifications', permissions: ['settings.read'] },
  { path: '/settings/file-management', permissions: ['settings.read'] },
]
