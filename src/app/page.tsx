import Link from 'next/link'

const FEATURES = [
  { icon: '🧠', title: 'AI Marketing Strategy', desc: 'Full positioning, audience analysis, value props, and platform playbook — generated in seconds.' },
  { icon: '🎣', title: 'Hook & Script Library', desc: '10+ proven opening hooks and full video scripts for every concept, ready to record.' },
  { icon: '✍️', title: 'Platform-Native Captions', desc: 'Instagram, TikTok, LinkedIn, Facebook — each caption optimized for its platform algorithm.' },
  { icon: '📅', title: '30-Day Content Calendar', desc: 'A complete posting schedule with content types, formats, and angles for every day.' },
  { icon: '💡', title: '5 Ad Concepts Per Campaign', desc: 'Different angles, tones, and formats — giving you a full testing matrix from day one.' },
  { icon: '⚡', title: 'Instant Generation', desc: 'Fill in 4 fields and get a complete marketing campaign in under 30 seconds.' },
]

const STEPS = [
  { num: '01', title: 'Describe Your Campaign', desc: 'Name, goal, audience, tone, and platforms. Takes 60 seconds.' },
  { num: '02', title: 'AI Does The Work', desc: 'NEXUS generates your full strategy, hooks, scripts, captions, and calendar.' },
  { num: '03', title: 'Copy, Post, Grow', desc: 'Everything is ready to use. No editing needed. Just execute.' },
]

const PLANS = [
  {
    name: 'Starter',
    price: '$19',
    period: '/month',
    desc: 'Perfect for solo creators and small businesses',
    features: ['10 campaigns/month', '50 AI generations', 'All platforms', 'Content calendar', 'Email support'],
    cta: 'Start Free Trial',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    desc: 'For growing brands that need more',
    features: ['Unlimited campaigns', '500 AI generations', 'All platforms', 'PDF exports', 'Priority support', 'Custom brand tone'],
    cta: 'Start Free Trial',
    highlight: true,
  },
  {
    name: 'Agency',
    price: '$149',
    period: '/month',
    desc: 'For agencies managing multiple clients',
    features: ['Unlimited everything', 'Multiple workspaces', 'Team collaboration', 'White-label exports', 'Dedicated support', 'API access'],
    cta: 'Contact Sales',
    highlight: false,
  },
]

