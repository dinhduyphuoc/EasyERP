import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  OutlinedInput,
  Stack,
  Typography,
  alpha,
} from '@mui/material'
import { Outlet, useLocation } from 'react-router'
import { useAuth } from '@/modules/auth/use-auth'
import { useStore } from '@/modules/store/use-store'
import { Breadcrumb } from '@/shared/ui/breadcrumb'
import { settingsItemsByPath, settingsSections } from './settings.config'
import { SettingsUnsavedProvider, useSettingsUnsavedActions } from './settings-unsaved-context'

const nestedBreadcrumbItems: Record<string, { parentPath: string; title: string }> = {
  '/settings/general/store-details': {
    parentPath: '/settings/general',
    title: 'Thông tin cửa hàng',
  },
  '/settings/general/payment-methods': {
    parentPath: '/settings/general',
    title: 'Phương thức thanh toán',
  },
}

const getInitials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'S'

const OVERLAY_ANIMATION_MS = 220

export function SettingsWorkspaceLayout(): ReactElement {
  return (
    <SettingsUnsavedProvider>
      <SettingsWorkspaceLayoutContent />
    </SettingsUnsavedProvider>
  )
}

function SettingsWorkspaceLayoutContent(): ReactElement {
  const location = useLocation()
  const { user, hasAnyPermission } = useAuth()
  const { activeStore } = useStore()
  const [search, setSearch] = useState('')
  const [isEntering, setIsEntering] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const closeTimeoutRef = useRef<number | null>(null)
  const activeItem =
    settingsItemsByPath[location.pathname] ??
    Object.values(settingsItemsByPath).find((item) => location.pathname.startsWith(`${item.path}/`))
  const breadcrumb = useMemo(() => {
    const nestedItem = nestedBreadcrumbItems[location.pathname]

    if (nestedItem) {
      const parentItem = settingsItemsByPath[nestedItem.parentPath]

      if (parentItem) {
        return {
          parent: parentItem,
          currentTitle: nestedItem.title,
        }
      }
    }

    if (activeItem) {
      return {
        parent: activeItem,
        currentTitle: null,
      }
    }

    return null
  }, [activeItem, location.pathname])
  const overlayFrom =
    location.state &&
    typeof location.state === 'object' &&
    'overlayFrom' in location.state &&
    typeof location.state.overlayFrom === 'string'
      ? location.state.overlayFrom
      : '/'
  const { attemptNavigate, pulse, isDirty } = useSettingsUnsavedActions()

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      setIsEntering(true)
    })

    return () => {
      window.cancelAnimationFrame(animationFrame)

      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  const handleClose = () => {
    if (isClosing) {
      return
    }

    if (isDirty) {
      pulse()
      return
    }

    setIsClosing(true)
    closeTimeoutRef.current = window.setTimeout(() => {
      attemptNavigate(overlayFrom)
    }, OVERLAY_ANIMATION_MS)
  }

  const visibleSections = useMemo(
    () =>
      settingsSections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              (!item.permissions || hasAnyPermission(item.permissions)) &&
              (!search.trim() ||
                item.title.toLowerCase().includes(search.trim().toLowerCase()) ||
                item.description.toLowerCase().includes(search.trim().toLowerCase())),
          ),
        }))
        .filter((section) => section.items.length > 0),
    [hasAnyPermission, search],
  )

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: (theme) => theme.zIndex.modal - 1,
        p: { xs: 0, md: 2 },
        bgcolor: isClosing
          ? 'rgba(15, 23, 42, 0)'
          : isEntering
            ? 'rgba(15, 23, 42, 0.24)'
            : 'rgba(15, 23, 42, 0)',
        backdropFilter: 'blur(10px)',
        transition: `background-color ${OVERLAY_ANIMATION_MS}ms ease`,
      }}
    >
      <Box
        sx={{
          height: '100%',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '320px minmax(0, 1fr)' },
          gap: 0,
          borderRadius: { xs: 0, md: 5 },
          overflow: 'hidden',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          boxShadow: '0 26px 60px rgba(15, 23, 42, 0.18)',
          bgcolor: '#f8fafc',
          opacity: isClosing ? 0 : isEntering ? 1 : 0,
          transform: isClosing
            ? 'translateY(8px) scale(0.985)'
            : isEntering
              ? 'translateY(0) scale(1)'
              : 'translateY(18px) scale(0.985)',
          transition: `opacity ${OVERLAY_ANIMATION_MS}ms ease, transform ${OVERLAY_ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
      >
        <Box
          sx={{
            bgcolor: '#ffffff',
            borderRight: { xs: 'none', lg: '1px solid rgba(15, 23, 42, 0.08)' },
            display: 'flex',
            flexDirection: 'column',
            minHeight: { xs: 'auto', lg: '100%' },
            position: { xs: 'relative', lg: 'sticky' },
            top: 0,
            opacity: isClosing ? 0 : isEntering ? 1 : 0,
            transform: isClosing
              ? 'translateX(-10px)'
              : isEntering
                ? 'translateX(0)'
                : 'translateX(-14px)',
            transition: `opacity ${OVERLAY_ANIMATION_MS}ms ease 40ms, transform ${OVERLAY_ANIMATION_MS}ms ease 40ms`,
          }}
        >
          <Box sx={{ px: 2.5, py: 2.5 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Avatar
                src={activeStore?.profile.avatar_url || undefined}
                variant="rounded"
                sx={{
                  width: 52,
                  height: 52,
                  bgcolor: '#0f766e',
                  fontWeight: 800,
                }}
              >
                {!activeStore?.profile.avatar_url ? getInitials(activeStore?.name ?? 'Store') : null}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800, color: '#0f172a' }} noWrap>
                  { activeStore?.name ?? 'Cài đặt cửa hàng'}
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Box sx={{ px: 2.5, pb: 2 }}>
            <OutlinedInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              size="small"
              fullWidth
              placeholder="Tìm trong cài đặt"
              startAdornment={
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" sx={{ color: '#98a2b3' }} />
                </InputAdornment>
              }
              sx={{
                borderRadius: 1,
              }}
            />
          </Box>

          <Divider />

          <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5 }}>
            {visibleSections.map((section) => (
              <Box key={section.id} sx={{ mb: 2 }}>
                <Typography
                  variant="caption"
                  sx={{
                    px: 1,
                    pb: 0.75,
                    display: 'block',
                    color: '#98a2b3',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                  }}
                >
                  {section.title}
                </Typography>
                <List disablePadding>
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const isActive =
                      location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)

                    return (
                      <ListItemButton
                        key={item.path}
                        onClick={() => attemptNavigate(item.path)}
                        sx={{
                          mb: 0.5,
                          borderRadius: 1,
                          gap: 1.25,
                          alignItems: 'flex-start',
                          bgcolor: isActive ? alpha('#0f766e', 0.10) : 'transparent',
                          color: isActive ? '#0f766e' : '#344054',
                          '&:hover': {
                            bgcolor: isActive ? alpha('#0f766e', 0.14) : alpha('#0f172a', 0.04),
                          },
                        }}
                      >
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 1,
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: isActive ? '#d1fae5' : '#f2f4f7',
                            color: isActive ? '#047857' : '#667085',
                            flexShrink: 0,
                          }}
                        >
                          <Icon fontSize="small" />
                        </Box>
                        <ListItemText
                          primary={item.title}
                          secondary={item.description}
                          slotProps={{
                            primary: {
                              sx: {
                                fontWeight: 700,
                                fontSize: 14,
                                mb: 0.25,
                              },
                            },
                            secondary: {
                              sx: {
                                fontSize: 12.5,
                                lineHeight: 1.5,
                                color: isActive ? alpha('#065f46', 0.88) : '#667085',
                              },
                            },
                          }}
                        />
                      </ListItemButton>
                    )
                  })}
                </List>
              </Box>
            ))}
          </Box>

          <Divider />

          <Stack direction="row" spacing={1.25} sx={{ px: 2.5, py: 2, alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: '#155eef', width: 42, height: 42 }}>
              {getInitials(user?.full_name ?? 'User')}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, color: '#101828' }} noWrap>
                {user?.full_name ?? 'Current user'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#667085' }} noWrap>
                {user?.email ?? 'user@example.com'}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Box
          sx={{
            minHeight: '100%',
            overflowY: 'auto',
            bgcolor: '#f8fafc',
            opacity: isClosing ? 0 : isEntering ? 1 : 0,
            transform: isClosing
              ? 'translateX(10px)'
              : isEntering
                ? 'translateX(0)'
                : 'translateX(16px)',
            transition: `opacity ${OVERLAY_ANIMATION_MS}ms ease 70ms, transform ${OVERLAY_ANIMATION_MS}ms ease 70ms`,
          }}
        >
          <Box
            sx={{
              px: { xs: 2, md: 4 },
              py: { xs: 2, md: 3 },
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 2,
            }}
          >
            <Box sx={{ maxWidth: 760, minWidth: 0 }}>
              <Breadcrumb
                parent={
                  breadcrumb
                    ? {
                        title: breadcrumb.parent.title,
                        icon: breadcrumb.parent.icon,
                        onClick: breadcrumb.currentTitle
                          ? () => attemptNavigate(breadcrumb.parent.path)
                          : undefined,
                      }
                    : null
                }
                currentTitle={breadcrumb?.currentTitle ?? null}
                fallbackTitle="Settings"
              />
            </Box>

            <IconButton
              onClick={handleClose}
              sx={{
                border: '1px solid rgba(15, 23, 42, 0.08)',
                bgcolor: '#ffffff',
                borderRadius: 1,
                flexShrink: 0,
              }}
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box sx={{ px: { xs: 2, md: 4 }, pb: 5 }}>
            <Outlet />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
