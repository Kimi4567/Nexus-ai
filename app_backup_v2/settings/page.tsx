'use client'

import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { Settings, Key, Save, Check, Globe, Bell, Shield, Moon, Sun } from 'lucide-react'

export default function SettingsPage() {
  const { user } = useAuth()
  const [apiKey, setApiKey] = useState('')
  const [language, setLanguage] = useState('ar')
  const [notifications, setNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(true)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('openai_key', apiKey)
      localStorage.setItem('nexus_language', language)
      localStorage.setItem('nexus_notifications', String(notifications))
      localStorage.setItem('nexus_darkmode', String(darkMode))
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold">الإعدادات</h1>
          <p className="text-text-muted text-sm">إدارة حسابك والمفاتيح والتفضيلات</p>
        </div>

        {/* Account Info */}
        <div className="glass p-6 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-5 h-5 text-amber" />
            <h3 className="font-bold">معلومات الحساب</h3>
          </div>
          <div className="p-4 rounded-xl bg-white/5 space-y-3">
            <div>
              <p className="text-xs text-text-muted">الاسم</p>
              <p className="text-sm font-medium">{user?.name || 'مستخدم'}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">البريد</p>
              <p className="text-sm font-medium">{user?.email || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">الخطة</p>
              <p className="text-sm font-medium text-amber">{user?.plan || 'Starter'}</p>
            </div>
          </div>
        </div>

        {/* API Keys */}
        <div className="glass p-6 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-5 h-5 text-cyan" />
            <h3 className="font-bold">API Keys</h3>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">OpenAI API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="input-nexus"
            />
            <p className="text-xs text-text-muted mt-1">المفتاح يُخزن محلياً في المتصفح ولا يُرسل لخوادمنا</p>
          </div>
        </div>

        {/* Preferences */}
        <div className="glass p-6 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold">التفضيلات</h3>
          </div>

          {/* Language Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-text-muted" />
              <div>
                <p className="text-sm font-medium">اللغة</p>
                <p className="text-xs text-text-muted">لغة واجهة التطبيق</p>
              </div>
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="input-nexus w-auto"
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </div>

          {/* Notifications Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-text-muted" />
              <div>
                <p className="text-sm font-medium">التنبيهات</p>
                <p className="text-xs text-text-muted">استلام إشعارات الحملات والتنبيهات</p>
              </div>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`relative w-12 h-6 rounded-full transition-all ${notifications ? 'bg-amber' : 'bg-white/10'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${notifications ? 'left-[26px]' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5 text-text-muted" />
              <div>
                <p className="text-sm font-medium">الوضع الداكن</p>
                <p className="text-xs text-text-muted">استخدام السمة الداكنة</p>
              </div>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`relative w-12 h-6 rounded-full transition-all ${darkMode ? 'bg-amber' : 'bg-white/10'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${darkMode ? 'left-[26px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        {saved && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />
            تم حفظ الإعدادات بنجاح
          </div>
        )}

        <button onClick={handleSave} className="btn-primary w-full">
          <Save className="w-4 h-4" />
          حفظ الإعدادات
        </button>
      </div>
    </ProtectedRoute>
  )
}
