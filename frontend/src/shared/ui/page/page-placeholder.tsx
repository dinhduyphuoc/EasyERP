import ConstructionRoundedIcon from '@mui/icons-material/ConstructionRounded'
import { Stack, Typography } from '@mui/material'

type PagePlaceholderProps = {
  title: string
  path: string
  description?: string
}

export function PagePlaceholder({
  title: _title,
  path: _path,
  description: _description,
}: PagePlaceholderProps) {
  return (
    <Stack
      spacing={2}
      sx={{
        minHeight: 'calc(100vh - 220px)',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <ConstructionRoundedIcon sx={{ fontSize: 72, color: '#F79009' }} />
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        Tính năng đang phát triển
      </Typography>
    </Stack>
  )
}
