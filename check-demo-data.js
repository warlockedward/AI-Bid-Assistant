const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkAndCreateDemoData() {
  try {
    console.log('Checking demo data...');
    
    // Check if demo tenant exists
    let demoTenant = await prisma.tenant.findUnique({
      where: { domain: 'demo' }
    });
    
    if (!demoTenant) {
      console.log('Creating demo tenant...');
      demoTenant = await prisma.tenant.create({
        data: {
          name: '演示公司',
          domain: 'demo',
          isActive: true,
          settings: {}
        }
      });
      console.log('Demo tenant created:', demoTenant.name);
    } else {
      console.log('Demo tenant already exists:', demoTenant.name);
    }
    
    // Check if demo user exists
    let demoUser = await prisma.user.findUnique({
      where: { email: 'demo@example.com' }
    });
    
    if (!demoUser) {
      console.log('Creating demo user...');
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
      console.log('Demo user created:', demoUser.name);
    } else {
      console.log('Demo user already exists:', demoUser.name);
    }
    
    console.log('Demo data check complete!');
    console.log('Demo account info:');
    console.log('- Email: demo@example.com');
    console.log('- Password: demo123');
    console.log('- Domain: demo');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndCreateDemoData();