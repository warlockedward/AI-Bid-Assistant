import { PrismaClient } from '@prisma/client';

// 全局Prisma客户端实例，避免在开发环境中创建多个实例
declare global {
  var prisma: PrismaClient | undefined;
}

// 创建Prisma客户端实例
export const prisma = globalThis.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// 租户隔离中间件
export function withTenantIsolation(tenantId: string) {
  // 验证租户ID
  if (!tenantId) {
    throw new Error('租户ID不能为空');
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          try {
            // 为查询操作添加租户过滤
            if (['findFirst', 'findMany', 'findUnique', 'update', 'updateMany', 'delete', 'deleteMany', 'count'].includes(operation)) {
              if ('where' in args) {
                if (args.where) {
                  args.where = { ...args.where, tenantId };
                } else {
                  args.where = { tenantId };
                }
              }
            }
            
            // 为创建操作添加租户ID
            if (operation === 'create' && 'data' in args && args.data) {
              (args.data as any).tenantId = tenantId;
            }
            
            if (operation === 'createMany' && args.data) {
              args.data = (args.data as any[]).map((item: any) => ({ ...item, tenantId }));
            }
            
            return await query(args);
          } catch (error) {
            console.error(`数据库操作失败 - 模型: ${model}, 操作: ${operation}`, error);
            throw error;
          }
        },
      },
    },
  });
}