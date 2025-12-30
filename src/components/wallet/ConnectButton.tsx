'use client';

/**
 * ConnectButton - Passkey wallet connection component
 *
 * This component handles the entire passkey authentication flow:
 * - Creating new passkey-based smart wallets
 * - Signing in with existing passkeys
 * - Disconnecting from the wallet
 *
 * The passkey flow uses WebAuthn, which means:
 * - No seed phrases or private keys to manage
 * - Authentication via device biometrics (FaceID, TouchID, Windows Hello)
 * - Hardware-bound credentials that never leave the device
 *
 * @example
 * ```tsx
 * <ConnectButton />
 * ```
 */

import { useWallet } from '@lazorkit/wallet';
import { Button } from '@/components/ui/button';
import { Loader2, Fingerprint, LogOut } from 'lucide-react';
import { toast } from 'sonner';

export function ConnectButton() {
  // useWallet hook provides all wallet functionality
  // - connect(): Creates or signs in with passkey
  // - disconnect(): Ends the current session
  // - isConnected: Whether wallet is currently connected
  // - smartWalletPubkey: The smart wallet's public key (PDA)
  const { connect, disconnect, isConnected, smartWalletPubkey } = useWallet();

  // Handle connect - this triggers the passkey authentication flow
  // For new users: Creates a new passkey and smart wallet
  // For returning users: Signs in with existing passkey
  // Using feeMode: 'user' to avoid paymaster dependency during connection
  const handleConnect = async () => {
    try {
      await connect({ feeMode: 'user' });
      toast.success('Wallet connected successfully!');
    } catch (error) {
      console.error('Connection failed:', error);
      const message = error instanceof Error ? error.message : 'Connection failed';
      toast.error('Connection failed', { description: message });
    }
  };

  // Handle disconnect - ends the current session
  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Disconnection failed:', error);
    }
  };

  // Show connected state with truncated address
  if (isConnected && smartWalletPubkey) {
    const address = smartWalletPubkey.toString();
    const truncatedAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;

    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground font-mono">
          {truncatedAddress}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          Disconnect
        </Button>
      </div>
    );
  }

  // Show connect button
  return (
    <Button onClick={handleConnect} className="gap-2">
      <Fingerprint className="h-4 w-4" />
      Connect with Passkey
    </Button>
  );
}

/**
 * ConnectButtonLarge - Larger version for landing pages
 *
 * Same functionality as ConnectButton but with larger styling
 * suitable for hero sections and call-to-action areas.
 */
export function ConnectButtonLarge() {
  const { connect, disconnect, isConnected, smartWalletPubkey, isConnecting } = useWallet();

  const handleConnect = async () => {
    try {
      // Using feeMode: 'user' to avoid paymaster dependency during connection
      await connect({ feeMode: 'user' });
      toast.success('Wallet connected successfully!');
    } catch (error) {
      console.error('Connection failed:', error);
      const message = error instanceof Error ? error.message : 'Connection failed';
      toast.error('Connection failed', { description: message });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Disconnection failed:', error);
    }
  };

  if (isConnected && smartWalletPubkey) {
    const address = smartWalletPubkey.toString();
    const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-6)}`;

    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium">Connected</span>
        </div>
        <p className="font-mono text-sm text-muted-foreground">{truncatedAddress}</p>
        <Button
          variant="outline"
          onClick={handleDisconnect}
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="lg"
      onClick={handleConnect}
      disabled={isConnecting}
      className="gap-2 text-lg px-8 py-6"
    >
      {isConnecting ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <Fingerprint className="h-5 w-5" />
          Connect with Passkey
        </>
      )}
    </Button>
  );
}
