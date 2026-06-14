'use client'

/**
 * Strategy PR-2B2A — premium, calm collapsible section wrapper for the Strategy tab.
 *
 * Pure presentation. Wraps a strategy detail section in a restrained card with a
 * quiet header the user can expand/collapse. Defaults to open on desktop; long
 * detail sections pass defaultOpen={false} to reduce scrolling without hiding
 * critical context. No heavy gradients, no loud colors — matches the existing
 * NEXUS dark design language (soft borders, subtle surface).
 */

import { useState, type ReactNode } from 'react'

interface StrategySectionProps {
  /** Quiet section title (already localized by the caller). */
  title: string
  /** Optional small muted subtitle / count. */
  hint?: string
  /** Optional single emoji/icon. Kept optional to avoid icon clutter. */
  icon?: ReactNode
  /** Expanded by default (desktop). Long detail sections pass false. */
  defaultOpen?: boolean
  /** When true the section cannot be collapsed (always-open critical context). */
  locked?: boolean
  children: ReactNode
}

export default function StrategySection({
  title,
  hint,
  icon,
  defaultOpen = true,
  locked = false,
  children,
}: StrategySectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const isOpen = locked || open

  return (
    <section
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(10,11,28,0.55)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <button
        type="button"
        onClick={() => !locked && setOpen(o => !o)}
        aria-expanded={isOpen}
        disabled={locked}
        className="w-full flex items-center gap-2.5 px-5 py-3.5 text-left transition-colors"
        style={{ cursor: locked ? 'default' : 'pointer' }}
      >
        {icon ? <span className="text-sm flex-shrink-0 opacity-80">{icon}</span> : null}
        <span className="text-[13px] font-semibold tracking-tight text-gray-100 flex-1">{title}</span>
        {hint ? <span className="text-[11px] text-gray-500 font-normal">{hint}</span> : null}
        {!locked && (
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            className="flex-shrink-0 text-gray-500 transition-transform duration-200"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      {isOpen && (
        <div className="px-5 pb-5 pt-0.5">
          {children}
        </div>
      )}
    </section>
  )
}
