# SolPortal

Non-custodial Solana wallet. Jupiter-style swaps, an Explore directory, and an in-app signer that stops every transaction before it can leave the phone.

This repository is a **sandbox**. Balances, quotes, and signatures are simulated in the browser. Nothing is broadcast, and the app does not create a real key. Do not paste a real recovery phrase, and do not send funds to any address it shows.

## Requirements

- [Node.js](https://nodejs.org) 22 or newer
- npm (comes with Node)

## Run it

```bash
git clone https://github.com/BullRushCoin/solportal-wallet.git
cd solportal-wallet
npm install
npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

1. On the first screen, create a wallet or import the 12 sandbox words the app gives you. Do not type a real seed phrase.
2. Home shows a simulated balance. Swap, Activity, and Explore are the other tabs.
3. More covers stake, cash-out, Pro, connected sites, and the flight manual.
4. Approving a swap or a dApp request only updates the sandbox. The network never sees it.

Stop the server with Ctrl+C.

## Other commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 8080 |
| `npm run build` | Production build |
| `npm run preview` | Serve the production build |
| `npm test` | Unit tests |
| `npm run typecheck` | TypeScript check |

No API keys are required. Wallet state stays in the browser (`localStorage`). `DATABASE_URL` is optional and only used by the unused auth scaffold; leave it unset.

## What this is not

Not a production wallet, not custody, and not financial advice. A real build would keep keys in the device keystore, call Jupiter and an RPC for real quotes, and show a simulated-vs-live difference on every signature screen before anything is signed.
