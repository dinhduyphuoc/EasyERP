import { Box, Paper } from '@mui/material'

export function Topbar() {
  return (
    <Paper
      elevation={0}
      sx={{
        minHeight: 88,
        borderRadius: 4,
        border: '1px solid rgba(97, 77, 59, 0.12)',
        bgcolor: 'rgba(255, 251, 245, 0.72)',
        boxShadow: '0 22px 50px rgba(66, 37, 15, 0.12)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        px: 3.5,
      }}
    >
      <Box sx={{ width: '100%', minHeight: 24 }} />
    </Paper>
  )
}
