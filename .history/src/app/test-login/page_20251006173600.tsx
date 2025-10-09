'use client';

import { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function TestLoginPage() {
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('demo123');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const router = useRouter();
  const { data: session } = useSession();

  const handleLogin = async () => {
    setLoading(true);
    try {
      console.log('尝试登录:', { email, password });
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      console.log('登录结果:', res);
      setResult(res);
      
      if (!res?.error) {
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('登录错误:', error);
      setResult({ error: error.message || '未知错误' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>测试登录页面</h1>
      
      {session ? (
        <div>
          <p>已登录: {session.user?.email}</p>
          <button onClick={() => router.push('/dashboard')}>前往仪表板</button>
        </div>
      ) : (
        <div>
          <div>
            <label>邮箱: </label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>
          <div>
            <label>密码: </label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>
          <button onClick={handleLogin} disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
          
          {result && (
            <div>
              <h2>结果:</h2>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}