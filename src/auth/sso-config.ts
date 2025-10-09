/**
 * SSO configuration for multiple identity providers
 * Supports Auth0, Azure AD, Okta, and other OIDC providers
 */

export interface SSOProvider {
  id: string;
  name: string;
  type: 'auth0' | 'azure-ad' | 'okta' | 'oidc' | 'saml';
  enabled: boolean;
  config: Record<string, any>;
  tenantMapping?: {
    tenantIdClaim: string;
    userIdClaim: string;
    emailClaim: string;
    nameClaim: string;
    rolesClaim?: string;
  };
}

export interface SSOConfiguration {
  providers: SSOProvider[];
  defaultProvider?: string;
  allowMultipleProviders: boolean;
  sessionTimeout: number;
  refreshTokenRotation: boolean;
}

export class SSOConfigManager {
  private static instance: SSOConfigManager;
  private config: SSOConfiguration;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  static getInstance(): SSOConfigManager {
    if (!SSOConfigManager.instance) {
      SSOConfigManager.instance = new SSOConfigManager();
    }
    return SSOConfigManager.instance;
  }

  private loadConfiguration(): SSOConfiguration {
    return {
      providers: [
        {
          id: 'auth0',
          name: 'Auth0',
          type: 'auth0',
          enabled: !!process.env.AUTH0_CLIENT_ID,
          config: {
            clientId: process.env.AUTH0_CLIENT_ID,
            clientSecret: process.env.AUTH0_CLIENT_SECRET,
            domain: process.env.AUTH0_DOMAIN,
            audience: process.env.AUTH0_AUDIENCE,
            scope: 'openid profile email'
          },
          tenantMapping: {
            tenantIdClaim: 'https://app.example.com/tenant_id',
            userIdClaim: 'sub',
            emailClaim: 'email',
            nameClaim: 'name',
            rolesClaim: 'https://app.example.com/roles'
          }
        },
        {
          id: 'azure-ad',
          name: 'Azure Active Directory',
          type: 'azure-ad',
          enabled: !!process.env.AZURE_AD_CLIENT_ID,
          config: {
            clientId: process.env.AZURE_AD_CLIENT_ID,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
            tenantId: process.env.AZURE_AD_TENANT_ID,
            scope: 'openid profile email'
          },
          tenantMapping: {
            tenantIdClaim: 'tid',
            userIdClaim: 'oid',
            emailClaim: 'email',
            nameClaim: 'name',
            rolesClaim: 'roles'
          }
        },
        {
          id: 'okta',
          name: 'Okta',
          type: 'okta',
          enabled: !!process.env.OKTA_CLIENT_ID,
          config: {
            clientId: process.env.OKTA_CLIENT_ID,
            clientSecret: process.env.OKTA_CLIENT_SECRET,
            domain: process.env.OKTA_DOMAIN,
            scope: 'openid profile email'
          },
          tenantMapping: {
            tenantIdClaim: 'tenant_id',
            userIdClaim: 'sub',
            emailClaim: 'email',
            nameClaim: 'name',
            rolesClaim: 'groups'
          }
        }
      ],
      defaultProvider: process.env.DEFAULT_SSO_PROVIDER || 'auth0',
      allowMultipleProviders: process.env.ALLOW_MULTIPLE_SSO_PROVIDERS === 'true',
      sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600', 10),
      refreshTokenRotation: process.env.REFRESH_TOKEN_ROTATION !== 'false'
    };
  }

  getConfiguration(): SSOConfiguration {
    return this.config;
  }

  getEnabledProviders(): SSOProvider[] {
    return this.config.providers.filter(provider => provider.enabled);
  }

  getProvider(providerId: string): SSOProvider | undefined {
    return this.config.providers.find(provider => provider.id === providerId);
  }

  getDefaultProvider(): SSOProvider | undefined {
    const defaultId = this.config.defaultProvider;
    if (defaultId) {
      return this.getProvider(defaultId);
    }
    
    // Return first enabled provider if no default is set
    return this.getEnabledProviders()[0];
  }

