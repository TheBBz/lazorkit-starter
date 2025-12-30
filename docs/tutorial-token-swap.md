# Tutorial: Token Swaps with Real Price Feeds

Learn how to implement a SOL → tUSDC swap feature using real-time price feeds from Jupiter. This tutorial shows you how to build a complete swap flow that works with Lazorkit's gasless transactions.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Deploy a Test Token](#step-1-deploy-a-test-token)
4. [Step 2: Create the Price API](#step-2-create-the-price-api)
5. [Step 3: Create the Swap Completion API](#step-3-create-the-swap-completion-api)
6. [Step 4: Build the Swap UI](#step-4-build-the-swap-ui)
7. [How It Works](#how-it-works)
8. [Production Considerations](#production-considerations)

## Overview

On devnet, there's no real USDC liquidity for swaps. This tutorial shows how to create a **mock swap system** that:

- Uses real SOL/USDC prices from Jupiter API
- Deploys a custom tUSDC (Test USDC) token on devnet
- Implements a two-step swap: User sends SOL → Backend sends tUSDC
- Integrates with Lazorkit's gasless transaction system

### What You'll Build

- A swap form UI with real-time price quotes
- Backend API routes for price fetching and swap completion
- A custom tUSDC token deployment script

## Prerequisites

- Completed [Tutorial 1: Passkey Wallet](./tutorial-passkey-wallet.md)
- A connected Lazorkit wallet with some devnet SOL
- Node.js 18+ and npm

## Step 1: Deploy a Test Token

First, create a custom tUSDC token on devnet to use for testing.

### Create the Deployment Script

Create `scripts/deploy-tusdc.ts`:

```typescript
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token';

const RPC_URL = 'https://api.devnet.solana.com';
const TUSDC_DECIMALS = 6; // Same as real USDC
const INITIAL_SUPPLY = 1_000_000_000; // 1 billion tUSDC

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed');

  // Generate keypairs
  const mintAuthority = Keypair.generate();
  const poolWallet = Keypair.generate();

  console.log('Requesting airdrop for mint authority...');
  const airdropSig = await connection.requestAirdrop(
    mintAuthority.publicKey,
    2 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdropSig);

  console.log('Creating tUSDC mint...');
  const mint = await createMint(
    connection,
    mintAuthority,
    mintAuthority.publicKey,
    null, // No freeze authority
    TUSDC_DECIMALS
  );

  console.log('Creating pool token account...');
  const poolTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    mintAuthority,
    mint,
    poolWallet.publicKey
  );

  console.log('Minting initial supply...');
  const rawAmount = BigInt(INITIAL_SUPPLY) * BigInt(10 ** TUSDC_DECIMALS);
  await mintTo(
    connection,
    mintAuthority,
    mint,
    poolTokenAccount.address,
    mintAuthority,
    rawAmount
  );

  // Output configuration
  console.log('\n=== tUSDC Deployment Complete ===\n');
  console.log('Add these to your .env.local:\n');
  console.log(`TUSDC_MINT_ADDRESS=${mint.toBase58()}`);
  console.log(`TUSDC_POOL_WALLET=${poolWallet.publicKey.toBase58()}`);
  console.log(`TUSDC_POOL_TOKEN_ACCOUNT=${poolTokenAccount.address.toBase58()}`);
  console.log(`TUSDC_POOL_KEYPAIR=${Buffer.from(poolWallet.secretKey).toString('base64')}`);
  console.log(`\nNEXT_PUBLIC_TUSDC_MINT_ADDRESS=${mint.toBase58()}`);
  console.log(`NEXT_PUBLIC_TUSDC_POOL_WALLET=${poolWallet.publicKey.toBase58()}`);
}

main().catch(console.error);
```

### Run the Deployment

```bash
npx tsx scripts/deploy-tusdc.ts
```

Add the output values to your `.env.local` file.

## Step 2: Create the Price API

Create an API route that fetches real SOL/USDC prices from Jupiter.

### Create `src/app/api/swap/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

// Jupiter API for mainnet price data
const JUPITER_API = 'https://lite-api.jup.ag/swap/v1';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MAINNET_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const TUSDC_MINT = process.env.NEXT_PUBLIC_TUSDC_MINT_ADDRESS || '';
const POOL_WALLET = process.env.NEXT_PUBLIC_TUSDC_POOL_WALLET || '';

export async function GET() {
  try {
    // Fetch real SOL/USDC price from Jupiter
    const response = await fetch(
      `${JUPITER_API}/quote?inputMint=${SOL_MINT}&outputMint=${USDC_MAINNET_MINT}&amount=${LAMPORTS_PER_SOL}&slippageBps=50`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch price');
    }

    const quote = await response.json();
    const solPrice = Number(quote.outAmount) / 1_000_000; // USDC has 6 decimals

    return NextResponse.json({
      solPrice,
      tusdcMint: TUSDC_MINT,
      poolWallet: POOL_WALLET,
      configured: Boolean(TUSDC_MINT && POOL_WALLET),
    });
  } catch (error) {
    console.error('Price fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch price', solPrice: 180 }, // Fallback price
      { status: 500 }
    );
  }
}
```

## Step 3: Create the Swap Completion API

Create the API that completes swaps by sending tUSDC to users after they send SOL.

### Create `src/app/api/swap/complete/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

const RPC_URL = process.env.NEXT_PUBLIC_LAZORKIT_RPC_URL || 'https://api.devnet.solana.com';
const TUSDC_MINT = process.env.TUSDC_MINT_ADDRESS || '';
const POOL_KEYPAIR_BASE64 = process.env.TUSDC_POOL_KEYPAIR || '';
const POOL_TOKEN_ACCOUNT = process.env.TUSDC_POOL_TOKEN_ACCOUNT || '';

// Jupiter API for price
const JUPITER_API = 'https://lite-api.jup.ag/swap/v1';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MAINNET_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

async function getSOLPrice(): Promise<number> {
  try {
    const response = await fetch(
      `${JUPITER_API}/quote?inputMint=${SOL_MINT}&outputMint=${USDC_MAINNET_MINT}&amount=${LAMPORTS_PER_SOL}&slippageBps=50`
    );
    if (!response.ok) throw new Error('Failed to fetch price');
    const quote = await response.json();
    return Number(quote.outAmount) / 1_000_000;
  } catch {
    return 180; // Fallback price
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { userWallet, solAmount, solTxSignature } = body;

    // Validate inputs
    if (!userWallet || !solAmount || solAmount <= 0 || !solTxSignature) {
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 }
      );
    }

    // Check configuration
    if (!TUSDC_MINT || !POOL_KEYPAIR_BASE64 || !POOL_TOKEN_ACCOUNT) {
      return NextResponse.json(
        { error: 'Server not configured for swaps' },
        { status: 500 }
      );
    }

    const connection = new Connection(RPC_URL, 'confirmed');

    // Verify the SOL transaction with retries
    let txConfirmed = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const txStatus = await connection.getSignatureStatus(solTxSignature);
      if (txStatus.value && !txStatus.value.err) {
        txConfirmed = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!txConfirmed) {
      return NextResponse.json(
        { error: 'SOL transaction not confirmed' },
        { status: 400 }
      );
    }

    // Calculate tUSDC amount
    const solPrice = await getSOLPrice();
    const tusdcAmount = solAmount * solPrice;
    const tusdcRawAmount = BigInt(Math.floor(tusdcAmount * 1_000_000));

    // Parse keys
    const poolKeypair = Keypair.fromSecretKey(
      Buffer.from(POOL_KEYPAIR_BASE64, 'base64')
    );
    const userPubkey = new PublicKey(userWallet);
    const tusdcMint = new PublicKey(TUSDC_MINT);
    const poolTokenAccountPubkey = new PublicKey(POOL_TOKEN_ACCOUNT);

    // Get user's tUSDC token account
    // IMPORTANT: allowOwnerOffCurve=true for PDA wallets (Lazorkit smart wallets)
    const userTokenAccount = await getAssociatedTokenAddress(
      tusdcMint,
      userPubkey,
      true // allowOwnerOffCurve - required for Lazorkit smart wallets
    );

    // Build transaction
    const transaction = new Transaction();

    // Check if user has a tUSDC token account
    let needsTokenAccount = false;
    try {
      await getAccount(connection, userTokenAccount);
    } catch {
      needsTokenAccount = true;
    }

    if (needsTokenAccount) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          poolKeypair.publicKey, // payer
          userTokenAccount,
          userPubkey,
          tusdcMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    // Transfer tUSDC from pool to user
    transaction.add(
      createTransferInstruction(
        poolTokenAccountPubkey,
        userTokenAccount,
        poolKeypair.publicKey,
        tusdcRawAmount
      )
    );

    // Send transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [poolKeypair],
      { commitment: 'confirmed' }
    );

    return NextResponse.json({
      success: true,
      signature,
      tusdcAmount,
      solPrice,
    });
  } catch (error) {
    console.error('Swap completion error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to complete swap' },
      { status: 500 }
    );
  }
}
```

## Step 4: Build the Swap UI

Create the frontend component for the swap interface.

### Create `src/components/swap/TokenSwapForm.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@lazorkit/wallet';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowDown, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface SwapQuote {
  solPrice: number;
  tusdcAmount: number;
  poolWallet: string;
}

