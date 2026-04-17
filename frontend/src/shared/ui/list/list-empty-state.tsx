import type { ReactNode } from 'react'
import { Box, Button, Stack, Typography, alpha } from '@mui/material'

type ListEmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
  illustration?: ReactNode
}

export function ListEmptyState({
  title,
  description = 'Chưa có dữ liệu để hiển thị trong danh sách này.',
  action,
  illustration,
}: ListEmptyStateProps) {
  return (
    <Stack
      spacing={2}
      sx={{
        py: 8,
        px: 3,
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: 4,
          display: 'grid',
          placeItems: 'center',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
          color: 'primary.main',
        }}
      >
        {illustration ?? <Button variant="text" disableRipple sx={{ pointerEvents: 'none' }}>0</Button>}
      </Box>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 440 }}>
          {description}
        </Typography>
      </Box>
      {action}
    </Stack>
  )
}

