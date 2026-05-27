import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="text-center max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M7 7L14 21L21 7" stroke="#080807" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 7H21" stroke="#080807" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* 404 */}
        <div className="text-8xl font-black text-accent/20 mb-2 leading-none tracking-tight">404</div>
        <h1 className="text-2xl font-bold text-white mb-3">Page not found</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition text-sm"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="px-6 py-3 border border-dark-tertiary text-gray-400 font-semibold rounded-xl hover:border-accent/40 hover:text-white transition text-sm"
          >
            Back to Home
          </Link>
        </div>

      </div>
    </div>
  )
}
