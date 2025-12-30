# Tutorial: Gasless USDC Transfers with Lazorkit

Learn how to send USDC on Solana without requiring users to hold SOL for gas fees. This tutorial shows you how to leverage Lazorkit's Paymaster for sponsored transactions.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Understanding the Paymaster](#step-1-understanding-the-paymaster)
4. [Step 2: Build the Transfer Form](#step-2-build-the-transfer-form)
5. [Step 3: Create the Transfer Logic](#step-3-create-the-transfer-logic)
6. [Step 4: Handle Transaction States](#step-4-handle-transaction-states)
7. [Step 5: Add Error Handling](#step-5-add-error-handling)
8. [How It Works](#how-it-works)
9. [Testing on Devnet](#testing-on-devnet)
10. [Production Considerations](#production-considerations)

## Overview

On Solana, every transaction requires a small fee paid in SOL. This creates a poor user experience:

- New users need to acquire SOL before they can do anything
- Users must manage two tokens (SOL for gas + their actual assets)
- Low SOL balance can prevent time-sensitive transactions

Lazorkit solves this with a **Paymaster** - a service that sponsors transaction fees on behalf of users.

### What You'll Build

- A USDC transfer form with recipient and amount inputs
- Transaction signing via passkey authentication
- Gasless execution through the Paymaster
- Real-time transaction status feedback

## Prerequisites

- Completed [Tutorial 1: Passkey Wallet](./tutorial-passkey-wallet.md)
- A connected Lazorkit wallet
- Test USDC on Solana Devnet (we'll show you how to get some)

## Step 1: Understanding the Paymaster

The Paymaster is a crucial component of the Lazorkit ecosystem:

```
Your App
   │
   │ 1. Build transaction
   ▼
Lazorkit SDK
   │
   │ 2. Sign with passkey
   ▼
Paymaster Service
   │
   │ 3. Add fee payment
   │ 4. Co-sign transaction
   ▼
Solana Network
   │
   │ 5. Execute transaction
   ▼
Transaction Confirmed!
```

### Key Concepts

| Term | Description |
|------|-------------|
| **Paymaster** | Service that pays transaction fees on behalf of users |
| **feeToken** | The token used to optionally reimburse the Paymaster |
| **Sponsored Transaction** | A transaction where fees are covered by a third party |

## Step 2: Build the Transfer Form

Create a form component for USDC transfers.

Create `src/components/transfer/UsdcTransferForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useWallet } from '@lazorkit/wallet';
import { PublicKey } from '@solana/web3.js';

// USDC mint address on Devnet
const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

export function UsdcTransferForm() {
  const { isConnected, smartWalletPubkey } = useWallet();

  // Form state
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Validate Solana address
  const isValidAddress = (address: string): boolean => {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  };

  // Form validation
  const isValid = () => {
    if (!recipient || !isValidAddress(recipient)) return false;
    if (!amount || parseFloat(amount) <= 0) return false;
    return true;
  };

  if (!isConnected) {
    return <p>Please connect your wallet first.</p>;
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Recipient Address
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Enter Solana address..."
          className="w-full px-3 py-2 border rounded-lg"
        />
        {recipient && !isValidAddress(recipient) && (
          <p className="text-red-500 text-sm mt-1">Invalid address</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Amount (USDC)
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          min="0"
          step="0.01"
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      <div className="p-3 bg-blue-50 rounded-lg text-sm">
        <p className="text-blue-700">
          <strong>Gasless:</strong> This transaction is sponsored by the
          Paymaster. You don't need SOL for fees!
        </p>
      </div>

      <button
        type="submit"
        disabled={!isValid() || status === 'pending'}
        className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
      >
        {status === 'pending' ? 'Sending...' : 'Send USDC'}
      </button>

      {status === 'success' && signature && (
        <div className="p-3 bg-green-50 rounded-lg">
          <p className="text-green-700">Transfer successful!</p>
          <a
            href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
            target="_blank"
            className="text-blue-500 underline text-sm"
          >
            View on Explorer
          </a>
        </div>
      )}

      {status === 'error' && error && (
        <div className="p-3 bg-red-50 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}
    </form>
  );
}
```

## Step 3: Create the Transfer Logic

Now add the actual transfer functionality. This involves:

1. Building the SPL token transfer instruction
2. Checking/creating the recipient's token account
3. Sending via the Paymaster

Update the component with the transfer logic:

```tsx
'use client';

import { useState } from 'react';
import { useWallet } from '@lazorkit/wallet';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

// Constants
const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const USDC_DECIMALS = 6;
const RPC_URL = 'https://api.devnet.solana.com';

export function UsdcTransferForm() {
  const { isConnected, smartWalletPubkey, signAndSendTransaction } = useWallet();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTransfer = async () => {
    if (!smartWalletPubkey || !signAndSendTransaction) return;

    setStatus('pending');
    setError(null);
    setSignature(null);

    try {
      const connection = new Connection(RPC_URL, 'confirmed');
      const usdcMint = new PublicKey(USDC_MINT_DEVNET);
      const recipientPubkey = new PublicKey(recipient);

      // Convert UI amount to raw amount (USDC has 6 decimals)
      const rawAmount = Math.floor(parseFloat(amount) * Math.pow(10, USDC_DECIMALS));

      // Derive Associated Token Accounts (ATAs)
      const senderAta = await getAssociatedTokenAddress(usdcMint, smartWalletPubkey);
      const recipientAta = await getAssociatedTokenAddress(usdcMint, recipientPubkey);

      // Build instructions
      const instructions = [];

      // Check if recipient's ATA exists
      const recipientAtaInfo = await connection.getAccountInfo(recipientAta);
      if (!recipientAtaInfo) {
        // Create the recipient's ATA if it doesn't exist
        instructions.push(
          createAssociatedTokenAccountInstruction(
            smartWalletPubkey,  // payer
            recipientAta,       // ata
            recipientPubkey,    // owner
            usdcMint,           // mint
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      // Add the transfer instruction
      instructions.push(
        createTransferInstruction(
          senderAta,          // source
          recipientAta,       // destination
          smartWalletPubkey,  // authority
          rawAmount           // amount
        )
      );

      // Sign and send with gasless option
      const sig = await signAndSendTransaction({
        instructions,
        transactionOptions: {
          // This is the magic - specifying feeToken enables gasless
          feeToken: USDC_MINT_DEVNET,
        },
      });

      // Wait for confirmation
      await connection.confirmTransaction(sig, 'confirmed');

      setSignature(sig);
      setStatus('success');
      setRecipient('');
      setAmount('');

    } catch (err) {
      console.error('Transfer error:', err);
      setError(err instanceof Error ? err.message : 'Transfer failed');
      setStatus('error');
    }
  };

  // ... rest of the component (form JSX)
}
```

## Step 4: Handle Transaction States

Provide clear feedback throughout the transaction lifecycle:

```tsx
// Transaction status states
type TxStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error';

function TransferButton({ status, onClick, disabled }) {
  const labels = {
    idle: 'Send USDC',
    building: 'Building Transaction...',
    signing: 'Sign with Passkey...',
    confirming: 'Confirming...',
    success: 'Send Another',
    error: 'Try Again',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || status === 'building' || status === 'signing' || status === 'confirming'}
      className="w-full py-3 bg-blue-500 text-white rounded-lg disabled:opacity-50"
    >
      {labels[status]}
    </button>
  );
}
```

## Step 5: Add Error Handling

Handle common error cases gracefully:

```tsx
const handleTransfer = async () => {
  try {
    // ... transfer logic

  } catch (err) {
    let errorMessage = 'Transfer failed';

    if (err instanceof Error) {
      // Parse common errors
      if (err.message.includes('insufficient')) {
        errorMessage = 'Insufficient USDC balance';
      } else if (err.message.includes('cancelled') || err.message.includes('aborted')) {
        errorMessage = 'Transaction cancelled';
      } else if (err.message.includes('network')) {
        errorMessage = 'Network error. Please try again.';
      } else {
        errorMessage = err.message;
      }
    }

    setError(errorMessage);
    setStatus('error');
  }
};
```

## How It Works

### The Gasless Transaction Flow

```
1. BUILD TRANSACTION
   ┌──────────────────────────────────────────┐
   │ Your app creates:                        │
   │ - Transfer instruction (USDC → recipient)│
   │ - Optional: Create ATA instruction       │
   │ + feeToken: USDC_MINT_ADDRESS            │
   └──────────────────────┬───────────────────┘
                          │
                          ▼
2. SIGN WITH PASSKEY
   ┌──────────────────────────────────────────┐
   │ User authenticates via:                  │
   │ - FaceID / TouchID / Windows Hello       │
   │ - Passkey signs the transaction locally  │
   └──────────────────────┬───────────────────┘
                          │
                          ▼
3. PAYMASTER PROCESSING
   ┌──────────────────────────────────────────┐
   │ Lazorkit Paymaster:                      │
   │ - Receives partially signed transaction  │
   │ - Adds fee payment (sponsors the tx)     │
   │ - Co-signs with its key                  │
   └──────────────────────┬───────────────────┘
                          │
                          ▼
4. SUBMIT TO NETWORK
   ┌──────────────────────────────────────────┐
   │ Transaction sent to Solana:              │
   │ - User's USDC transfer executes          │
   │ - Paymaster pays the network fee         │
   │ - User never needs SOL!                  │
   └──────────────────────────────────────────┘
```

### Why This Works

The Solana runtime doesn't care *who* pays the transaction fee - it just needs to be paid. The Paymaster:

1. Receives your signed transaction
2. Wraps it with fee payment from its own wallet
3. Submits the complete transaction to the network

## Testing on Devnet

### Get Test USDC

1. **Get Test SOL first** (needed for the faucet):
   - Visit [faucet.solana.com](https://faucet.solana.com)
   - Enter your smart wallet address
   - Request an airdrop

2. **Get Devnet USDC**:
   - Visit [SPL Token Faucet](https://spl-token-faucet.com/?token-name=USDC-Dev)
   - Connect and receive test USDC

3. **Test the Transfer**:
   - Enter a recipient address (use another wallet or your own)
   - Enter an amount (e.g., 1.00)
   - Click Send and authenticate with your passkey
   - View the transaction on Solana Explorer

### Test Recipient Address

Need an address to test with? Create another passkey wallet in a different browser, or use this devnet faucet address:
```
DemouCYGxkqxNX5Tw8DKJL2EpGQe5cCxFdJ5pHpgGpYf
```

## Production Considerations

### Fee Token Configuration

In production, you may want to:

```tsx
// Option 1: Always use USDC for fees (gasless)
transactionOptions: {
  feeToken: USDC_MINT_MAINNET,
}

// Option 2: Let user pay in SOL (not gasless)
transactionOptions: {
  // No feeToken = user pays in SOL
}

// Option 3: Conditional based on user preference
transactionOptions: {
  feeToken: userPrefersGasless ? USDC_MINT_MAINNET : undefined,
}
```

### Mainnet USDC Mint

```tsx
// Mainnet USDC (Circle official)
const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
```

### Rate Limits

The Paymaster may have rate limits or spending caps. Check with Lazorkit documentation for production limits.

## Complete Code

See the full implementation:
- Transfer Form: [`src/components/transfer/UsdcTransferForm.tsx`](../src/components/transfer/UsdcTransferForm.tsx)
- Constants: [`src/lib/constants.ts`](../src/lib/constants.ts)
- Balance Hook: [`src/hooks/useWalletBalance.ts`](../src/hooks/useWalletBalance.ts)

## Summary

You've learned how to:

1. **Configure the Paymaster** - Set up gasless transactions in the provider
2. **Build SPL token transfers** - Create transfer instructions for USDC
3. **Handle ATAs** - Create recipient token accounts when needed
4. **Use `feeToken`** - Enable gasless execution via the Paymaster
5. **Manage states** - Provide clear feedback during transactions

### Key Takeaways

- The `feeToken` option in `transactionOptions` enables gasless transactions
- The Paymaster sponsors the fee, so users don't need SOL
- Always handle the case where recipient's ATA doesn't exist
- Provide clear transaction status feedback to users

---

**Prev:** [Tutorial 1 - Passkey Wallet](./tutorial-passkey-wallet.md)

**Resources:**
- [Lazorkit Documentation](https://docs.lazorkit.com)
- [SPL Token Documentation](https://spl.solana.com/token)
- [Solana Cookbook](https://solanacookbook.com)
