'use client'

import { useState } from 'react'
import { generateAdCopy } from '@/services/openai'
import { Wand2, Loader2, Megaphone, Copy, CheckCircle, AlertTriangle, Info } from 'lucide-react'

interface Campaign {
  id: string
  title: string
  status: 'active' | 'paused' | 'draft'
  platform: string
  budget: string
  ctr: string
  roas: string
}

export default function VexPage() {
  const [product, setProduct] = useState('')
  const [goal, setGoal] = useState('sales')
  const [audience, setAudience] = useState('')
  const [copy, setCopy] = useState('')
  const [loading, setLoading] = useState(false)
  const [campaigns] = useState<Campaign[]>([
    { id: '1', title: 'حملة منتج X', status: 'active', platform: 'فيسبوك', budget: '$500', ctr: '2.4%', roas: '3.2x' },
    { id: '2', title: 'ترويج تطبيق Y', status: 'paused', platform: 'إنستغرام', budget: '$300', ctr: '1.8%', roas: '2.1x' },
    { id: '3', title: 'وعي علامة Z', status: 'draft', platform: 'تيك توك', budget: '$800', ctr: '-', roas: '-' },
    { id: '4', title: 'حملة رمضان', status: 'active', platform: 'فيسبوك', budget: '$1200', ctr: '3.1%', roas: '4.5x' },
  ])

  const handleGenerate = async () => {
    if (!product || !audience) return
    setLoading(true)
    try {
      const result = await generateAdCopy(product, goal, audience)
      setCopy(result)
    } catch (e) {
      setCopy('Error generating ad copy. Please try again.')
    }
    setLoading(false)
  }

  const statusColors: Record<string, string> = {
    active: 'text-emerald-500',
    paused: 'text-yellow-500',
    draft: 'text-text-muted',
  }

  const statusLabels: Record<string, string> = {
    active: 'نشطة',
    paused: 'معلّقة',
    draft: 'مسودة',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">مدير VEX</h1>
        <p className="text-text-muted text-sm">أدر حملاتك الإعلانية بالذكاء الاصطناعي</p>
      </div>

      <div className="glass p-6">
        <h3 className="text-lg font-bold mb-4">مولد النسخ الإعلانية</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">اسم المنتج</label>
            <input type="text" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="مثال: تطبيق fitness" className="input-nexus" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">الهدف</label>
            <select value={goal} onChange={(e) => setGoal(e.target.value)} className="input-nexus">
              <option value="sales">مبيعات</option>
              <option value="leads">قيادة</option>
              <option value="awareness">وعي</option>
              <option value="engagement">تفاعل</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">الجمهور</label>
            <input type="text" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="مثال: شاب 18-25 مهتم بالرياضة" className="input-nexus" />
          </div>
        </div>
        <button onClick={handleGenerate} disabled={loading || !product || !audience} className="btn-primary">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {loading ? 'جاري التوليد...' : 'توليد النسخ'}
        </button>

        {copy && (
          <div className="mt-4 p-4 rounded-xl bg-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">النسخ الإعلانية:</span>
              <button onClick={() => navigator.clipboard.writeText(copy)} className="text-xs text-amber hover:text-amber-dark transition-colors">
                <Copy className="w-4 h-4 inline" /> نسخ
              </button>
            </div>
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{copy}</p>
          </div>
        )}
      </div>

      <div className="glass p-6">
        <h3 className="text-lg font-bold mb-4">الحملات</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-right py-3 px-4 text-text-muted font-medium">الحملة</th>
                <th className="text-right py-3 px-4 text-text-muted font-medium">المنصة</th>
                <th className="text-right py-3 px-4 text-text-muted font-medium">الميزانية</th>
                <th className="text-right py-3 px-4 text-text-muted font-medium">CTR</th>
                <th className="text-right py-3 px-4 text-text-muted font-medium">ROAS</th>
                <th className="text-right py-3 px-4 text-text-muted font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 font-medium">{c.title}</td>
                  <td className="py-3 px-4 text-text-secondary">{c.platform}</td>
                  <td className="py-3 px-4 text-text-secondary">{c.budget}</td>
                  <td className="py-3 px-4 text-text-secondary">{c.ctr}</td>
                  <td className="py-3 px-4 text-text-secondary">{c.roas}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${statusColors[c.status]}`}>
                      {c.status === 'active' && <CheckCircle className="w-3 h-3" />}
                      {c.status === 'paused' && <AlertTriangle className="w-3 h-3" />}
                      {c.status === 'draft' && <Info className="w-3 h-3" />}
                      {statusLabels[c.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
