import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function initDemoData() {
  try {
    console.log('开始初始化演示数据...');
    
    // 检查是否已存在演示租户
    let demoTenant = await prisma.tenant.findUnique({
      where: { domain: 'demo' }
    });
    
    if (!demoTenant) {
      // 创建演示租户
      demoTenant = await prisma.tenant.create({
        data: {
          name: '演示公司',
          domain: 'demo',
          isActive: true,
          settings: {}
        }
      });
      
      console.log('创建演示租户:', demoTenant.name);
      
      // 创建租户配置
      await prisma.tenantConfig.create({
        data: {
          tenantId: demoTenant.id,
          ragApiUrl: process.env.DEMO_RAG_API_URL || 'https://api.example.com/rag',
          llmEndpoint: process.env.DEMO_LLM_ENDPOINT || 'https://api.example.com/llm',
          features: {
            aiAssistance: true,
            workflowAutomation: true,
            documentGeneration: true,
            complianceCheck: true
          },
          workflowSettings: {
            autoSave: true,
            checkpointInterval: 300,
            maxRetries: 3,
            timeoutMinutes: 60
          },
          uiCustomization: {
            theme: 'dark',
            primaryColor: '#1677ff',
            companyLogo: null
          },
          notificationSettings: {
            emailNotifications: true,
            workflowCompletion: true,
            errorAlerts: true,
            weeklyReports: false
          }
        }
      });
      
      console.log('创建租户配置');
    }
    
    // 检查是否已存在演示用户
    let demoUser = await prisma.user.findUnique({
      where: { email: 'demo@example.com' }
    });
    
    if (!demoUser) {
      // 创建演示用户
      const hashedPassword = await bcrypt.hash('demo123', 12);
      
      demoUser = await prisma.user.create({
        data: {
          email: 'demo@example.com',
          password: hashedPassword,
          name: '演示用户',
          tenantId: demoTenant.id,
          role: 'ADMIN',
          emailVerified: new Date(),
          isActive: true,
          lastLogin: new Date()
        }
      });
      
      console.log('创建演示用户:', demoUser.name);
    }
    
    console.log('演示数据初始化完成!');
    console.log('演示账户信息:');
    console.log('- 邮箱: demo@example.com');
    console.log('- 密码: demo123');
    console.log('- 域名: demo');
    
  } catch (error) {
    console.error('初始化演示数据时出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行初始化
initDemoData();