'use client';

import { useState, useEffect } from 'react';
import { signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function SystemTestPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const router = useRouter();
  
  // Instead of using useSession which requires SessionProvider
  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      // Simple session check without using useSession
      const checkSession = async () => {
        try {
          const res = await fetch('/api/auth/session');
          if (res.ok) {
            const data = await res.json();
            setSession(data.session || null);
          }
        } catch (error) {
          console.error('Failed to check session:', error);
        }
      };
      
      checkSession();
    }
  }, []);

  const addResult = (test: string, success: boolean, data?: any) => {
    setResults(prev => [...prev, {
      test,
      success,
      data,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const clearResults = () => {
    setResults([]);
  };

  // 测试数据库连接
  const testDatabase = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      addResult('数据库连接', response.ok, data);
    } catch (error: any) {
      addResult('数据库连接', false, { error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // 测试注册功能
  const testRegistration = async () => {
    setLoading(true);
    try {
      const testEmail = `test${Date.now()}@example.com`;
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'test123456',
          name: 'Test User',
          companyName: 'Test Company'
        })
      });
      const data = await response.json();
      addResult('用户注册', response.ok, { email: testEmail, ...data });
    } catch (error: any) {
      addResult('用户注册', false, { error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // 测试演示账户登录
  const testDemoLogin = async () => {
    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email: 'demo@example.com',
        password: 'demo123',
        domain: 'demo',
        redirect: false
      });
      addResult('演示账户登录', result?.ok || false, result);
    } catch (error: any) {
      addResult('演示账户登录', false, { error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // 测试仪表板访问
  const testDashboard = async () => {
    if (!session) {
      addResult('仪表板访问', false, { error: '需要先登录' });
      return;
    }
    
    setLoading(true);
    try {
      router.push('/dashboard');
      addResult('仪表板访问', true, { redirected: true });
    } catch (error: any) {
      addResult('仪表板访问', false, { error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // 测试登出
  const testSignOut = async () => {
    setLoading(true);
    try {
      await signOut({ redirect: false });
      addResult('用户登出', true, { signedOut: true });
    } catch (error: any) {
      addResult('用户登出', false, { error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px', color: '#333' }}>系统功能全面测试</h1>
      
      {/* 当前状态 */}
      <div style={{ 
        padding: '15px', 
        backgroundColor: '#f8f9fa', 
        border: '1px solid #dee2e6', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3>当前状态</h3>
        <p>登录状态: {status === 'loading' ? '检查中...' : status === 'authenticated' ? '已登录' : '未登录'}</p>
        {session && (
          <div>
            <p>用户: {session.user?.name} ({session.user?.email})</p>
            <p>租户ID: {session.user?.tenantId || '无'}</p>
            <p>角色: {session.user?.role || '无'}</p>
          </div>
        )}
      </div>

      {/* 测试按钮 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '10px',
        marginBottom: '20px'
      }}>
        <button 
          onClick={testDatabase}
          disabled={loading}
          style={{
            padding: '12px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          测试数据库连接
        </button>

        <button 
          onClick={testRegistration}
          disabled={loading}
          style={{
            padding: '12px 16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          测试用户注册
        </button>

        <button 
          onClick={testDemoLogin}
          disabled={loading}
          style={{
            padding: '12px 16px',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          测试演示登录
        </button>

        <button 
          onClick={testDashboard}
          disabled={loading || !session}
          style={{
            padding: '12px 16px',
            backgroundColor: '#6f42c1',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: (loading || !session) ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          测试仪表板访问
        </button>

        <button 
          onClick={testSignOut}
          disabled={loading || !session}
          style={{
            padding: '12px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: (loading || !session) ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          测试登出
        </button>

        <button 
          onClick={clearResults}
          style={{
            padding: '12px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          清空结果
        </button>
      </div>

      {/* 测试结果 */}
      <div style={{ marginTop: '20px' }}>
        <h3>测试结果 ({results.length})</h3>
        {results.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>暂无测试结果</p>
        ) : (
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {results.map((result, index) => (
              <div 
                key={index}
                style={{
                  padding: '12px',
                  margin: '8px 0',
                  backgroundColor: result.success ? '#d4edda' : '#f8d7da',
                  border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`,
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <strong style={{ color: result.success ? '#155724' : '#721c24' }}>
                    {result.test} - {result.success ? '✅ 成功' : '❌ 失败'}
                  </strong>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    {result.timestamp}
                  </span>
                </div>
                {result.data && (
                  <pre style={{ 
                    fontSize: '12px', 
                    backgroundColor: 'rgba(0,0,0,0.05)', 
                    padding: '8px', 
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '200px'
                  }}>
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 演示账户信息 */}
      <div style={{ 
        marginTop: '30px',
        padding: '15px',
        backgroundColor: '#e7f3ff',
        border: '1px solid #b3d9ff',
        borderRadius: '8px'
      }}>
        <h3 style={{ color: '#0056b3', marginBottom: '10px' }}>演示账户信息</h3>
        <div style={{ fontSize: '14px', color: '#0056b3' }}>
          <p><strong>邮箱:</strong> demo@example.com</p>
          <p><strong>密码:</strong> demo123</p>
          <p><strong>域名:</strong> demo</p>
          <p><strong>角色:</strong> ADMIN</p>
        </div>
      </div>

      {/* 快速链接 */}
      <div style={{ marginTop: '20px' }}>
        <h3>快速链接</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <a href="/auth/signin" style={{ color: '#007bff', textDecoration: 'none' }}>登录页面</a>
          <a href="/auth/signup" style={{ color: '#007bff', textDecoration: 'none' }}>注册页面</a>
          <a href="/dashboard" style={{ color: '#007bff', textDecoration: 'none' }}>仪表板</a>
          <a href="/simple-test" style={{ color: '#007bff', textDecoration: 'none' }}>简单测试</a>
          <a href="/quick-login" style={{ color: '#007bff', textDecoration: 'none' }}>快速登录</a>
        </div>
      </div>
    </div>
  );
}