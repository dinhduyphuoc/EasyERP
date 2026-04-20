import type { PropsWithChildren } from 'react'
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material'
import { theme } from '@/app/theme'
import { GlobalToast } from '@/shared/ui/toast/toast'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          body: {
            minWidth: 320,
          },
          '#root': {
            minHeight: '100vh',
          },
        }}
      />
      {children}
      <GlobalToast />
    </ThemeProvider>
  )
}
