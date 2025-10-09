'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function SimpleTestPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const testLogin = async () => {
    setLoading(true);
    setMessage('正在测试登录...');
    
    try {
      const result = await signIn('credentials', {
        email: 'demo@example.com',
        password: 'demo123',
        domain: 'demo',
        redirect: false
      });

      if (result?.ok) {
        setMessage('登录成功！正在跳转...');
        setTimeout(() => router.push('/dashboard'), 1000);
      } else {
        setMessage(`登录失败: ${result?.error || '未知错误'}`);
      }
    } catch (error: any) {
      setMessage(`登录异常: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testRegister = async () => {
    setLoading(true);
    setMessage('正在测试注册...');
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `test${Date.now()}@example.com`,
          password: 'test123',
          name: 'Test User',
          companyName: 'Test Company'
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage('注册成功！');
      } else {
        setMessage(`注册失败: ${data.error}`);
      }
    } catch (error: any) {
      setMessage(`注册异常: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>简单功能测试</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={testLogin}
          disabled={loading}
          style={{
            padding: '10px 20px',
            marginRight: '10px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '测试中...' : '测试演示登录'}
        </button>
        
        <button 
          onClick={testRegister}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '测试中...' : '测试注册功能'}
        </button>
      </div>

      {message && (
        <div style={{
          padding: '10px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          marginTop: '10px'
        }}>
          {message}
        </div>
      )}

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <h3>演示账户信息:</h3>
        <p>邮箱: demo@example.com</p>
        <p>密码: demo123</p>
        <p>域名: demo</p>
      </div>
    </div>
  );
}