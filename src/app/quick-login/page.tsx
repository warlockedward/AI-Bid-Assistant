'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function QuickLoginPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const router = useRouter();

  const testDirectAuth = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'demo@example.com',
          password: 'demo123',
          domain: 'demo'
        })
      });
      
      const data = await response.json();
      setResult({ type: 'direct', success: response.ok, data });
    } catch (error: any) {
      setResult({ type: 'direct', success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testNextAuthLogin = async () => {
    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email: 'demo@example.com',
        password: 'demo123',
        domain: 'demo',
        redirect: false
      });
      
      if (result?.ok) {
        router.push('/dashboard');
      } else {
        setResult({ type: 'nextauth', success: false, result });
      }
    } catch (error: any) {
      setResult({ type: 'nextauth', success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">快速登录测试</h1>
        
        <div className="space-y-4 mb-6">
          <Button onClick={testDirectAuth} disabled={loading} className="w-full">
            {loading ? '测试中...' : '测试直接认证API'}
          </Button>
          
          <Button onClick={testNextAuthLogin} disabled={loading} className="w-full">
            {loading ? '登录中...' : '使用NextAuth登录'}
          </Button>
        </div>

        {result && (
          <div className="bg-white p-4 rounded border">
            <h3 className="font-semibold mb-2">测试结果:</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded">
          <h3 className="font-semibold mb-2">演示账户信息:</h3>
          <p>邮箱: demo@example.com</p>
          <p>密码: demo123</p>
          <p>域名: demo</p>
        </div>
      </div>
    </div>
  );
}