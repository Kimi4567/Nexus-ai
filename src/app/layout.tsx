"use client";

import './globals.css';
import { Inter } from 'next/font/google';
import { useState } from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-dark-900 text-white min-h-screen`}>
        <AuthProvider>
          {children}
          <Toaster position="top-center" />
        </AuthProvider>
      </body>
    </html>
  );
}
