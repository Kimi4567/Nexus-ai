import Link from 'next/link'

export const metadata = { title: 'Terms of Service | NEXUS AI' }

export default function TermsPage() {
  const year = new Date().getFullYear()

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-dark-secondary to-dark-tertiary">
      {/* Nav */}
      <nav className="border-b border-dark-tertiary bg-dark/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-accent">NEXUS</Link>
          <Link href="/auth/login" className="text-sm text-gray-400 hover:text-white transition">Sign In →</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-400 mb-10">Last updated: January 1, {year}</p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using NEXUS AI ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Service. We reserve the right to update these terms at any time with notice provided via email or in-app notification.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Description of Service</h2>
            <p>NEXUS AI is an AI-powered marketing platform that generates marketing strategies, ad concepts, scripts, captions, and content calendars. The Service is provided on a subscription basis with different plan tiers offering varying levels of access and usage limits.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Account Registration</h2>
            <p>You must create an account to use the Service. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate and complete information during registration.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Subscription and Billing</h2>
            <p>Paid subscriptions are billed in advance on a monthly basis. You may cancel your subscription at any time; cancellation takes effect at the end of the current billing period. Refunds are not provided for partial months. We reserve the right to change pricing with 30 days notice.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Acceptable Use</h2>
            <p>You agree not to use the Service to generate content that is illegal, harmful, deceptive, or violates any third-party rights. You may not use the Service to generate spam, misleading advertising, or content that violates platform policies of any social media network. We reserve the right to suspend accounts for violations.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Intellectual Property</h2>
            <p>You retain ownership of all content you input into the Service. AI-generated content produced by the Service using your inputs is yours to use for your marketing purposes. NEXUS AI retains all rights to the platform, technology, and underlying AI systems.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Disclaimer of Warranties</h2>
            <p>The Service is provided "as is" without warranty of any kind. We do not guarantee that AI-generated content will be accurate, complete, or suitable for your specific needs. Marketing results vary and we make no guarantees about business outcomes from using our Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, NEXUS AI shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service. Our total liability to you shall not exceed the amount paid by you in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">9. Contact</h2>
            <p>For questions about these Terms, contact us at <a href="mailto:legal@nexus-ai.app" className="text-accent hover:text-accent-light transition">legal@nexus-ai.app</a>.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-dark-tertiary flex gap-6 text-sm text-gray-500">
          <Link href="/" className="hover:text-white transition">← Home</Link>
          <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
        </div>
      </div>
    </div>
  )
}
