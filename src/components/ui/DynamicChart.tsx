'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

/* ═══════════════════════════════════════════════════════════════
   Dynamic Chart Wrapper — Lazy loads recharts to reduce bundle size
   Only loads when the component is actually rendered
   ═══════════════════════════════════════════════════════════════ */

const ChartSkeleton = () => (
  <div className="w-full h-[250px] rounded-xl bg-white/3 animate-pulse flex items-center justify-center">
    <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-amber animate-spin" />
  </div>
)

// Lazy load each chart type separately
export const AreaChart = dynamic(
  () => import('recharts').then((mod) => mod.AreaChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
)

export const BarChart = dynamic(
  () => import('recharts').then((mod) => mod.BarChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
)

export const PieChart = dynamic(
  () => import('recharts').then((mod) => mod.PieChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
)

export const LineChart = dynamic(
  () => import('recharts').then((mod) => mod.LineChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
)

export const Area = dynamic(
  () => import('recharts').then((mod) => mod.Area),
  { ssr: false }
)

export const Bar = dynamic(
  () => import('recharts').then((mod) => mod.Bar),
  { ssr: false }
)

export const Pie = dynamic(
  () => import('recharts').then((mod) => mod.Pie),
  { ssr: false }
)

export const Cell = dynamic(
  () => import('recharts').then((mod) => mod.Cell),
  { ssr: false }
)

export const XAxis = dynamic(
  () => import('recharts').then((mod) => mod.XAxis),
  { ssr: false }
)

export const YAxis = dynamic(
  () => import('recharts').then((mod) => mod.YAxis),
  { ssr: false }
)

export const CartesianGrid = dynamic(
  () => import('recharts').then((mod) => mod.CartesianGrid),
  { ssr: false }
)

export const Tooltip = dynamic(
  () => import('recharts').then((mod) => mod.Tooltip),
  { ssr: false }
)

export const ResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => mod.ResponsiveContainer),
  { ssr: false, loading: () => <ChartSkeleton /> }
)

export const Line = dynamic(
  () => import('recharts').then((mod) => mod.Line),
  { ssr: false }
)
