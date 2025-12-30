'use client';

/**
 * WalletInfo - Display wallet address and balances
 *
 * This component shows:
 * - Smart wallet address with copy functionality
 * - SOL balance
 * - USDC balance
 * - Links to Solana Explorer
 *
 * @example
 * ```tsx
 * <WalletInfo />
 * ```
 */

import { useWallet } from '@lazorkit/wallet';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { getAccountUrl } from '@/lib/constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Copy, ExternalLink, RefreshCw, Wallet } from 'lucide-react';
import { toast } from 'sonner';

export function WalletInfo() {
  const { isConnected, smartWalletPubkey } = useWallet();

  // Get wallet address as string
  const address = smartWalletPubkey?.toString() || null;

  // Fetch balances using our custom hook
  const { solBalance, usdcBalance, isLoading, refresh } = useWalletBalance(address);

  // Copy address to clipboard
  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      toast.success('Address copied to clipboard');
    }
  };

  // Open address in Solana Explorer
  const openExplorer = () => {
    if (address) {
      window.open(getAccountUrl(address), '_blank');
    }
  };

  // Don't render if not connected
  if (!isConnected || !address) {
    return null;
  }

  const truncatedAddress = `${address.slice(0, 8)}...${address.slice(-8)}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            <CardTitle>Wallet</CardTitle>
          </div>
          <Badge variant="secondary" className="text-green-600 dark:text-green-400">
            Connected
          </Badge>
        </div>
        <CardDescription>Your Lazorkit smart wallet</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Address Section */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Address</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono">
              {truncatedAddress}
            </code>
            <Button variant="ghost" size="icon" onClick={copyAddress} title="Copy address">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={openExplorer} title="View in Explorer">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Balances Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Balances</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
              className="h-8 px-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* SOL Balance */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">S</span>
              </div>
              <div>
                <p className="font-medium">SOL</p>
                <p className="text-xs text-muted-foreground">Solana</p>
              </div>
            </div>
            <p className="font-mono font-medium">
              {isLoading ? '...' : solBalance.toFixed(4)}
            </p>
          </div>

          {/* USDC Balance */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">$</span>
              </div>
              <div>
                <p className="font-medium">USDC</p>
                <p className="text-xs text-muted-foreground">USD Coin</p>
              </div>
            </div>
            <p className="font-mono font-medium">
              {isLoading ? '...' : usdcBalance.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Devnet Notice */}
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-xs text-yellow-600 dark:text-yellow-500">
            Running on Devnet. Get test SOL from{' '}
            <a
              href="https://faucet.solana.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-yellow-700 dark:hover:text-yellow-400"
            >
              faucet.solana.com
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
