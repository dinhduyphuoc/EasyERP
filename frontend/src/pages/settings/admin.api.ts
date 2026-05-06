import { apiClient } from '@/api/api-client'

type UserStatus = 'active' | 'inactive' | 'blocked'

export type AdminUserItem = {
  id: string
  tenant_id: string | null
  full_name: string
  email: string
  status: UserStatus
  is_email_verified: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
  roles: Array<{
    slug: string
    name: string
  }>
  scopes: Array<{
    scope_type: string
    scope_value: string
  }>
}

export type RoleItem = {
  id: string
  slug: string
  name: string
  description: string | null
  is_system: boolean
  permissions: Array<{
    code: string
    description: string | null
  }>
}

export type PermissionItem = {
  id: string
  code: string
  description: string | null
  created_at: string
}

export type CreateAdminUserPayload = {
  full_name: string
  email: string
  password: string
  role_slugs: string[]
  tenant_id?: string | null
}

export const adminApi = {
  getUsers: async (): Promise<{ items: AdminUserItem[] }> => {
    return apiClient.get('/admin/users')
  },

  createUser: async (payload: CreateAdminUserPayload): Promise<AdminUserItem> => {
    return apiClient.post('/admin/users', payload)
  },

  assignRoles: async (userId: string, roleSlugs: string[]): Promise<AdminUserItem> => {
    return apiClient.put(`/admin/users/${userId}/roles`, { role_slugs: roleSlugs })
  },

  updateStatus: async (userId: string, status: UserStatus): Promise<AdminUserItem> => {
    return apiClient.patch(`/admin/users/${userId}/status`, { status })
  },

  getRoles: async (): Promise<{ items: RoleItem[] }> => {
    return apiClient.get('/rbac/roles')
  },

  createRole: async (payload: {
    slug: string
    name: string
    description?: string | null
    permission_codes: string[]
  }): Promise<RoleItem> => {
    return apiClient.post('/rbac/roles', payload)
  },

  updateRole: async (
    roleId: string,
    payload: {
      name: string
      description?: string | null
      permission_codes: string[]
    },
  ): Promise<RoleItem> => {
    return apiClient.put(`/rbac/roles/${roleId}`, payload)
  },

  deleteRole: async (roleId: string): Promise<{ deleted: boolean; id: string }> => {
    return apiClient.delete(`/rbac/roles/${roleId}`)
  },

  getPermissions: async (): Promise<{ items: PermissionItem[] }> => {
    return apiClient.get('/rbac/permissions')
  },
}
