"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { Video, Menu, X, Sparkles } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center space-x-2">
            <Sparkles className="h-8 w-8 text-primary-400" />
            <span className="text-xl font-bold text-gradient">NEXUS AI</span>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <Link href="/features" className="text-gray-300 hover:text-white transition">Features</Link>
            <Link href="/pricing" className="text-gray-300 hover:text-white transition">Pricing</Link>
            <Link href="/templates" className="text-gray-300 hover:text-white transition">Templates</Link>
            {user ? (
              <div className="flex items-center space-x-4">
                <Link href="/dashboard" className="bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg transition">
                  Dashboard
                </Link>
                <button onClick={logout} className="text-gray-300 hover:text-white">Logout</button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link href="/login" className="text-gray-300 hover:text-white">Login</Link>
                <Link href="/register" className="bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg transition">
                  Get Started
                </Link>
              </div>
            )}
          </div>

          <button 
            className="md:hidden text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden glass border-t border-white/10">
          <div className="px-4 pt-2 pb-4 space-y-2">
            <Link href="/features" className="block py-2 text-gray-300">Features</Link>
            <Link href="/pricing" className="block py-2 text-gray-300">Pricing</Link>
            <Link href="/templates" className="block py-2 text-gray-300">Templates</Link>
            {user ? (
              <>
                <Link href="/dashboard" className="block py-2 text-primary-400">Dashboard</Link>
                <button onClick={logout} className="block py-2 text-gray-300">Logout</button>
              </>
            ) : (
              <>
                <Link href="/login" className="block py-2 text-gray-300">Login</Link>
                <Link href="/register" className="block py-2 text-primary-400">Get Started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
