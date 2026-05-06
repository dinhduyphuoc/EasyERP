export const ACCESS_TOKEN_KEY = 'access_token'
export const AUTH_USER_STORAGE_KEY = 'auth_user_snapshot'
export const AUTH_EXPIRED_EVENT = 'app:auth-expired'

export const clearStoredAuthSession = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_STORAGE_KEY)
}
