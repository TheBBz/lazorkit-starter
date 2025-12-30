import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { LazorkitClientProvider } from '@/components/providers/LazorkitProvider';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Lazorkit Starter - Passkey-Powered Solana Wallet',
  description:
    'A starter template demonstrating Lazorkit SDK integration with passkey authentication and gasless USDC transfers on Solana.',
  keywords: ['Solana', 'Lazorkit', 'Passkey', 'WebAuthn', 'Smart Wallet', 'Gasless', 'USDC'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/*
          LazorkitClientProvider wraps the entire app to provide:
          - Passkey authentication context
          - Smart wallet state management
          - Paymaster integration for gasless transactions
        */}
        <LazorkitClientProvider>
          {children}
          {/* Toast notifications for transaction feedback */}
          <Toaster position="top-right" richColors />
        </LazorkitClientProvider>
      </body>
    </html>
  );
}
