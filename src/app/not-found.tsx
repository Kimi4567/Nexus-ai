import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 text-slate-950">
      <div className="text-center max-w-md rounded-2xl border border-slate-200 bg-white px-8 py-9 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M7 7L14 21L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 7H21" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* 404 */}
        <div className="text-8xl font-black text-blue-100 mb-2 leading-none tracking-tight">404</div>
        <h1 className="text-2xl font-bold text-slate-950 mb-3">Page not found</h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-blue-600 text-[color:#fff] font-bold rounded-xl hover:bg-blue-700 transition text-sm"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="px-6 py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:border-slate-300 hover:text-slate-950 hover:bg-slate-50 transition text-sm"
          >
            Back to Home
          </Link>
        </div>

      </div>
    </div>
  )
}
