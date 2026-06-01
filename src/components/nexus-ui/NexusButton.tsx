'use client'
import React from 'react'
import Link from 'next/link'

type Variant = 'primary' | 'orange' | 'ghost' | 'subtle' | 'danger'
type Size = 'xs' | 'sm' | 'md' | 'lg'

interface NexusButtonProps {
  children: React.ReactNode
  variant?: Variant
  size?: Size
  href?: string
  onClick?: () => void
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit' | 'reset'
  icon?: React.ReactNode
  iconRight?: React.ReactNode
  fullWidth?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'nx-btn-primary',
  orange:  'nx-btn-orange',
  ghost:   'nx-btn-ghost',
  subtle:  'bg-white/5 text-nx-text-2 hover:bg-white/10 hover:text-nx-text-1 border border-white/8 rounded-xl transition-all',
  danger:  'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 rounded-xl transition-all',
}

const SIZES: Record<Size, string> = {
  xs: 'text-[11px] px-3 py-1.5 gap-1.5',
  sm: 'text-xs px-3.5 py-2 gap-1.5',
  md: 'text-sm px-5 py-2.5 gap-2',
  lg: 'text-base px-6 py-3 gap-2.5',
}

export function NexusButton({
  children,
  variant = 'primary',
  size = 'md',
  href,
  onClick,
  disabled,
  className = '',
  type = 'button',
  icon,
  iconRight,
  fullWidth,
}: NexusButtonProps) {
  const cls = [
    'inline-flex items-center justify-center font-bold transition-all',
    VARIANTS[variant],
    SIZES[size],
    fullWidth ? 'w-full' : '',
    disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
    className,
  ].filter(Boolean).join(' ')

  const content = (
    <>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
      {iconRight && <span className="shrink-0">{iconRight}</span>}
    </>
  )

  if (href) return <Link href={href} className={cls}>{content}</Link>
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled}>
      {content}
    </button>
  )
}
