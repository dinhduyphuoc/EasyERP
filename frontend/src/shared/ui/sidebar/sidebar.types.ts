export interface SidebarBaseItem {
  id: string
  label: string
}

export interface SidebarLinkItem extends SidebarBaseItem {
  kind: 'item'
  to: string
  exact?: boolean
}

export interface SidebarGroupItem extends SidebarBaseItem {
  kind: 'group'
  to?: string
  children: SidebarLinkItem[]
}

export type SidebarItem = SidebarLinkItem | SidebarGroupItem
