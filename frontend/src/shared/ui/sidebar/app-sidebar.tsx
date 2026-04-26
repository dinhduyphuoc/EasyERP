import { Fragment, useEffect, useRef, useState } from 'react'
import {
  Box,
  Collapse,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Popper,
  Stack,
  Typography,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { NavLink, useLocation, useNavigate } from 'react-router'
import {
  filterSidebarMenuByPermission,
  findActiveGroup,
  isSidebarLinkActive,
} from '@/app/config/sidebar-menu'
import { useAuth } from '@/modules/auth/use-auth'
import type { SidebarItem, SidebarLinkItem } from '@/shared/ui/sidebar/sidebar.types'

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
        color: 'currentColor',
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
  onClick,
}: {
  label: string
  to: string
  isActive: boolean
  icon?: SidebarItem['icon']
  collapsed: boolean
  showExpandedContent: boolean
  nested?: boolean
  onClick?: () => void
}) {
  return (
    <ListItemButton
      component={onClick ? 'button' : NavLink}
      to={onClick ? undefined : to}
      onClick={onClick}
      sx={{
        minHeight: 44,
        width: '100%',
        px: collapsed ? 1.75 : nested ? 2 : 2.25,
        pl: collapsed ? 1.75 : nested ? 4.5 : 2.25,
        borderRadius: 3,
        mb: 0.5,
        color: isActive ? '#0f766e' : '#344054',
        bgcolor: isActive ? '#ecfdf3' : 'transparent',
        border: isActive ? '1px solid rgba(15, 118, 110, 0.12)' : '1px solid transparent',
        boxShadow: isActive ? '0 10px 24px rgba(15, 118, 110, 0.08)' : 'none',
        justifyContent: collapsed ? 'center' : 'flex-start',
        transition: 'background-color 160ms ease, box-shadow 160ms ease, border-color 160ms ease, transform 160ms ease',
        '&:hover': {
          bgcolor: isActive ? '#e3faf2' : '#f8fafc',
          borderColor: isActive ? 'rgba(15, 118, 110, 0.16)' : 'rgba(15, 23, 42, 0.06)',
          transform: collapsed ? 'none' : 'translateX(2px)',
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
                fontWeight: isActive ? 700 : 500,
              },
            },
          }}
        />
      ) : null}
    </ListItemButton>
  )
}

