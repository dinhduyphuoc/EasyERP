export type AuthUser = {
  id: string
  tenant_id: string | null
  active_store_id: string | null
  full_name: string
  email: string
  avatar_url: string | null
  status: string
  last_login_at: string | null
  roles: string[]
  permissions: string[]
  scopes: Array<{
    scope_type: string
    scope_value: string
  }>
  stores: Array<{
    id: string
    name: string
    slug: string
    role: string
    default_currency: string
    default_timezone: string
    is_active: boolean
  }>
}

export type LoginResponse = {
  access_token: string
  token_type: string
  expires_at: string
  session_id: string
  user: AuthUser
}
