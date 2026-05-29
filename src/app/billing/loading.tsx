'use client'

export default function Loading() {
  return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Nexus logo spinner */}
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-lg bg-accent/20 animate-pulse" />
          <svg width="40" height="40" viewBox="0 0 28 28" fill="none" className="relative z-10">
            <rect width="28" height="28" rx="7" fill="#FF9500" />
            <path d="M7 7L14 21L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 7H21" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-accent/30 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-[11px] text-t4 font-medium">Loading Nexus...</span>
      </div>
    </div>
  )
}
