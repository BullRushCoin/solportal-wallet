# SolPortal

A Solana wallet with cleanup built in. The **Incinerator** finds dust, dead tokens and spam NFTs, burns them, closes the empty token accounts and hands the locked SOL rent back to you in one tap, with no third-party site to connect.

Live: https://solportal-wallet.vercel.app (installable PWA, add it to your home screen)

## What's real and what's simulated

**Live on Solana devnet (real keys, real transactions):**

- A real ed25519 keypair generated in the browser, devnet only. Never send mainnet funds to it.
- Get, send and receive SOL; mint, send and receive NFTs.
- **The Incinerator:** "Make junk" creates real dust tokens, an empty account and a spam NFT. "Incinerate" sends `burnChecked` and `closeAccount` instructions (classic SPL Token and Token-2022), returns the rent to the wallet and pays a 5% fee on reclaimed rent in the same transaction. Spam NFTs are only burned if you opt in.
- Code: `src/lib/vela/devnet.ts`, `src/components/vela/devnet-page.tsx`, `src/routes/api/devnet.ts` (RPC proxy with a method allowlist, so the RPC key stays server-side).
- Example burn: https://solscan.io/tx/Q2UYW9hVPkssDeDr6ftibe6EReTpsFDSoM79jKBU5mretm6AXMZnwqZ8fBeP1fK5dF1KkXzLyY9Cy8sNHGb9XCE?cluster=devnet

**Product sandbox (simulated):** the full wallet UI (swap, stake, activity) runs on simulated balances and signatures. Nothing in it is broadcast. Read-only pieces use real data: Explore (DefiLlama, live DEX pairs), live prices and quotes, and "Watch a wallet", which scans any public mainnet address for dust and empty accounts.

**Not yet built:** swapping dust to SOL on-chain before burning (devnet has no swap liquidity), and mainnet. Mainnet waits on a security audit and a deposit-capped beta.

**Template leftovers:** the project started from an app-builder template. Auth and database packages, migrations, and multiplayer/OG helpers are unused by the wallet.

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
2. Home shows a simulated balance. Swap, Activity, and Explore are the other tabs. Explore → Trending lists real Solana dapps (ranked with DefiLlama TVL and volume), plus live DEX pairs and perp markets. Tapping a dapp opens the real site in a new tab; tapping a pair prefills the sandbox Swap.
3. Home has Send, Receive, Swap, and Stake. Tap an asset to open Swap with that token prefilled. The Incinerator card on Home finds dead/dust tokens and empty accounts; a simulated one-click burn or swap-to-SOL reclaims rent. Collectibles, Buy, and Watch a wallet live under More. Watching a public address shows its real holdings, LST, native stake, and dust (read-only); Home then shows a compact banner with Back to sandbox.
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

- `HELIUS_API_KEY` — server-only (never `VITE_`). Enables live USD prices, token logos, 24h change, live sandbox swap quotes, staking data (epoch, native stake accounts), and the read-only "Watch an address" view (paste any public Solana address; no keys, nothing is signed or broadcast). Leave unset to fall back to demo prices and fallback APYs.
- `VITE_FEE_WALLET_ADDRESS` / `FEE_WALLET_ADDRESS` — public fee-collection wallet (not a secret). Defaults to `GD5z4HJRrG6MTwrtceeu3W7mtHwZp7vBtQGkCHJrjJ2c`. Swap quotes show this wallet and its associated token accounts as the Jupiter fee recipient. The sandbox never sends it funds.
- `VITE_INCINERATOR_FEE_BPS` / `INCINERATOR_FEE_BPS` — optional fee on incinerator reclaimed SOL, in basis points. Defaults to `500` (5%). Shown clearly on the review sheet. Nothing is collected in this sandbox.
- `DATABASE_URL` — optional, only used by the unused auth scaffold. Leave it unset locally.
- `VITE_AUTH_ENABLED` — shipped as `"false"` in `.grok/app-env.json`. The wallet UI does not require sign-in.
- `GROK_PREVIEW_CLIENT_SECRET` / `GROK_PREVIEW_CLIENT_ID` — only needed if you turn federated sign-in on in a Grok live preview. Do not commit real secrets. A previous preview client secret was hardcoded in this repo and is still in git history; treat it as exposed and rotate it on the auth broker if it is still valid.

## What this is not

Not a production wallet yet, and not financial advice. The devnet key lives in browser localStorage, which is fine for play money only. Mainnet will use a proper keystore after a security review.
