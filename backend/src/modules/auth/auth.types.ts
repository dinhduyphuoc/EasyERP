export type AuthenticatedUser = {
  id: string;
  tenant_id: string | null;
  active_store_id: string | null;
  full_name: string;
  email: string;
  status: string;
  last_login_at: string | null;
  roles: string[];
  permissions: string[];
  scopes: Array<{
    scope_type: string;
    scope_value: string;
  }>;
  stores: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    default_currency: string;
    default_timezone: string;
    is_active: boolean;
  }>;
};

export type AuthSessionContext = {
  session_id: string;
  session_expires_at: string;
  user: AuthenticatedUser;
  permissions: string[];
};

export type LoginInput = {
  email: string;
  password: string;
  ip_address?: string | null;
  user_agent?: string | null;
  request_id?: string | null;
};

export type ForgotPasswordInput = {
  email: string;
  ip_address?: string | null;
  user_agent?: string | null;
  request_id?: string | null;
};

export type ResetPasswordInput = {
  token: string;
  new_password: string;
  ip_address?: string | null;
  user_agent?: string | null;
  request_id?: string | null;
};
