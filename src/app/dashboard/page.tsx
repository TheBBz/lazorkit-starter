'use client';

/**
 * Dashboard Page - Main wallet interface
 *
 * This page displays:
 * - Connected wallet information and balances
 * - USDC transfer form for gasless transactions
 * - Navigation back to landing page
 *
 * Users are redirected here after connecting their passkey wallet.
 */

import { useWallet } from '@lazorkit/wallet';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useState } from 'react';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { WalletInfo } from '@/components/wallet/WalletInfo';
import { UsdcTransferForm } from '@/components/transfer/UsdcTransferForm';
import { TokenSwapForm } from '@/components/swap/TokenSwapForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Fingerprint, Home, Send, ArrowDownUp } from 'lucide-react';
import Link from 'next/link';

type ActiveTab = 'transfer' | 'swap';

export default function Dashboard() {
  const { isConnected } = useWallet();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('transfer');

  // Redirect to home if not connected
  useEffect(() => {
    if (!isConnected) {
      router.push('/');
    }
  }, [isConnected, router]);

  // Show loading state while checking connection
  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Fingerprint className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Lazorkit Starter</span>
          </Link>
          <div className="flex items-center gap-4">
            <Badge variant="secondary">Devnet</Badge>
            <ConnectButton />
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your smart wallet and send gasless USDC transfers
            </p>
          </div>

          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Wallet Info */}
            <div className="space-y-6">
              <WalletInfo />

              {/* Quick Actions */}
              <div className="p-4 bg-card border rounded-lg space-y-3">
                <h3 className="font-medium">Quick Links</h3>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href="https://faucet.solana.com"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Get Test SOL
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href="https://spl-token-faucet.com/?token-name=USDC-Dev"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Get Test USDC
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href="https://docs.lazorkit.com"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Documentation
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Column: Transfer/Swap Forms */}
            <div className="space-y-4">
              {/* Tab Buttons */}
              <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <Button
                  variant={activeTab === 'transfer' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => setActiveTab('transfer')}
                >
                  <Send className="h-4 w-4" />
                  Send
                </Button>
                <Button
                  variant={activeTab === 'swap' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => setActiveTab('swap')}
                >
                  <ArrowDownUp className="h-4 w-4" />
                  Swap
                </Button>
              </div>

              {/* Active Form */}
              {activeTab === 'transfer' ? <UsdcTransferForm /> : <TokenSwapForm />}
            </div>
          </div>

          {/* How It Works Section */}
          <div className="mt-12 p-6 bg-card border rounded-xl">
            <h2 className="text-xl font-semibold mb-4">How Gasless Transfers Work</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  1
                </div>
                <h3 className="font-medium">Build Transaction</h3>
                <p className="text-sm text-muted-foreground">
                  The app creates a USDC transfer instruction with your recipient and amount.
                </p>
              </div>
              <div className="space-y-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  2
                </div>
                <h3 className="font-medium">Sign with Passkey</h3>
                <p className="text-sm text-muted-foreground">
                  Authenticate using your device&apos;s biometric (FaceID, TouchID) to sign.
                </p>
              </div>
              <div className="space-y-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  3
                </div>
                <h3 className="font-medium">Paymaster Sponsors</h3>
                <p className="text-sm text-muted-foreground">
                  The Lazorkit Paymaster pays the network fee, so you don&apos;t need SOL.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-12 border-t">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>Lazorkit Starter Template</p>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" className="gap-2">
              <Home className="h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </footer>
    </div>
  );
}
