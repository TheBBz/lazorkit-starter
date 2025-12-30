# Tutorial: Creating a Passkey-Based Wallet with Lazorkit

Learn how to integrate passkey authentication into your Solana application using the Lazorkit SDK. By the end of this tutorial, you'll have a working wallet that uses FaceID, TouchID, or Windows Hello instead of seed phrases.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Install Dependencies](#step-1-install-dependencies)
4. [Step 2: Set Up the Provider](#step-2-set-up-the-provider)
5. [Step 3: Create the Connect Button](#step-3-create-the-connect-button)
6. [Step 4: Display Wallet Information](#step-4-display-wallet-information)
7. [Step 5: Handle Session Persistence](#step-5-handle-session-persistence)
8. [How It Works](#how-it-works)
9. [Next Steps](#next-steps)

## Overview

Traditional Solana wallets require users to manage complex seed phrases - 12 or 24 random words that control access to their funds. Lazorkit replaces this with **passkeys**, the same technology used for passwordless login to Google, Apple, and Microsoft accounts.

### What You'll Build

- A "Connect with Passkey" button that creates or signs into a smart wallet
- Display of the connected wallet address and balances
- Automatic session persistence across page refreshes

### How Passkeys Work

1. **Creation**: When a new user clicks "Connect", their device creates a cryptographic keypair stored in the Secure Enclave (hardware)
2. **Authentication**: The private key never leaves the device - it signs challenges locally using biometrics
3. **Smart Wallet**: Lazorkit creates an on-chain smart wallet (PDA) controlled by this passkey

## Prerequisites

- Node.js 18 or higher
- A Next.js project (we'll use the App Router)
- A browser with WebAuthn support (Chrome, Safari, Edge, Firefox)

## Step 1: Install Dependencies

Install the Lazorkit SDK and Solana libraries:

```bash
npm install @lazorkit/wallet @solana/web3.js @coral-xyz/anchor
```

## Step 2: Set Up the Provider

The `LazorkitProvider` wraps your application and provides wallet context to all components.

### Create the Provider Component

Create `src/components/providers/LazorkitProvider.tsx`:

```tsx
'use client';

import { LazorkitProvider } from '@lazorkit/wallet';
import { ReactNode } from 'react';

// Configuration for Solana Devnet
const config = {
  rpcUrl: process.env.NEXT_PUBLIC_LAZORKIT_RPC_URL || 'https://api.devnet.solana.com',
  portalUrl: process.env.NEXT_PUBLIC_LAZORKIT_PORTAL_URL || 'https://portal.lazor.sh',
  paymasterUrl: process.env.NEXT_PUBLIC_LAZORKIT_PAYMASTER_URL || 'https://kora.devnet.lazorkit.com',
};

interface Props {
  children: ReactNode;
}

export function LazorkitClientProvider({ children }: Props) {
  return (
    <LazorkitProvider
      rpcUrl={config.rpcUrl}
      portalUrl={config.portalUrl}
      paymasterConfig={{
        paymasterUrl: config.paymasterUrl,
      }}
    >
      {children}
    </LazorkitProvider>
  );
}
```

### Configuration Explained

| Property | Description |
|----------|-------------|
| `rpcUrl` | Solana RPC endpoint for blockchain communication |
| `portalUrl` | Lazorkit's hosted service that handles WebAuthn flows |
| `paymasterConfig` | Configuration for gasless transaction sponsorship |

### Wrap Your App

Update your root layout (`src/app/layout.tsx`):

```tsx
import { LazorkitClientProvider } from '@/components/providers/LazorkitProvider';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LazorkitClientProvider>
          {children}
        </LazorkitClientProvider>
      </body>
    </html>
  );
}
```

## Step 3: Create the Connect Button

Now create a button component that handles passkey authentication.

Create `src/components/wallet/ConnectButton.tsx`:

```tsx
'use client';

import { useWallet } from '@lazorkit/wallet';
import { useState } from 'react';

export function ConnectButton() {
  // Get wallet state and methods from the hook
  const {
    connect,
    disconnect,
    isConnected,
    isConnecting,
    smartWalletPubkey
  } = useWallet();

  const [error, setError] = useState<string | null>(null);

  // Handle the connect action
  const handleConnect = async () => {
    setError(null);
    try {
      // This triggers the passkey flow:
      // - For new users: Creates a new passkey and smart wallet
      // - For returning users: Signs in with existing passkey
      await connect();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      console.error('Connect error:', err);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  };

  // Show connected state
  if (isConnected && smartWalletPubkey) {
    const address = smartWalletPubkey.toString();
    const truncated = `${address.slice(0, 4)}...${address.slice(-4)}`;

    return (
      <div className="flex items-center gap-4">
        <span className="font-mono text-sm">{truncated}</span>
        <button
          onClick={handleDisconnect}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Show connect button
  return (
    <div className="space-y-2">
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
      >
        {isConnecting ? 'Connecting...' : 'Connect with Passkey'}
      </button>
      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}
    </div>
  );
}
```

### The `useWallet` Hook

The hook provides these key properties:

| Property | Type | Description |
|----------|------|-------------|
| `isConnected` | `boolean` | Whether a wallet is currently connected |
| `isConnecting` | `boolean` | Whether a connection is in progress |
| `smartWalletPubkey` | `PublicKey \| null` | The connected wallet's address |
| `connect()` | `function` | Initiates passkey authentication |
| `disconnect()` | `function` | Ends the current session |

## Step 4: Display Wallet Information

Create a component to show wallet details and balances.

Create `src/components/wallet/WalletInfo.tsx`:

```tsx
'use client';

import { useWallet } from '@lazorkit/wallet';
import { useEffect, useState } from 'react';
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';

export function WalletInfo() {
  const { isConnected, smartWalletPubkey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);

  // Fetch balance when connected
  useEffect(() => {
    if (!smartWalletPubkey) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      const connection = new Connection('https://api.devnet.solana.com');
      const lamports = await connection.getBalance(smartWalletPubkey);
      setBalance(lamports / LAMPORTS_PER_SOL);
    };

    fetchBalance();
  }, [smartWalletPubkey]);

  if (!isConnected || !smartWalletPubkey) {
    return null;
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold mb-2">Wallet Info</h3>

      <div className="space-y-2 text-sm">
        <div>
          <span className="text-gray-500">Address:</span>
          <code className="ml-2 bg-gray-100 px-2 py-1 rounded">
            {smartWalletPubkey.toString()}
          </code>
        </div>

        <div>
          <span className="text-gray-500">Balance:</span>
          <span className="ml-2">
            {balance !== null ? `${balance.toFixed(4)} SOL` : 'Loading...'}
          </span>
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Get test SOL at <a
          href="https://faucet.solana.com"
          target="_blank"
          className="text-blue-500 underline"
        >
          faucet.solana.com
        </a>
      </p>
    </div>
  );
}
```

## Step 5: Handle Session Persistence

Lazorkit automatically persists wallet sessions using the browser's IndexedDB. When a user returns to your app, the SDK checks for an existing session and automatically reconnects.

This happens automatically - you don't need to write any code! The `isConnected` state will be `true` after the provider initializes if a valid session exists.

### Cross-Device Session Persistence

Passkeys can sync across devices automatically through your operating system's password manager:

| Platform | Sync Method | Devices |
|----------|-------------|---------|
| **Apple** | iCloud Keychain | iPhone, iPad, Mac |
| **Google** | Google Password Manager | Android, Chrome on any device |
| **Microsoft** | Microsoft Account | Windows devices |

**How it works:**
1. User creates a passkey on Device A (e.g., iPhone)
2. Passkey syncs automatically via iCloud/Google/Microsoft
3. User visits your app on Device B (e.g., Mac)
4. User clicks "Connect" and selects the synced passkey
5. Same wallet is now accessible on both devices!

**No code required** - this is handled entirely by the operating system. Users just need to:
- Have their password manager sync enabled
- Click "Connect" on the new device
- Select their existing passkey when prompted

### Checking Session on Load

If you need to show a loading state while the session is being restored:

```tsx
'use client';

import { useWallet } from '@lazorkit/wallet';

export function App() {
  const { isConnected, isLoading } = useWallet();

  if (isLoading) {
    return <div>Restoring session...</div>;
  }

  return (
    <div>
      {isConnected ? <Dashboard /> : <LandingPage />}
    </div>
  );
}
```

## How It Works

### The Passkey Flow

```
User clicks "Connect"
       │
       ▼
┌─────────────────────────────────┐
│   Lazorkit Portal Opens         │
│   (iframe or popup)             │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│   Browser WebAuthn API          │
│   - New user: Create passkey    │
│   - Returning: Use passkey      │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│   Device Biometric Prompt       │
│   (FaceID / TouchID / PIN)      │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│   Smart Wallet PDA Created      │
│   (if new user)                 │
└─────────────┬───────────────────┘
              │
              ▼
     Wallet Connected!
```

### Smart Wallet Architecture

The wallet address you see is not a traditional keypair - it's a **Program Derived Address (PDA)** controlled by the Lazorkit on-chain program. This enables:

- **Key rotation**: Change passkeys without changing your address
- **Recovery**: Add backup authentication methods
- **Programmable logic**: Spending limits, time locks, etc.

## Next Steps

Now that you have passkey authentication working:

1. **[Tutorial 2: Gasless USDC Transfers](./tutorial-gasless-transfer.md)** - Learn to send tokens without SOL
2. **Add error handling** - Handle cases like user cancellation
3. **Customize the UI** - Style the components to match your app
4. **Deploy to production** - Switch to mainnet configuration

## Troubleshooting

### "Passkey not supported"

- Ensure you're using a supported browser (Chrome 67+, Safari 14+, Edge 79+, Firefox 60+)
- The device must have a secure authentication method (biometric or PIN)

### "Operation cancelled"

- User closed the passkey prompt - this is normal, just let them try again

### "Network error"

- Check your RPC endpoint is accessible
- Verify the portal URL is correct

## Complete Example

See the full implementation in the starter template:

- Provider: [`src/components/providers/LazorkitProvider.tsx`](../src/components/providers/LazorkitProvider.tsx)
- Connect Button: [`src/components/wallet/ConnectButton.tsx`](../src/components/wallet/ConnectButton.tsx)
- Wallet Info: [`src/components/wallet/WalletInfo.tsx`](../src/components/wallet/WalletInfo.tsx)

---

**Next:** [Tutorial 2 - Gasless USDC Transfers](./tutorial-gasless-transfer.md)
