'use client';

/**
 * TokenSwapForm - SOL to tUSDC swap component
 *
 * This component enables token swaps on devnet:
 * - Uses real SOL/USDC price from Jupiter API
 * - User sends SOL to pool, receives tUSDC back
 * - Two-step process: 1) Send SOL, 2) Receive tUSDC
 *
 * @example
 * ```tsx
 * <TokenSwapForm />
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@lazorkit/wallet';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { TUSDC_CONFIG, getTransactionUrl } from '@/lib/constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  ArrowDownUp,
  Loader2,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

type TxState = 'idle' | 'quoting' | 'swapping' | 'confirming' | 'success' | 'error';

interface SwapQuote {
  solAmount: number;
  tusdcAmount: number;
  rate: number;
  priceImpact: number;
}

export function TokenSwapForm() {
  const { isConnected, smartWalletPubkey, signAndSendTransaction } = useWallet();

  // Form state
  const [solAmount, setSolAmount] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [txState, setTxState] = useState<TxState>('idle');
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get wallet balances
  const address = smartWalletPubkey?.toString() || null;
  const { solBalance, usdcBalance, refresh: refreshBalance } = useWalletBalance(address);

  // Fetch quote from our API
  const fetchQuote = useCallback(async (amount: string) => {
    if (!amount || parseFloat(amount) <= 0 || !smartWalletPubkey) {
      setQuote(null);
      setTxState('idle');
      return;
    }

    setTxState('quoting');
    setError(null);

    try {
      // Fetch price from our API
      const response = await fetch('/api/swap');
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to get price');
      }

      const solAmountNum = parseFloat(amount);
      setQuote({
        solAmount: solAmountNum,
        tusdcAmount: solAmountNum * data.solPrice,
        rate: data.solPrice,
        priceImpact: 0.1,
      });
      setTxState('idle');
    } catch (err) {
      console.error('Quote error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get quote');
      setTxState('error');
      setQuote(null);
    }
  }, [smartWalletPubkey]);

  // Debounced quote fetching - only trigger on solAmount change
  useEffect(() => {
    // Clear quote if empty
    if (!solAmount || parseFloat(solAmount) <= 0) {
      setQuote(null);
      return;
    }

    const timer = setTimeout(() => {
      fetchQuote(solAmount);
    }, 500);

    return () => clearTimeout(timer);
  }, [solAmount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Execute the swap
  const handleSwap = async () => {
    if (!isConnected || !smartWalletPubkey || !signAndSendTransaction || !quote) {
      toast.error('Wallet not connected or no quote available');
      return;
    }

    // Check balance
    if (parseFloat(solAmount) > solBalance) {
      toast.error('Insufficient SOL balance');
      return;
    }

    setTxState('swapping');
    setError(null);
    setTxSignature(null);

    try {
      const poolWallet = new PublicKey(TUSDC_CONFIG.poolWallet);
      const lamports = Math.floor(parseFloat(solAmount) * 1_000_000_000); // Convert SOL to lamports

      // Step 1: User sends SOL to pool
      // Create SOL transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: smartWalletPubkey,
        toPubkey: poolWallet,
        lamports,
      });

      setTxState('confirming');

      // Sign and send with Lazorkit
      const signature = await signAndSendTransaction({
        instructions: [transferInstruction],
      });

      // Step 2: Backend sends tUSDC to user
      // Call API to complete the swap
      const completeResponse = await fetch('/api/swap/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userWallet: smartWalletPubkey.toString(),
          solAmount: parseFloat(solAmount),
          solTxSignature: signature,
        }),
      });

      const completeData = await completeResponse.json();

      if (!completeResponse.ok || completeData.error) {
        throw new Error(completeData.error || 'Failed to complete swap');
      }

      setTxState('success');
      setTxSignature(completeData.signature || signature);

      toast.success('Swap successful!', {
        description: `Swapped ${solAmount} SOL for ${quote.tusdcAmount.toFixed(2)} tUSDC`,
        action: {
          label: 'View',
          onClick: () => window.open(getTransactionUrl(completeData.signature || signature), '_blank'),
        },
      });

      // Refresh balances
      await refreshBalance();

      // Reset form
      setSolAmount('');
      setQuote(null);
    } catch (err) {
      setTxState('error');
      const errorMessage = err instanceof Error ? err.message : 'Swap failed';
      setError(errorMessage);
      toast.error('Swap failed', { description: errorMessage });
      console.error('Swap error:', err);
    }
  };

  // Reset form
  const resetForm = () => {
    setTxState('idle');
    setTxSignature(null);
    setError(null);
    setSolAmount('');
    setQuote(null);
  };

  // Don't render if not connected
  if (!isConnected) {
    return null;
  }

  // Success state
  if (txState === 'success' && txSignature) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle className="h-5 w-5" />
            <CardTitle>Swap Complete</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-600 dark:text-green-400">
              Successfully swapped SOL for tUSDC!
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Transaction</p>
            <code className="block p-2 bg-muted rounded text-xs font-mono break-all">
              {txSignature}
            </code>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={resetForm}>
              New Swap
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={() => window.open(getTransactionUrl(txSignature), '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              View on Explorer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          <CardTitle>Swap SOL → tUSDC</CardTitle>
        </div>
        <CardDescription>
          Swap SOL for tUSDC using real-time market prices
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input: SOL */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>You Pay</Label>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setSolAmount(Math.max(0, solBalance - 0.01).toFixed(4))}
              disabled={txState !== 'idle'}
            >
              Balance: {solBalance.toFixed(4)} SOL
            </button>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="number"
                placeholder="0.00"
                value={solAmount}
                onChange={(e) => setSolAmount(e.target.value)}
                disabled={txState !== 'idle'}
                min="0"
                step="0.01"
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg min-w-[100px]">
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">S</span>
              </div>
              <span className="font-medium">SOL</span>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Output: tUSDC */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>You Receive</Label>
            <span className="text-xs text-muted-foreground">
              Balance: {usdcBalance.toFixed(2)} {TUSDC_CONFIG.symbol}
            </span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="0.00"
                value={txState === 'quoting' ? '...' : (quote?.tusdcAmount.toFixed(2) || '')}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg min-w-[100px]">
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">$</span>
              </div>
              <span className="font-medium">{TUSDC_CONFIG.symbol}</span>
            </div>
          </div>
        </div>

        {/* Quote Info */}
        {quote && (
          <>
            <Separator />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rate</span>
                <span>1 SOL ≈ {quote.rate.toFixed(2)} {TUSDC_CONFIG.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price Impact</span>
                <span className={quote.priceImpact > 1 ? 'text-red-500' : ''}>
                  {quote.priceImpact.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network Fee</span>
                <span>~0.000005 SOL</span>
              </div>
            </div>
          </>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Swap Button */}
        <Button
          className="w-full gap-2"
          onClick={handleSwap}
          disabled={!quote || txState !== 'idle' || parseFloat(solAmount) > solBalance}
        >
          {txState === 'quoting' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Getting Quote...
            </>
          )}
          {txState === 'swapping' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sign with Passkey...
            </>
          )}
          {txState === 'confirming' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Confirming...
            </>
          )}
          {txState === 'idle' && (
            <>
              <ArrowDownUp className="h-4 w-4" />
              {quote ? 'Swap Now' : 'Enter Amount'}
            </>
          )}
          {txState === 'error' && 'Try Again'}
        </Button>

        {/* Refresh Quote */}
        {quote && txState === 'idle' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchQuote(solAmount)}
            className="w-full gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Quote
          </Button>
        )}

        {/* Info Box */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-600 dark:text-blue-400">
            <strong>Test Token:</strong> tUSDC is a test token for this demo.
            Prices are based on real SOL/USDC rates from Jupiter.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
