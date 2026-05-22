"use client";

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Check, Sparkles, Zap, Crown } from 'lucide-react';

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState('monthly');

  const plans = [
    {
      name: "Free",
      icon: <Sparkles className="h-6 w-6" />,
      price: { monthly: 0, yearly: 0 },
      description: "Perfect for trying out",
      features: [
        "3 videos per month",
        "720p quality",
        "Nexus AI watermark",
        "Basic templates",
        "Community support"
      ],
      cta: "Get Started",
      popular: false
    },
    {
      name: "Starter",
      icon: <Zap className="h-6 w-6" />,
      price: { monthly: 29, yearly: 24 },
      description: "For small businesses",
      features: [
        "20 videos per month",
        "1080p quality",
        "No watermark",
        "All templates",
        "Priority support",
        "Brand colors",
        "Basic analytics"
      ],
      cta: "Start Free Trial",
      popular: true
    },
    {
      name: "Pro",
      icon: <Crown className="h-6 w-6" />,
      price: { monthly: 79, yearly: 66 },
      description: "For growing teams",
      features: [
        "50 videos per month",
        "4K quality",
        "No watermark",
        "All templates + custom",
        "24/7 priority support",
        "Full brand kit",
        "Advanced analytics",
        "API access",
        "Team collaboration"
      ],
      cta: "Start Free Trial",
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      <section className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold mb-4">Simple, Transparent Pricing</h1>
            <p className="text-gray-400 text-lg mb-8">Start free, upgrade when you grow</p>

            <div className="inline-flex items-center glass rounded-full p-1">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2 rounded-full transition ${billingCycle === 'monthly' ? 'bg-primary-600 text-white' : 'text-gray-400'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-6 py-2 rounded-full transition ${billingCycle === 'yearly' ? 'bg-primary-600 text-white' : 'text-gray-400'}`}
              >
                Yearly <span className="text-green-400 text-sm">Save 20%</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, idx) => (
              <div 
                key={idx} 
                className={`glass rounded-2xl p-8 ${plan.popular ? 'border-2 border-primary-500 relative' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </div>
                )}

                <div className="flex items-center space-x-3 mb-4">
                  <div className="text-primary-400">{plan.icon}</div>
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                </div>

                <p className="text-gray-400 mb-6">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-5xl font-bold">${billingCycle === 'monthly' ? plan.price.monthly : plan.price.yearly}</span>
                  <span className="text-gray-400">/month</span>
                </div>

                <Link 
                  href="/register"
                  className={`block text-center py-3 rounded-xl font-semibold transition mb-8 ${
                    plan.popular 
                      ? 'bg-primary-600 hover:bg-primary-700 text-white' 
                      : 'glass hover:bg-white/10 text-white'
                  }`}
                >
                  {plan.cta}
                </Link>

                <ul className="space-y-3">
                  {plan.features.map((feature, fidx) => (
                    <li key={fidx} className="flex items-center text-sm">
                      <Check className="h-4 w-4 text-green-400 mr-2 flex-shrink-0" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
