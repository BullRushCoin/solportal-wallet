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

The sandbox UI runs without API keys and keeps wallet state in the browser (`localStorage`). Fixed demo prices are used if live market data cannot be fetched. See [`.env.example`](.env.example) for optional variables:

- `HELIUS_API_KEY` — server-only (never `VITE_`). Enables live USD prices, token logos, 24h change on the sandbox wallet, live sandbox swap quotes, and the read-only "Watch an address" view (paste any public Solana address; no keys, nothing is signed or broadcast). Leave unset to fall back to the hardcoded demo prices.
- `DATABASE_URL` — optional, only used by the unused auth scaffold. Leave it unset locally.
- `VITE_AUTH_ENABLED` — shipped as `"false"` in `.grok/app-env.json`. The wallet UI does not require sign-in.
- `GROK_PREVIEW_CLIENT_SECRET` / `GROK_PREVIEW_CLIENT_ID` — only needed if you turn federated sign-in on in a Grok live preview. Do not commit real secrets. A previous preview client secret was hardcoded in this repo and is still in git history; treat it as exposed and rotate it on the auth broker if it is still valid.

## What this is not

Not a production wallet, not custody, and not financial advice. A real build would keep keys in the device keystore, call Jupiter and an RPC for real quotes, and show a simulated-vs-live difference on every signature screen before anything is signed.
