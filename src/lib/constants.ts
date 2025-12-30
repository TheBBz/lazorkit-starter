/**
 * Constants for the Lazorkit starter application
 *
 * This file contains all configuration constants including:
 * - Network endpoints (RPC, Portal, Paymaster)
 * - Token addresses (USDC mint on devnet/mainnet)
 * - Explorer URLs
 */

// Lazorkit SDK Configuration
// These can be overridden via environment variables
export const LAZORKIT_CONFIG = {
  // RPC endpoint for Solana network
  rpcUrl: process.env.NEXT_PUBLIC_LAZORKIT_RPC_URL || 'https://api.devnet.solana.com',

  // Lazorkit Portal URL for passkey authentication
  portalUrl: process.env.NEXT_PUBLIC_LAZORKIT_PORTAL_URL || 'https://portal.lazor.sh',

  // Paymaster URL for gasless transactions (Kora service)
  paymasterUrl: process.env.NEXT_PUBLIC_LAZORKIT_PAYMASTER_URL || 'https://kora.devnet.lazorkit.com',
} as const;

// USDC Token Addresses
// Note: Devnet USDC is a test token, not real USDC
export const USDC_MINT = {
  // Devnet USDC mint address (Circle's test token)
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',

  // Mainnet USDC mint address (Circle's official USDC)
  mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
} as const;

// Current network configuration
// Change this to 'mainnet' for production deployment
export const CURRENT_NETWORK = 'devnet' as const;

// Get the appropriate USDC mint for current network
export const USDC_MINT_ADDRESS = USDC_MINT[CURRENT_NETWORK];

// USDC has 6 decimal places
export const USDC_DECIMALS = 6;

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
