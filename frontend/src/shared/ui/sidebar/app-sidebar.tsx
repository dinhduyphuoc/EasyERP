import { Fragment, useState } from 'react'
import {
  Box,
  Collapse,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
  alpha,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { NavLink, useLocation } from 'react-router'
import { findActiveGroup, isSidebarLinkActive, sidebarMenu } from '@/app/config/sidebar-menu'
import type { SidebarItem } from '@/shared/ui/sidebar/sidebar.types'

type AppSidebarProps = {
  collapsed: boolean
  showExpandedContent: boolean
  onToggleCollapsed: () => void
}

function SidebarIcon({ icon: Icon }: { icon?: SidebarItem['icon'] }) {
  if (!Icon) {
    return null
  }

  return (
    <Box
      component="span"
      sx={{
        width: 22,
        height: 22,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: '#ffffff',
      }}
    >
      <Icon fontSize="small" />
    </Box>
  )
}

function SidebarLink({
  label,
  to,
  isActive,
  icon,
  collapsed,
  showExpandedContent,
  nested = false,
}: {
  label: string
  to: string
  isActive: boolean
  icon?: SidebarItem['icon']
  collapsed: boolean
  showExpandedContent: boolean
  nested?: boolean
}) {
  return (
    <ListItemButton
      component={NavLink}
      to={to}
      sx={{
        minHeight: 44,
        px: collapsed ? 1.75 : nested ? 2 : 2.25,
        pl: collapsed ? 1.75 : nested ? 4.5 : 2.25,
        borderRadius: "4px",
        mb: 0.5,
        color: '#ffffff',
        bgcolor: isActive ? (theme) => alpha(theme.palette.primary.light, 0.22) : 'transparent',
        justifyContent: collapsed ? 'center' : 'flex-start',
        '&:hover': {
          bgcolor: (theme) =>
            isActive ? alpha(theme.palette.primary.light, 0.28) : alpha(theme.palette.common.white, 0.08),
            borderRadius: "4px",
        },
      }}
    >
      {!nested ? <SidebarIcon icon={icon} /> : null}
      {showExpandedContent ? (
        <ListItemText
          primary={label}
          sx={{ ml: nested ? 0 : 1.25 }}
          slotProps={{
            primary: {
              sx: {
                fontSize: nested ? 14 : 15,
                fontWeight: 500,
              },
            },
          }}
        />
      ) : null}
    </ListItemButton>
  )
}

export function AppSidebar({ collapsed, showExpandedContent, onToggleCollapsed }: AppSidebarProps) {
  const { pathname } = useLocation()
  const activeGroup = findActiveGroup(pathname)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const toggleGroup = (itemId: string) => {
    setOpenGroups((current) => ({
      ...current,
      [itemId]: !current[itemId],
    }))
  }

  const renderItem = (item: SidebarItem) => {
    if (item.kind === 'item') {
      return (
        <SidebarLink
          key={item.id}
          label={item.label}
          to={item.to}
          isActive={isSidebarLinkActive(item, pathname)}
          icon={item.icon}
          collapsed={collapsed}
          showExpandedContent={showExpandedContent}
        />
      )
    }

    const isOpen = openGroups[item.id] ?? activeGroup?.id === item.id

    return (
      <Fragment key={item.id}>
        <ListItemButton
          onClick={() => toggleGroup(item.id)}
          sx={{
            minHeight: 46,
            mb: 0.5,
            borderRadius: "4px",
            color: '#ffffff',
            justifyContent: collapsed ? 'center' : 'flex-start',
            '&:hover': {
              bgcolor: (theme) => alpha(theme.palette.common.white, 0.08),
            },
          }}
        >
          <SidebarIcon icon={item.icon} />
          {showExpandedContent ? (
            <ListItemText
              primary={item.label}
              sx={{ ml: collapsed ? 0 : 1.25 }}
              slotProps={{
                primary: {
                  sx: {
                    fontSize: 15,
                    fontWeight: 500,
                  },
                },
              }}
            />
          ) : null}
          {showExpandedContent ? (
            <Box sx={{ display: 'inline-flex', color: alpha('#ffffff', 0.72) }}>
              {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </Box>
          ) : null}
        </ListItemButton>
        <Collapse in={showExpandedContent && isOpen} timeout="auto" unmountOnExit>
          <List disablePadding sx={{ mb: 1 }}>
            {item.children.map((child) => (
              <SidebarLink
                key={child.id}
                label={child.label}
                to={child.to}
                isActive={isSidebarLinkActive(child, pathname)}
                icon={child.icon}
                collapsed={collapsed}
                showExpandedContent={showExpandedContent}
                nested
              />
            ))}
          </List>
        </Collapse>
      </Fragment>
    )
  }

  return (
    <Stack sx={{ height: '100%' }}>
      <Box
        sx={{
          px: collapsed ? 1.5 : 2.5,
          py: 3,
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'space-between',
          alignItems: 'center',
          borderBottom: (theme) => `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
        }}
      >
        {showExpandedContent ? (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 3,
                display: 'grid',
                placeItems: 'center',
                color: 'common.white',
                bgcolor: (theme) => alpha(theme.palette.common.white, 0.12),
                fontWeight: 800,
              }}
            >
              E
            </Box>
            <Box>
              <Typography variant="subtitle1" color="common.white" sx={{ fontWeight: 800 }}>
                EasyERP
              </Typography>
              <Typography variant="body2" color={alpha('#ffffff', 0.72)}>
                Quản trị bán hàng
              </Typography>
            </Box>
          </Stack>
        ) : null}
        <Box
          onClick={onToggleCollapsed}
          sx={{
            display: { xs: 'none', lg: 'inline-flex' },
            color: alpha('#ffffff', 0.72),
            cursor: 'pointer',
            transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <ChevronLeftIcon fontSize="small" />
        </Box>
      </Box>

      <List sx={{ p: 2, overflowY: 'auto' }}>
        {sidebarMenu.map(renderItem)}
      </List>
    </Stack>
  )
}
