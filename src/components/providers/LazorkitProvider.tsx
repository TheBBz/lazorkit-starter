'use client';

/**
 * LazorkitProvider - Wrapper component for Lazorkit SDK
 *
 * This provider initializes the Lazorkit SDK and makes wallet functionality
 * available throughout the application via the useWallet hook.
 *
 * Key features:
 * - Passkey-based authentication (FaceID, TouchID, Windows Hello)
 * - Smart wallet management (PDA-based accounts)
 * - Paymaster integration for gasless transactions
 *
 * @example
 * ```tsx
 * // In your app layout
 * <LazorkitClientProvider>
 *   <YourApp />
 * </LazorkitClientProvider>
 * ```
 */

import { LazorkitProvider } from '@lazorkit/wallet';
import { LAZORKIT_CONFIG } from '@/lib/constants';
import { ReactNode } from 'react';

interface LazorkitClientProviderProps {
  children: ReactNode;
}

export function LazorkitClientProvider({ children }: LazorkitClientProviderProps) {
  return (
    <LazorkitProvider
      // RPC endpoint for Solana network communication
      // Used for sending transactions and fetching on-chain data
      rpcUrl={LAZORKIT_CONFIG.rpcUrl}
      // Portal URL handles the passkey authentication flow
      // This is where WebAuthn credentials are created and verified
      portalUrl={LAZORKIT_CONFIG.portalUrl}
      // NOTE: Paymaster temporarily disabled due to service being down (503)
      // When paymaster is back online, uncomment this to enable gasless transactions:
      // paymasterConfig={{
      //   paymasterUrl: LAZORKIT_CONFIG.paymasterUrl,
      // }}
    >
      {children}
    </LazorkitProvider>
  );
}
