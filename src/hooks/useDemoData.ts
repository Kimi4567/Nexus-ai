'use client'

/* ═══════════════════════════════════════════════════════════════
   useDemoData — Auto-populate dashboard for new users
   Every new user sees realistic data in their first 7 days.
   ═══════════════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react'

export interface DemoCampaign {
  id: string
  name: string
  platform: 'Meta' | 'TikTok' | 'Google' | 'Snapchat'
  status: 'active' | 'paused' | 'draft'
  budget: number
  spent: number
  impressions: number
  clicks: number
  ctr: number
  conversions: number
  roas: number
  createdAt: string
  daysRunning: number
}

export interface DemoActivity {
  id: string
  agent: string
  action: string
  target: string
  time: string
  icon: string
  glow: string
}

export interface DemoStats {
  totalCampaigns: number
  activeCampaigns: number
  totalImpressions: number
  totalClicks: number
  avgCtr: number
  totalConversions: number
  totalRevenue: number
  creditsUsed: number
  creditsTotal: number
}

const DEMO_CAMPAIGNS: DemoCampaign[] = [
  {
    id: 'demo-1',
    name: 'حملة عيد الأضحى — تخفيضات 30%',
    platform: 'Meta',
    status: 'active',
    budget: 500,
    spent: 320,
    impressions: 45200,
    clicks: 1582,
    ctr: 3.5,
    conversions: 124,
    roas: 4.2,
    createdAt: 'منذ 5 أيام',
    daysRunning: 5,
  },
  {
    id: 'demo-2',
    name: 'ترويج منتج جديد — تيشيرت صيفي',
    platform: 'TikTok',
    status: 'active',
    budget: 300,
    spent: 180,
    impressions: 28400,
    clicks: 852,
    ctr: 3.0,
    conversions: 67,
    roas: 3.8,
    createdAt: 'منذ 3 أيام',
    daysRunning: 3,
  },
  {
    id: 'demo-3',
    name: 'حملة awareness — علامة تجارية',
    platform: 'Google',
    status: 'draft',
    budget: 800,
    spent: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    conversions: 0,
    roas: 0,
    createdAt: 'منذ ساعة',
    daysRunning: 0,
  },
]

const DEMO_ACTIVITIES: DemoActivity[] = [
  { id: '1', agent: 'NEX', action: 'ولد فيديو تسويقي جديد', target: '"عيد الأضحى"', time: 'منذ 10 دقائق', icon: 'Film', glow: 'amber' },
  { id: '2', agent: 'VEX', action: 'حسّن حملة', target: 'Meta — +23% CTR', time: 'منذ ساعة', icon: 'Megaphone', glow: 'cyan' },
  { id: '3', agent: 'PULSE', action: 'اكتشف فرصة', target: 'زيادة إنفاق TikTok 15%', time: 'منذ 3 ساعات', icon: 'BarChart3', glow: 'purple' },
  { id: '4', agent: 'Sentinel', action: 'حذر: ميزانية', target: '"عيد الأضحى" 80% مستخدمة', time: 'منذ 6 ساعات', icon: 'Shield', glow: 'emerald' },
  { id: '5', agent: 'NEX', action: 'ولد 3 فيديوهات', target: 'لحملة "تيشيرت صيفي"', time: 'منذ 8 ساعات', icon: 'Film', glow: 'amber' },
  { id: '6', agent: 'VEX', action: 'أطلق حملة جديدة', target: 'Google — Awareness', time: 'أمس', icon: 'Megaphone', glow: 'cyan' },
]

const DEMO_STATS: DemoStats = {
  totalCampaigns: 3,
  activeCampaigns: 2,
  totalImpressions: 73600,
  totalClicks: 2434,
  avgCtr: 3.3,
  totalConversions: 191,
  totalRevenue: 2840,
  creditsUsed: 12,
  creditsTotal: 50,
}

export function useDemoData() {
  const [isDemo, setIsDemo] = useState(false)
  const [campaigns] = useState(DEMO_CAMPAIGNS)
  const [activities] = useState(DEMO_ACTIVITIES)
  const [stats] = useState(DEMO_STATS)

  useEffect(() => {
    // Check if user is new (within first 7 days or no real data)
    const createdAt = localStorage.getItem('nexus_user_created')
    if (!createdAt) {
      localStorage.setItem('nexus_user_created', Date.now().toString())
      setIsDemo(true)
    } else {
      const daysSince = (Date.now() - parseInt(createdAt)) / (1000 * 60 * 60 * 24)
      setIsDemo(daysSince < 7)
    }
  }, [])

  const dismissDemo = () => {
    localStorage.setItem('nexus_user_created', '0') // Mark as old user
    setIsDemo(false)
  }

  return { isDemo, campaigns, activities, stats, dismissDemo }
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}
