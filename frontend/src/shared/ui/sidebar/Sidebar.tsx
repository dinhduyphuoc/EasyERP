import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Box,
  Collapse,
  Divider,
  List,
  ListItemButton,
  Paper,
  Typography,
} from '@mui/material'
import {
  findActiveGroup,
  isSidebarLinkActive,
  sidebarMenu,
} from '@/shared/ui/sidebar/sidebar.config'

const SIDEBAR_WIDTH = 288
const SIDEBAR_STORAGE_KEY = 'erp.sidebar.open-group'

function DotIcon({ active = false }: { active?: boolean }) {
  return (
    <Box
      sx={{
        width: 8,
        height: 8,
        borderRadius: '999px',
        flexShrink: 0,
        bgcolor: active ? '#ffffff' : 'rgba(214, 227, 255, 0.58)',
      }}
    />
  )
}

function RailIcon({ active = false }: { active?: boolean }) {
  return (
    <Box
      sx={{
        width: 18,
        height: 18,
        borderRadius: 1.5,
        flexShrink: 0,
        border: '1.5px solid',
        borderColor: active ? 'rgba(255,255,255,0.92)' : 'rgba(214, 227, 255, 0.48)',
        bgcolor: active ? 'rgba(255,255,255,0.12)' : 'transparent',
      }}
    />
  )
}

export function Sidebar() {
  const location = useLocation()
  const activeGroup = useMemo(() => findActiveGroup(location.pathname), [location.pathname])
  const [openGroupId, setOpenGroupId] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null
    }

    const storedGroup = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
    return storedGroup || findActiveGroup(window.location.pathname)?.id || null
  })

  useEffect(() => {
    if (!activeGroup) {
      return
    }

    setOpenGroupId(activeGroup.id)
  }, [activeGroup])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (openGroupId) {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, openGroupId)
      return
    }

    window.localStorage.removeItem(SIDEBAR_STORAGE_KEY)
  }, [openGroupId])

  return (
    <Paper
      square
      elevation={0}
      sx={{
        width: SIDEBAR_WIDTH,
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
        alignSelf: 'start',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        background: 'linear-gradient(180deg, #13283d 0%, #0a1729 100%)',
        color: '#edf4ff',
        px: 1.5,
        py: 2,
      }}
    >
      <Box
        sx={{
          px: 1.5,
          pb: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            bgcolor: '#7ac0ff',
            color: '#082038',
            fontWeight: 800,
          }}
        >
          S
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
            Symmie
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'rgba(219,230,250,0.68)' }}>
            ERP Dashboard
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 1.5 }} />

      <List disablePadding sx={{ display: 'grid', gap: 0.75 }}>
        {sidebarMenu.map((item) => {
          if (item.kind === 'item') {
            const isActive = isSidebarLinkActive(item, location.pathname)

            return (
              <ListItemButton
                key={item.id}
                component={NavLink}
                to={item.to}
                selected={isActive}
                sx={{
                  minHeight: 48,
                  borderRadius: 3,
                  px: 1.5,
                  gap: 1.5,
                  color: isActive ? '#ffffff' : 'rgba(231,240,255,0.86)',
                  '&.Mui-selected': {
                    bgcolor: 'rgba(124, 180, 255, 0.18)',
                  },
                  '&.Mui-selected:hover': {
                    bgcolor: 'rgba(124, 180, 255, 0.24)',
                  },
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.06)',
                  },
                }}
              >
                <RailIcon active={isActive} />
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                  {item.label}
                </Typography>
              </ListItemButton>
            )
          }

          const groupActive = item.children.some((child) =>
            isSidebarLinkActive(child, location.pathname),
          )
          const groupOpen = openGroupId === item.id

          return (
            <Box key={item.id}>
              <ListItemButton
                onClick={() =>
                  setOpenGroupId((currentValue) =>
                    currentValue === item.id ? null : item.id,
                  )
                }
                sx={{
                  minHeight: 48,
                  borderRadius: 3,
                  px: 1.5,
                  gap: 1.5,
                  color: groupActive ? '#ffffff' : 'rgba(231,240,255,0.86)',
                  bgcolor: groupActive ? 'rgba(124, 180, 255, 0.12)' : 'transparent',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.06)',
                  },
                }}
              >
                <RailIcon active={groupActive} />
                <Typography sx={{ fontSize: 14, fontWeight: 600, flexGrow: 1 }}>
                  {item.label}
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    fontSize: 16,
                    lineHeight: 1,
                    color: 'rgba(231,240,255,0.72)',
                    transform: groupOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 180ms ease',
                  }}
                >
                  ⌄
                </Typography>
              </ListItemButton>

              <Collapse in={groupOpen} timeout="auto" unmountOnExit>
                <List disablePadding sx={{ pt: 0.5, display: 'grid', gap: 0.5 }}>
                  {item.children.map((child) => {
                    const childActive = isSidebarLinkActive(child, location.pathname)

                    return (
                      <ListItemButton
                        key={child.id}
                        component={NavLink}
                        to={child.to}
                        selected={childActive}
                        sx={{
                          minHeight: 40,
                          ml: 2,
                          mr: 0.5,
                          borderRadius: 2.5,
                          px: 1.5,
                          gap: 1.25,
                          color: childActive ? '#ffffff' : 'rgba(211,224,246,0.78)',
                          '&.Mui-selected': {
                            bgcolor: 'rgba(255,255,255,0.08)',
                          },
                          '&.Mui-selected:hover': {
                            bgcolor: 'rgba(255,255,255,0.12)',
                          },
                          '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.05)',
                          },
                        }}
                      >
                        <DotIcon active={childActive} />
                        <Typography sx={{ fontSize: 13.5, fontWeight: 500 }}>
                          {child.label}
                        </Typography>
                      </ListItemButton>
                    )
                  })}
                </List>
              </Collapse>
            </Box>
          )
        })}
      </List>
    </Paper>
  )
}

export { SIDEBAR_WIDTH }
