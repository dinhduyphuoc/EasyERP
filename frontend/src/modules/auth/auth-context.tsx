import {
  createContext,
  startTransition,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react'
import { authApi } from '@/modules/auth/auth.api'
import {
  ACCESS_TOKEN_KEY,
  AUTH_EXPIRED_EVENT,
  AUTH_USER_STORAGE_KEY,
  clearStoredAuthSession,
} from '@/modules/auth/auth-session'
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

export const AuthContext = createContext<AuthContextValue | null>(null)

const getStoredToken = () => localStorage.getItem(ACCESS_TOKEN_KEY)
const getStoredUser = (): AuthUser | null => {
  const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY)
    return null
  }
}

const persistToken = (token: string | null) => {
  if (!token) {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    return
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

const persistUser = (user: AuthUser | null) => {
  if (!user) {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY)
    return
  }

  localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user))
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>(() => (getStoredToken() ? 'loading' : 'anonymous'))
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser())
  const [accessToken, setAccessToken] = useState<string | null>(() => getStoredToken())

  const refreshUser = async () => {
    const token = getStoredToken()

    if (!token) {
      setAccessToken(null)
      setUser(null)
      persistUser(null)
      setStatus('anonymous')
      return null
    }

    const currentUser = await authApi.me()
    setAccessToken(token)
    setUser(currentUser)
    persistUser(currentUser)
    setStatus('authenticated')
    return currentUser
  }

  useEffect(() => {
    const token = getStoredToken()

    if (!token) {
      persistUser(null)
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
          persistUser(currentUser)
          setStatus('authenticated')
        })
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        persistToken(null)
        persistUser(null)
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

  useEffect(() => {
    const handleAuthExpired = () => {
      clearStoredAuthSession()
      setAccessToken(null)
      setUser(null)
      setStatus('anonymous')
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)

    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)
    }
  }, [])

  const login = async (payload: { email: string; password: string }) => {
    const result = await authApi.login(payload)
    persistToken(result.access_token)
    persistUser(result.user)
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
      persistUser(null)
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
