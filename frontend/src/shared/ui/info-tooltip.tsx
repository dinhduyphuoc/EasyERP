import type { ReactElement, ReactNode } from 'react'
import { Box, Tooltip } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'

type InfoTooltipProps = {
  title: ReactNode
  ariaLabel?: string
  children?: ReactNode
  sx?: SxProps<Theme>
}

export function InfoTooltip({
  title,
  ariaLabel = 'Thông tin bổ sung',
  children = '?',
  sx,
}: InfoTooltipProps): ReactElement {
  return (
    <Tooltip
      title={title}
      arrow
      slotProps={{
        tooltip: {
          sx: {
            textAlign: 'center',
          },
        },
      }}
    >
      <Box
        component="span"
        aria-label={ariaLabel}
        sx={[
          {
            width: 16,
            height: 16,
            p: 0,
            borderRadius: '50%',
            boxSizing: 'border-box',
            backgroundColor: '#555',
            color: '#fff',
            fontSize: 8,
            fontWeight: 600,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'help',
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
      >
        {children}
      </Box>
    </Tooltip>
  )
}
