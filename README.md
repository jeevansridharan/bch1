# Milestara — CashScript + CashTokens Milestone Governance dApp

> **Bitcoin Cash Chipnet** · React + Vite · Supabase · Express Oracle Backend

A trust-minimised milestone-funding platform on BCH where funders lock BCH in a
CashScript escrow contract, vote with GOV tokens, and a Tally Oracle signs an
on-chain proof that unlocks funds only after ≥50% approval.

---

## 📦 What's in This Repo

| Path | What it is |
|------|------------|
| `src/` | React 19 + Vite frontend |
| `backend/` | Express oracle backend (Tally Engine) |
| `production/contracts/MilestoneEscrow.cash` | **Production** CashScript smart contract |
| `production/contracts/MilestoneEscrow.json` | Compiled artifact (bytecode + ABI) |
| `production/scripts/deployContract.js` | Derives the P2SH32 escrow address at project creation |
| `production/scripts/generateVotingAddresses.js` | Deterministic per-project vote addresses |
| `src/lib/schema.sql` | Authoritative Supabase DB schema (idempotent, safe to re-run) |
| `src/services/milestoneContract.js` | On-chain service: fund, vote, release |
| `src/services/govService.ts` | CashTokens lifecycle: mint, transfer, scan UTXOs |
| `src/services/bchWallet.js` | mainnet-js Chipnet wallet |
| `src/lib/db/` | Supabase CRUD modules (projects, milestones, votes, contracts, …) |

---

## 🔄 Full User Flow

```
1.  Create a project with milestones (ProjectsPage)
         ↓  deployContract.js derives escrow address from
            (creatorPk, funderPk, tallyOraclePk, milestoneId, deadline)
            and saves it to Supabase `contracts` table

2.  Connect BCH Wallet (Chipnet) — WalletPanel generates / loads a TestNetWallet
         ↓

3.  Lock BCH → Governance Panel
         ↓  BCH sent to the P2SH32 escrow contract address
         ↓  GOV tokens minted (100,000 GOV per BCH)

4.  Vote YES / NO on milestones
         ↓  Step A: wallet_address + token_amount recorded in Supabase `votes`
         ↓  Step B (optional): GOV tokens transferred on-chain to per-project
            approve / reject addresses (on-chain receipt)

5.  ≥50% YES + quorum met → click Release Funds
         ↓  Frontend calls Oracle backend: POST /api/oracle/sign
         ↓  Oracle reads Supabase votes, checks quorum (≥1 demo; ≥3 recommended)
         ↓  Oracle signs tallyProof = milestoneId_bytes32 || 0x01  (Schnorr)
         ↓  Frontend builds CashScript release() tx:
               release(creatorSig, oracleSig, tallyProof)
               – checkDataSig(oracleSig, tallyProof, tallyOraclePk)  ← on-chain
               – checkSig(creatorSig, creatorPk)                      ← on-chain
               – output[0] → creatorPk P2PKH address                  ← on-chain
         ↓  Milestone status → "released" in Supabase
         ✅  BCH leaves the escrow → creator's Chipnet address
```

---

## 🏗 Architecture

```
┌───────────────────────────────────────────────────────────┐
│  Browser / React (Vite :5173)                             │
│  React Router · WalletContext · GovernancePanel           │
└──────────────────────┬────────────────────────────────────┘
                       │ anon key (public)
                       ▼
┌───────────────────────────────────────────────────────────┐
│  Supabase Postgres                                        │
│  users · projects · milestones · transactions             │
│  contracts · votes                                        │
│  Views: project_summary · milestone_vote_summary          │
│  ← DB is authoritative for project metadata & vote tallies│
└──────────────────────┬────────────────────────────────────┘
                       │ service_role key (server-side only)
                       ▼
┌───────────────────────────────────────────────────────────┐
│  Oracle Backend  (Node/Express :3001)                     │
│  POST /api/oracle/sign   — tally + Schnorr sign           │
│  GET  /api/oracle/pubkey — returns current signing pubkey │
│  GET  /health                                             │
│  Oracle WIF private key never leaves this process         │
└──────────────────────┬────────────────────────────────────┘
                       │ oracleSig (Schnorr 64-byte datasig)
                       ▼
┌───────────────────────────────────────────────────────────┐
│  Bitcoin Cash Chipnet (ElectrumNetworkProvider)           │
│  MilestoneEscrow P2SH32 contract                          │
│  release(creatorSig, oracleSig, tallyProof)               │
│  refund(funderSig)  after deadline block                  │
│  CashTokens — GOV fungible token                          │
└───────────────────────────────────────────────────────────┘
```

