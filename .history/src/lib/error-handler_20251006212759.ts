/**
 * 通用错误处理工具
 */

// 自定义错误基类
export class BaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 认证相关错误
export class AuthenticationError extends BaseError {
  constructor(message: string, code: string = 'AUTHENTICATION_ERROR') {
    super(message, code, 401);
  }
}

// 授权相关错误
export class AuthorizationError extends BaseError {
  constructor(message: string, code: string = 'AUTHORIZATION_ERROR') {
    super(message, code, 403);
  }
}

// 验证相关错误
export class ValidationError extends BaseError {
  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(message, code, 400);
  }
}

// 资源未找到错误
export class NotFoundError extends BaseError {
  constructor(message: string, code: string = 'NOT_FOUND') {
    super(message, code, 404);
  }
}

// 数据库相关错误
export class DatabaseError extends BaseError {
  constructor(message: string, code: string = 'DATABASE_ERROR') {
    super(message, code, 500);
  }
}

// 网络相关错误
export class NetworkError extends BaseError {
  constructor(message: string, code: string = 'NETWORK_ERROR') {
    super(message, code, 500);
  }
}

// 业务逻辑错误
export class BusinessError extends BaseError {
  constructor(message: string, code: string = 'BUSINESS_ERROR', statusCode: number = 400) {
    super(message, code, statusCode);
  }
}

// 统一API响应格式
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    message: string;
    code?: string;
    statusCode?: number;
    details?: Record<string, any>;
  };
  timestamp: string;
}

// 创建成功响应
export function createSuccessResponse<T>(
  data: T,
  message?: string
): APIResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

// 创建错误响应
export function createErrorResponse(
  error: Error | BaseError | string,
  statusCode?: number,
  code?: string
): APIResponse<null> {
  // 如果是字符串，创建通用错误
  if (typeof error === 'string') {
    return {
      success: false,
      error: {
        message: error,
        code: code || 'UNKNOWN_ERROR',
        statusCode: statusCode || 500,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // 如果是BaseError实例
  if (error instanceof BaseError) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // 其他错误类型
  return {
    success: false,
    error: {
      message: error.message,
      code: code || 'UNKNOWN_ERROR',
      statusCode: statusCode || 500,
    },
    timestamp: new Date().toISOString(),
  };
}

// 处理API路由错误
export function handleAPIError(error: unknown): APIResponse<null> {
  console.error('API Error:', error);

  if (error instanceof BaseError) {
    return createErrorResponse(error);
  }

  if (error instanceof Error) {
    // 处理常见的数据库错误
    if (error.message.includes('Unique constraint failed')) {
      return createErrorResponse(
        new DatabaseError('数据冲突，记录已存在', 'UNIQUE_CONSTRAINT_FAILED')
      );
    }

    if (error.message.includes('Foreign key constraint failed')) {
      return createErrorResponse(
        new DatabaseError('外键约束失败', 'FOREIGN_KEY_CONSTRAINT_FAILED')
      );
    }

    // 处理网络错误
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      return createErrorResponse(
        new NetworkError('网络连接失败', 'NETWORK_CONNECTION_FAILED')
      );
    }

    return createErrorResponse(error);
  }

  return createErrorResponse('未知错误', 500, 'UNKNOWN_ERROR');
}

// 日志记录工具
export function logError(error: Error, context?: string, metadata?: Record<string, any>) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    context,
    metadata,
  };

  console.error(JSON.stringify(logEntry, null, 2));
}

export default {
  BaseError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  DatabaseError,
  NetworkError,
  BusinessError,
  createSuccessResponse,
  createErrorResponse,
  handleAPIError,
  logError,
};