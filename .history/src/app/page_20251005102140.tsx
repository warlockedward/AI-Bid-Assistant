import Link from 'next/link';
import { 
  Bot, 
  Zap, 
  Sparkles, 
  Rocket, 
  Star, 
  ArrowRight,
  CheckCircle,
  Users,
  Shield,
  TrendingUp,
  Globe,
  Brain
} from 'lucide-react';

export default function HomePage() {
  const features = [
    {
      icon: Brain,
      title: 'AI智能分析',
      description: '深度学习算法分析招标文件，提取关键信息',
      color: 'from-blue-500 to-cyan-500',
      animation: 'float-3d'
    },
    {
      icon: Rocket,
      title: '自动化工作流',
      description: '端到端自动化投标流程，提高效率10倍',
      color: 'from-purple-500 to-pink-500',
      animation: 'float-3d delay-100'
    },
    {
      icon: Shield,
      title: '企业级安全',
      description: '多租户架构，数据隔离，符合企业安全标准',
      color: 'from-green-500 to-emerald-500',
      animation: 'float-3d delay-200'
    },
    {
      icon: TrendingUp,
      title: '数据洞察',
      description: '实时分析投标成功率，优化策略决策',
      color: 'from-orange-500 to-red-500',
      animation: 'float-3d delay-300'
    }
  ];

  const stats = [
    { label: '投标成功率', value: '85%', icon: TrendingUp, animation: 'tech-glow' },
    { label: '处理时间节省', value: '90%', icon: Zap, animation: 'tech-glow' },
    { label: '企业用户', value: '500+', icon: Users, animation: 'tech-glow' },
    { label: '全球覆盖', value: '50+', icon: Globe, animation: 'tech-glow' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* 动态背景 - 皮克斯风格 */}
      <div className="absolute inset-0">
        {/* 大型渐变球体 - 皮克斯风格的柔和渐变 */}
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-gradient-to-r from-blue-400/20 to-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-gradient-to-r from-cyan-400/20 to-blue-600/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-pink-400/10 to-purple-600/10 rounded-full blur-2xl animate-pulse delay-2000"></div>
        
        {/* 高科技网格背景 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
        
        {/* 浮动粒子 - 高科技感 */}
        <div className="absolute inset-0">
          {[...Array(80)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 bg-blue-400/40 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${3 + Math.random() * 4}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* 导航栏 - 皮克斯风格圆润 */}
      <nav className="relative z-10 px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg tech-glow">
              <Bot className="h-7 w-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-white gradient-text">智能投标系统</span>
          </div>
          
          <div className="flex items-center space-x-6">
            <Link 
              href="/auth/signin"
              className="px-6 py-2.5 text-white hover:text-blue-300 transition-colors"
            >
              登录
            </Link>
            <Link 
              href="/auth/signup"
              className="pixar-button px-8 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-full font-semibold transition-all duration-300 transform hover:scale-105 tech-glow"
            >
              免费试用
            </Link>
          </div>
        </div>
      </nav>

      {/* 主要内容 */}
      <div className="relative z-10 max-w-7xl mx-auto px-8 py-24">
        {/* 英雄区域 - 皮克斯风格 */}
        <div className="text-center mb-24">
          <div className="flex justify-center mb-10">
            <div className="relative float-3d">
              <div className="w-40 h-40 bg-gradient-to-r from-primary via-secondary to-accent rounded-[2rem] flex items-center justify-center shadow-2xl transform rotate-6 hover:rotate-0 transition-all duration-500 tech-glow">
                <Rocket className="h-20 w-20 text-white" />
              </div>
              <div className="absolute -top-6 -right-6 w-12 h-12 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center animate-bounce shadow-lg">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
          
          <h1 className="text-7xl font-bold mb-8">
            <span className="gradient-text">AI驱动的</span>
            <br />
            <span className="text-white">智能投标平台</span>
          </h1>
          
          <p className="text-2xl text-gray-200 mb-10 max-w-3xl mx-auto leading-relaxed">
            利用人工智能技术，自动化分析招标文件，生成高质量投标方案，
            <br />
            让您的投标成功率提升<span className="text-primary font-bold">85%</span>，处理时间节省<span className="text-secondary font-bold">90%</span>
          </p>
          
          <div className="flex items-center justify-center space-x-8 mb-16">
            <Link 
              href="/auth/signup"
              className="group px-10 py-5 bg-gradient-to-r from-primary via-secondary to-accent text-white font-bold rounded-full transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl flex items-center space-x-3 tech-glow"
            >
              <span className="text-lg">立即开始</span>
              <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
            </Link>
            
            <Link 
              href="/system-test"
              className="px-10 py-5 bg-white/10 border-2 border-white/20 text-white font-semibold rounded-full hover:bg-white/20 transition-all duration-300 backdrop-blur-sm hover:border-primary/50"
            >
              查看演示
            </Link>
          </div>
          
          {/* 特色标签 */}
          <div className="flex items-center justify-center space-x-8 text-sm text-gray-400">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <span>免费试用</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <span>无需信用卡</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <span>即时部署</span>
            </div>
          </div>
        </div>

        {/* 统计数据 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
          {stats.map((stat, index) => (
            <div key={stat.label} className="text-center">
              <div className="relative mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                  <stat.icon className="h-8 w-8 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full animate-pulse"></div>
              </div>
              <div className="text-3xl font-bold text-white mb-2">{stat.value}</div>
              <div className="text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* 功能特色 */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              为什么选择我们？
            </h2>
            <p className="text-xl text-gray-300">
              领先的AI技术，为您的投标业务赋能
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={feature.title} className="relative group">
                <div className={`absolute inset-0 bg-gradient-to-r ${feature.color.replace('to-', 'to-').replace('from-', 'from-').split(' ').map(c => c + '/10').join(' ')} rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300`}></div>
                
                <div className="relative bg-white/10 glass border border-white/20 rounded-2xl p-6 backdrop-blur-sm group-hover:bg-white/15 transition-all duration-300 transform group-hover:scale-105">
                  <div className={`w-12 h-12 bg-gradient-to-r ${feature.color} rounded-2xl flex items-center justify-center mb-4 shadow-lg`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                  
                  <div className="absolute top-2 right-2 w-2 h-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA区域 */}
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 rounded-3xl blur-xl"></div>
            
            <div className="relative bg-white/10 glass border border-white/20 rounded-3xl p-12 backdrop-blur-sm">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <Zap className="h-8 w-8 text-white" />
                </div>
              </div>
              
              <h2 className="text-3xl font-bold text-white mb-4">
                准备好开始您的AI投标之旅了吗？
              </h2>
              <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
                加入数百家企业，体验AI驱动的智能投标系统，
                让技术为您的业务增长助力
              </p>
              
              <div className="flex items-center justify-center space-x-4">
                <Link 
                  href="/auth/signup"
                  className="group px-8 py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 hover:from-blue-700 hover:via-purple-700 hover:to-cyan-700 text-white font-bold rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-2xl flex items-center space-x-2"
                >
                  <span>免费开始试用</span>
                  <Rocket className="h-5 w-5 group-hover:translate-y-[-2px] transition-transform" />
                </Link>
                
                <Link 
                  href="/auth/signin"
                  className="px-8 py-4 bg-white/10 glass border border-white/20 text-white font-semibold rounded-2xl hover:bg-white/20 transition-all duration-200 backdrop-blur-sm"
                >
                  已有账户？登录
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 页脚 */}
      <footer className="relative z-10 border-t border-white/10 mt-20 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <span className="text-white font-semibold">智能投标系统</span>
          </div>
          <p className="text-gray-400 text-sm">
            © 2024 智能投标系统. 基于AutoGen技术构建. 保留所有权利.
          </p>
        </div>
      </footer>
    </div>
  );
}