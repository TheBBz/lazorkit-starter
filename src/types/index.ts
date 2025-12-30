/**
 * TypeScript type definitions for the Lazorkit starter application
 */

import { PublicKey } from '@solana/web3.js';

// Wallet connection state
export interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  address: string | null;
  publicKey: PublicKey | null;
}

// Token balance information
export interface TokenBalance {
  mint: string;
  symbol: string;
  balance: number;
  uiBalance: string;
  decimals: number;
}

// Transaction status
export type TransactionStatus = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

// Transfer form data
export interface TransferFormData {
  recipient: string;
  amount: string;
}

// Transaction result
export interface TransactionResult {
  signature: string;
  status: TransactionStatus;
  error?: string;
}

// Wallet balance data
export interface WalletBalances {
  sol: number;
  usdc: number;
  isLoading: boolean;
  error: string | null;
}

// Transaction history item
export interface TransactionHistoryItem {
  signature: string;
  timestamp: number;
  type: 'send' | 'receive' | 'other';
  amount?: number;
  token?: string;
  status: 'confirmed' | 'finalized' | 'failed';
}
