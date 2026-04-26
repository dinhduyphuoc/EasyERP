import type { PropsWithChildren } from 'react'
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material'
import { theme } from '@/app/theme'
import { AuthProvider } from '@/modules/auth/auth-context'
import { StoreProvider } from '@/modules/store/store-context'
import { GlobalToast } from '@/shared/ui/toast/toast'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <StoreProvider>
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
        </StoreProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