export function AppSidebar({ collapsed, showExpandedContent, onToggleCollapsed }: AppSidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { pathname } = location
  const { user } = useAuth()
  const visibleSidebarMenu = filterSidebarMenuByPermission(user)
  const activeGroup = findActiveGroup(pathname, visibleSidebarMenu)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [hoveredItem, setHoveredItem] = useState<SidebarItem | null>(null)
  const [hoverAnchorEl, setHoverAnchorEl] = useState<HTMLElement | null>(null)
  const hoverCloseTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (hoverCloseTimeoutRef.current !== null) {
        window.clearTimeout(hoverCloseTimeoutRef.current)
      }
    }
  }, [])

  const toggleGroup = (itemId: string) => {
    setOpenGroups((current) => ({
      ...current,
      [itemId]: !current[itemId],
    }))
  }

  const handleNavigateToLink = (item: SidebarLinkItem) => {
    if (item.to === '/settings') {
      navigate('/settings/general', {
        state: {
          overlayFrom: `${location.pathname}${location.search}${location.hash}`,
        },
      })
      return
    }

    navigate(item.to)
  }

  const handleOpenHoverMenu = (item: SidebarItem, anchorEl: HTMLElement) => {
    if (!collapsed || showExpandedContent) {
      return
    }

    if (hoverCloseTimeoutRef.current !== null) {
      window.clearTimeout(hoverCloseTimeoutRef.current)
      hoverCloseTimeoutRef.current = null
    }

    setHoveredItem(item)
    setHoverAnchorEl(anchorEl)
  }

  const handleScheduleHoverClose = () => {
    if (hoverCloseTimeoutRef.current !== null) {
      window.clearTimeout(hoverCloseTimeoutRef.current)
    }

    hoverCloseTimeoutRef.current = window.setTimeout(() => {
      setHoveredItem(null)
      setHoverAnchorEl(null)
      hoverCloseTimeoutRef.current = null
    }, 120)
  }

  const handleHoverPanelEnter = () => {
    if (hoverCloseTimeoutRef.current !== null) {
      window.clearTimeout(hoverCloseTimeoutRef.current)
      hoverCloseTimeoutRef.current = null
    }
  }

  const handleHoverPanelClose = () => {
    setHoveredItem(null)
    setHoverAnchorEl(null)
  }

  const renderItem = (item: SidebarItem) => {
    if (item.kind === 'item') {
      return (
        <Box
          key={item.id}
          onMouseEnter={(event) => handleOpenHoverMenu(item, event.currentTarget)}
          onMouseLeave={handleScheduleHoverClose}
        >
          <SidebarLink
            label={item.label}
            to={item.to}
            isActive={isSidebarLinkActive(item, pathname)}
            icon={item.icon}
            collapsed={collapsed}
            showExpandedContent={showExpandedContent}
            onClick={item.to === '/settings' ? () => handleNavigateToLink(item) : undefined}
          />
        </Box>
      )
    }

    const isOpen = openGroups[item.id] ?? activeGroup?.id === item.id

    return (
      <Fragment key={item.id}>
        <Box
          onMouseEnter={(event) => handleOpenHoverMenu(item, event.currentTarget)}
          onMouseLeave={handleScheduleHoverClose}
        >
          <ListItemButton
            onClick={() => toggleGroup(item.id)}
            sx={{
              minHeight: 46,
              width: '100%',
              mb: 0.5,
              borderRadius: 3,
              color: '#344054',
              justifyContent: collapsed ? 'center' : 'flex-start',
              transition: 'background-color 160ms ease, transform 160ms ease',
              '&:hover': {
                bgcolor: '#f8fafc',
                transform: collapsed ? 'none' : 'translateX(2px)',
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
                      fontWeight: 600,
                    },
                  },
                }}
              />
            ) : null}
            {showExpandedContent ? (
              <Box sx={{ display: 'inline-flex', color: '#98a2b3' }}>
                {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </Box>
            ) : null}
          </ListItemButton>
        </Box>
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
          px: collapsed ? 1.5 : 2,
          py: 2,
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
        }}
      >
        {showExpandedContent ? (
          <Stack
            direction="row"
            spacing={1.5}
            sx={{
              alignItems: 'center',
              flex: 1,
              p: 1.25,
              borderRadius: 4,
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              border: '1px solid rgba(15, 23, 42, 0.06)',
              boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06)',
            }}
          >
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: 3,
                display: 'grid',
                placeItems: 'center',
                color: '#ffffff',
                background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
                boxShadow: '0 10px 24px rgba(15, 118, 110, 0.22)',
                fontWeight: 800,
              }}
            >
              E
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#101828' }}>
                EasyERP
              </Typography>
              <Typography variant="body2" color="#667085">
                Sales operations
              </Typography>
            </Box>
          </Stack>
        ) : null}
        <Box
          onClick={onToggleCollapsed}
          sx={{
            display: { xs: 'none', lg: 'inline-flex' },
            color: '#98a2b3',
            cursor: 'pointer',
            transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <ChevronLeftIcon fontSize="small" />
        </Box>
      </Box>

      <List sx={{ p: 1.5, overflowY: 'auto' }}>
        {visibleSidebarMenu.map(renderItem)}
      </List>

      <Popper
        open={Boolean(collapsed && !showExpandedContent && hoveredItem && hoverAnchorEl)}
        anchorEl={hoverAnchorEl}
        placement="right-start"
        modifiers={[
          {
            name: 'offset',
            options: {
              offset: [8, 0],
            },
          },
        ]}
        sx={{ zIndex: 1400 }}
      >
        {hoveredItem ? (
          <Paper
            onMouseEnter={handleHoverPanelEnter}
            onMouseLeave={handleScheduleHoverClose}
            sx={{
              width: hoveredItem.kind === 'group' ? 220 : 164,
              p: hoveredItem.kind === 'group' ? 0.75 : 0.5,
              borderRadius: 3,
              border: '1px solid rgba(15, 23, 42, 0.08)',
              boxShadow: '0 18px 36px rgba(15, 23, 42, 0.12)',
              bgcolor: '#ffffff',
            }}
          >
            <Stack spacing={0.5}>
              {hoveredItem.kind === 'group' ? (
                <>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 0.5, py: 0.25 }}>
                    <Box
                      sx={{
                        width: 30,
                        height: 30,
                        borderRadius: 2,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: '#f2f4f7',
                        color: '#475467',
                        flexShrink: 0,
                      }}
                    >
                      <SidebarIcon icon={hoveredItem.icon} />
                    </Box>
                    <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#101828' }}>
                      {hoveredItem.label}
                    </Typography>
                  </Stack>

                  <List disablePadding sx={{ minWidth: 0 }}>
                    {hoveredItem.children.map((child) => (
                      <SidebarLink
                        key={child.id}
                        label={child.label}
                        to={child.to}
                        isActive={isSidebarLinkActive(child, pathname)}
                        icon={child.icon}
                        collapsed={false}
                        showExpandedContent
                        nested
                        onClick={() => {
                          handleHoverPanelClose()
                          handleNavigateToLink(child)
                        }}
                      />
                    ))}
                  </List>
                </>
              ) : (
                <Stack
                  direction="row"
                  spacing={1}
                  onClick={() => {
                    handleHoverPanelClose()
                    handleNavigateToLink(hoveredItem)
                  }}
                  sx={{
                    alignItems: 'center',
                    borderRadius: 2.5,
                    px: 0.5,
                    py: 0.25,
                    cursor: 'pointer',
                    color: isSidebarLinkActive(hoveredItem, pathname) ? '#0f766e' : '#344054',
                    bgcolor: isSidebarLinkActive(hoveredItem, pathname) ? '#ecfdf3' : 'transparent',
                    border: isSidebarLinkActive(hoveredItem, pathname)
                      ? '1px solid rgba(15, 118, 110, 0.12)'
                      : '1px solid transparent',
                    '&:hover': {
                      bgcolor: isSidebarLinkActive(hoveredItem, pathname) ? '#e3faf2' : '#f8fafc',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: '#f2f4f7',
                      color: 'inherit',
                      flexShrink: 0,
                    }}
                  >
                    <SidebarIcon icon={hoveredItem.icon} />
                  </Box>
                  <Typography
                    sx={{
                      fontSize: 15,
                      fontWeight: isSidebarLinkActive(hoveredItem, pathname) ? 800 : 700,
                    }}
                  >
                    {hoveredItem.label}
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Paper>
        ) : null}
      </Popper>
    </Stack>
  )
}
