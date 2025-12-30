/**
 * Constants for the Lazorkit starter application
 *
 * This file contains all configuration constants including:
 * - Network endpoints (RPC, Portal, Paymaster)
 * - Token addresses (USDC, tUSDC)
 * - Explorer URLs
 */

// Lazorkit SDK Configuration
export const LAZORKIT_CONFIG = {
  // RPC endpoint for Solana network
  rpcUrl: process.env.NEXT_PUBLIC_LAZORKIT_RPC_URL || 'https://api.devnet.solana.com',

  // Lazorkit Portal URL for passkey authentication
  portalUrl: process.env.NEXT_PUBLIC_LAZORKIT_PORTAL_URL || 'https://portal.lazor.sh',

  // Paymaster URL for gasless transactions (Kora service)
  paymasterUrl: process.env.NEXT_PUBLIC_LAZORKIT_PAYMASTER_URL || 'https://kora.devnet.lazorkit.com',
} as const;

// Current network configuration
export const CURRENT_NETWORK = 'devnet' as const;

// tUSDC (Test USDC) Token - Custom token for devnet testing
// This allows users to swap SOL for tUSDC and send gasless transfers
export const TUSDC_CONFIG = {
  // tUSDC mint address on devnet
  mintAddress: (process.env.NEXT_PUBLIC_TUSDC_MINT_ADDRESS || 'AVC33ghWUsCyUqhb7XJxV5zrqa4RaDjxSCQLRbkvQhRm').trim(),

  // Pool wallet that holds tUSDC liquidity
  poolWallet: (process.env.NEXT_PUBLIC_TUSDC_POOL_WALLET || 'AnwauefJNiQeuskcVDQaT1omPkZhjfnuoZqUy19TcqYF').trim(),

  // Decimals (same as real USDC)
  decimals: 6,

  // Symbol
  symbol: 'tUSDC',

  // Name
  name: 'Test USDC',
} as const;

// Circle's USDC Token Addresses (for reference)
export const USDC_MINT = {
  // Devnet USDC mint address (Circle's test token)
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',

  // Mainnet USDC mint address (Circle's official USDC)
  mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
} as const;

// For this demo, we use tUSDC (our custom test token)
// This allows users to swap SOL for tUSDC directly in the app
export const USDC_MINT_ADDRESS = TUSDC_CONFIG.mintAddress;
export const USDC_DECIMALS = TUSDC_CONFIG.decimals;

// Solana Explorer URLs
export const EXPLORER_URL = {
  devnet: 'https://explorer.solana.com/?cluster=devnet',
  mainnet: 'https://explorer.solana.com',
} as const;

// Get transaction URL for current network
export function getTransactionUrl(signature: string): string {
  const cluster = CURRENT_NETWORK === 'devnet' ? '?cluster=devnet' : '';
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}

// Get account URL for current network
export function getAccountUrl(address: string): string {
  const cluster = CURRENT_NETWORK === 'devnet' ? '?cluster=devnet' : '';
  return `https://explorer.solana.com/address/${address}${cluster}`;
}

// Jupiter API for price feeds (mainnet prices for reference)
export const JUPITER_API = 'https://lite-api.jup.ag/swap/v1';

// Wrapped SOL mint (same on all networks)
export const WRAPPED_SOL_MINT = 'So11111111111111111111111111111111111111112';
