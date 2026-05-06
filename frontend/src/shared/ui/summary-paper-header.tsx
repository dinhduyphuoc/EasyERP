import type { ReactElement } from 'react'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { IconButton, Stack, Typography } from '@mui/material'

type SummaryPaperHeaderProps = {
  title: string
  onEdit?: () => void
}

export function SummaryPaperHeader({ title, onEdit }: SummaryPaperHeaderProps): ReactElement {
  return (
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <Typography variant="h6" sx={{ fontWeight: 600, color: '#0f172a' }}>
        {title}
      </Typography>
      {onEdit ? (
        <IconButton size="small" onClick={onEdit} sx={{ color: '#98a2b3' }}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      ) : null}
    </Stack>
  )
}
