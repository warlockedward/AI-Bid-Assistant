/**
 * Authentication and authorization type definitions
 */

export interface AuthSession {
  user: SessionUser;
  tenant: SessionTenant;
  expires: string;
  accessToken: string;
  refreshToken?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: import('./tenant').UserRole;
  permissions: string[];
  preferences: import('./tenant').UserPreferences;
}

export interface SessionTenant {
  id: string;
  name: string;
  domain: string;
  features: import('./tenant').TenantFeatures;
  branding: import('./tenant').TenantBranding;
}

export interface SSOProvider {
  id: string;
  name: string;
  type: SSOProviderType;
  config: SSOProviderConfig;
  is_active: boolean;
  tenant_id?: string; // null for system-wide providers
}

export interface SSOProviderConfig {
  client_id: string;
  client_secret: string;
  issuer_url: string;
  redirect_uri: string;
  scopes: string[];
  additional_params?: Record<string, string>;
}

export interface AuthenticationRequest {
  provider: string;
  tenant_domain?: string;
  redirect_url?: string;
}

export interface AuthenticationResponse {
  success: boolean;
  user?: SessionUser;
  tenant?: SessionTenant;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: AuthError;
}

export interface AuthError {
  code: AuthErrorCode;
  message: string;
  details?: Record<string, any>;
}

export interface TokenClaims {
  sub: string; // user_id
  email: string;
  name: string;
  tenant_id: string;
  role: import('./tenant').UserRole;
  permissions: string[];
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sso_provider: string;
  sso_id: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
  tenant_id: string;
}

export interface TenantSelection {
  available_tenants: TenantOption[];
  current_tenant?: string;
}

export interface TenantOption {
  id: string;
  name: string;
  domain: string;
  role: import('./tenant').UserRole;
  permissions: string[];
}

export interface PasswordResetRequest {
  email: string;
  tenant_domain?: string;
}

export interface PasswordResetConfirm {
  token: string;
  new_password: string;
}

export interface InvitationAcceptance {
  invitation_token: string;
  user_info: {
    name: string;
    password?: string; // Only for non-SSO users
  };
}

export enum SSOProviderType {
  OAUTH2 = 'oauth2',
  SAML = 'saml',
  OIDC = 'oidc'
}

export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'invalid_credentials',
  USER_NOT_FOUND = 'user_not_found',
  TENANT_NOT_FOUND = 'tenant_not_found',
  TENANT_SUSPENDED = 'tenant_suspended',
  INSUFFICIENT_PERMISSIONS = 'insufficient_permissions',
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_INVALID = 'token_invalid',
  SSO_ERROR = 'sso_error',
  MULTI_TENANT_SELECTION_REQUIRED = 'multi_tenant_selection_required',
  INVITATION_EXPIRED = 'invitation_expired',
  INVITATION_INVALID = 'invitation_invalid'
}

// NextAuth.js specific types
export interface NextAuthOptions {
  providers: any[];
  callbacks: {
    jwt: (params: any) => Promise<any>;
    session: (params: any) => Promise<any>;
    signIn: (params: any) => Promise<boolean>;
  };
  pages: {
    signIn: string;
    error: string;
  };
  session: {
    strategy: 'jwt';
    maxAge: number;
  };
}

export interface JWTCallback {
  token: any;
  user?: any;
  account?: any;
  profile?: any;
  isNewUser?: boolean;
}

export interface SessionCallback {
  session: any;
  token: any;
  user?: any;
}