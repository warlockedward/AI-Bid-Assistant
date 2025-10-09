/**
 * Tenant context implementation for TypeScript frontend
 * Matches the Python backend TenantContext structure
 */

export interface TenantContext {
  tenant_id: string;
  user_id: string;
  sso_provider?: string;
  sso_id?: string;
  preferences?: Record<string, any>;
  tenant_name?: string;
  user_email?: string;
  user_name?: string;
  permissions: string[];
  created_at: Date;
  updated_at: Date;
}

export class TenantContextManager {
  /**
   * Validate that the current context has access to a resource from the specified tenant
   */
  static validateTenantAccess(context: TenantContext, resourceTenantId: string): boolean {
    return context.tenant_id === resourceTenantId;
  }

  /**
   * Create a filter object for tenant-aware API queries
   */
  static createTenantFilter(context: TenantContext): Record<string, string> {
    return { tenant_id: context.tenant_id };
  }

  /**
   * Validate that a tenant context is properly formed
   */
  static validateContext(context: TenantContext): void {
    if (!context.tenant_id) {
      throw new Error('TenantContext must have a valid tenant_id');
    }
    
    if (!context.user_id) {
      throw new Error('TenantContext must have a valid user_id');
    }
    
    if (!context.user_email) {
      throw new Error('TenantContext must have a valid user_email');
    }
  }

  /**
   * Get a user preference value
   */
  static getPreference(context: TenantContext, key: string, defaultValue: any = null): any {
    if (!context.preferences) {
      return defaultValue;
    }
    return context.preferences[key] ?? defaultValue;
  }

  /**
   * Set a user preference value (returns new context)
   */
  static setPreference(context: TenantContext, key: string, value: any): TenantContext {
    return {
      ...context,
      preferences: {
        ...context.preferences,
        [key]: value
      },
      updated_at: new Date()
    };
  }

  /**
   * Merge user preferences with tenant defaults
   */
  static mergePreferences(
    userPreferences?: Record<string, any>,
    tenantDefaults?: Record<string, any>
  ): Record<string, any> {
    const merged = { ...tenantDefaults };
    
    if (userPreferences) {
      Object.assign(merged, userPreferences);
    }
    
    return merged;
  }

  /**
   * Create TenantContext from API response
   */
  static fromApiResponse(data: any): TenantContext {
    return {
      tenant_id: data.tenant_id,
      user_id: data.user_id,
      sso_provider: data.sso_provider,
      sso_id: data.sso_id,
      preferences: data.preferences || {},
      tenant_name: data.tenant_name,
      user_email: data.user_email,
      user_name: data.user_name,
      permissions: data.permissions || [],
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at)
    };
  }

  /**
   * Convert TenantContext to API request format
   */
  static toApiRequest(context: TenantContext): Record<string, any> {
    return {
      tenant_id: context.tenant_id,
      user_id: context.user_id,
      sso_provider: context.sso_provider,
      sso_id: context.sso_id,
      preferences: context.preferences,
      tenant_name: context.tenant_name,
      user_email: context.user_email,
      user_name: context.user_name,
      permissions: context.permissions
    };
  }
}