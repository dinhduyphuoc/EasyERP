import {
  createContext,
  startTransition,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react'
import { authApi } from '@/modules/auth/auth.api'
import type { AuthUser } from '@/modules/auth/auth.types'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

type AuthContextValue = {
  status: AuthStatus
  user: AuthUser | null
  accessToken: string | null
  login: (payload: { email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<AuthUser | null>
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
}

const ACCESS_TOKEN_KEY = 'access_token'

export const AuthContext = createContext<AuthContextValue | null>(null)

const getStoredToken = () => localStorage.getItem(ACCESS_TOKEN_KEY)

const persistToken = (token: string | null) => {
  if (!token) {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    return
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(() => getStoredToken())

  const refreshUser = async () => {
    const token = getStoredToken()

    if (!token) {
      setAccessToken(null)
      setUser(null)
      setStatus('anonymous')
      return null
    }

    const currentUser = await authApi.me()
    setAccessToken(token)
    setUser(currentUser)
    setStatus('authenticated')
    return currentUser
  }

  useEffect(() => {
    const token = getStoredToken()

    if (!token) {
      setStatus('anonymous')
      return
    }

    let cancelled = false

    void authApi
      .me()
      .then((currentUser) => {
        if (cancelled) {
          return
        }

        startTransition(() => {
          setAccessToken(token)
          setUser(currentUser)
          setStatus('authenticated')
        })
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        persistToken(null)
        startTransition(() => {
          setAccessToken(null)
          setUser(null)
          setStatus('anonymous')
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = async (payload: { email: string; password: string }) => {
    const result = await authApi.login(payload)
    persistToken(result.access_token)
    setAccessToken(result.access_token)
    setUser(result.user)
    setStatus('authenticated')
  }

  const logout = async () => {
    try {
      if (accessToken) {
        await authApi.logout()
      }
    } finally {
      persistToken(null)
      setAccessToken(null)
      setUser(null)
      setStatus('anonymous')
    }
  }

  const hasPermission = (permission: string) => !!user?.permissions.includes(permission)

  const hasAnyPermission = (permissions: string[]) =>
    permissions.some((permission) => hasPermission(permission))

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        accessToken,
      login,
      logout,
      refreshUser,
      hasPermission,
      hasAnyPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
