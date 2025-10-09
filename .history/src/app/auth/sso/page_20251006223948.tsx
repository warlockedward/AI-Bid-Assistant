import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Building2, Shield, Users, Zap } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { motion } from 'framer-motion'

function SSOContent() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

      {/* Header */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <Link href="/auth/signin" className="flex items-center space-x-3 text-white hover:text-blue-300 transition-colors">
              <ArrowLeft className="h-5 w-5" />
              <span>{t('auth.backToLogin')}</span>
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="relative z-10 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="sm:mx-auto sm:w-full sm:max-w-md"
        >
          <div className="flex justify-center">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
              <Building2 className="h-12 w-12 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            {t('auth.sso.title')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-300">
            {t('auth.sso.subtitle')}
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"
        >
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white text-center">
                {t('auth.sso.selectProvider')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                variant="outline" 
                className="w-full bg-white/10 hover:bg-white/20 border-white/30 text-white"
                onClick={() => alert('Auth0 SSO')}
              >
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 bg-blue-500 rounded-sm flex items-center justify-center">
                    <span className="text-white text-xs font-bold">A</span>
                  </div>
                  <span>Auth0</span>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full bg-white/10 hover:bg-white/20 border-white/30 text-white"
                onClick={() => alert('Azure AD SSO')}
              >
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 bg-blue-600 rounded-sm flex items-center justify-center">
                    <span className="text-white text-xs">M</span>
                  </div>
                  <span>Microsoft Azure AD</span>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full bg-white/10 hover:bg-white/20 border-white/30 text-white"
                onClick={() => alert('Google Workspace SSO')}
              >
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 bg-blue-400 rounded-sm flex items-center justify-center">
                    <span className="text-white text-xs">G</span>
                  </div>
                  <span>Google Workspace</span>
                </div>
              </Button>
              
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/30"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-transparent text-gray-300">
                    {t('auth.sso.or')}
                  </span>
                </div>
              </div>
              
              <Button 
                variant="link" 
                className="w-full text-gray-300 hover:text-white"
                onClick={() => alert('Contact support')}
              >
                {t('auth.sso.contactSupport')}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-12 sm:mx-auto sm:w-full sm:max-w-4xl"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Secure Authentication</h3>
              <p className="text-gray-400 text-sm">Enterprise-grade security with your existing identity provider</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Centralized Access</h3>
              <p className="text-gray-400 text-sm">Manage user access through your organization&apos;s directory</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Zap className="h-6 w-6 text-green-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Seamless Experience</h3>
              <p className="text-gray-400 text-sm">Single sign-on for all your business applications</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default function SSOPage() {
  return <SSOContent />
}