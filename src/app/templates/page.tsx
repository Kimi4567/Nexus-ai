"use client";

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import { Video, Play, Clock, Star } from 'lucide-react';

export default function Templates() {
  const [category, setCategory] = useState('all');

  const categories = ['all', 'product', 'promo', 'brand', 'tutorial', 'social'];

  const templates = [
    { name: "Product Launch", category: "product", duration: "30s", style: "Cinematic", rating: 4.9, uses: 2340 },
    { name: "Flash Sale", category: "promo", duration: "15s", style: "Energetic", rating: 4.8, uses: 1890 },
    { name: "Brand Story", category: "brand", duration: "60s", style: "Emotional", rating: 4.9, uses: 1560 },
    { name: "How-To Guide", category: "tutorial", duration: "45s", style: "Clean", rating: 4.7, uses: 1230 },
    { name: "Testimonial", category: "social", duration: "30s", style: "Authentic", rating: 4.8, uses: 980 },
    { name: "Behind Scenes", category: "brand", duration: "45s", style: "Casual", rating: 4.6, uses: 870 },
    { name: "Holiday Special", category: "promo", duration: "20s", style: "Festive", rating: 4.9, uses: 2100 },
    { name: "App Showcase", category: "product", duration: "30s", style: "Modern", rating: 4.7, uses: 1450 },
  ];

  const filtered = category === 'all' ? templates : templates.filter(t => t.category === category);

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      <section className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4">Video Templates</h1>
            <p className="text-gray-400 text-lg">Professional templates to jumpstart your content</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-6 py-2 rounded-full transition capitalize ${
                  category === cat ? 'bg-primary-600 text-white' : 'glass text-gray-400 hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filtered.map((template, idx) => (
              <div key={idx} className="glass rounded-xl overflow-hidden hover:scale-105 transition cursor-pointer group">
                <div className="h-48 bg-gradient-to-br from-primary-900 to-dark-800 flex items-center justify-center relative">
                  <Video className="h-16 w-16 text-primary-400/30" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center">
                      <Play className="h-6 w-6 text-white ml-1" />
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-1">{template.name}</h3>
                  <div className="flex items-center justify-between text-sm text-gray-400 mb-3">
                    <span className="flex items-center"><Clock className="h-3 w-3 mr-1" />{template.duration}</span>
                    <span>{template.style}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 mr-1" />
                      <span className="text-sm">{template.rating}</span>
                    </div>
                    <span className="text-xs text-gray-500">{template.uses.toLocaleString()} uses</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
