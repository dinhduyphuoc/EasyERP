import type { SxProps, Theme } from '@mui/material/styles'

export const defaultCardSx: SxProps<Theme> = {
  p: { xs: 2, md: 2.5 },
}

export const borderedCardSx: SxProps<Theme> = {
  ...defaultCardSx,
  border: (theme) => `1px solid ${theme.palette.divider}`,
  boxShadow: '0 18px 45px rgba(15, 23, 42, 0.06)',
}
