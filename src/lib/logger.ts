import { TenantContext } from '@/types/tenant';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface LogContext {
  tenantId?: string;
  userId?: string;
  workflowId?: string;
  agentId?: string;
  sessionId?: string;
  requestId?: string;
  component?: string;
  operation?: string;
  duration?: number;
  service?: string;
  environment?: string;
  status?: string;
  success?: boolean;
  checkpoint?: string;
  totalChecks?: number;
  failedChecks?: number;
  results?: Record<string, any>;
  intervalMs?: number;
  hasToken?: boolean;
  code?: number;
  reason?: string;
  stepId?: string;
  agentType?: string;
  metadata?: Record<string, any>;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

class Logger {
  private serviceName: string;
  private environment: string;

  constructor(serviceName: string = 'intelligent-bid-system') {
    this.serviceName = serviceName;
    this.environment = process.env.NODE_ENV || 'development';
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context: LogContext = {},
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...context,
        service: this.serviceName,
        environment: this.environment,
      }
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      };
    }

    return entry;
  }

  private output(entry: LogEntry): void {
    if (this.environment === 'development') {
      // Pretty print for development
      console.log(`[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`);
      if (Object.keys(entry.context).length > 0) {
        console.log('Context:', entry.context);
      }
      if (entry.error) {
        console.error('Error:', entry.error);
      }
    } else {
      // Structured JSON for production
      console.log(JSON.stringify(entry));
    }
  }

  debug(message: string, context?: LogContext): void {
    this.output(this.createLogEntry(LogLevel.DEBUG, message, context));
  }

  info(message: string, context?: LogContext): void {
    this.output(this.createLogEntry(LogLevel.INFO, message, context));
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.output(this.createLogEntry(LogLevel.WARN, message, context, error));
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.output(this.createLogEntry(LogLevel.ERROR, message, context, error));
  }

  critical(message: string, context?: LogContext, error?: Error): void {
    this.output(this.createLogEntry(LogLevel.CRITICAL, message, context, error));
  }

  // Convenience method for tenant-aware logging
  withTenant(tenantContext: TenantContext) {
    const baseContext: LogContext = {
      tenantId: tenantContext.tenant_id,
      userId: tenantContext.user_id
    };

    return {
      debug: (message: string, context?: LogContext) => 
        this.debug(message, { ...baseContext, ...context }),
      info: (message: string, context?: LogContext) => 
        this.info(message, { ...baseContext, ...context }),
      warn: (message: string, context?: LogContext, error?: Error) => 
        this.warn(message, { ...baseContext, ...context }, error),
      error: (message: string, context?: LogContext, error?: Error) => 
        this.error(message, { ...baseContext, ...context }, error),
      critical: (message: string, context?: LogContext, error?: Error) => 
        this.critical(message, { ...baseContext, ...context }, error)
    };
  }

  // Performance monitoring helper
  time<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now();
    const operationContext = { ...context, operation };

    this.debug(`Starting operation: ${operation}`, operationContext);

    return fn()
      .then(result => {
        const duration = Date.now() - startTime;
        this.info(`Operation completed: ${operation}`, {
          ...operationContext,
          duration,
          status: 'success'
        });
        return result;
      })
      .catch(error => {
        const duration = Date.now() - startTime;
        this.error(`Operation failed: ${operation}`, {
          ...operationContext,
          duration,
          status: 'error'
        }, error);
        throw error;
      });
  }
}

export const logger = new Logger();
export default logger;