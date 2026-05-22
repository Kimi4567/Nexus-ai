"use client";

import Navbar from '@/components/Navbar';
import { 
  Wand2, 
  Zap, 
  Shield, 
  Globe, 
  BarChart3, 
  Palette,
  Clock,
  Headphones
} from 'lucide-react';

export default function Features() {
  const features = [
    {
      icon: <Wand2 className="h-12 w-12 text-primary-400" />,
      title: "AI Video Generation",
      description: "Describe your video in text and watch AI create professional marketing videos with scripts, visuals, voiceovers, and music - all automatically.",
      details: ["Text-to-video generation", "Auto script writing", "AI voiceover in 30+ languages", "Background music selection"]
    },
    {
      icon: <Zap className="h-12 w-12 text-primary-400" />,
      title: "Lightning Fast",
      description: "What used to take a full day of production now takes 5 minutes. Generate while you grab coffee.",
      details: ["5-minute generation time", "Batch processing", "Instant previews", "Real-time status updates"]
    },
    {
      icon: <Globe className="h-12 w-12 text-primary-400" />,
      title: "Multi-Platform Ready",
      description: "One video, multiple formats. Automatically optimize for every social platform.",
      details: ["TikTok (9:16)", "Instagram Reels (9:16)", "YouTube Shorts (9:16)", "LinkedIn (1:1)", "Twitter (16:9)"]
    },
    {
      icon: <Palette className="h-12 w-12 text-primary-400" />,
      title: "Brand Consistency",
      description: "Upload your brand kit once and every video automatically matches your colors, fonts, and style.",
      details: ["Brand color extraction", "Logo auto-placement", "Font matching", "Style templates"]
    },
    {
      icon: <BarChart3 className="h-12 w-12 text-primary-400" />,
      title: "Performance Analytics",
      description: "Track how your videos perform across platforms and optimize for better engagement.",
      details: ["View tracking", "Engagement metrics", "A/B testing", "Performance recommendations"]
    },
    {
      icon: <Headphones className="h-12 w-12 text-primary-400" />,
      title: "Priority Support",
      description: "Get help when you need it. Our team is available 24/7 for Pro users.",
      details: ["24/7 live chat", "Video review service", "Strategy consulting", "Custom template requests"]
    }
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      <section className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold mb-4">Powerful Features for Modern Marketing</h1>
            <p className="text-gray-400 text-lg max-w-3xl mx-auto">
              Everything you need to create, manage, and scale your video marketing - powered by cutting-edge AI
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <div key={idx} className="glass rounded-2xl p-8 hover:bg-white/10 transition">
                <div className="mb-6">{feature.icon}</div>
                <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-400 mb-6">{feature.description}</p>
                <ul className="space-y-2">
                  {feature.details.map((detail, didx) => (
                    <li key={didx} className="flex items-center text-sm text-gray-300">
                      <div className="w-1.5 h-1.5 bg-primary-400 rounded-full mr-2" />
                      {detail}
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
