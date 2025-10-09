'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestAuthPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testDemoLogin = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const result = await signIn('credentials', {
        email: 'demo@example.com',
        password: 'demo123',
        domain: 'demo',
        redirect: false
      });
      
      setResult({
        success: !result?.error,
        error: result?.error,
        status: result?.status,
        ok: result?.ok,
        url: result?.url
      });
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message,
        caught: true
      });
    } finally {
      setLoading(false);
    }
  };

  const testBcrypt = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/test-bcrypt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: 'demo123'
        }),
      });
      
      const data = await response.json();
      
      setResult({
        success: response.ok,
        status: response.status,
        data: data
      });
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message,
        caught: true
      });
    } finally {
      setLoading(false);
    }
  };

  const testRegistration = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'test123',
          name: 'Test User',
          companyName: 'Test Company'
        }),
      });
      
      const data = await response.json();
      
      setResult({
        success: response.ok,
        status: response.status,
        data: data
      });
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message,
        caught: true
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>认证功能测试</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={testDemoLogin} 
                disabled={loading}
                variant="default"
              >
                {loading ? '测试中...' : '测试演示账户登录'}
              </Button>
              
              <Button 
                onClick={testBcrypt} 
                disabled={loading}
                variant="secondary"
              >
                {loading ? '测试中...' : '测试密码验证'}
              </Button>
              
              <Button 
                onClick={testRegistration} 
                disabled={loading}
                variant="outline"
              >
                {loading ? '测试中...' : '测试注册功能'}
              </Button>
            </div>
            
            {result && (
              <div className="mt-6">
                <h3 className="font-semibold mb-2">测试结果:</h3>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>演示账户信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>邮箱:</strong> demo@example.com</p>
              <p><strong>密码:</strong> demo123</p>
              <p><strong>域名:</strong> demo</p>
              <p><strong>角色:</strong> ADMIN</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}