export function TokenSwapForm() {
  const { isConnected, smartWalletPubkey, signAndSendTransaction } = useWallet();
  const address = smartWalletPubkey?.toString() || null;
  const { solBalance, refresh: refreshBalance } = useWalletBalance(address);

  const [solAmount, setSolAmount] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  // Fetch price quote
  const fetchQuote = useCallback(async (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      setQuote(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/swap');
      const data = await response.json();

      if (data.solPrice && data.poolWallet) {
        setQuote({
          solPrice: data.solPrice,
          tusdcAmount: parseFloat(amount) * data.solPrice,
          poolWallet: data.poolWallet,
        });
      }
    } catch (error) {
      console.error('Failed to fetch quote:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounce quote fetching
  useEffect(() => {
    if (!solAmount || parseFloat(solAmount) <= 0) {
      setQuote(null);
      return;
    }

    const timer = setTimeout(() => {
      fetchQuote(solAmount);
    }, 500);

    return () => clearTimeout(timer);
  }, [solAmount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle swap
  const handleSwap = async () => {
    if (!smartWalletPubkey || !signAndSendTransaction || !quote) return;

    setIsSwapping(true);
    try {
      const lamports = Math.floor(parseFloat(solAmount) * LAMPORTS_PER_SOL);

      // Step 1: Send SOL to pool wallet
      const solSignature = await signAndSendTransaction({
        instructions: [
          SystemProgram.transfer({
            fromPubkey: smartWalletPubkey,
            toPubkey: new PublicKey(quote.poolWallet),
            lamports,
          }),
        ],
      });

      toast.info('SOL sent, completing swap...');

      // Step 2: Call backend to send tUSDC
      const response = await fetch('/api/swap/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userWallet: smartWalletPubkey.toString(),
          solAmount: parseFloat(solAmount),
          solTxSignature: solSignature,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast.success(`Swapped ${solAmount} SOL for ${result.tusdcAmount.toFixed(2)} tUSDC!`);
      setSolAmount('');
      setQuote(null);
      await refreshBalance();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Swap failed');
    } finally {
      setIsSwapping(false);
    }
  };

  if (!isConnected) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Swap SOL → tUSDC</CardTitle>
        <CardDescription>
          Convert SOL to tUSDC using real-time prices from Jupiter
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* SOL Input */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>You pay</Label>
            <span className="text-sm text-muted-foreground">
              Balance: {solBalance.toFixed(4)} SOL
            </span>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="0.0"
              value={solAmount}
              onChange={(e) => setSolAmount(e.target.value)}
              disabled={isSwapping}
            />
            <Button
              variant="outline"
              onClick={() => setSolAmount(Math.max(0, solBalance - 0.01).toString())}
              disabled={isSwapping}
            >
              MAX
            </Button>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowDown className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* tUSDC Output */}
        <div className="space-y-2">
          <Label>You receive</Label>
          <div className="p-3 bg-muted rounded-lg">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : quote ? (
              <span className="text-xl font-mono">
                {quote.tusdcAmount.toFixed(2)} tUSDC
              </span>
            ) : (
              <span className="text-muted-foreground">Enter amount</span>
            )}
          </div>
          {quote && (
            <p className="text-xs text-muted-foreground">
              1 SOL = ${quote.solPrice.toFixed(2)} (Jupiter price)
            </p>
          )}
        </div>

        {/* Swap Button */}
        <Button
          className="w-full"
          onClick={handleSwap}
          disabled={!quote || isSwapping || parseFloat(solAmount) > solBalance}
        >
          {isSwapping ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Swapping...
            </>
          ) : (
            'Swap Now'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
```

## How It Works

### The Two-Step Swap Process

Since Jupiter's swap API only works on mainnet and devnet lacks real USDC liquidity, we implement a mock swap:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. GET PRICE QUOTE                                          │
│    - Frontend calls /api/swap                               │
│    - Backend fetches SOL/USDC price from Jupiter (mainnet)  │
│    - Returns: price, pool wallet address                    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. USER SENDS SOL                                           │
│    - signAndSendTransaction with SystemProgram.transfer     │
│    - SOL goes to pool wallet (controlled by backend)        │
│    - Transaction signed with passkey                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. BACKEND COMPLETES SWAP                                   │
│    - POST /api/swap/complete with SOL tx signature          │
│    - Backend verifies SOL transaction confirmed             │
│    - Calculates tUSDC amount from Jupiter price             │
│    - Sends tUSDC from pool to user's wallet                 │
└─────────────────────────────────────────────────────────────┘
```

### Why allowOwnerOffCurve = true?

Lazorkit smart wallets are **Program Derived Addresses (PDAs)**, which are "off-curve" keys (not on the ed25519 elliptic curve). When deriving Associated Token Accounts for these wallets, you must set `allowOwnerOffCurve: true`:

```typescript
const userTokenAccount = await getAssociatedTokenAddress(
  mintAddress,
  userPubkey,
  true  // Required for PDA wallets!
);
```

Without this, you'll get a `TokenOwnerOffCurveError`.

## Production Considerations

### Using Real Swaps

For production on mainnet, you would:

1. **Use Jupiter's Swap API directly** - Build swap transactions with Jupiter and execute them
2. **No mock tokens needed** - Real USDC liquidity is available
3. **Fee considerations** - Jupiter charges fees for swaps

### Security

For production swap backends:

- Rate limit the swap API
- Verify transaction amounts match quotes
- Add slippage protection
- Monitor pool balances

### Example: Direct Jupiter Integration

```typescript
// For mainnet, use Jupiter's swap API directly
const quoteResponse = await fetch(
  `https://lite-api.jup.ag/swap/v1/quote?inputMint=${SOL_MINT}&outputMint=${USDC_MINT}&amount=${lamports}`
);
const quote = await quoteResponse.json();

const swapResponse = await fetch('https://lite-api.jup.ag/swap/v1/swap', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quoteResponse: quote,
    userPublicKey: walletPubkey.toString(),
  }),
});
const swapTransaction = await swapResponse.json();
// Sign and send the transaction...
```

---

**Prev:** [Tutorial 2 - Gasless Transfers](./tutorial-gasless-transfer.md)

**Resources:**
- [Jupiter API Documentation](https://station.jup.ag/docs/apis/swap-api)
- [SPL Token Documentation](https://spl.solana.com/token)
- [Lazorkit Documentation](https://docs.lazorkit.com)
