import axios from 'axios'
import {
  ACCESS_TOKEN_KEY,
  AUTH_EXPIRED_EVENT,
  clearStoredAuthSession,
} from '@/modules/auth/auth-session'
import { appToast, suppressAppToasts } from '@/shared/ui/toast/toast.helpers'

const apiBaseUrl = import.meta.env.VITE_API_URL?.trim() || 'http://localhost:3001'

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const ACTIVE_STORE_STORAGE_KEY = 'active_store_id'

let isHandlingAuthExpiration = false

const shouldHandleExpiredSession = (error: unknown) => {
  if (!axios.isAxiosError(error) || !error.response) {
    return false
  }

  if (error.response.status !== 401) {
    return false
  }

  const requestUrl = error.config?.url ?? ''
  if (requestUrl.includes('/auth/login')) {
    return false
  }

  return !!localStorage.getItem(ACCESS_TOKEN_KEY)
}

const handleExpiredSession = () => {
  if (isHandlingAuthExpiration) {
    return
  }

  isHandlingAuthExpiration = true
  suppressAppToasts(2000)
  clearStoredAuthSession()
  localStorage.removeItem(ACTIVE_STORE_STORAGE_KEY)
  appToast.sessionExpired('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))

  window.setTimeout(() => {
    isHandlingAuthExpiration = false
  }, 2000)
}

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }

    const activeStoreId = localStorage.getItem(ACTIVE_STORE_STORAGE_KEY)
    if (activeStoreId && config.headers) {
      config.headers['X-Store-Id'] = activeStoreId
    }

    return config
  },
  (error) => Promise.reject(error),
)

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (shouldHandleExpiredSession(error)) {
      handleExpiredSession()
    } else if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 401) {
        console.error('Unauthorized request.')
      }
    } else {
      console.error('Không thể kết nối đến máy chủ.')
    }

    return Promise.reject(error)
  },
)
