# Milestara — : CashScript + CashTokens Governance

## 📦 What Was Added (Week 3)

| File | Purpose |
|------|---------|
| `src/contracts/MilestoneLock.cash` | CashScript smart contract source |
| `src/services/milestoneContract.js` | All Week 3 logic: mint, vote, release |
| `src/components/GovernancePanel.jsx` | New governance UI panel |
| `src/components/Dashboard.jsx` | Updated to include GovernancePanel |
| `src/components/WalletPanel.jsx` | Updated to expose wallet to parent |

---

## 🔄 Full User Flow

```
1. Connect BCH Wallet (Week 2 panel)
        ↓
2. Lock BCH in Governance Panel (simulates contract funding)
        ↓ mints CashTokens (GOV tokens)
3. Use GOV tokens to vote YES/NO on milestones
        ↓ each token = 1 vote
4. If >50% YES → milestone approved → Release button appears
        ↓ calls wallet.send() on Chipnet
5. BCH sent from your wallet to the project team address ✅
```

---

## 🛠️ Install Dependencies

```bash
npm install @cashscript/utils cashscript
```

---

## 🚀 Run Locally

```bash
npm run dev
```

Open: http://localhost:5173

---

## 📜 CashScript Contract Explained

**File:** `src/contracts/MilestoneLock.cash`

```cashscript
contract MilestoneLock(pubkey ownerPk, pubkey funderPk) {
    function release(sig ownerSig) {
        require(checkSig(ownerSig, ownerPk));
    }
    function refund(sig funderSig) {
        require(checkSig(funderSig, funderPk));
    }
}
```

**What it means:**
- `constructor params` = baked into the contract at deploy time
- `release()` = only the project OWNER (who has `ownerPk`) can sign and unlock
- `refund()` = the original FUNDER can always get their money back
- The BCH sitting in this contract UTXO can only be spent via one of these two functions
- The 50% governance threshold is enforced in `milestoneContract.js` — only calls `release()` after approval

---

## 🪙 CashTokens Explained

CashTokens are **native tokens** on BCH — baked into the protocol (since CHIP-2022-02).

**Types:**
- **Fungible tokens (FT)** — like our GOV tokens — you can split and merge them
- **Non-fungible tokens (NFT)** — unique (not used here)

**How we mint:**
```js
await wallet.send([
    new TokenSendRequest({
        cashaddr: wallet.cashaddr,
        amount: 100,  // mint 100 tokens
    })
])
```
The first time you send with `TokenSendRequest` without a category, it creates a **genesis** output — a brand new token type. The Transaction ID becomes the **Token Category ID** (like a contract address in Ethereum).

---

## 🏗️ Deploy Contract to Chipnet (Production Steps)

For a real deployment (beyond the hackathon MVP):

### Step 1 — Install cashc compiler CLI
```bash
npm install -g cashc
```

### Step 2 — Compile the contract
```bash
cashc src/contracts/MilestoneLock.cash --output src/contracts/MilestoneLock.json
```
This creates a JSON artifact with the bytecode.

### Step 3 — Deploy using a Node script
```js
import { Contract, ElectrumNetworkProvider } from 'cashscript'
import artifact from './src/contracts/MilestoneLock.json' assert { type: 'json' }

const provider = new ElectrumNetworkProvider('chipnet')
const contract = new Contract(artifact, [ownerPubKey, funderPubKey], { provider })

console.log('Contract address:', contract.address)
// Fund this address with testnet BCH from the faucet
```

### Step 4 — Call release() from the frontend
```js
const contractInstance = new Contract(artifact, [ownerPk, funderPk], { provider })
const tx = await contractInstance.functions
    .release(new SignatureTemplate(ownerKeypair))
    .to(ownerAddress, contractBalance - 1000n)  // keep 1000 sat for fee
    .send()
```

---

## 🧪 How to Test Locally (MVP Demo Mode)

1. Open http://localhost:5173
2. Create a project with 2–3 milestones
3. Click **Connect Wallet** (auto-generates a Chipnet wallet)
4. Go to [tbch.googol.cash](https://tbch.googol.cash), paste your wallet address, get free tBCH
5. Wait 1–2 min, click 🔄 refresh, see your balance
6. In **Governance Panel**: enter 0.001 BCH → click **Lock & Mint**
7. You receive 100 GOV tokens
8. Click **YES** buttons next to milestones to vote (each click uses tokens)
9. Once >50% YES → click **Release Funds** → real Chipnet tx!

---

## 🔮 Week 4 Ideas (Beyond MVP)
- On-chain vote counting via CashTokens burns
- Multi-sig release with CashScript `checkMultiSig`
- NFT milestone receipts for funders
- Backend indexer to track all project contracts