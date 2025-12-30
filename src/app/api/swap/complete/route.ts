/**
 * Swap Completion API Route
 *
 * This API completes the SOL -> tUSDC swap by:
 * 1. Verifying the user's SOL deposit
 * 2. Calculating the tUSDC amount based on current price
 * 3. Transferring tUSDC from pool to user
 */

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

// Jupiter API for price
const JUPITER_API = 'https://lite-api.jup.ag/swap/v1';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MAINNET_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Configuration (trim to remove any newlines from env vars)
const RPC_URL = (process.env.NEXT_PUBLIC_LAZORKIT_RPC_URL || 'https://api.devnet.solana.com').trim();
const TUSDC_MINT = (process.env.TUSDC_MINT_ADDRESS || '').trim();
const POOL_KEYPAIR_BASE64 = (process.env.TUSDC_POOL_KEYPAIR || '').trim();
const POOL_TOKEN_ACCOUNT = (process.env.TUSDC_POOL_TOKEN_ACCOUNT || '').trim();

interface CompleteSwapRequest {
  userWallet: string;
  solAmount: number;
  solTxSignature: string;
}

// Get SOL/USDC price
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
    const body: CompleteSwapRequest = await request.json();
    const { userWallet, solAmount, solTxSignature } = body;

    console.log('Swap complete request:', { userWallet, solAmount, solTxSignature });

    // Validate inputs
    if (!userWallet || !solAmount || solAmount <= 0 || !solTxSignature) {
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 }
      );
    }

    // Check configuration
    if (!TUSDC_MINT || !POOL_KEYPAIR_BASE64 || !POOL_TOKEN_ACCOUNT) {
      console.log('Config check failed:', { TUSDC_MINT: !!TUSDC_MINT, POOL_KEYPAIR_BASE64: !!POOL_KEYPAIR_BASE64, POOL_TOKEN_ACCOUNT: !!POOL_TOKEN_ACCOUNT });
      return NextResponse.json(
        { error: 'Server not configured for swaps' },
        { status: 500 }
      );
    }

    const connection = new Connection(RPC_URL, 'confirmed');

    // Verify the SOL transaction exists and is confirmed
    // Wait a bit and retry if not confirmed yet
    let txConfirmed = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        console.log(`Verifying transaction (attempt ${attempt + 1}):`, solTxSignature);
        const txStatus = await connection.getSignatureStatus(solTxSignature);
        console.log('Transaction status:', JSON.stringify(txStatus));

        if (txStatus.value && !txStatus.value.err) {
          txConfirmed = true;
          break;
        }

        // Wait 2 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.error('Transaction verification error:', e);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!txConfirmed) {
      return NextResponse.json(
        { error: 'SOL transaction not confirmed after retries' },
        { status: 400 }
      );
    }

    // Get current price and calculate tUSDC amount
    const solPrice = await getSOLPrice();
    const tusdcAmount = solAmount * solPrice;
    const tusdcRawAmount = BigInt(Math.floor(tusdcAmount * 1_000_000)); // 6 decimals
    console.log('Price calculation:', { solPrice, tusdcAmount, tusdcRawAmount: tusdcRawAmount.toString() });

    // Parse keys
    let poolKeypair: Keypair;
    try {
      poolKeypair = Keypair.fromSecretKey(
        Buffer.from(POOL_KEYPAIR_BASE64, 'base64')
      );
      console.log('Pool keypair loaded, pubkey:', poolKeypair.publicKey.toBase58());
    } catch (e) {
      console.error('Failed to parse pool keypair:', e);
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const userPubkey = new PublicKey(userWallet);
    const tusdcMint = new PublicKey(TUSDC_MINT);
    const poolTokenAccountPubkey = new PublicKey(POOL_TOKEN_ACCOUNT);
    console.log('Keys parsed:', { user: userPubkey.toBase58(), mint: tusdcMint.toBase58(), poolToken: poolTokenAccountPubkey.toBase58() });

    // Get user's tUSDC token account
    // Note: allowOwnerOffCurve=true because Lazorkit smart wallets are PDAs
    const userTokenAccount = await getAssociatedTokenAddress(
      tusdcMint,
      userPubkey,
      true // allowOwnerOffCurve - required for PDA wallets like Lazorkit smart wallets
    );

    // Build transaction
    const transaction = new Transaction();

    // Check if user has a tUSDC token account, create if not
    let needsTokenAccount = false;
    try {
      await getAccount(connection, userTokenAccount);
    } catch {
      needsTokenAccount = true;
    }

    if (needsTokenAccount) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          poolKeypair.publicKey, // payer (pool pays for account creation)
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
    console.log('Sending transaction...');
    try {
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [poolKeypair],
        { commitment: 'confirmed' }
      );
      console.log('Transaction confirmed:', signature);

      return NextResponse.json({
        success: true,
        signature,
        tusdcAmount,
        solPrice,
      });
    } catch (txError) {
      console.error('Transaction send error:', txError);
      return NextResponse.json(
        { error: txError instanceof Error ? txError.message : 'Transaction failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Swap completion error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to complete swap' },
      { status: 500 }
    );
  }
}
