'use client';
import { useEffect } from 'react';
import NeuralCanvas from '@/components/ui/NeuralCanvas';
import Navbar from '@/components/ui/Navbar';
import HeroSection from '@/components/ui/HeroSection';
import CrewSection from '@/components/ui/CrewSection';
import HowItWorksSection from '@/components/ui/HowItWorksSection';
import PricingSection from '@/components/ui/PricingSection';
import FAQSection from '@/components/ui/FAQSection';
import CTASection from '@/components/ui/CTASection';
import Footer from '@/components/ui/Footer';
export default function HomePage() {
  useEffect(() => { document.documentElement.dir = 'rtl'; document.documentElement.lang = 'ar'; }, []);
  return (
    <main className="bg-[#020204] text-[#f8fafc] min-h-[100dvh] relative">
      <NeuralCanvas />
      <div className="relative z-10"><Navbar /><HeroSection /><CrewSection /><HowItWorksSection /><PricingSection /><FAQSection /><CTASection /><Footer /></div>
    </main>
  );
}
