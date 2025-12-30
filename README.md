# Lazorkit Starter

A Next.js starter template demonstrating **Lazorkit SDK** integration with passkey authentication and gasless USDC transfers on Solana.

![Lazorkit Starter](https://img.shields.io/badge/Solana-Devnet-purple)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## Features

- **Seedless Authentication** - Sign in with FaceID, TouchID, or Windows Hello using WebAuthn passkeys
- **Gasless Transactions** - Send USDC without holding SOL for gas fees via Paymaster
- **Smart Wallets** - Programmable PDA-based accounts managed by Lazorkit
- **Modern Stack** - Built with Next.js 14, TypeScript, Tailwind CSS, and shadcn/ui

## Demo

[Live Demo on Vercel](https://your-deployment-url.vercel.app) (Coming soon)

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm
- A browser with WebAuthn support (Chrome, Safari, Edge, Firefox)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/lazorkit-starter.git
cd lazorkit-starter
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

```bash
cp .env.example .env.local
```

The default configuration connects to Solana Devnet. Edit `.env.local` if you need custom RPC endpoints:

```env
NEXT_PUBLIC_LAZORKIT_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_LAZORKIT_PORTAL_URL=https://portal.lazor.sh
NEXT_PUBLIC_LAZORKIT_PAYMASTER_URL=https://lazorkit-paymaster.onrender.com
```

4. **Start the development server**

```bash
npm run dev
```

5. **Open the app**

Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
lazorkit-starter/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with providers
│   │   ├── page.tsx            # Landing page
│   │   └── dashboard/
│   │       └── page.tsx        # Wallet dashboard
│   ├── components/
│   │   ├── providers/
│   │   │   └── LazorkitProvider.tsx   # SDK provider wrapper
│   │   ├── wallet/
│   │   │   ├── ConnectButton.tsx      # Passkey connect/disconnect
│   │   │   └── WalletInfo.tsx         # Address & balance display
│   │   ├── transfer/
│   │   │   └── UsdcTransferForm.tsx   # Gasless USDC transfer
│   │   └── ui/                 # shadcn/ui components
│   ├── hooks/
│   │   └── useWalletBalance.ts # Balance fetching hook
│   ├── lib/
│   │   ├── constants.ts        # Configuration constants
│   │   └── utils.ts            # Helper functions
│   └── types/
│       └── index.ts            # TypeScript definitions
├── docs/
│   ├── tutorial-passkey-wallet.md     # Tutorial 1
│   └── tutorial-gasless-transfer.md   # Tutorial 2
└── .env.example                # Environment template
```

## Core SDK Integration

### 1. Provider Setup

Wrap your app with `LazorkitProvider` to enable wallet functionality:

```tsx
// src/components/providers/LazorkitProvider.tsx
import { LazorkitProvider } from '@lazorkit/wallet';

export function LazorkitClientProvider({ children }) {
  return (
    <LazorkitProvider
      rpcUrl={process.env.NEXT_PUBLIC_LAZORKIT_RPC_URL}
      portalUrl={process.env.NEXT_PUBLIC_LAZORKIT_PORTAL_URL}
      paymasterConfig={{
        paymasterUrl: process.env.NEXT_PUBLIC_LAZORKIT_PAYMASTER_URL,
      }}
    >
      {children}
    </LazorkitProvider>
  );
}
```

### 2. Connect with Passkey

Use the `useWallet` hook to connect users:

```tsx
import { useWallet } from '@lazorkit/wallet';

function ConnectButton() {
  const { connect, disconnect, isConnected, smartWalletPubkey } = useWallet();

  const handleConnect = async () => {
    await connect();
  };

  if (isConnected) {
    return (
      <div>
        <p>Connected: {smartWalletPubkey?.toString()}</p>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }

  return <button onClick={handleConnect}>Connect with Passkey</button>;
}
```

### 3. Send Gasless Transactions

Execute transactions without SOL for gas:

```tsx
import { useWallet } from '@lazorkit/wallet';
import { createTransferInstruction } from '@solana/spl-token';

function SendUsdc() {
  const { signAndSendTransaction, smartWalletPubkey } = useWallet();

  const handleSend = async () => {
    const signature = await signAndSendTransaction({
      instructions: [
        createTransferInstruction(
          senderAta,      // Your USDC token account
          recipientAta,   // Recipient's USDC token account
          smartWalletPubkey,
          amount
        ),
      ],
      transactionOptions: {
        feeToken: USDC_MINT_ADDRESS, // Pay fees in USDC
      },
    });
    console.log('Transaction:', signature);
  };

  return <button onClick={handleSend}>Send USDC (Gasless)</button>;
}
```

## Tutorials

Learn how to integrate Lazorkit step-by-step:

1. **[Creating a Passkey Wallet](./docs/tutorial-passkey-wallet.md)** - Set up passkey authentication from scratch
2. **[Gasless USDC Transfers](./docs/tutorial-gasless-transfer.md)** - Send tokens without holding SOL

## Testing on Devnet

1. **Get Test SOL**: Visit [faucet.solana.com](https://faucet.solana.com) and airdrop SOL to your smart wallet address
2. **Get Test USDC**: Use the [SPL Token Faucet](https://spl-token-faucet.com/?token-name=USDC-Dev) to get devnet USDC

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the repository on [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

```bash
# Or use Vercel CLI
npm i -g vercel
vercel
```

## API Reference

### `useWallet()` Hook

| Property | Type | Description |
|----------|------|-------------|
| `isConnected` | `boolean` | Whether wallet is connected |
| `isConnecting` | `boolean` | Connection in progress |
| `isSigning` | `boolean` | Transaction signing in progress |
| `smartWalletPubkey` | `PublicKey \| null` | Smart wallet address |
| `connect()` | `() => Promise<WalletInfo>` | Connect with passkey |
| `disconnect()` | `() => Promise<void>` | Disconnect wallet |
| `signAndSendTransaction()` | `(payload) => Promise<string>` | Sign and send transaction |
| `signMessage()` | `(message) => Promise<SignResult>` | Sign a message |

### Transaction Options

| Option | Type | Description |
|--------|------|-------------|
| `feeToken` | `string` | Token mint address to pay fees with |
| `computeUnitLimit` | `number` | Max compute units |
| `clusterSimulation` | `'devnet' \| 'mainnet'` | Network for simulation |

## Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Wallet SDK**: [@lazorkit/wallet](https://www.npmjs.com/package/@lazorkit/wallet)
- **Blockchain**: [Solana](https://solana.com/) via [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/)

## Resources

- [Lazorkit Documentation](https://docs.lazorkit.com)
- [Lazorkit GitHub](https://github.com/lazor-kit/lazor-kit)
- [Lazorkit Telegram](https://t.me/lazorkit)
- [Solana Documentation](https://docs.solana.com)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Built for the [Lazorkit Bounty](https://lazorkit.com/bounty) by the community.
