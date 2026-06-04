'use client'

/**
 * PlatformNativeCard — renders a calendar post item as a pixel-authentic
 * preview of the target platform's native post UI.
 *
 * Supported platforms:
 *   INSTAGRAM  · TIKTOK  · LINKEDIN  · FACEBOOK  · YOUTUBE  · SNAPCHAT  · TWITTER/X
 *
 * Falls back to a generic dark card for unknown platforms.
 */

import React, { useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CalendarPost {
  id?: string
  platform: string
  date?: string
  week?: number
  topic: string
  title?: string
  hook?: string
  caption?: string
  cta?: string
  visualNote?: string
  contentType?: string
  assetUrl?: string | null
}

interface Props {
  item: CalendarPost
  index?: number
  locale?: string
  /** Brand/account name shown in card header */
  brandName?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizePlatform(raw: string): string {
  const p = (raw || '').toUpperCase()
  if (p.includes('INSTAGRAM')) return 'INSTAGRAM'
  if (p.includes('TIKTOK')) return 'TIKTOK'
  if (p.includes('LINKEDIN')) return 'LINKEDIN'
  if (p.includes('FACEBOOK') || p.includes('META')) return 'FACEBOOK'
  if (p.includes('YOUTUBE')) return 'YOUTUBE'
  if (p.includes('SNAPCHAT') || p.includes('SNAP')) return 'SNAPCHAT'
  if (p.includes('TWITTER') || p.includes(' X ') || p === 'X') return 'TWITTER'
  if (p.includes('GOOGLE')) return 'GOOGLE'
  return 'GENERAL'
}

function formatDate(dateStr: string | undefined, week: number | undefined, index: number, locale: string): string {
  if (dateStr) {
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      })
    }
    return dateStr
  }
  return locale === 'ar' ? `الأسبوع ${week || index + 1}` : `Week ${week || index + 1}`
}

function truncate(str: string | undefined | null, len: number): string {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '…' : str
}

// ─────────────────────────────────────────────────────────────────────────────
// Media placeholder
// ─────────────────────────────────────────────────────────────────────────────

