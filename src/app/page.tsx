"use client";

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { 
  Sparkles, 
  Zap, 
  Shield, 
  Globe, 
  ArrowRight, 
  Play,
  Star,
  CheckCircle2,
  Video,
  Wand2,
  Clock,
  DollarSign
} from 'lucide-react';

export default function Home() {
  const [email, setEmail] = useState('');

  const features = [
    {
      icon: <Wand2 className="h-8 w-8 text-primary-400" />,
      title: "AI-Powered Generation",
      description: "Create stunning marketing videos with a single text prompt. Our AI handles everything from script to visuals."
    },
    {
      icon: <Clock className="h-8 w-8 text-primary-400" />,
      title: "5-Minute Delivery",
      description: "What used to take 8 hours now takes 5 minutes. Generate professional videos while you grab coffee."
    },
    {
      icon: <DollarSign className="h-8 w-8 text-primary-400" />,
      title: "90% Cost Reduction",
      description: "Professional video production costs $500+. Nexus AI delivers the same quality starting at $5 per video."
    },
    {
      icon: <Globe className="h-8 w-8 text-primary-400" />,
      title: "Multi-Platform Ready",
      description: "Instantly optimize for TikTok, Instagram Reels, YouTube Shorts, and more with one click."
    }
  ];

  const templates = [
    { name: "Product Launch", style: "Cinematic", duration: "30s" },
    { name: "Brand Story", style: "Emotional", duration: "60s" },
    { name: "Promo Sale", style: "Energetic", duration: "15s" },
    { name: "Tutorial", style: "Clean", duration: "45s" }
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Marketing Director",
      company: "TechStart Inc.",
      text: "We cut our video production costs by 85% and increased output by 10x. Nexus AI is a game-changer."
    },
    {
      name: "Marcus Johnson",
      role: "Founder",
      company: "GrowthLabs",
      text: "I was spending $2,000/month on video agencies. Now I create better content for $79/month."
    },
    {
      name: "Aisha Patel",
      role: "Social Media Manager",
      company: "RetailMax",
      text: "Our engagement rate jumped 340% after switching to Nexus AI videos. The quality is incredible."
    }
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-900/20 to-transparent" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse-slow" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center space-x-2 glass px-4 py-2 rounded-full mb-8">
            <Sparkles className="h-4 w-4 text-primary-400" />
            <span className="text-sm text-primary-300">Trusted by 2,000+ businesses worldwide</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Create Viral Marketing Videos
            <span className="block text-gradient">in 5 Minutes with AI</span>
          </h1>

          <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-10">
            Stop spending thousands on video production. Generate professional, engaging marketing videos 
            for TikTok, Instagram, and YouTube with a single click.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link 
              href="/register" 
              className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition glow flex items-center space-x-2"
            >
              <span>Start Creating Free</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
            <button className="glass hover:bg-white/10 text-white px-8 py-4 rounded-xl font-semibold text-lg transition flex items-center space-x-2">
              <Play className="h-5 w-5" />
              <span>Watch Demo</span>
            </button>
          </div>

          <div className="flex items-center justify-center space-x-8 text-sm text-gray-500">
            <span className="flex items-center"><CheckCircle2 className="h-4 w-4 text-green-400 mr-1" /> No credit card required</span>
            <span className="flex items-center"><CheckCircle2 className="h-4 w-4 text-green-400 mr-1" /> 3 free videos</span>
            <span className="flex items-center"><CheckCircle2 className="h-4 w-4 text-green-400 mr-1" /> Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-gradient">50K+</div>
              <div className="text-gray-400 mt-1">Videos Created</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-gradient">2,000+</div>
              <div className="text-gray-400 mt-1">Active Users</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-gradient">340%</div>
              <div className="text-gray-400 mt-1">Avg. Engagement Boost</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-gradient">4.9/5</div>
              <div className="text-gray-400 mt-1">User Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why Choose Nexus AI?</h2>
            <p className="text-gray-400 text-lg">Everything you need to dominate social media</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, idx) => (
              <div key={idx} className="glass p-8 rounded-2xl hover:bg-white/10 transition group">
                <div className="mb-4 group-hover:scale-110 transition-transform">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates Preview */}
      <section className="py-20 bg-dark-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Ready-to-Use Templates</h2>
            <p className="text-gray-400 text-lg">Professional templates for every business need</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {templates.map((template, idx) => (
              <div key={idx} className="glass rounded-xl overflow-hidden hover:scale-105 transition cursor-pointer">
                <div className="h-40 bg-gradient-to-br from-primary-900 to-dark-800 flex items-center justify-center">
                  <Video className="h-12 w-12 text-primary-400/50" />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">{template.name}</h3>
                  <div className="flex justify-between text-sm text-gray-400 mt-2">
                    <span>{template.style}</span>
                    <span>{template.duration}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Create in 3 Simple Steps</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">1</div>
              <h3 className="text-xl font-semibold mb-2">Describe Your Video</h3>
              <p className="text-gray-400">Enter a text prompt describing what you want. Be as detailed or as simple as you like.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">2</div>
              <h3 className="text-xl font-semibold mb-2">AI Generates Everything</h3>
              <p className="text-gray-400">Our AI creates script, visuals, voiceover, music, and editing - all automatically.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">3</div>
              <h3 className="text-xl font-semibold mb-2">Download & Share</h3>
              <p className="text-gray-400">Get your video in multiple formats, ready to post on any platform instantly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-dark-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Loved by Businesses</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, idx) => (
              <div key={idx} className="glass p-6 rounded-xl">
                <div className="flex items-center space-x-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-300 mb-4">"{testimonial.text}"</p>
                <div>
                  <div className="font-semibold">{testimonial.name}</div>
                  <div className="text-sm text-gray-400">{testimonial.role}, {testimonial.company}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Marketing?</h2>
          <p className="text-gray-400 text-lg mb-8">
            Join 2,000+ businesses already creating stunning videos with AI
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/register" 
              className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition glow"
            >
              Start Free Trial
            </Link>
            <Link 
              href="/pricing" 
              className="glass hover:bg-white/10 text-white px-8 py-4 rounded-xl font-semibold text-lg transition"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Sparkles className="h-6 w-6 text-primary-400" />
                <span className="text-lg font-bold text-gradient">NEXUS AI</span>
              </div>
              <p className="text-gray-400 text-sm">
                AI-powered video generation for modern businesses.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/features">Features</Link></li>
                <li><Link href="/pricing">Pricing</Link></li>
                <li><Link href="/templates">Templates</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/about">About</Link></li>
                <li><Link href="/blog">Blog</Link></li>
                <li><Link href="/contact">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/privacy">Privacy</Link></li>
                <li><Link href="/terms">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-white/5 text-center text-gray-500 text-sm">
            © 2026 Nexus AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
