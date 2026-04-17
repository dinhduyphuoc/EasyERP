import type { PropsWithChildren } from 'react'
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material'
import { theme } from '@/app/theme'

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
    </ThemeProvider>
  )
}
