'use client'
import React from 'react'
import Image from 'next/image'

export type AgentId = 'brand-brain' | 'strategist' | 'nex' | 'vex' | 'sentinel' | 'pulse'

const AGENT_COLORS: Record<AgentId, { primary: string; glow: string; gradient: string }> = {
  'brand-brain':  { primary: '#8B5CF6', glow: 'rgba(139,92,246,0.4)',  gradient: 'linear-gradient(135deg, #7C3AED, #8B5CF6)' },
  'strategist':   { primary: '#6366F1', glow: 'rgba(99,102,241,0.4)',  gradient: 'linear-gradient(135deg, #4F46E5, #6366F1)' },
  'nex':          { primary: '#06B6D4', glow: 'rgba(6,182,212,0.4)',   gradient: 'linear-gradient(135deg, #0891B2, #06B6D4)' },
  'vex':          { primary: '#F97316', glow: 'rgba(249,115,22,0.4)',  gradient: 'linear-gradient(135deg, #EA580C, #F97316)' },
  'sentinel':     { primary: '#EAB308', glow: 'rgba(234,179,8,0.4)',   gradient: 'linear-gradient(135deg, #CA8A04, #EAB308)' },
  'pulse':        { primary: '#10B981', glow: 'rgba(16,185,129,0.4)',  gradient: 'linear-gradient(135deg, #059669, #10B981)' },
}

// Premium SVG placeholder avatars — one per agent
const AGENT_SVGS: Record<AgentId, React.ReactNode> = {
  'brand-brain': (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="14" fill="url(#bb1)" opacity="0.2"/>
      <path d="M14 18c0-3.31 2.69-6 6-6s6 2.69 6 6c0 2.1-1.08 3.94-2.71 5.01L23 26h-6l-.29-2.99A6 6 0 0114 18z" fill="url(#bb1)"/>
      <path d="M16 26h8v1.5a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 0116 27.5V26z" fill="url(#bb1)" opacity="0.7"/>
      <path d="M20 12v2M20 26v2M12 20h2M26 20h2" stroke="url(#bb1)" strokeWidth="1.5" strokeLinecap="round"/>
      <defs>
        <linearGradient id="bb1" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA"/><stop offset="1" stopColor="#8B5CF6"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  'strategist': (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="14" fill="url(#st1)" opacity="0.15"/>
      <path d="M14 14h12v2H14zM14 19h8v2h-8zM14 24h10v2H14z" fill="url(#st1)"/>
      <path d="M28 22l-4 4 2 2 5-5-3-3z" fill="url(#st1)" opacity="0.7"/>
      <circle cx="27" cy="27" r="2" fill="url(#st1)"/>
      <defs>
        <linearGradient id="st1" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818CF8"/><stop offset="1" stopColor="#6366F1"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  'nex': (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="14" fill="url(#nx1)" opacity="0.15"/>
      <rect x="13" y="15" width="14" height="10" rx="3" stroke="url(#nx1)" strokeWidth="1.5" fill="url(#nx1)" fillOpacity="0.1"/>
      <circle cx="17" cy="20" r="1.5" fill="url(#nx1)"/>
      <circle cx="20" cy="20" r="1.5" fill="url(#nx1)"/>
      <circle cx="23" cy="20" r="1.5" fill="url(#nx1)"/>
      <path d="M20 13v2M15 13.5l1 1.5M25 13.5l-1 1.5" stroke="url(#nx1)" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M16 25l-2 3M24 25l2 3" stroke="url(#nx1)" strokeWidth="1.2" strokeLinecap="round"/>
      <defs>
        <linearGradient id="nx1" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67E8F9"/><stop offset="1" stopColor="#06B6D4"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  'vex': (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="14" fill="url(#vx1)" opacity="0.15"/>
      <path d="M13 20l7-9 7 9H13z" fill="url(#vx1)" fillOpacity="0.3" stroke="url(#vx1)" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M13 20l7 9 7-9" stroke="url(#vx1)" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
      <circle cx="20" cy="20" r="2.5" fill="url(#vx1)"/>
      <defs>
        <linearGradient id="vx1" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FB923C"/><stop offset="1" stopColor="#F97316"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  'sentinel': (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="14" fill="url(#sn1)" opacity="0.15"/>
      <path d="M20 12l8 3.5v5c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9v-5L20 12z" fill="url(#sn1)" fillOpacity="0.2" stroke="url(#sn1)" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M16.5 20l2.5 2.5 4-4" stroke="url(#sn1)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <defs>
        <linearGradient id="sn1" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047"/><stop offset="1" stopColor="#EAB308"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  'pulse': (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="14" fill="url(#pl1)" opacity="0.15"/>
      <path d="M12 20h3l2.5-5 3 10 2.5-8 2 3h3" stroke="url(#pl1)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <defs>
        <linearGradient id="pl1" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6EE7B7"/><stop offset="1" stopColor="#10B981"/>
        </linearGradient>
      </defs>
    </svg>
  ),
}

interface NexusAgentAvatarProps {
  agentId: AgentId
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showGlow?: boolean
  className?: string
}

const SIZE_MAP = {
  sm: { outer: 'w-9 h-9', inner: 32 },
  md: { outer: 'w-12 h-12', inner: 40 },
  lg: { outer: 'w-16 h-16', inner: 56 },
  xl: { outer: 'w-24 h-24', inner: 80 },
}

export function NexusAgentAvatar({ agentId, size = 'md', showGlow = false, className = '' }: NexusAgentAvatarProps) {
  const colors = AGENT_COLORS[agentId] || AGENT_COLORS['nex']
  const sz = SIZE_MAP[size]
  const hasImage = false // flip to true when real assets are loaded

  return (
    <div
      className={`${sz.outer} rounded-xl flex items-center justify-center relative shrink-0 ${className}`}
      style={{
        background: colors.gradient,
        boxShadow: showGlow ? `0 0 20px ${colors.glow}` : undefined,
      }}
    >
      {hasImage ? (
        <Image
          src={`/agents/${agentId}.webp`}
          alt={agentId}
          width={sz.inner}
          height={sz.inner}
          className="rounded-xl object-cover"
        />
      ) : (
        <div className="w-3/4 h-3/4">
          {AGENT_SVGS[agentId]}
        </div>
      )}
    </div>
  )
}
