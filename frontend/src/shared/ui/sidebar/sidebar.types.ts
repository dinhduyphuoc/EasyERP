import type { SvgIconComponent } from '@mui/icons-material'

export type SidebarLinkItem = {
  id: string
  kind: 'item'
  label: string
  to: string
  exact?: boolean
  icon?: SvgIconComponent
}

export type SidebarGroupItem = {
  id: string
  kind: 'group'
  label: string
  icon?: SvgIconComponent
  children: SidebarLinkItem[]
}

export type SidebarItem = SidebarLinkItem | SidebarGroupItem
