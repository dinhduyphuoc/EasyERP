import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'

type ListPageHeaderProps = {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

export function ListPageHeader({ title, description, actions }: ListPageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', lg: 'row' }}
      spacing={2}
      sx={{ alignItems: { xs: 'stretch', lg: 'center' }, justifyContent: 'space-between' }}
    >
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>
        {description ? (
          <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 760 }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      {actions ? <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>{actions}</Stack> : null}
    </Stack>
  )
}