**Why Supabase + on-chain?**
BCH UTXOs are great for enforcing *who can spend* (the contract), but terrible for
storing application state. Supabase holds project metadata and vote records for
fast UI reads. The Oracle reads from Supabase and signs an on-chain proof, so the
final release is permissionless — no one can approve a milestone the Oracle hasn't
signed for.

---

## 📜 CashScript Contract

**File:** `production/contracts/MilestoneEscrow.cash`

```cashscript
pragma cashscript ^0.12.0;

contract MilestoneEscrow(
    pubkey  creatorPk,      // project creator — receives funds on release
    pubkey  funderPk,       // original funder — can refund after deadline
    pubkey  tallyOraclePk,  // Tally Oracle public key (baked in at deploy)
    bytes32 milestoneId,    // unique 32-byte ID for this milestone
    int     deadline        // block height: funder can refund after this
) {
    // ── release() ────────────────────────────────────────────────────────────
    // Oracle must have signed tallyProof = milestoneId || 0x01
    // Output must go to creatorPk's P2PKH address
    function release(sig creatorSig, datasig oracleSig, bytes tallyProof) {
        require(checkDataSig(oracleSig, tallyProof, tallyOraclePk));
        require(tallyProof == milestoneId + 0x01);
        bytes20 creatorHash = hash160(creatorPk);
        bytes   creatorLock = new LockingBytecodeP2PKH(creatorHash);
        require(tx.outputs[0].lockingBytecode == creatorLock);
        require(tx.outputs[0].value >= tx.inputs[this.activeInputIndex].value - 1000);
        require(checkSig(creatorSig, creatorPk));
    }

    // ── refund() ─────────────────────────────────────────────────────────────
    // Funder reclaims funds if deadline block height is reached
    function refund(sig funderSig) {
        require(tx.time >= deadline);
        require(checkSig(funderSig, funderPk));
    }
}
```

**Key design points:**
- `tallyOraclePk` is **baked into the contract bytecode** at deploy time → the
  contract address is deterministic from all 5 constructor args.
- `checkDataSig` on BCH verifies a Schnorr signature over `SHA256(tallyProof)`.
  The oracle signs `SHA256(milestoneId_bytes32 || 0x01)`.
- The governance 50% threshold is enforced **in the Oracle** (Express backend),
  which only signs if `yesTokens / totalTokens > 0.5`.
- `MilestoneLock.cash` in `src/contracts/` is an old hackathon draft — it is not
  used by any production code.

---

## 🪙 CashTokens (GOV Tokens)

CashTokens are native tokens on BCH (since CHIP-2022-02). Milestara uses
**fungible tokens** (FT) as governance power:

| Action | How |
|--------|-----|
| Mint | `TestNetWallet.tokenMint(category, [{cashaddr, amount}])` via `govService.ts` |
| Transfer / Vote | `wallet.send([{cashaddr, value: 1000n, token: {amount, category}}])` |
| Scan votes | `ElectrumNetworkProvider.getUtxos(approveAddr / rejectAddr)` → sum token amounts |

**Token Category ID (Chipnet):**
`9da68991a0c7c647565c567540a02d41549dad1182284730b9a92e21d7a4c651`

**Minting ratio:** 100,000 GOV per 1 BCH locked

---

## 🗄 Database Schema

> **Canonical source:** `src/lib/schema.sql` — paste into Supabase SQL Editor → Run.
> Safe to run multiple times (all statements are idempotent).

