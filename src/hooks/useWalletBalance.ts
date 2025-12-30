'use client';

/**
 * useWalletBalance - Custom hook to fetch SOL and USDC balances
 *
 * This hook fetches the native SOL balance and USDC token balance
 * for a connected wallet address. It automatically refreshes when
 * the address changes.
 *
 * @example
 * ```tsx
 * const { solBalance, usdcBalance, isLoading, refresh } = useWalletBalance(address);
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { LAZORKIT_CONFIG, USDC_MINT_ADDRESS, USDC_DECIMALS } from '@/lib/constants';

interface UseWalletBalanceReturn {
  solBalance: number;
  usdcBalance: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWalletBalance(address: string | null): UseWalletBalanceReturn {
  const [solBalance, setSolBalance] = useState<number>(0);
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!address) {
      setSolBalance(0);
      setUsdcBalance(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const connection = new Connection(LAZORKIT_CONFIG.rpcUrl, 'confirmed');
      const publicKey = new PublicKey(address);

      // Fetch SOL balance
      // getBalance returns lamports (1 SOL = 1e9 lamports)
      const lamports = await connection.getBalance(publicKey);
      setSolBalance(lamports / LAMPORTS_PER_SOL);

      // Fetch USDC/tUSDC balance
      // First, derive the Associated Token Account (ATA) address
      try {
        const usdcMint = new PublicKey(USDC_MINT_ADDRESS);
        // allowOwnerOffCurve=true because Lazorkit smart wallets are PDAs
        const ataAddress = await getAssociatedTokenAddress(usdcMint, publicKey, true);

        // Get the token account info
        const tokenAccount = await getAccount(connection, ataAddress);

        // Convert from raw amount to UI amount (USDC has 6 decimals)
        const rawBalance = Number(tokenAccount.amount);
        setUsdcBalance(rawBalance / Math.pow(10, USDC_DECIMALS));
      } catch {
        // Token account doesn't exist = 0 balance
        // This is normal for new wallets that haven't received USDC yet
        setUsdcBalance(0);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch balances';
      setError(errorMessage);
      console.error('Balance fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Fetch balances when address changes
  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return {
    solBalance,
    usdcBalance,
    isLoading,
    error,
    refresh: fetchBalances,
  };
}