  /**
   * Generate NextAuth.js provider configuration
   */
  getNextAuthProviders(): any[] {
    const providers = [];

    for (const provider of this.getEnabledProviders()) {
      switch (provider.type) {
        case 'auth0':
          providers.push({
            id: provider.id,
            name: provider.name,
            type: 'oauth',
            version: '2.0',
            authorization: {
              url: `https://${provider.config.domain}/authorize`,
              params: {
                scope: provider.config.scope,
                audience: provider.config.audience
              }
            },
            token: `https://${provider.config.domain}/oauth/token`,
            userinfo: `https://${provider.config.domain}/userinfo`,
            clientId: provider.config.clientId,
            clientSecret: provider.config.clientSecret,
            profile: (profile: any) => this.mapProfile(profile, provider)
          });
          break;

        case 'azure-ad':
          providers.push({
            id: provider.id,
            name: provider.name,
            type: 'oauth',
            version: '2.0',
            authorization: {
              url: `https://login.microsoftonline.com/${provider.config.tenantId}/oauth2/v2.0/authorize`,
              params: {
                scope: provider.config.scope
              }
            },
            token: `https://login.microsoftonline.com/${provider.config.tenantId}/oauth2/v2.0/token`,
            userinfo: 'https://graph.microsoft.com/oidc/userinfo',
            clientId: provider.config.clientId,
            clientSecret: provider.config.clientSecret,
            profile: (profile: any) => this.mapProfile(profile, provider)
          });
          break;

        case 'okta':
          providers.push({
            id: provider.id,
            name: provider.name,
            type: 'oauth',
            version: '2.0',
            authorization: {
              url: `https://${provider.config.domain}/oauth2/default/v1/authorize`,
              params: {
                scope: provider.config.scope
              }
            },
            token: `https://${provider.config.domain}/oauth2/default/v1/token`,
            userinfo: `https://${provider.config.domain}/oauth2/default/v1/userinfo`,
            clientId: provider.config.clientId,
            clientSecret: provider.config.clientSecret,
            profile: (profile: any) => this.mapProfile(profile, provider)
          });
          break;
      }
    }

    return providers;
  }

  /**
   * Map SSO profile to internal user format
   */
  private mapProfile(profile: any, provider: SSOProvider): any {
    const mapping = provider.tenantMapping;
    if (!mapping) {
      return profile;
    }

    return {
      id: this.getClaimValue(profile, mapping.userIdClaim),
      email: this.getClaimValue(profile, mapping.emailClaim),
      name: this.getClaimValue(profile, mapping.nameClaim),
      tenantId: this.getClaimValue(profile, mapping.tenantIdClaim),
      roles: mapping.rolesClaim ? this.getClaimValue(profile, mapping.rolesClaim) : [],
      ssoProvider: provider.id,
      ssoId: this.getClaimValue(profile, mapping.userIdClaim),
      image: profile.picture || profile.avatar_url,
      raw: profile
    };
  }

  /**
   * Extract claim value from profile using dot notation
   */
  private getClaimValue(profile: any, claimPath: string): any {
    const parts = claimPath.split('.');
    let value = profile;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Validate SSO configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.providers.length === 0) {
      errors.push('No SSO providers configured');
    }

    const enabledProviders = this.getEnabledProviders();
    if (enabledProviders.length === 0) {
      errors.push('No SSO providers are enabled');
    }

    for (const provider of enabledProviders) {
      const providerErrors = this.validateProvider(provider);
      errors.push(...providerErrors);
    }

    if (this.config.defaultProvider && !this.getProvider(this.config.defaultProvider)) {
      errors.push(`Default provider '${this.config.defaultProvider}' not found`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate individual provider configuration
   */
  private validateProvider(provider: SSOProvider): string[] {
    const errors: string[] = [];

    if (!provider.config.clientId) {
      errors.push(`Provider '${provider.id}' missing clientId`);
    }

    if (!provider.config.clientSecret) {
      errors.push(`Provider '${provider.id}' missing clientSecret`);
    }

    switch (provider.type) {
      case 'auth0':
        if (!provider.config.domain) {
          errors.push(`Auth0 provider '${provider.id}' missing domain`);
        }
        break;

      case 'azure-ad':
        if (!provider.config.tenantId) {
          errors.push(`Azure AD provider '${provider.id}' missing tenantId`);
        }
        break;

      case 'okta':
        if (!provider.config.domain) {
          errors.push(`Okta provider '${provider.id}' missing domain`);
        }
        break;
    }

    return errors;
  }
}

// Export singleton instance
export const ssoConfig = SSOConfigManager.getInstance();