```
users
├── id            UUID PK
├── wallet_address TEXT UNIQUE   ← Web3 identity (no email/password)
├── role          TEXT           investor | creator | admin
└── created_at    TIMESTAMPTZ

projects
├── id               UUID PK
├── title / description / goal_amount / raised_amount
├── owner_wallet     TEXT        ← BCH address of project creator
├── contract_address TEXT        ← P2SH32 escrow address (for UI display)
├── status           TEXT        active | funded | completed | cancelled
└── created_at       TIMESTAMPTZ

milestones
├── id          UUID PK
├── project_id  UUID FK → projects (CASCADE)
├── title / description / amount
├── approved    BOOLEAN
├── status      TEXT   pending | voting | approved | released | rejected
└── created_at  TIMESTAMPTZ

contracts   ← one row per project; stores CashScript constructor args
├── id               UUID PK
├── project_id       UUID UNIQUE FK → projects
├── contract_address TEXT   P2SH32 cashaddr
├── creator_pubkey   TEXT   hex 33-byte compressed pubkey
├── funder_pubkey    TEXT   hex 33-byte compressed pubkey
├── oracle_pubkey    TEXT   hex 33-byte compressed pubkey
├── milestone_id_hex TEXT   hex 32-byte milestone ID
├── deadline         BIGINT block height
└── created_at       TIMESTAMPTZ

votes
├── id             UUID PK
├── milestone_id   UUID FK → milestones (CASCADE)
├── wallet_address TEXT    voter identity (BCH cashaddr)
├── vote           BOOLEAN true=YES, false=NO
├── token_amount   NUMERIC GOV tokens used (voting power)
├── created_at     TIMESTAMPTZ
└── UNIQUE(milestone_id, wallet_address)   ← one vote per wallet per milestone

transactions
├── id             UUID PK
├── project_id     UUID FK → projects (CASCADE)
├── wallet_address TEXT
├── tx_hash        TEXT
├── amount         NUMERIC(18,8)
├── type           TEXT   funding | release | refund
└── created_at     TIMESTAMPTZ
```

**DB Functions:**
- `increment_raised_amount(project_id, amount)` — atomic update to avoid race conditions
- `approve_milestone(milestone_id)` — marks approved; auto-completes project when all done

**DB Views:**
- `project_summary` — aggregated stats per project (funded %, milestone counts, etc.)
- `milestone_vote_summary` — token-weighted YES/NO tally per milestone

---

## ⚙️ Environment Setup

### Frontend `.env` (copy from `.env.example`)

```env
# Supabase — use the ANON (public) key here
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Oracle backend URL
# Local dev  : http://localhost:3001
# Production : https://your-deployed-oracle.com
VITE_ORACLE_URL=http://localhost:3001

# Optional: WIF of wallet holding the GOV token minting baton
# Leave empty to skip on-chain minting (simulated tokens only)
VITE_MINTER_WIF=
```

### Backend `backend/.env` (copy from `backend/.env.example`)

```env
# Supabase — use the SERVICE ROLE key here (bypasses RLS; server-side only)
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Oracle signing key — generate with:  node gen-oracle-mainnetjs.mjs
ORACLE_WIF=cS2o...

# Server config
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173   # set to your Vercel/Netlify URL in prod
```

> **Where to get the values:**
> - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` →
>   Supabase dashboard → Project Settings → API
> - `ORACLE_WIF` → run `node gen-oracle-mainnetjs.mjs` in the project root
>   (generates a fresh Chipnet keypair; put the WIF in backend and the pubkey
>   in `src/pages/ProjectsPage.jsx` as `PLATFORM_ORACLE_PK_HEX`)

---

## 🚀 Local Development Setup

### 1 — Install dependencies

```bash
# Frontend + root scripts
npm install

# Oracle backend
cd backend && npm install && cd ..
```

### 2 — Set up environment files

```bash
cp .env.example .env          # fill in Supabase URL + anon key
cp backend/.env.example backend/.env   # fill in Supabase service key + oracle WIF
```

### 3 — Apply DB schema (first time only)

1. Open `src/lib/schema.sql`
2. Paste the entire file into [Supabase SQL Editor](https://supabase.com/dashboard) → Run
3. Verify: `node diagnose.mjs`

### 4 — Seed sample data (optional)

```bash
node seed.mjs
```

Inserts 3 sample projects so the Projects page shows data immediately.

### 5 — Start the oracle backend

```bash
cd backend
npm run dev        # node --watch server.js (auto-restart)
```

Verify: `curl http://localhost:3001/health`

### 6 — Start the frontend

```bash
npm run dev
```

Open: <http://localhost:5173>

---

## 🧪 Manual Test Flow (Chipnet)

