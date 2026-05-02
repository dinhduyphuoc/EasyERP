import { type ReactElement, type ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'

export function InfoField({
  label,
  value,
  variant = 'column',
  valueWeight = 500,
  labelMinWidth,
}: {
  label: string
  value: ReactNode
  variant?: 'column' | 'row'
  valueWeight?: number
  labelMinWidth?: number
}): ReactElement {
  const isRow = variant === 'row'

  return (
    <Stack
      direction={isRow ? 'row' : 'column'}
      spacing={isRow ? 1.5 : 0.5}
      sx={{
        justifyContent: isRow ? 'space-between' : undefined,
        alignItems: isRow ? 'flex-start' : undefined,
      }}
    >
      <Typography
        variant="body2"
        sx={{
          color: '#98a2b3',
          fontSize: 14,
          lineHeight: '20px',
          fontWeight: 400,
          wordBreak: 'break-word',
          minWidth: isRow ? labelMinWidth : undefined,
        }}
      >
        {label}
      </Typography>
      <Box
        component="div"
        sx={{
          color: '#101828',
          fontSize: 14,
          lineHeight: '20px',
          fontWeight: valueWeight,
          wordBreak: 'break-word',
          textAlign: isRow ? 'right' : 'left',
        }}
      >
        {value}
      </Box>
    </Stack>
  )
}
