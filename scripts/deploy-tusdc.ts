/**
 * Deploy tUSDC (Test USDC) Token on Devnet
 *
 * This script creates a custom SPL token for testing the swap functionality.
 * The token mimics USDC with 6 decimals.
 *
 * Usage:
 *   npx tsx scripts/deploy-tusdc.ts
 */

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

const DEVNET_RPC = 'https://api.devnet.solana.com';
const TUSDC_DECIMALS = 6;
const INITIAL_SUPPLY = 1_000_000_000; // 1 billion tUSDC

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function airdropWithRetry(
  connection: Connection,
  pubkey: any,
  lamports: number,
  maxRetries = 5
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`   Attempt ${i + 1}/${maxRetries}...`);
      const sig = await connection.requestAirdrop(pubkey, lamports);
      await connection.confirmTransaction(sig, 'confirmed');
      return true;
    } catch (error: any) {
      if (i < maxRetries - 1) {
        console.log(`   Rate limited, waiting 15 seconds...`);
        await sleep(15000);
      }
    }
  }
  return false;
}

async function main() {
  console.log('🚀 Deploying tUSDC (Test USDC) on Devnet...\n');

  const connection = new Connection(DEVNET_RPC, 'confirmed');

  // Generate keypairs
  const mintAuthority = Keypair.generate();
  const poolWallet = Keypair.generate();

  console.log('📝 Generated Keypairs:');
  console.log(`   Mint Authority: ${mintAuthority.publicKey.toBase58()}`);
  console.log(`   Pool Wallet: ${poolWallet.publicKey.toBase58()}`);

  // Airdrop SOL
  console.log('\n💰 Requesting airdrop (this may take a moment)...');
  const airdropSuccess = await airdropWithRetry(
    connection,
    mintAuthority.publicKey,
    2 * LAMPORTS_PER_SOL
  );

  if (!airdropSuccess) {
    console.log('\n❌ Airdrop failed after retries.');
    console.log('   Please manually fund the wallet and re-run:');
    console.log(`   solana airdrop 2 ${mintAuthority.publicKey.toBase58()} --url devnet`);

    // Save keypairs anyway so user can fund and continue
    saveKeypairs(mintAuthority, poolWallet);
    return;
  }

  console.log('   ✅ Airdrop successful!');

  // Create the tUSDC mint
  console.log('\n🪙 Creating tUSDC mint...');
  const mintPubkey = await createMint(
    connection,
    mintAuthority,
    mintAuthority.publicKey,
    mintAuthority.publicKey,
    TUSDC_DECIMALS,
    undefined,
    undefined,
    TOKEN_PROGRAM_ID
  );
  console.log(`   ✅ Mint Address: ${mintPubkey.toBase58()}`);

  // Create token account for pool
  console.log('\n📦 Creating pool token account...');
  const poolTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    mintAuthority,
    mintPubkey,
    poolWallet.publicKey
  );
  console.log(`   ✅ Pool Token Account: ${poolTokenAccount.address.toBase58()}`);

  // Mint initial supply
  console.log('\n💵 Minting initial supply to pool...');
  const mintAmount = BigInt(INITIAL_SUPPLY) * BigInt(10 ** TUSDC_DECIMALS);
  await mintTo(
    connection,
    mintAuthority,
    mintPubkey,
    poolTokenAccount.address,
    mintAuthority,
    mintAmount
  );
  console.log(`   ✅ Minted ${INITIAL_SUPPLY.toLocaleString()} tUSDC`);

  // Save everything
  saveKeypairs(mintAuthority, poolWallet);

  // Output env vars
  console.log('\n✅ Deployment Complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Add these to your .env.local file:\n');
  console.log(`TUSDC_MINT_ADDRESS=${mintPubkey.toBase58()}`);
  console.log(`TUSDC_POOL_WALLET=${poolWallet.publicKey.toBase58()}`);
  console.log(`TUSDC_POOL_TOKEN_ACCOUNT=${poolTokenAccount.address.toBase58()}`);
  console.log(`TUSDC_MINT_AUTHORITY=${Buffer.from(mintAuthority.secretKey).toString('base64')}`);
  console.log(`TUSDC_POOL_KEYPAIR=${Buffer.from(poolWallet.secretKey).toString('base64')}`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📖 View on Explorer:');
  console.log(`   https://explorer.solana.com/address/${mintPubkey.toBase58()}?cluster=devnet`);
}

function saveKeypairs(mintAuthority: Keypair, poolWallet: Keypair) {
  const keysDir = path.join(process.cwd(), '.keys');
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(keysDir, 'mint-authority.json'),
    JSON.stringify(Array.from(mintAuthority.secretKey))
  );

  fs.writeFileSync(
    path.join(keysDir, 'pool-wallet.json'),
    JSON.stringify(Array.from(poolWallet.secretKey))
  );

  console.log('\n📁 Keypairs saved to .keys/ directory');
}

main().catch(console.error);
