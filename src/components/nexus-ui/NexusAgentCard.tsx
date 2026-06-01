'use client'
import React from 'react'
import Link from 'next/link'
import { NexusAgentAvatar, AgentId } from './NexusAgentAvatar'

interface NexusAgentCardProps {
  agentId: AgentId
  name: string
  role: string
  statusLabel: string
  statusActive?: boolean
  href: string
  accentColor: string
  launchLabel?: string
}

export function NexusAgentCard({
  agentId,
  name,
  role,
  statusLabel,
  statusActive = true,
  href,
  accentColor,
  launchLabel = 'Launch',
}: NexusAgentCardProps) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl p-4 relative overflow-hidden transition-all duration-300"
      style={{
        background: 'rgba(12,13,36,0.65)',
        border: `1px solid ${accentColor}20`,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.background = 'rgba(17,19,48,0.85)'
        el.style.borderColor = `${accentColor}45`
        el.style.boxShadow = `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${accentColor}18`
        el.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.background = 'rgba(12,13,36,0.65)'
        el.style.borderColor = `${accentColor}20`
        el.style.boxShadow = ''
        el.style.transform = ''
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-10 pointer-events-none transition-opacity duration-300 group-hover:opacity-20"
        style={{ background: accentColor }}
      />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <NexusAgentAvatar agentId={agentId} size="md" />
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: statusActive ? '#10B981' : accentColor,
                boxShadow: `0 0 5px ${statusActive ? '#10B981' : accentColor}`,
              }}
            />
            <span className="text-[9px] font-semibold uppercase tracking-wide"
              style={{ color: statusActive ? '#10B981' : accentColor }}>
              {statusLabel}
            </span>
          </div>
        </div>

        <p className="font-bold text-sm mb-0.5 font-heading" style={{ color: accentColor }}>{name}</p>
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--nx-text-3)' }}>{role}</p>

        <div
          className="flex items-center gap-1 mt-3 text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ color: accentColor }}
        >
          {launchLabel}
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M7 7h10v10" />
          </svg>
        </div>
      </div>
    </Link>
  )
}
