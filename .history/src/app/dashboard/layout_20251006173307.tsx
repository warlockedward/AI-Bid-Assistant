import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import DashboardLayoutClient from '@/components/dashboard/DashboardLayoutClient';
import React from 'react';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin');
  }

  return (
    <DashboardLayoutClient 
      user={{
        name: session.user.name || '',
        email: session.user.email || '',
        tenant: { name: '智能投标平台' }
      }}
    >
      {children}
    </DashboardLayoutClient>
  );
}