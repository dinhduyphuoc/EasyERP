import { apiClient } from '@/api/api-client'
import type { AuthUser, LoginResponse } from '@/modules/auth/auth.types'

export const authApi = {
  login(payload: { email: string; password: string }) {
    return apiClient.post<never, LoginResponse>('/auth/login', payload)
  },

  me() {
    return apiClient.get<never, AuthUser>('/auth/me')
  },

  logout() {
    return apiClient.post('/auth/logout')
  },
}