function MediaArea({ assetUrl, visualNote, aspect, className = '' }: {
  assetUrl?: string | null
  visualNote?: string
  aspect?: string
  className?: string
}) {
  if (assetUrl) {
    const isVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(assetUrl)
    if (isVideo) {
      return (
        <div className={`relative overflow-hidden ${aspect || 'aspect-square'} ${className}`}>
          <video src={assetUrl} className="w-full h-full object-cover" muted playsInline />
        </div>
      )
    }
    return (
      <div className={`relative overflow-hidden ${aspect || 'aspect-square'} ${className}`}>
        <img src={assetUrl} alt="" className="w-full h-full object-cover" />
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden flex items-center justify-center ${aspect || 'aspect-square'} ${className}`}
      style={{ background: 'linear-gradient(135deg, #0d0d1a 0%, #1a0d2e 100%)' }}>
      <div className="text-center px-4 py-2">
        <div className="text-3xl mb-2 opacity-40">🎨</div>
        <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-3">
          {truncate(visualNote, 80) || 'AI visual planned'}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform-specific cards
// ─────────────────────────────────────────────────────────────────────────────

/** ── INSTAGRAM ── */
function InstagramCard({ item, locale, brandName }: { item: CalendarPost; locale: string; brandName: string }) {
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const likes = 847 + (item.id ? parseInt(item.id.replace(/\D/g, '').slice(-3) || '0', 10) % 300 : 0)

  return (
    <div className="rounded-2xl overflow-hidden w-full"
      style={{ background: '#000', border: '1px solid rgba(255,255,255,0.1)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Avatar with gradient ring */}
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-full p-[2px]"
            style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}>
            <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
              <span className="text-xs font-bold text-white">{brandName.slice(0, 1).toUpperCase()}</span>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white leading-none truncate">{brandName}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">{formatDate(item.date, item.week, 0, locale)}</p>
        </div>
        {/* Dots */}
        <button className="text-white text-xl leading-none px-1">···</button>
      </div>

      {/* Image */}
      <MediaArea assetUrl={item.assetUrl} visualNote={item.visualNote} aspect="aspect-square" className="w-full" />

      {/* Action bar */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <button onClick={() => setLiked(l => !l)} className="transition-transform active:scale-110">
              {liked
                ? <svg viewBox="0 0 24 24" className="w-6 h-6 fill-red-500"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.53L12 21.35z" /></svg>
                : <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-white fill-none" strokeWidth="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.53L12 21.35z" /></svg>
              }
            </button>
            <button>
              <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-white fill-none" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <button>
              <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-white fill-none" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <button onClick={() => setSaved(s => !s)}>
            {saved
              ? <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
              : <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-white fill-none" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
            }
          </button>
        </div>

        <p className="text-[13px] font-semibold text-white mb-1">{(liked ? likes + 1 : likes).toLocaleString()} likes</p>

        {/* Caption */}
        <p className="text-[13px] text-white leading-snug">
          <span className="font-semibold mr-1">{brandName}</span>
          <span className="text-gray-200">{truncate(item.hook || item.topic, 90)}</span>
        </p>
        {item.caption && (
          <p className="text-[12px] text-gray-400 mt-1 leading-relaxed line-clamp-2">{truncate(item.caption, 100)}</p>
        )}
        {item.cta && (
          <p className="text-[12px] font-semibold mt-1" style={{ color: '#a78bfa' }}>{item.cta}</p>
        )}
        <p className="text-[11px] text-gray-600 mt-1.5 uppercase tracking-wide">
          {item.contentType || 'Post'}
        </p>
      </div>

      {/* Bottom bar */}
      <div className="px-3 pb-3 flex items-center gap-2">
        <div className="w-5 h-5 rounded-full flex-shrink-0"
          style={{ background: 'linear-gradient(45deg, #6366f1, #ec4899)' }} />
        <input readOnly value={locale === 'ar' ? 'أضف تعليقاً…' : 'Add a comment…'}
          className="flex-1 text-[12px] text-gray-600 bg-transparent outline-none cursor-default" />
      </div>
    </div>
  )
}

/** ── TIKTOK ── */
function TikTokCard({ item, locale, brandName }: { item: CalendarPost; locale: string; brandName: string }) {
  const [liked, setLiked] = useState(false)
  const likes = 12400 + (item.id ? parseInt(item.id.replace(/\D/g, '').slice(-3) || '0', 10) % 8000 : 0)
  const comments = 342 + (item.id ? parseInt(item.id.replace(/\D/g, '').slice(-2) || '0', 10) % 200 : 0)
  const shares = 89 + (item.id ? parseInt(item.id.replace(/\D/g, '').slice(-1) || '0', 10) % 50 : 0)

  return (
    <div className="rounded-2xl overflow-hidden w-full relative"
      style={{ background: '#000', border: '1px solid rgba(255,255,255,0.08)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', minHeight: 340 }}>

      {/* Background media — full card */}
      <div className="absolute inset-0">
        <MediaArea assetUrl={item.assetUrl} visualNote={item.visualNote} aspect="" className="absolute inset-0 w-full h-full" />
        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.85) 100%)' }} />
        {/* Top gradient */}
        <div className="absolute top-0 left-0 right-0 h-20" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)' }} />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-3 pt-3 pb-1">
        <div className="flex gap-4">
          <button className="text-white text-[13px] font-medium opacity-60">
            {locale === 'ar' ? 'متابَعون' : 'Following'}
          </button>
          <button className="text-white text-[13px] font-bold border-b-2 border-white pb-0.5">
            {locale === 'ar' ? 'لك' : 'For You'}
          </button>
        </div>
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
      </div>

      {/* Right action column */}
      <div className="absolute right-3 bottom-24 z-10 flex flex-col items-center gap-5">
        {/* Avatar */}
        <div className="relative">
          <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #06b6d4, #f43f5e)' }}>
            <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white">
              {brandName.slice(0, 1).toUpperCase()}
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <span className="text-white text-[10px] leading-none">+</span>
          </div>
        </div>

        {/* Like */}
        <button onClick={() => setLiked(l => !l)} className="flex flex-col items-center gap-0.5">
          <div className="w-10 h-10 flex items-center justify-center">
            {liked
              ? <svg viewBox="0 0 24 24" className="w-7 h-7 fill-red-500"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.53L12 21.35z" /></svg>
              : <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.53L12 21.35z" /></svg>
            }
          </div>
          <span className="text-white text-[11px] font-semibold">{((liked ? likes + 1 : likes) / 1000).toFixed(1)}K</span>
        </button>

        {/* Comment */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-10 h-10 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          </div>
          <span className="text-white text-[11px] font-semibold">{comments}</span>
        </div>

        {/* Share */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-10 h-10 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="white" strokeWidth="2">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </div>
          <span className="text-white text-[11px] font-semibold">{shares}</span>
        </div>

        {/* Spinning record */}
        <div className="w-8 h-8 rounded-full border-2 border-gray-700 overflow-hidden flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #111, #333)', animation: 'spin 4s linear infinite' }}>
          <div className="w-2 h-2 rounded-full bg-gray-400" />
        </div>
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-4 pr-16">
        <p className="text-white font-bold text-[14px] mb-1">@{brandName.toLowerCase().replace(/\s/g, '_')}</p>
        <p className="text-white text-[13px] leading-snug mb-2 line-clamp-3">
          {item.hook || item.topic}
        </p>
        {item.cta && (
          <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-full">
            <span className="text-white text-[12px] font-semibold">{item.cta}</span>
          </div>
        )}

        {/* Music ticker */}
        <div className="flex items-center gap-2 mt-2">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white flex-shrink-0">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
          <p className="text-white text-[11px] truncate opacity-80">
            {item.contentType || 'original sound'} · {brandName}
          </p>
        </div>
      </div>

      {/* Date pill */}
      <div className="absolute top-12 left-3 z-10">
        <span className="text-[10px] px-2 py-1 rounded-full text-white"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          {formatDate(item.date, item.week, 0, locale)}
        </span>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

/** ── LINKEDIN ── */
function LinkedInCard({ item, locale, brandName }: { item: CalendarPost; locale: string; brandName: string }) {
  const [liked, setLiked] = useState(false)
  const reactions = 234 + (item.id ? parseInt(item.id.replace(/\D/g, '').slice(-2) || '0', 10) % 100 : 0)
  const comments = 18 + (item.id ? parseInt(item.id.replace(/\D/g, '').slice(-1) || '0', 10) % 20 : 0)

  return (
    <div className="rounded-2xl overflow-hidden w-full"
      style={{ background: '#1b1f23', border: '1px solid rgba(255,255,255,0.1)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-lg"
          style={{ background: 'linear-gradient(135deg, #0077b5, #00a0dc)' }}>
          {brandName.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-white leading-none">{brandName}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-tight line-clamp-1">
            {locale === 'ar' ? 'شركة · قطاع التسويق الرقمي' : 'Company · Digital Marketing'}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {formatDate(item.date, item.week, 0, locale)} · 🌐
          </p>
        </div>
        {/* Follow button */}
        <button className="text-[13px] font-semibold px-4 py-1.5 rounded-full border"
          style={{ color: '#0077b5', borderColor: '#0077b5' }}>
          + {locale === 'ar' ? 'متابعة' : 'Follow'}
        </button>
      </div>

      {/* Caption */}
      <div className="px-4 pb-3">
        <p className="text-[14px] text-gray-200 leading-relaxed">
          {truncate(item.hook || item.topic, 140)}
        </p>
        {item.caption && (
          <p className="text-[13px] text-gray-400 mt-2 leading-relaxed line-clamp-3">{truncate(item.caption, 160)}</p>
        )}
        {item.cta && (
          <p className="text-[13px] font-semibold mt-2" style={{ color: '#0077b5' }}>{item.cta}</p>
        )}
      </div>

      {/* Image */}
      {(item.assetUrl || item.visualNote) && (
        <MediaArea assetUrl={item.assetUrl} visualNote={item.visualNote} aspect="aspect-video" className="w-full" />
      )}

      {/* Reaction count */}
      <div className="px-4 py-2 flex items-center justify-between border-t border-b"
        style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1">
            {['👍', '❤️', '💡'].map((e, i) => (
              <div key={i} className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                style={{ background: '#2a2f35', border: '1px solid #1b1f23', zIndex: 3 - i }}>
                {e}
              </div>
            ))}
          </div>
          <span className="text-[12px] text-gray-500">{liked ? reactions + 1 : reactions}</span>
        </div>
        <span className="text-[12px] text-gray-500">
          {comments} {locale === 'ar' ? 'تعليق' : 'comments'}
        </span>
      </div>

      {/* Actions */}
      <div className="px-2 py-1 grid grid-cols-4">
        {[
          { icon: '👍', label: locale === 'ar' ? 'إعجاب' : 'Like', action: () => setLiked(l => !l), active: liked },
          { icon: '💬', label: locale === 'ar' ? 'تعليق' : 'Comment', action: () => {}, active: false },
          { icon: '🔁', label: locale === 'ar' ? 'إعادة نشر' : 'Repost', action: () => {}, active: false },
          { icon: '📤', label: locale === 'ar' ? 'إرسال' : 'Send', action: () => {}, active: false },
        ].map(btn => (
          <button key={btn.label} onClick={btn.action}
            className="flex flex-col items-center gap-0.5 py-2 rounded-lg text-[11px] transition-colors hover:bg-white/5"
            style={{ color: btn.active ? '#0077b5' : '#9ca3af' }}>
            <span className="text-base">{btn.icon}</span>
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** ── FACEBOOK ── */
function FacebookCard({ item, locale, brandName }: { item: CalendarPost; locale: string; brandName: string }) {
  const [liked, setLiked] = useState(false)
  const reactions = 1200 + (item.id ? parseInt(item.id.replace(/\D/g, '').slice(-3) || '0', 10) % 500 : 0)
  const comments = 56 + (item.id ? parseInt(item.id.replace(/\D/g, '').slice(-1) || '0', 10) % 30 : 0)
  const shares = 23 + (item.id ? parseInt(item.id.replace(/\D/g, '').slice(-1) || '0', 10) % 10 : 0)

  return (
    <div className="rounded-2xl overflow-hidden w-full"
      style={{ background: '#242526', border: '1px solid rgba(255,255,255,0.1)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold"
          style={{ background: 'linear-gradient(135deg, #1877f2, #42a0ff)' }}>
          {brandName.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-white">{brandName}</p>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span>{formatDate(item.date, item.week, 0, locale)}</span>
            <span>·</span>
            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-gray-500">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
          </div>
        </div>
        <button className="text-gray-400 text-xl">···</button>
      </div>

      {/* Caption */}
      <div className="px-4 pb-3">
        <p className="text-[14px] text-gray-200 leading-relaxed">
          {truncate(item.hook || item.topic, 150)}
        </p>
        {item.caption && (
          <p className="text-[13px] text-gray-400 mt-1 line-clamp-2">{truncate(item.caption, 120)}</p>
        )}
        {item.cta && (
          <p className="text-[13px] font-semibold mt-2" style={{ color: '#1877f2' }}>{item.cta}</p>
        )}
      </div>

      {/* Image */}
      <MediaArea assetUrl={item.assetUrl} visualNote={item.visualNote} aspect="aspect-video" className="w-full" />

      {/* Reactions row */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-0.5">
            {['👍', '❤️', '😮'].map((e, i) => (
              <div key={i} className="w-5 h-5 rounded-full text-[12px] flex items-center justify-center"
                style={{ background: '#3a3b3c', border: '2px solid #242526', zIndex: 3 - i }}>
                {e}
              </div>
            ))}
          </div>
          <span className="text-[12px] text-gray-500">{liked ? reactions + 1 : reactions}</span>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-gray-500">
          <span>{comments} {locale === 'ar' ? 'تعليق' : 'comments'}</span>
          <span>{shares} {locale === 'ar' ? 'مشاركة' : 'shares'}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="border-t border-b mx-3 grid grid-cols-3 py-1"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        {[
          { icon: '👍', label: locale === 'ar' ? 'إعجاب' : 'Like', action: () => setLiked(l => !l), active: liked },
          { icon: '💬', label: locale === 'ar' ? 'تعليق' : 'Comment', action: () => {}, active: false },
          { icon: '↗', label: locale === 'ar' ? 'مشاركة' : 'Share', action: () => {}, active: false },
        ].map(btn => (
          <button key={btn.label} onClick={btn.action}
            className="flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-semibold transition-colors hover:bg-white/5"
            style={{ color: btn.active ? '#1877f2' : '#9ca3af' }}>
            <span>{btn.icon}</span> {btn.label}
          </button>
        ))}
      </div>

      {/* Comment box */}
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
          style={{ background: '#4e4f50' }}>N</div>
        <div className="flex-1 rounded-full px-3 py-1.5 text-[13px] text-gray-500 cursor-default"
          style={{ background: '#3a3b3c' }}>
          {locale === 'ar' ? 'اكتب تعليقاً…' : 'Write a comment…'}
        </div>
      </div>
    </div>
  )
}

/** ── YOUTUBE SHORTS ── */
function YouTubeCard({ item, locale, brandName }: { item: CalendarPost; locale: string; brandName: string }) {
  const [liked, setLiked] = useState(false)
  const views = 45000 + (item.id ? parseInt(item.id.replace(/\D/g, '').slice(-3) || '0', 10) % 20000 : 0)
  const likes = 2300 + (item.id ? parseInt(item.id.replace(/\D/g, '').slice(-2) || '0', 10) % 1000 : 0)
  const comments = 87 + (item.id ? parseInt(item.id.replace(/\D/g, '').slice(-1) || '0', 10) % 40 : 0)

  return (
    <div className="rounded-2xl overflow-hidden w-full relative"
      style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.08)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', minHeight: 300 }}>

      {/* Background */}
      <div className="absolute inset-0">
        <MediaArea assetUrl={item.assetUrl} visualNote={item.visualNote} aspect="" className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.9) 100%)' }} />
      </div>

      {/* YouTube Shorts logo */}
      <div className="relative z-10 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: '#ff0000' }}>
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white"><path d="M8 5v14l11-7z" /></svg>
            </div>
            <span className="text-white text-[13px] font-bold">Shorts</span>
          </div>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full text-white"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          {formatDate(item.date, item.week, 0, locale)}
        </span>
      </div>

      {/* Right sidebar */}
      <div className="absolute right-3 bottom-20 z-10 flex flex-col items-center gap-5">
        <button onClick={() => setLiked(l => !l)} className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5"
              fill={liked ? '#ff0000' : 'white'}>
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.53L12 21.35z" />
            </svg>
          </div>
          <span className="text-white text-[11px]">{((liked ? likes + 1 : likes) / 1000).toFixed(1)}K</span>
        </button>

        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          </div>
          <span className="text-white text-[11px]">{comments}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth="2">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </div>
          <span className="text-white text-[11px]">{locale === 'ar' ? 'مشاركة' : 'Share'}</span>
        </div>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-4 pr-16">
        <p className="text-white font-bold text-[13px] mb-0.5">@{brandName.toLowerCase().replace(/\s/g, '')}</p>
        <p className="text-white text-[13px] leading-snug line-clamp-2">
          {item.hook || item.topic}
        </p>
        <p className="text-gray-400 text-[11px] mt-1">
          {(views / 1000).toFixed(0)}K {locale === 'ar' ? 'مشاهدة' : 'views'}
        </p>
      </div>
    </div>
  )
}

/** ── SNAPCHAT ── */
function SnapchatCard({ item, locale, brandName }: { item: CalendarPost; locale: string; brandName: string }) {
  return (
    <div className="rounded-2xl overflow-hidden w-full relative"
      style={{ background: '#000', border: '1px solid rgba(255,255,255,0.08)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', minHeight: 260 }}>

      <div className="absolute inset-0">
        <MediaArea assetUrl={item.assetUrl} visualNote={item.visualNote} aspect="" className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.7) 100%)' }} />
      </div>

      {/* Snapchat header */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-black"
            style={{ background: '#FFFC00' }}>
            {brandName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="text-white text-[13px] font-bold">{brandName}</p>
          </div>
        </div>
        {/* Snapchat ghost icon */}
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white opacity-80">
            <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.019.09.071.266.195.514.224.46.752.955 1.562 1.427.102.057.225.092.346.155.009.215-.051.512-.319.661a2.897 2.897 0 0 1-.939.265c-.18.044-.355.075-.511.15-.079.038-.168.131-.23.396.077.241.137.488.16.753-.038.279-.178.403-.337.407-.135.003-.271-.042-.398-.109-.215-.113-.434-.211-.647-.17-.144.028-.323.141-.583.376.021.195.048.398.067.586.1.955.186 1.777-.002 2.518-.166.667-.571 1.212-1.062 1.749-.22.239-.469.442-.73.609-.229.146-.461.26-.674.344.047.136.089.264.128.39.091.279.16.541.198.809.052.377.026.697-.071.93-.168.402-.466.56-.733.657-.135.047-.267.085-.392.123-.33.099-.605.204-.813.459a.42.42 0 0 1-.326.157.496.496 0 0 1-.194-.038c-.262-.11-.505-.358-.743-.673-.252-.333-.496-.77-.735-.982-.297-.267-.569-.45-.915-.45-.346 0-.618.183-.915.45-.239.212-.483.649-.735.982-.238.315-.481.563-.743.673a.496.496 0 0 1-.194.038.42.42 0 0 1-.326-.157c-.208-.255-.483-.36-.813-.459-.125-.038-.257-.076-.392-.123-.267-.097-.565-.255-.733-.657-.097-.233-.123-.553-.071-.93.038-.268.107-.53.198-.809.039-.126.081-.254.128-.39a3.285 3.285 0 0 1-.674-.344c-.261-.167-.51-.37-.73-.609-.491-.537-.896-1.082-1.062-1.749-.188-.741-.102-1.563-.002-2.518.019-.188.046-.391.067-.586-.26-.235-.439-.348-.583-.376-.213-.041-.432.057-.647.17-.127.067-.263.112-.398.109-.159-.004-.299-.128-.337-.407.023-.265.083-.512.16-.753-.062-.265-.151-.358-.23-.396-.156-.075-.331-.106-.511-.15a2.897 2.897 0 0 1-.939-.265c-.268-.149-.328-.446-.319-.661.121-.063.244-.098.346-.155.81-.472 1.338-.967 1.562-1.427.124-.248.176-.424.195-.514-.008-.165-.018-.33-.03-.51l-.003-.06c-.104-1.628-.23-3.654.299-4.847C7.859 1.069 11.216.793 12.206.793z" />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-5">
        <p className="text-white text-[14px] font-bold leading-snug mb-1 drop-shadow-lg">
          {truncate(item.hook || item.topic, 80)}
        </p>
        {item.cta && (
          <div className="flex items-center gap-2 mt-2">
            <div className="w-full py-2 rounded-full text-center font-bold text-[13px]"
              style={{ background: '#FFFC00', color: '#000' }}>
              {item.cta}
            </div>
          </div>
        )}
        <p className="text-gray-400 text-[10px] mt-1">{formatDate(item.date, item.week, 0, locale)}</p>
      </div>
    </div>
  )
}

/** ── TWITTER / X ── */
function TwitterCard({ item, locale, brandName }: { item: CalendarPost; locale: string; brandName: string }) {
  const [liked, setLiked] = useState(false)
  const [retweeted, setRetweeted] = useState(false)
  const likes = 847 + (item.id ? parseInt(item.id.replace(/\D/g, '').slice(-2) || '0', 10) % 300 : 0)
  const retweets = 124 + (item.id ? parseInt(item.id.replace(/\D/g, '').slice(-1) || '0', 10) % 50 : 0)
  const views = (12 + (item.id ? parseInt(item.id.replace(/\D/g, '').slice(-1) || '0', 10) % 8 : 0)) * 1000

  return (
    <div className="rounded-2xl overflow-hidden w-full"
      style={{ background: '#000', border: '1px solid rgba(255,255,255,0.12)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold"
            style={{ background: 'linear-gradient(135deg, #1d9bf0, #0063bf)' }}>
            {brandName.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[15px] font-bold text-white leading-none">{brandName}</p>
              {/* Blue checkmark */}
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-blue-400 flex-shrink-0">
                <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91-1.01-1.01-2.52-1.27-3.91-.81C14.65 2.88 13.41 2 12 2s-2.65.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81-1.01 1.01-1.27 2.52-.81 3.91C2.88 9.35 2 10.59 2 12s.88 2.65 2.19 3.34c-.46 1.39-.2 2.9.81 3.91 1.01 1.01 2.52 1.27 3.91.81C9.35 21.12 10.59 22 12 22s2.65-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81 1.01-1.01 1.27-2.52.81-3.91C21.12 14.65 22 13.41 22 12zm-6.28-1.28l-4.5 4.5a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 0 1 1.06-1.06l1.47 1.47 3.97-3.97a.75.75 0 0 1 1.06 1.06z" />
              </svg>
            </div>
            <p className="text-[13px] text-gray-500 mt-0.5">
              @{brandName.toLowerCase().replace(/\s/g, '_')} · {formatDate(item.date, item.week, 0, locale)}
            </p>
          </div>
          {/* X logo */}
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white flex-shrink-0 opacity-80">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.629L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
          </svg>
        </div>

        {/* Tweet content */}
        <p className="text-[16px] text-white leading-relaxed mb-3">
          {truncate(item.hook || item.topic, 200)}
        </p>
        {item.caption && (
          <p className="text-[14px] text-gray-400 mb-3 line-clamp-2">{truncate(item.caption, 120)}</p>
        )}
        {item.cta && (
          <p className="text-[14px] font-semibold mb-3" style={{ color: '#1d9bf0' }}>{item.cta}</p>
        )}

        {/* Attached image */}
        {(item.assetUrl || item.visualNote) && (
          <div className="rounded-xl overflow-hidden mb-3">
            <MediaArea assetUrl={item.assetUrl} visualNote={item.visualNote} aspect="aspect-video" />
          </div>
        )}

        {/* Engagement bar */}
        <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Comment */}
          <button className="flex items-center gap-2 group text-gray-500 hover:text-blue-400 transition-colors">
            <div className="p-1.5 rounded-full group-hover:bg-blue-400/10 transition-colors">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" />
              </svg>
            </div>
            <span className="text-[13px]">
              {(48 + (item.id ? parseInt(item.id.replace(/\D/g, '').slice(-1) || '0', 10) % 20 : 0))}
            </span>
          </button>

          {/* Repost */}
          <button onClick={() => setRetweeted(r => !r)}
            className={`flex items-center gap-2 group transition-colors ${retweeted ? 'text-green-400' : 'text-gray-500 hover:text-green-400'}`}>
            <div className="p-1.5 rounded-full group-hover:bg-green-400/10 transition-colors">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46L18.5 16.45V8c0-1.1-.896-2-2-2z" />
              </svg>
            </div>
            <span className="text-[13px]">{retweeted ? retweets + 1 : retweets}</span>
          </button>

          {/* Like */}
          <button onClick={() => setLiked(l => !l)}
            className={`flex items-center gap-2 group transition-colors ${liked ? 'text-pink-500' : 'text-gray-500 hover:text-pink-500'}`}>
            <div className="p-1.5 rounded-full group-hover:bg-pink-500/10 transition-colors">
              {liked
                ? <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" /></svg>
                : <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" /></svg>
              }
            </div>
            <span className="text-[13px]">{liked ? likes + 1 : likes}</span>
          </button>

          {/* Views */}
          <div className="flex items-center gap-1.5 text-gray-500">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z" />
            </svg>
            <span className="text-[13px]">{(views / 1000).toFixed(0)}K</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** ── GOOGLE ADS ── */
function GoogleAdsCard({ item, locale, brandName }: { item: CalendarPost; locale: string; brandName: string }) {
  return (
    <div className="rounded-2xl overflow-hidden w-full"
      style={{ background: '#202124', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Arial, sans-serif' }}>

      {/* Search bar mockup */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-full"
          style={{ background: '#303134', border: '1px solid rgba(255,255,255,0.1)' }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-gray-500 flex-shrink-0">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <span className="text-gray-400 text-[13px] truncate">{truncate(item.topic, 40)}</span>
        </div>
      </div>

      {/* Ad result */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[11px] px-1.5 py-0.5 rounded border text-gray-300"
            style={{ borderColor: 'rgba(255,255,255,0.3)', background: 'transparent' }}>Ad</span>
          <span className="text-[12px] text-green-500 truncate">nexus-grow.com › {item.contentType || 'campaign'}</span>
        </div>
        <h3 className="text-[18px] font-normal mb-1" style={{ color: '#8ab4f8' }}>
          {truncate(item.title || item.hook || item.topic, 60)}
        </h3>
        <p className="text-[14px] text-gray-300 leading-relaxed line-clamp-3">
          {truncate(item.caption || item.hook || item.visualNote, 140)} {item.cta && `— ${item.cta}`}
        </p>
        {/* Sitelinks */}
        <div className="flex flex-wrap gap-2 mt-3">
          {['Learn More', 'Get Started', 'View Plans', 'Contact Us'].map(link => (
            <span key={link} className="text-[13px] px-2 py-1 rounded"
              style={{ color: '#8ab4f8', background: 'rgba(138,180,248,0.1)', border: '1px solid rgba(138,180,248,0.2)' }}>
              {link}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-gray-600 mt-2">{formatDate(item.date, item.week, 0, locale)}</p>
      </div>
    </div>
  )
}

/** ── GENERIC fallback ── */
function GenericCard({ item, locale, brandName }: { item: CalendarPost; locale: string; brandName: string }) {
  const platform = normalizePlatform(item.platform)

  return (
    <div className="rounded-2xl overflow-hidden w-full"
      style={{ background: 'rgba(10,11,28,0.9)', border: '1px solid rgba(139,92,246,0.25)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <span className="text-base">🌐</span>
        <span className="text-[13px] font-bold text-white capitalize">{platform}</span>
        <span className="ml-auto text-[11px] text-gray-500">{formatDate(item.date, item.week, 0, locale)}</span>
      </div>
      <MediaArea assetUrl={item.assetUrl} visualNote={item.visualNote} aspect="aspect-video" className="w-full" />
      <div className="p-4">
        <p className="text-[14px] font-semibold text-white mb-1">{item.topic}</p>
        {item.hook && <p className="text-[13px] text-purple-300 mb-2">"{item.hook}"</p>}
        {item.caption && <p className="text-[12px] text-gray-400 line-clamp-3">{item.caption}</p>}
        {item.cta && <p className="text-[12px] font-semibold mt-2 text-purple-400">{item.cta}</p>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export default function PlatformNativeCard({ item, index = 0, locale = 'en', brandName = 'NEXUS' }: Props) {
  const platform = normalizePlatform(item.platform)

  switch (platform) {
    case 'INSTAGRAM': return <InstagramCard item={item} locale={locale} brandName={brandName} />
    case 'TIKTOK':    return <TikTokCard    item={item} locale={locale} brandName={brandName} />
    case 'LINKEDIN':  return <LinkedInCard  item={item} locale={locale} brandName={brandName} />
    case 'FACEBOOK':  return <FacebookCard  item={item} locale={locale} brandName={brandName} />
    case 'YOUTUBE':   return <YouTubeCard   item={item} locale={locale} brandName={brandName} />
    case 'SNAPCHAT':  return <SnapchatCard  item={item} locale={locale} brandName={brandName} />
    case 'TWITTER':   return <TwitterCard   item={item} locale={locale} brandName={brandName} />
    case 'GOOGLE':    return <GoogleAdsCard item={item} locale={locale} brandName={brandName} />
    default:          return <GenericCard   item={item} locale={locale} brandName={brandName} />
  }
}