1. Open <http://localhost:5173>
2. Go to **Projects** → Create a project with 2–3 milestones
3. Go to **Dashboard** → **Connect Wallet** (auto-generates a Chipnet TestNetWallet)
4. Copy your `bchtest:…` address → get free tBCH from [tbch.googol.cash](https://tbch.googol.cash)
5. Wait 1–2 min, click 🔄 refresh → see your balance
6. **Governance Panel** → enter `0.001 BCH` → click **Lock & Mint**
7. You receive 100 GOV tokens
8. Click **YES** / **NO** next to each milestone
9. Once `>50% YES` — click **Release Funds**
   - Oracle signs proof → CashScript `release()` broadcasts on Chipnet
   - Check tx: <https://chipnet.imaginary.cash>

---

## 🛠 Utility Scripts

Run all scripts from the **project root** (`bch1/`).

| Script | Command | What it does |
|--------|---------|--------------|
| `diagnose.mjs` | `node diagnose.mjs` | Tests Supabase connection; inserts a sample project if empty |
| `seed.mjs` | `node seed.mjs` | Inserts 3 sample projects (run after `schema.sql`) |
| `fix-schema.mjs` | `node fix-schema.mjs` | Prints SQL to add missing columns to an older projects table |
| `test-insert.mjs` | `node test-insert.mjs` | Probes which columns exist via insert attempts |
| `gen-oracle-mainnetjs.mjs` | `node gen-oracle-mainnetjs.mjs` | Generates a fresh oracle WIF + pubkey |
| `scripts/fix-oracle-pubkey.mjs` | `node scripts/fix-oracle-pubkey.mjs` | Updates stored oracle pubkey in contracts table |

> **One-off diagnostics** (kept for debugging; not wired to npm scripts):
>
> | Script | Checks |
> |--------|--------|
> | `check-columns.mjs` | Column names on the `users` table |
> | `check-users-schema.mjs` | Full `users` schema via RPC + insert probe |

---

## 🔮 Compile & Deploy Contract (Advanced)

The compiled artifact is already checked in at
`production/contracts/MilestoneEscrow.json`.
Only needed if you modify `MilestoneEscrow.cash`:

```bash
# Recompile
npx cashc production/contracts/MilestoneEscrow.cash \
  -o production/contracts/MilestoneEscrow.json

# Derive the contract address (no transaction needed)
node production/scripts/deployContract.js
```

The contract address is **deterministic** from the 5 constructor params —
no broadcast occurs during "deployment". The address is stored in Supabase
`contracts` table so `release()` can reconstruct and spend the UTXO later.

---

## 🗺 Roadmap / Week 4 Ideas

- [ ] **CI** — GitHub Actions: lint + build on every push/PR
- [ ] **On-chain vote integrity** — cross-check Supabase vote tallies against
      actual GOV token balances at approve/reject addresses on-chain
- [ ] **Raise quorum threshold** — currently `QUORUM = 1` in `backend/server.js`;
      raise to `3` or higher before mainnet use
- [ ] **Multi-sig release** — CashScript `checkMultiSig` for multi-owner projects
- [ ] **NFT milestone receipts** — CashTokens NFT for funders as proof of participation
- [ ] **Backend indexer** — track all deployed contract addresses chain-wide
- [ ] **LICENSE + CONTRIBUTING.md** — open-source housekeeping

---

## 📁 Key File Reference

```
bch1/
├── .env.example                          ← frontend env template
├── src/
│   ├── contracts/MilestoneLock.cash     ← OLD draft (not used in production)
│   ├── services/
│   │   ├── milestoneContract.js         ← fund / vote / release logic
│   │   ├── govService.ts                ← CashTokens mint / transfer / scan
│   │   └── bchWallet.js                 ← mainnet-js Chipnet wallet
│   └── lib/
│       ├── schema.sql                   ← authoritative DB schema ← START HERE
│       ├── supabase.js / supabaseClient.js
│       └── db/                          ← Supabase CRUD per table
│           ├── projects.js · milestones.js · votes.js
│           ├── transactions.js · contracts.js
│           └── users.js
├── production/
│   ├── contracts/
│   │   ├── MilestoneEscrow.cash         ← production contract source
│   │   └── MilestoneEscrow.json         ← compiled artifact (bytecode)
│   └── scripts/
│       ├── deployContract.js            ← derives escrow address
│       └── generateVotingAddresses.js   ← per-project vote addresses
├── backend/
│   ├── server.js                        ← Oracle Express backend
│   ├── .env.example                     ← backend env template
│   └── package.json
├── seed.mjs · diagnose.mjs · fix-schema.mjs
├── gen-oracle-mainnetjs.mjs             ← generate oracle keypair
└── vite.config.js · package.json · eslint.config.js
```