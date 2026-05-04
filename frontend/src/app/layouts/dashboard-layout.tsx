import { useEffect, useRef, useState } from 'react'
import { Box, Drawer, OutlinedInput, Paper, Stack, alpha } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { Outlet } from 'react-router'
import { CreateStoreModal } from '@/modules/store/create-store-modal'
import { ConnectedStoreSwitcherDropdown } from '@/modules/store/connected-store-switcher-dropdown'
import { useStore } from '@/modules/store/use-store'
import { AppSidebar } from '@/shared/ui/sidebar/app-sidebar'

const SIDEBAR_WIDTH = 304
const SIDEBAR_COLLAPSED_WIDTH = 88
const SIDEBAR_ANIMATION_MS = 200
const SIDEBAR_COLLAPSE_CONTENT_DELAY_MS = 60

export function DashboardLayout() {
  const { isReady, stores } = useStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showExpandedContent, setShowExpandedContent] = useState(true)
  const [isCreateStoreOpen, setIsCreateStoreOpen] = useState(false)
  const sidebarAnimationTimeoutRef = useRef<number | null>(null)
  const desktopSidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH

  useEffect(() => {
    if (isReady && stores.length === 0) {
      setIsCreateStoreOpen(true)
    }
  }, [isReady, stores.length])

  useEffect(() => {
    return () => {
      if (sidebarAnimationTimeoutRef.current !== null) {
        window.clearTimeout(sidebarAnimationTimeoutRef.current)
      }
    }
  }, [])

  const handleToggleSidebar = () => {
    if (sidebarAnimationTimeoutRef.current !== null) {
      window.clearTimeout(sidebarAnimationTimeoutRef.current)
      sidebarAnimationTimeoutRef.current = null
    }

    if (sidebarCollapsed) {
      setSidebarCollapsed(false)
      sidebarAnimationTimeoutRef.current = window.setTimeout(() => {
        setShowExpandedContent(true)
        sidebarAnimationTimeoutRef.current = null
      }, SIDEBAR_ANIMATION_MS)
      return
    }

    setShowExpandedContent(false)
    sidebarAnimationTimeoutRef.current = window.setTimeout(() => {
      setSidebarCollapsed(true)
      sidebarAnimationTimeoutRef.current = null
    }, SIDEBAR_COLLAPSE_CONTENT_DELAY_MS)
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(15, 118, 110, 0.10), transparent 24%), linear-gradient(180deg, #f4f8fb 0%, #edf3f7 100%)',
      }}
    >
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', lg: 'none' },
          '& .MuiDrawer-paper': {
            width: SIDEBAR_WIDTH,
            bgcolor: '#fcfcfd',
            color: '#101828',
            borderRight: '1px solid rgba(15, 23, 42, 0.08)',
            boxShadow: '16px 0 40px rgba(15, 23, 42, 0.08)',
          },
        }}
      >
        <AppSidebar
          collapsed={false}
          showExpandedContent
          onToggleCollapsed={() => undefined}
          onNavigate={() => setMobileOpen(false)}
        />
      </Drawer>

      <Box sx={{ display: 'flex' }}>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', lg: 'block' },
            width: desktopSidebarWidth,
            flexShrink: 0,
            transition: 'width 0.2s ease',
            '& .MuiDrawer-paper': {
              width: desktopSidebarWidth,
              bgcolor: '#fcfcfd',
              color: '#101828',
              borderRight: '1px solid rgba(15, 23, 42, 0.08)',
              boxShadow: '8px 0 28px rgba(15, 23, 42, 0.04)',
              transition: 'width 0.2s ease',
              overflowX: 'hidden',
            },
          }}
        >
          <AppSidebar
            collapsed={sidebarCollapsed}
            showExpandedContent={showExpandedContent}
            onToggleCollapsed={handleToggleSidebar}
          />
        </Drawer>

        <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box>
            <Paper
              sx={{
                mb: 3,
                px: { xs: 2, md: 3, xl: 4 },
                py: { xs: 1.5, lg: 2 },
                position: 'sticky',
                top: 0,
                zIndex: 1100,
                border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(244,248,251,0.92) 100%)',
                backdropFilter: 'blur(14px)',
              }}
            >
              <Stack
                direction="row"
                spacing={1.5}
                sx={{
                  display: { xs: 'flex', lg: 'none' },
                  alignItems: 'center',
                }}
              >
                <Box
                  onClick={() => setMobileOpen(true)}
                  sx={{
                    width: 40,
                    height: 40,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 2.5,
                    color: '#132238',
                    cursor: 'pointer',
                    bgcolor: 'transparent',
                  }}
                >
                  <MenuIcon fontSize="small" />
                </Box>
                <OutlinedInput
                  size="small"
                  placeholder="Tìm kiếm nhanh"
                  sx={{
                    flex: 1,
                    bgcolor: 'common.white',
                  }}
                />
                <ConnectedStoreSwitcherDropdown onCreateStore={() => setIsCreateStoreOpen(true)} />
              </Stack>

              <Stack
                direction={{ xs: 'column', lg: 'row' }}
                spacing={2}
                sx={{
                  display: { xs: 'none', lg: 'flex' },
                  alignItems: { xs: 'stretch', lg: 'center' },
                  justifyContent: 'space-between',
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  sx={{ alignItems: 'center' }}
                >
                  <OutlinedInput
                    size="small"
                    placeholder="Tìm kiếm nhanh"
                    sx={{
                      minWidth: { xs: '100%', sm: 240, md: 500 },
                      bgcolor: 'common.white',
                    }}
                  />
                </Stack>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
                  <ConnectedStoreSwitcherDropdown onCreateStore={() => setIsCreateStoreOpen(true)} />
                </Stack>
              </Stack>
            </Paper>

            <Box sx={{ mx: { md: 3, xl: 4 }, px: { md: 2, xl: 3 } }}>
              <Outlet />
            </Box>
          </Box>
        </Box>
      </Box>
      <CreateStoreModal open={isCreateStoreOpen} onClose={() => setIsCreateStoreOpen(false)} />
    </Box>
  )
}
