'use client';

/**
 * Landing Page - Lazorkit Starter
 *
 * This is the main entry point for the application.
 * It showcases the key features and provides a connection flow.
 */

import { useWallet } from '@lazorkit/wallet';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ConnectButtonLarge } from '@/components/wallet/ConnectButton';
import { Badge } from '@/components/ui/badge';
import { Fingerprint, Zap, Shield, ArrowRight } from 'lucide-react';

export default function Home() {
  const { isConnected } = useWallet();
  const router = useRouter();

  // Redirect to dashboard when connected
  useEffect(() => {
    if (isConnected) {
      router.push('/dashboard');
    }
  }, [isConnected, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Fingerprint className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Lazorkit Starter</span>
          </div>
          <Badge variant="secondary">Devnet</Badge>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          {/* Badge */}
          <Badge variant="outline" className="px-4 py-1.5">
            Powered by Lazorkit SDK
          </Badge>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            Solana Made{' '}
            <span className="bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
              Simple
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            No seed phrases. No gas fees. Just your fingerprint.
            <br />
            Experience the future of Web3 authentication.
          </p>

          {/* Connect Button */}
          <div className="pt-4">
            <ConnectButtonLarge />
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12">
            {/* Feature 1: Seedless */}
            <div className="p-6 rounded-2xl bg-card border hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 mx-auto">
                <Fingerprint className="h-6 w-6 text-purple-500" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Seedless</h3>
              <p className="text-sm text-muted-foreground">
                Sign in with FaceID, TouchID, or Windows Hello. No seed phrases to lose.
              </p>
            </div>

            {/* Feature 2: Gasless */}
            <div className="p-6 rounded-2xl bg-card border hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 mx-auto">
                <Zap className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Gasless</h3>
              <p className="text-sm text-muted-foreground">
                Send USDC without holding SOL. Transaction fees are sponsored for you.
              </p>
            </div>

            {/* Feature 3: Secure */}
            <div className="p-6 rounded-2xl bg-card border hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 mx-auto">
                <Shield className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Secure</h3>
              <p className="text-sm text-muted-foreground">
                Hardware-bound credentials that never leave your device. Phishing-resistant.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-20 border-t">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>Built for the Lazorkit Bounty</p>
          <div className="flex items-center gap-4">
            <a
              href="https://docs.lazorkit.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              Documentation
              <ArrowRight className="h-3 w-3" />
            </a>
            <a
              href="https://github.com/lazor-kit/lazor-kit"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              GitHub
              <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