const TESTIMONIALS = [
  { name: 'Sarah K.', role: 'E-commerce founder', quote: 'I used to spend 3 days planning a campaign. NEXUS does it in 30 seconds. The hooks are better than what my copywriter wrote.', avatar: 'SK' },
  { name: 'Marcus T.', role: 'Marketing agency owner', quote: 'We use NEXUS for every client brief now. The strategy output is genuinely impressive — clients think we hired a senior strategist.', avatar: 'MT' },
  { name: 'Leila A.', role: 'SaaS founder', quote: 'Finally a tool that gives me the full picture — not just captions, but the WHY behind each piece of content. Game changer.', avatar: 'LA' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-dark-secondary to-dark-tertiary text-white">

      {/* NAV */}
      <nav className="border-b border-dark-tertiary bg-dark/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-accent">NEXUS</div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#how" className="hover:text-white transition">How it works</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-gray-400 hover:text-white transition px-3 py-2">
              Login
            </Link>
            <Link href="/auth/register" className="text-sm px-5 py-2 bg-accent text-dark font-bold rounded-lg hover:bg-accent-light transition">
              Start Free →
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-7xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/30 text-accent text-sm font-semibold px-4 py-2 rounded-full mb-8">
            <span>⚡</span> AI-powered marketing in 30 seconds
          </div>
          <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight tracking-tight">
            Your AI<br />
            <span className="text-accent">Marketing Team</span>
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            NEXUS generates complete marketing campaigns — strategy, hooks, scripts, captions, and a 30-day content calendar — in under 30 seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/auth/register" className="px-8 py-4 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition text-lg">
              Generate Your First Campaign →
            </Link>
            <a href="#how" className="px-8 py-4 border border-dark-tertiary text-gray-300 rounded-xl hover:border-accent/50 hover:text-white transition text-lg">
              See How It Works
            </a>
          </div>

          {/* Social Proof Bar */}
          <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-400">
            <div><span className="text-white font-bold text-2xl">500+</span><br />campaigns generated</div>
            <div className="w-px bg-dark-tertiary" />
            <div><span className="text-white font-bold text-2xl">30s</span><br />average generation time</div>
            <div className="w-px bg-dark-tertiary" />
            <div><span className="text-white font-bold text-2xl">5</span><br />platforms supported</div>
            <div className="w-px bg-dark-tertiary" />
            <div><span className="text-white font-bold text-2xl">$0</span><br />to get started</div>
          </div>
        </div>
      </section>

      {/* PRODUCT PREVIEW */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl overflow-hidden shadow-2xl">
          {/* Fake browser bar */}
          <div className="bg-dark border-b border-dark-tertiary px-4 py-3 flex items-center gap-2">
            <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500/60" /><div className="w-3 h-3 rounded-full bg-yellow-500/60" /><div className="w-3 h-3 rounded-full bg-green-500/60" /></div>
            <div className="flex-1 mx-4 bg-dark-tertiary rounded-md px-3 py-1 text-xs text-gray-500">app.nexus-ai.com/campaign/results</div>
          </div>
          {/* Fake content */}
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-sm font-semibold">AI Generation Complete</span>
              <span className="text-gray-500 text-sm">— Summer Sale Campaign</span>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[['5', 'Ad Concepts'], ['15', 'Hooks'], ['8', 'Captions'], ['30 days', 'Calendar']].map(([v, l]) => (
                <div key={l} className="bg-dark rounded-xl p-3 border border-dark-tertiary text-center">
                  <div className="text-accent font-bold text-lg">{v}</div>
                  <div className="text-xs text-gray-400">{l}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {['🧠 Strategy', '🎣 Hooks & Scripts', '✍️ Captions', '📅 Content Calendar', '💡 All Concepts'].map((tab, i) => (
                <div key={tab} className={`px-4 py-2 rounded-lg text-sm font-semibold ${i === 0 ? 'bg-accent text-dark' : 'text-gray-400'}`}>{tab}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Everything your marketing needs</h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">No more blank page. No more guessing. NEXUS delivers a complete campaign system every time.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6 hover:border-accent/40 transition group">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-bold mb-2 group-hover:text-accent transition">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Launch a campaign in 3 steps</h2>
          <p className="text-gray-400 text-lg">No marketing degree required.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <div key={step.num} className="relative">
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-accent/40 to-transparent z-10" />
              )}
              <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-8">
                <div className="text-5xl font-black text-accent/20 mb-4">{step.num}</div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Marketers love NEXUS</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map(t => (
            <div key={t.name} className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
              <p className="text-gray-300 text-sm leading-relaxed mb-6">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-bold">{t.avatar}</div>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Simple, transparent pricing</h2>
          <p className="text-gray-400 text-lg">Start free. Upgrade when you're ready.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {PLANS.map(plan => (
            <div key={plan.name} className={`rounded-2xl p-8 border-2 relative ${plan.highlight ? 'border-accent bg-accent/5' : 'border-dark-tertiary bg-dark-secondary'}`}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-dark text-xs font-bold px-4 py-1 rounded-full">MOST POPULAR</div>
              )}
              <div className="mb-6">
                <div className="font-bold text-xl mb-1">{plan.name}</div>
                <div className="text-gray-400 text-sm mb-4">{plan.desc}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black">{plan.price}</span>
                  <span className="text-gray-400">{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                    <span className="text-accent">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/register"
                className={`block w-full text-center py-3 rounded-xl font-bold transition ${plan.highlight ? 'bg-accent text-dark hover:bg-accent-light' : 'bg-dark-tertiary hover:bg-dark-tertiary/70'}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-gray-500 text-sm mt-8">All plans start with a 7-day free trial. No credit card required.</p>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="bg-gradient-to-r from-accent/20 via-accent/10 to-accent/20 border border-accent/30 rounded-3xl p-16">
          <h2 className="text-5xl font-bold mb-4">Your next campaign<br />starts now.</h2>
          <p className="text-gray-400 text-lg mb-8">Join hundreds of brands using NEXUS to move faster and market smarter.</p>
          <Link href="/auth/register" className="inline-block px-10 py-4 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition text-lg">
            Generate Your First Campaign — Free →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-dark-tertiary">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-accent font-bold text-xl">NEXUS</div>
          <p className="text-gray-500 text-sm">© 2024 NEXUS AI. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-white transition">Privacy</a>
            <a href="#" className="hover:text-white transition">Terms</a>
            <Link href="/auth/login" className="hover:text-white transition">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
