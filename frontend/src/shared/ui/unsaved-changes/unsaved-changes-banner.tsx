import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import type { ReactElement } from 'react'

type UnsavedChangesBannerProps = {
  visible: boolean
  shakeTick?: number
  isSaving?: boolean
  message?: string
  placement?: 'sticky' | 'fixed'
  onDiscard: () => void
  onSave: () => void
  discardLabel?: string
  saveLabel?: string
  savingLabel?: string
}

export function UnsavedChangesBanner({
  visible,
  shakeTick = 0,
  isSaving = false,
  message = 'Bạn có thay đổi chưa lưu.',
  placement = 'sticky',
  onDiscard,
  onSave,
  discardLabel = 'Hủy',
  saveLabel = 'Lưu',
  savingLabel = 'Đang lưu...',
}: UnsavedChangesBannerProps): ReactElement | null {
  if (!visible) {
    return null
  }

  return (
    <Box
      sx={{
        position: placement,
        bottom: 20,
        left: placement === 'fixed' ? 0 : 'auto',
        right: placement === 'fixed' ? 0 : 'auto',
        zIndex: (theme) => theme.zIndex.modal + 2,
        display: 'flex',
        justifyContent: 'center',
        px: { xs: 0.5, md: 0 },
        pointerEvents: 'none',
        '@keyframes sharedUnsavedShake': {
          '0%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-8px)' },
          '40%': { transform: 'translateX(8px)' },
          '60%': { transform: 'translateX(-6px)' },
          '80%': { transform: 'translateX(6px)' },
          '100%': { transform: 'translateX(0)' },
        },
      }}
    >
      <Paper
        elevation={8}
        key={shakeTick}
        sx={{
          width: { xs: '100%', sm: 'auto' },
          position: 'relative',
          zIndex: (theme) => theme.zIndex.modal + 2,
          pointerEvents: 'auto',
          borderRadius: 1,
          border: '1px solid #d0d5dd',
          bgcolor: '#ffffff',
          color: '#101828',
          px: 1.5,
          py: 1.25,
          animation: shakeTick > 0 ? 'sharedUnsavedShake 420ms ease' : 'none',
          '@keyframes sharedUnsavedMoveIn': {
            '0%': { transform: 'translateY(20px)', opacity: 0 },
            '100%': { transform: 'translateY(0)', opacity: 1 },
          },
          animationFillMode: 'forwards',
          animationDuration: '300ms',
          animationTimingFunction: 'ease',
          animationName: shakeTick > 0 ? 'sharedUnsavedShake' : 'sharedUnsavedMoveIn',
        }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
            <InfoOutlinedIcon fontSize="small" />
            <Typography noWrap sx={{ fontWeight: 600, minWidth: 0, flex: 1 }}>
              {message}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
            <Button variant="text" onClick={onDiscard} disabled={isSaving} sx={{ color: '#344054' }}>
              {discardLabel}
            </Button>
            <Button variant="contained" onClick={onSave} disabled={isSaving}>
              {isSaving ? savingLabel : saveLabel}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  )
}
