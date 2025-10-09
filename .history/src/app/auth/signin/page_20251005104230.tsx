'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  Zap, 
  Mail, 
  Lock, 
  Building2, 
  ArrowRight, 
  Sparkles, 
  Bot,
  Eye,
  EyeOff,
  Star,
  Rocket
} from 'lucide-react';

export default function SignInPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    domain: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        domain: formData.domain,
        redirect: false
      });

      if (result?.error) {
        setError('登录失败，请检查您的凭据');
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      setError('登录过程中发生错误');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoData = () => {
    setFormData({
      email: 'demo@example.com',
      password: 'demo123',
      domain: 'demo'
    });
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* 动态背景 */}
      <div className="absolute inset-0">
        {/* 渐变球体 */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-blue-400/20 to-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-cyan-400/20 to-blue-600/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-pink-400/10 to-purple-600/10 rounded-full blur-2xl animate-pulse delay-2000"></div>
        
        {/* 网格背景 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        
        {/* 浮动粒子 */}
        <div className="absolute inset-0">
          {typeof window !== 'undefined' && [...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-blue-400/30 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* 主要内容 */}
      <div className="relative z-10 flex flex-col justify-center min-h-screen py-12 sm:px-6 lg:px-8">
        {/* 头部 */}
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/25 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                <Bot className="h-10 w-10 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center animate-bounce">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
            </div>
          </div>
          
          <h1 className="text-4xl font-bold gradient-text mb-4">
            智能投标系统
          </h1>
          <p className="text-lg text-gray-300 mb-2">
            AI驱动的下一代投标平台
          </p>
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
            <Star className="h-4 w-4 text-yellow-400" />
            <span>安全</span>
            <span>•</span>
            <span>智能</span>
            <span>•</span>
            <span>高效</span>
            <Star className="h-4 w-4 text-yellow-400" />
          </div>
        </div>

        {/* 登录表单 */}
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="relative">
            {/* 背景光效 */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-500/10 rounded-3xl blur-xl"></div>
            
            {/* 表单容器 */}
            <div className="relative bg-white/10 glass border border-white/20 rounded-3xl p-8 shadow-2xl">
              {/* 演示账户快速填充 */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={fillDemoData}
                  className="w-full group relative overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  <div className="relative flex items-center justify-center space-x-2">
                    <Rocket className="h-5 w-5" />
                    <span>使用演示账户</span>
                  </div>
                </button>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-2xl text-sm backdrop-blur-sm">
                    {error}
                  </div>
                )}

                {/* 邮箱输入 */}
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-200">
                    邮箱地址
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-blue-400 transition-colors" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="pl-12 block w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      placeholder="user@example.com"
                    />
                  </div>
                </div>

                {/* 密码输入 */}
                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-200">
                    密码
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-400 transition-colors" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="pl-12 pr-12 block w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                      )}
                    </button>
                  </div>
                </div>

                {/* 域名输入 */}
                <div className="space-y-2">
                  <label htmlFor="domain" className="block text-sm font-semibold text-gray-200">
                    企业域名 <span className="text-gray-400 text-xs">(可选)</span>
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Building2 className="h-5 w-5 text-gray-400 group-focus-within:text-blue-400 transition-colors" />
                    </div>
                    <input
                      id="domain"
                      name="domain"
                      type="text"
                      value={formData.domain}
                      onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                      className="pl-12 block w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      placeholder="company-domain"
                    />
                  </div>
                </div>

                {/* 登录按钮 */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full group relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 hover:from-blue-700 hover:via-purple-700 hover:to-cyan-700 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    <div className="relative flex items-center justify-center space-x-2">
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>登录中...</span>
                        </>
                      ) : (
                        <>
                          <span>登录</span>
                          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </div>
                  </button>
                </div>
              </form>

              {/* 注册链接 */}
              <div className="mt-8 text-center">
                <p className="text-gray-300 text-sm">
                  还没有账户？{' '}
                  <Link 
                    href="/auth/signup" 
                    className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 hover:from-blue-300 hover:to-purple-300 transition-all duration-200"
                  >
                    立即注册
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 演示账户信息 */}
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-2xl blur-lg"></div>
            <div className="relative bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 backdrop-blur-sm">
              <h3 className="text-emerald-300 font-semibold mb-3 flex items-center">
                <Zap className="h-4 w-4 mr-2" />
                演示账户信息
              </h3>
              <div className="space-y-2 text-sm text-emerald-200">
                <div className="flex justify-between">
                  <span className="text-gray-400">邮箱:</span>
                  <span className="font-mono">demo@example.com</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">密码:</span>
                  <span className="font-mono">demo123</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">域名:</span>
                  <span className="font-mono">demo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}