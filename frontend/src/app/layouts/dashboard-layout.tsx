import { Box } from '@mui/material'
import { Outlet } from 'react-router-dom'
import { Sidebar, SIDEBAR_WIDTH } from '@/shared/ui/sidebar/Sidebar'
import { Topbar } from '@/shared/ui/topbar/Topbar'

export function DashboardLayout() {
  return (
    <Box
      sx={{
        minHeight: '100svh',
        display: 'grid',
        gridTemplateColumns: `${SIDEBAR_WIDTH}px minmax(0, 1fr)`,
        '@media (max-width: 960px)': {
          gridTemplateColumns: '1fr',
        },
      }}
    >
      <Sidebar />

      <Box sx={{ minWidth: 0 }}>
        <Topbar />

        <Box className="content-shell">
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
