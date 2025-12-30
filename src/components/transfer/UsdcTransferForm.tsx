'use client';

/**
 * UsdcTransferForm - Gasless USDC transfer component
 *
 * This component demonstrates Lazorkit's gasless transaction capability:
 * - Users can send USDC without holding SOL for gas fees
 * - The Paymaster sponsors the transaction fees
 * - Fees can optionally be deducted from the USDC being sent
 *
 * Key implementation details:
 * - Uses SPL Token's createTransferInstruction for the USDC transfer
 * - Passes feeToken: 'USDC' to enable fee payment in USDC
 * - The signAndSendTransaction method handles signing via passkey
 *
 * @example
 * ```tsx
 * <UsdcTransferForm />
 * ```
 */

import { useState } from 'react';
import { useWallet } from '@lazorkit/wallet';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { PublicKey } from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Connection } from '@solana/web3.js';
import {
  LAZORKIT_CONFIG,
  USDC_MINT_ADDRESS,
  USDC_DECIMALS,
  TUSDC_CONFIG,
  getTransactionUrl,
} from '@/lib/constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, Loader2, CheckCircle, ExternalLink, Send } from 'lucide-react';
import { toast } from 'sonner';

// Transaction state type
type TxState = 'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error';

export function UsdcTransferForm() {
  const { isConnected, smartWalletPubkey, signAndSendTransaction } = useWallet();

  // Form state
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [txState, setTxState] = useState<TxState>('idle');
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get wallet address and balances
  const address = smartWalletPubkey?.toString() || null;
  const { usdcBalance, refresh: refreshBalance } = useWalletBalance(address);

  // Validate recipient address
  const isValidAddress = (addr: string): boolean => {
    try {
      new PublicKey(addr);
      return true;
    } catch {
      return false;
    }
  };

  // Validate form
  const isValidForm = (): boolean => {
    if (!recipient || !isValidAddress(recipient)) return false;
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) return false;
    if (parseFloat(amount) > usdcBalance) return false;
    return true;
  };

  // Handle transfer
  const handleTransfer = async () => {
    if (!isConnected || !smartWalletPubkey || !signAndSendTransaction) {
      toast.error('Wallet not connected');
      return;
    }

    if (!isValidForm()) {
      toast.error('Please check your inputs');
      return;
    }

    setError(null);
    setTxSignature(null);
    setTxState('building');

    try {
      const connection = new Connection(LAZORKIT_CONFIG.rpcUrl, 'confirmed');
      const usdcMint = new PublicKey(USDC_MINT_ADDRESS);
      const recipientPubkey = new PublicKey(recipient);
      const senderPubkey = smartWalletPubkey;

      // Convert UI amount to raw amount (USDC has 6 decimals)
      const rawAmount = Math.floor(parseFloat(amount) * Math.pow(10, USDC_DECIMALS));

      // Derive Associated Token Accounts (ATAs)
      // ATAs are deterministic addresses that hold SPL tokens for a wallet
      // allowOwnerOffCurve=true because Lazorkit smart wallets are PDAs
      const senderAta = await getAssociatedTokenAddress(usdcMint, senderPubkey, true);
      const recipientAta = await getAssociatedTokenAddress(usdcMint, recipientPubkey, true);

      // Build instructions array
      const instructions = [];

      // Check if recipient's ATA exists, if not we need to create it
      // This is a common pattern in Solana - you can't send tokens to an address
      // that doesn't have a token account for that specific mint
      const recipientAtaInfo = await connection.getAccountInfo(recipientAta);
      if (!recipientAtaInfo) {
        // Add instruction to create the recipient's ATA
        // The sender pays for this (included in the transaction)
        instructions.push(
          createAssociatedTokenAccountInstruction(
            senderPubkey, // payer
            recipientAta, // ata address
            recipientPubkey, // owner
            usdcMint, // mint
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      // Add the transfer instruction
      instructions.push(
        createTransferInstruction(
          senderAta, // source
          recipientAta, // destination
          senderPubkey, // owner/authority
          rawAmount // amount in raw units
        )
      );

      setTxState('signing');

      // Sign and send the transaction using Lazorkit
      // The magic happens here:
      // - signAndSendTransaction triggers passkey authentication
      // - feeToken: 'USDC' tells the paymaster to sponsor fees
      // - The user signs with their biometric (FaceID/TouchID)
      // - Transaction is submitted and confirmed
      const signature = await signAndSendTransaction({
        instructions,
        transactionOptions: {
          // This is the key for gasless transactions!
          // By specifying USDC as the fee token, the Paymaster
          // will sponsor the transaction fees
          feeToken: USDC_MINT_ADDRESS,
          // Optionally specify compute unit limit
          // computeUnitLimit: 200000,
        },
      });

      setTxState('confirming');

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      setTxState('success');
      setTxSignature(signature);

      toast.success('Transfer successful!', {
        description: `Sent ${amount} ${TUSDC_CONFIG.symbol}`,
        action: {
          label: 'View',
          onClick: () => window.open(getTransactionUrl(signature), '_blank'),
        },
      });

      // Refresh balance after successful transfer
      await refreshBalance();

      // Reset form
      setRecipient('');
      setAmount('');
    } catch (err) {
      setTxState('error');
      const errorMessage = err instanceof Error ? err.message : 'Transfer failed';
      setError(errorMessage);
      toast.error('Transfer failed', { description: errorMessage });
      console.error('Transfer error:', err);
    }
  };

  // Reset form state
  const resetForm = () => {
    setTxState('idle');
    setTxSignature(null);
    setError(null);
  };

  // Don't render if not connected
  if (!isConnected) {
    return null;
  }

  // Success state
  if (txState === 'success' && txSignature) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle className="h-5 w-5" />
            <CardTitle>Transfer Complete</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-600 dark:text-green-400">
              Successfully sent {amount} {TUSDC_CONFIG.symbol}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Transaction Signature</p>
            <code className="block p-2 bg-muted rounded text-xs font-mono break-all">
              {txSignature}
            </code>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={resetForm}>
              New Transfer
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={() => window.open(getTransactionUrl(txSignature), '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              View on Explorer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          <CardTitle>Send {TUSDC_CONFIG.symbol}</CardTitle>
        </div>
        <CardDescription>
          Send {TUSDC_CONFIG.symbol} gaslessly - no SOL needed for transaction fees
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recipient Input */}
        <div className="space-y-2">
          <Label htmlFor="recipient">Recipient Address</Label>
          <Input
            id="recipient"
            placeholder="Enter Solana address..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={txState !== 'idle'}
            className={
              recipient && !isValidAddress(recipient)
                ? 'border-red-500 focus-visible:ring-red-500'
                : ''
            }
          />
          {recipient && !isValidAddress(recipient) && (
            <p className="text-xs text-red-500">Invalid Solana address</p>
          )}
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="amount">Amount ({TUSDC_CONFIG.symbol})</Label>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setAmount(usdcBalance.toString())}
              disabled={txState !== 'idle'}
            >
              Max: {usdcBalance.toFixed(2)} {TUSDC_CONFIG.symbol}
            </button>
          </div>
          <Input
            id="amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={txState !== 'idle'}
            min="0"
            step="0.01"
          />
          {amount && parseFloat(amount) > usdcBalance && (
            <p className="text-xs text-red-500">Insufficient balance</p>
          )}
        </div>

        <Separator />

        {/* Transaction Summary */}
        {amount && parseFloat(amount) > 0 && isValidAddress(recipient) && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <p className="text-sm font-medium">Transaction Summary</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-mono">{parseFloat(amount).toFixed(2)} {TUSDC_CONFIG.symbol}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Network Fee</span>
              <span className="font-mono text-green-600 dark:text-green-400">
                Sponsored (Gasless)
              </span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <Button
          className="w-full gap-2"
          onClick={handleTransfer}
          disabled={!isValidForm() || txState !== 'idle'}
        >
          {txState === 'building' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Building Transaction...
            </>
          )}
          {txState === 'signing' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sign with Passkey...
            </>
          )}
          {txState === 'confirming' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Confirming...
            </>
          )}
          {txState === 'idle' && (
            <>
              <ArrowRight className="h-4 w-4" />
              Send {TUSDC_CONFIG.symbol}
            </>
          )}
          {txState === 'error' && 'Try Again'}
        </Button>

        {/* Info Box */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-600 dark:text-blue-400">
            <strong>How it works:</strong> Lazorkit&apos;s Paymaster sponsors the transaction fee,
            so you don&apos;t need any SOL to send {TUSDC_CONFIG.symbol}. Your passkey securely signs the
            transaction.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
