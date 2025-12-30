/**
 * Swap Price API Route
 *
 * Returns the current SOL/USDC price from Jupiter for swap quotes.
 */

import { NextResponse } from 'next/server';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

// Jupiter API for price feeds
const JUPITER_API = 'https://lite-api.jup.ag/swap/v1';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MAINNET_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Configuration (trim to remove any newlines from env vars)
const TUSDC_MINT = (process.env.TUSDC_MINT_ADDRESS || '').trim();
const POOL_WALLET = (process.env.TUSDC_POOL_WALLET || '').trim();

// Get SOL/USDC price from Jupiter
async function getSOLPrice(): Promise<number> {
  try {
    const response = await fetch(
      `${JUPITER_API}/quote?inputMint=${SOL_MINT}&outputMint=${USDC_MAINNET_MINT}&amount=${LAMPORTS_PER_SOL}&slippageBps=50`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch price');
    }

    const quote = await response.json();
    // outAmount is in USDC (6 decimals)
    const usdcAmount = Number(quote.outAmount) / 1_000_000;
    return usdcAmount;
  } catch (error) {
    console.error('Price fetch error:', error);
    // Fallback price if Jupiter fails
    return 180;
  }
}

// GET endpoint for price/config
export async function GET(): Promise<NextResponse> {
  try {
    const solPrice = await getSOLPrice();

    return NextResponse.json({
      solPrice,
      tusdcMint: TUSDC_MINT,
      poolWallet: POOL_WALLET,
      configured: !!(TUSDC_MINT && POOL_WALLET),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch price', solPrice: 180 },
      { status: 500 }
    );
  }
}
