import type { ReactNode } from 'react'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Box, Paper, Stack, Typography } from '@mui/material'

type CreateEditPageHeaderProps = {
  title: string
  subtitle?: string
  onBack: () => void
  actions?: ReactNode
}

export function CreateEditPageHeader({
  title,
  subtitle,
  onBack,
  actions,
}: CreateEditPageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', cursor: 'pointer' }} onClick={onBack}>
        <Paper
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 1,
          }}
        >
          <ArrowBackIcon sx={{ color: '#344054' }} />
        </Paper>

        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#101828' }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography sx={{ color: '#667085', mt: 0.5 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
      </Stack>

      {actions}
    </Stack>
  )
}
