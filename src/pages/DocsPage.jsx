/**
 * src/pages/DocsPage.jsx
 * Documentation / How It Works page for Milestara.
 * Standalone layout: full-width dark page with a sticky left ToC sidebar.
 */

import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Palette ───────────────────────────────────────────────────────────────────
const GREEN       = '#10b981'
const GREEN_DARK  = '#059669'
const GREEN_LIGHT = '#34d399'
const BG          = '#0a0a0f'
const CARD_BG     = 'rgba(15,17,35,0.85)'
const BORDER      = 'rgba(255,255,255,0.07)'
const TEXT        = '#f1f5f9'
const MUTED       = '#64748b'
const CYAN        = '#06b6d4'
const PURPLE      = '#a78bfa'

// ── Section IDs ──────────────────────────────────────────────────────────────
const SECTIONS = [
    { id: 'overview',       label: 'Overview' },
    { id: 'flow',           label: 'Step-by-Step Flow' },
    { id: 'smart-contract', label: 'Smart Contract' },
    { id: 'governance',     label: 'Governance' },
    { id: 'faq',            label: 'FAQ' },
    { id: 'get-started',    label: 'Get Started' },
]

// ── Sticky Left ToC ───────────────────────────────────────────────────────────
function TableOfContents({ active }) {
    const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    return (
        <nav style={{
            position: 'sticky', top: '88px',
            width: '220px', flexShrink: 0,
            display: 'flex', flexDirection: 'column', gap: '2px',
        }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '12px', paddingLeft: '12px' }}>
                On This Page
            </div>
            {SECTIONS.map(({ id, label }) => {
                const isActive = active === id
                return (
                    <button
                        key={id}
                        onClick={() => scrollTo(id)}
                        style={{
                            background: isActive ? 'rgba(16,185,129,0.1)' : 'transparent',
                            border: 'none', borderLeft: `2px solid ${isActive ? GREEN : 'rgba(255,255,255,0.07)'}`,
                            cursor: 'pointer', textAlign: 'left',
                            padding: '8px 12px',
                            color: isActive ? GREEN_LIGHT : MUTED,
                            fontSize: '0.82rem', fontWeight: isActive ? 700 : 500,
                            transition: 'all 0.2s ease', borderRadius: '0 6px 6px 0',
                        }}
                        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = TEXT; e.currentTarget.style.borderLeftColor = 'rgba(16,185,129,0.4)' }}}
                        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = MUTED; e.currentTarget.style.borderLeftColor = 'rgba(255,255,255,0.07)' }}}
                    >{label}</button>
                )
            })}

            {/* Back to landing */}
            <div style={{ marginTop: '24px', borderTop: `1px solid ${BORDER}`, paddingTop: '16px' }}>
                <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: MUTED, fontSize: '0.78rem', fontWeight: 500, textDecoration: 'none', padding: '4px 12px', transition: 'color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.color = GREEN_LIGHT}
                    onMouseLeave={e => e.currentTarget.style.color = MUTED}
                >← Back to Home</a>
            </div>
        </nav>
    )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ id, children }) {
    return (
        <section id={id} style={{ scrollMarginTop: '88px', marginBottom: '72px' }}>
            {children}
        </section>
    )
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ label, tag, color = GREEN }) {
    return (
        <div style={{ marginBottom: '28px' }}>
            {tag && (
                <div style={{
                    display: 'inline-block', fontSize: '0.68rem', fontWeight: 700,
                    color, background: `${color}12`, border: `1px solid ${color}25`,
                    borderRadius: '999px', padding: '3px 12px', letterSpacing: '0.1em',
                    marginBottom: '10px', textTransform: 'uppercase',
                }}>{tag}</div>
            )}
            <h2 style={{ fontSize: 'clamp(1.4rem,3vw,1.9rem)', fontWeight: 900, color: TEXT, letterSpacing: '-0.03em', lineHeight: 1.15 }}>{label}</h2>
        </div>
    )
}

// ── Card ──────────────────────────────────────────────────────────────────────
function Card({ children, accent }) {
    return (
        <div style={{
            background: CARD_BG, border: `1px solid ${accent ? accent + '25' : BORDER}`,
            borderRadius: '16px', padding: '28px', backdropFilter: 'blur(20px)',
            transition: 'box-shadow 0.2s',
        }}>{children}</div>
    )
}

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview() {
    const principles = [
        { icon: '🔒', title: 'Trustless', desc: 'Funds are locked in a CashScript escrow contract. No one — not even the platform — can move BCH without meeting the release conditions.', color: GREEN },
        { icon: '🔍', title: 'Transparent', desc: 'Every milestone vote, oracle signature, and fund release is recorded on the Bitcoin Cash blockchain for anyone to audit.', color: CYAN },
        { icon: '🏛️', title: 'Community-Governed', desc: 'GOV token holders decide milestone completion. No central authority approves or rejects — the community decides.', color: PURPLE },
    ]

    return (
        <Section id="overview">
            <SectionHeading tag="Overview" label="What is Milestara?" />
            <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.75, marginBottom: '32px', maxWidth: '680px' }}>
                Milestara is a <strong style={{ color: TEXT }}>trustless milestone-based crowdfunding protocol</strong> built on Bitcoin Cash.
                Project creators define milestones upfront and lock funds in a smart contract.
                Contributors earn governance tokens to vote on milestone completion. Verified milestones
                trigger an automatic on-chain fund release — no middlemen, no escrow agents.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
                {principles.map(({ icon, title, desc, color }) => (
                    <Card key={title} accent={color}>
                        <div style={{ fontSize: '1.6rem', marginBottom: '12px' }}>{icon}</div>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: TEXT, marginBottom: '8px' }}>{title}</h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.65 }}>{desc}</p>
                    </Card>
                ))}
            </div>
        </Section>
    )
}

// ── Flow ──────────────────────────────────────────────────────────────────────
function Flow() {
    const steps = [
        {
            num: '01', icon: '📋', color: GREEN,
            title: 'Create Project',
            desc: 'The project creator defines milestones, sets a funding target, and deploys a CashScript escrow contract on Chipnet. BCH locked in the contract is verifiably held on-chain.',
            detail: 'Contract deployed → funds locked → milestones recorded',
        },
        {
            num: '02', icon: '🪙', color: GREEN_LIGHT,
            title: 'Mint GOV Tokens',
            desc: 'Every contributor who sends BCH to the project escrow receives GOV tokens proportional to their contribution. 1 BCH = 1,000 GOV tokens. These tokens represent voting power.',
            detail: '1 BCH → 1,000 GOV tokens minted on-chain',
        },
        {
            num: '03', icon: '🗳️', color: CYAN,
            title: 'Community Votes',
            desc: 'When a milestone is submitted, GOV token holders vote YES or NO. Votes are weighted by token balance. A threshold of >50% YES is required for the milestone to pass.',
            detail: '>50% YES threshold required · Voting period: 72 hours',
        },
        {
            num: '04', icon: '🔮', color: PURPLE,
            title: 'Oracle Approves',
            desc: "The Milestara tally oracle reads the on-chain vote result, verifies the quorum is met, and generates a cryptographic signature (a \"release proof\") using its private key.",
            detail: 'Oracle signs: keccak256(projectId + milestoneId + voteResult)',
        },
        {
            num: '05', icon: '⚡', color: '#f59e0b',
            title: 'Funds Released',
            desc: 'The project creator submits the oracle signature to the escrow contract. The contract\'s checkDataSig opcode verifies the signature on-chain and automatically sends BCH to the creator.',
            detail: 'checkDataSig(sig, message, oraclePublicKey) → release BCH',
        },
    ]

    return (
        <Section id="flow">
            <SectionHeading tag="Protocol Flow" label="Step-by-Step: How Funds Move" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {steps.map(({ num, icon, color, title, desc, detail }, i) => (
                    <div key={num} style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        {/* Timeline */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '14px',
                                background: `${color}15`, border: `1.5px solid ${color}40`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.3rem', boxShadow: `0 0 16px ${color}20`,
                            }}>{icon}</div>
                            {i < steps.length - 1 && (
                                <div style={{
                                    width: '1.5px', height: '40px', marginTop: '4px',
                                    background: `linear-gradient(180deg, ${color}40, transparent)`,
                                }} />
                            )}
                        </div>
                        {/* Content */}
                        <div style={{
                            flex: 1, background: CARD_BG, border: `1px solid ${BORDER}`,
                            borderRadius: '14px', padding: '20px 24px',
                            backdropFilter: 'blur(16px)',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}35`; e.currentTarget.style.boxShadow = `0 4px 24px ${color}12` }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = 'none' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Step {num}</span>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: TEXT }}>{title}</h3>
                                </div>
                            </div>
                            <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.65, marginBottom: '12px' }}>{desc}</p>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center',
                                background: `${color}0d`, border: `1px solid ${color}20`,
                                borderRadius: '8px', padding: '5px 12px',
                                fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                                fontSize: '0.72rem', color, letterSpacing: '0.02em',
                            }}>{detail}</div>
                        </div>
                    </div>
                ))}
            </div>
        </Section>
    )
}

// ── Smart Contract ────────────────────────────────────────────────────────────
function SmartContract() {
    const snippet = `contract MilestoneEscrow(
  bytes20 creatorPKH,       // Creator's public key hash
  bytes32 oraclePubKey,     // Oracle's public key (65 bytes)
  bytes32 projectId,        // Unique project identifier
  bytes32 milestoneId       // Current milestone being released
) {
  // Called by creator after oracle approves milestone
  function releaseMilestone(
    sig     creatorSig,     // Creator's signature
    datasig oracleSig,      // Oracle's datasig over vote result
    bytes   voteResult      // "APPROVED" or "REJECTED"
  ) {
    // 1. Verify oracle approved this milestone
    bytes msg = sha256(projectId + milestoneId + voteResult);
    require(checkDataSig(oracleSig, msg, oraclePubKey));

    // 2. Verify voteResult is "APPROVED"
    require(voteResult == bytes("APPROVED"));

    // 3. Verify creator is the one calling
    require(hash160(creatorSig) == creatorPKH);

    // 4. Release: output goes to creator's address
  }
}`

    return (
        <Section id="smart-contract">
            <SectionHeading tag="Smart Contracts" label="CashScript Escrow" color={CYAN} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <Card accent={GREEN}>
                    <div style={{ fontSize: '1.4rem', marginBottom: '12px' }}>📦</div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: TEXT, marginBottom: '8px' }}>Escrow Contract</h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.65 }}>
                        When a project is created, a CashScript contract is compiled and deployed to Chipnet.
                        The contract P2SH address is unique per project. All BCH contributions are sent directly to this address — not to any wallet.
                    </p>
                </Card>
                <Card accent={CYAN}>
                    <div style={{ fontSize: '1.4rem', marginBottom: '12px' }}>✍️</div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: TEXT, marginBottom: '8px' }}>checkDataSig</h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.65 }}>
                        <code style={{ color: CYAN, background: `${CYAN}12`, borderRadius: '4px', padding: '1px 5px', fontFamily: 'monospace', fontSize: '0.8rem' }}>checkDataSig</code> is a Bitcoin Cash opcode that verifies an arbitrary message was signed by a specific key — without requiring a full transaction signature. It's how the oracle proves a vote was approved.
                    </p>
                </Card>
            </div>

            {/* Code block */}
            <div style={{
                background: 'rgba(5,5,10,0.95)', border: `1px solid rgba(16,185,129,0.15)`,
                borderRadius: '14px', overflow: 'hidden',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.02)',
                }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {['#f87171','#fbbf24','#34d399'].map(c => <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />)}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: MUTED, fontFamily: 'monospace', marginLeft: '4px' }}>MilestoneEscrow.cash</span>
                </div>
                <pre style={{
                    margin: 0, padding: '20px',
                    fontSize: '0.78rem', lineHeight: 1.7,
                    color: '#94a3b8', overflowX: 'auto',
                    fontFamily: "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
                }}>
                    {snippet.split('\n').map((line, i) => {
                        let c = '#94a3b8'
                        if (line.includes('contract') || line.includes('function')) c = '#f472b6'
                        else if (line.includes('require') || line.includes('bytes') || line.includes('sig') || line.includes('datasig')) c = CYAN
                        else if (line.trim().startsWith('//')) c = '#475569'
                        else if (line.includes('checkDataSig') || line.includes('hash160') || line.includes('sha256')) c = GREEN_LIGHT
                        return <span key={i} style={{ color: c, display: 'block' }}>{line}</span>
                    })}
                </pre>
            </div>
        </Section>
    )
}

// ── Governance ────────────────────────────────────────────────────────────────
function Governance() {
    const items = [
        {
            icon: '🪙', color: GREEN,
            title: 'GOV Token Allocation',
            body: 'Contributors receive GOV tokens 1:1000 with BCH contributed. Tokens are non-transferable during the voting period to prevent vote manipulation. After project completion, tokens are burned.',
        },
        {
            icon: '📊', color: CYAN,
            title: 'Quorum & Threshold',
            body: 'A milestone vote requires >50% YES votes from participating token holders. There is no minimum quorum currently on Chipnet — any token holder can trigger a vote, but all holders can participate within the 72-hour window.',
        },
        {
            icon: '🛡️', color: PURPLE,
            title: 'Oracle Protection',
            body: 'Even if a vote passes on-chain, funds are not released until the Milestara oracle independently verifies the tally and issues a cryptographic signature. This prevents vote manipulation and smart contract bugs from draining funds.',
        },
    ]

    return (
        <Section id="governance">
            <SectionHeading tag="Governance" label="Token-Weighted Voting" color={PURPLE} />
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.75, marginBottom: '28px', maxWidth: '660px' }}>
                Milestara governance is fully on-chain. GOV tokens give holders proportional voting
                power over milestone completion. The oracle acts as a final safeguard.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {items.map(({ icon, color, title, body }) => (
                    <div key={title} style={{
                        display: 'flex', gap: '18px', alignItems: 'flex-start',
                        background: CARD_BG, border: `1px solid ${BORDER}`,
                        borderRadius: '14px', padding: '22px',
                        backdropFilter: 'blur(16px)',
                        transition: 'border-color 0.2s',
                    }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = `${color}35`}
                        onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
                    >
                        <div style={{
                            width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                            background: `${color}12`, border: `1px solid ${color}25`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.2rem',
                        }}>{icon}</div>
                        <div>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: TEXT, marginBottom: '6px' }}>{title}</h3>
                            <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.65 }}>{body}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Voting flow mini diagram */}
            <div style={{ marginTop: '24px', background: 'rgba(5,5,12,0.8)', border: `1px solid rgba(167,139,250,0.15)`, borderRadius: '14px', padding: '20px 24px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>Voting Lifecycle</div>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    {[
                        { label: 'Milestone Submitted', color: MUTED },
                        { label: '→', color: 'rgba(255,255,255,0.2)' },
                        { label: 'Vote Opens (72h)', color: CYAN },
                        { label: '→', color: 'rgba(255,255,255,0.2)' },
                        { label: 'Tally Computed', color: GREEN },
                        { label: '→', color: 'rgba(255,255,255,0.2)' },
                        { label: 'Oracle Signs', color: PURPLE },
                        { label: '→', color: 'rgba(255,255,255,0.2)' },
                        { label: 'BCH Released', color: '#f59e0b' },
                    ].map(({ label, color }, i) => (
                        <span key={i} style={{ fontSize: '0.78rem', fontWeight: label === '→' ? 400 : 700, color, fontFamily: label === '→' ? 'inherit' : 'inherit' }}>{label}</span>
                    ))}
                </div>
            </div>
        </Section>
    )
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
function FAQ() {
    const [open, setOpen] = useState(null)

    const items = [
        {
            q: 'Is this on mainnet?',
            a: 'Currently Milestara runs on the BCH Chipnet testnet only. Chipnet is a dedicated Bitcoin Cash test network with real CashScript contracts but no real-money BCH. Mainnet deployment is coming soon after audits complete.',
        },
        {
            q: 'What is the oracle?',
            a: 'The oracle is a trusted off-chain backend service operated by the Milestara team. It monitors on-chain votes, verifies quorum is reached, and issues a cryptographic signature (datasig) that the escrow contract requires to release funds. Future versions aim to decentralise the oracle role.',
        },
        {
            q: 'Can funds be stolen or misused?',
            a: 'No. Funds can only leave the escrow contract via the releaseMilestone function, which requires both a valid oracle signature AND a passed community vote. Even Milestara admins cannot drain the contract — the contract code is immutable once deployed.',
        },
        {
            q: 'What wallet do I need?',
            a: 'Any BCH wallet that supports Chipnet testnet works, including Electron Cash configured for Chipnet, or a custom WIF-key wallet. The app provides a built-in Chipnet wallet connector under the Profile section.',
        },
        {
            q: 'How are GOV tokens created?',
            a: 'GOV tokens are minted automatically when a contribution is recorded in the Supabase backend. On Chipnet, this is simulated. On mainnet, tokens will be issued as BCH CashTokens — the native fungible token standard on Bitcoin Cash.',
        },
        {
            q: 'What happens if a milestone vote fails?',
            a: "If a milestone vote is rejected (<50% YES), the funds for that milestone remain locked in escrow. The project creator can revise the milestone, provide more evidence, and resubmit. After 3 failed attempts, contributors can vote to fully refund the escrow.",
        },
    ]

    return (
        <Section id="faq">
            <SectionHeading tag="FAQ" label="Frequently Asked Questions" color='#f59e0b' />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map(({ q, a }, i) => {
                    const isOpen = open === i
                    return (
                        <div key={i} style={{
                            background: CARD_BG, border: `1px solid ${isOpen ? 'rgba(245,158,11,0.25)' : BORDER}`,
                            borderRadius: '12px', overflow: 'hidden',
                            backdropFilter: 'blur(16px)', transition: 'border-color 0.2s',
                        }}>
                            <button
                                onClick={() => setOpen(isOpen ? null : i)}
                                style={{
                                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '18px 22px', textAlign: 'left', gap: '12px',
                                }}
                            >
                                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: TEXT }}>{q}</span>
                                <span style={{
                                    fontSize: '1.1rem', color: isOpen ? '#f59e0b' : MUTED,
                                    transition: 'transform 0.25s ease, color 0.2s',
                                    transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                                    flexShrink: 0, lineHeight: 1,
                                }}>+</span>
                            </button>
                            {isOpen && (
                                <div style={{ padding: '0 22px 18px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.7, marginTop: '14px' }}>{a}</p>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </Section>
    )
}

// ── Get Started ───────────────────────────────────────────────────────────────
function GetStarted() {
    const navigate = useNavigate()
    return (
        <Section id="get-started">
            <SectionHeading tag="Get Started" label="Ready to build?" />
            <div style={{
                background: `linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,182,212,0.05))`,
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: '20px', padding: '48px 40px',
                position: 'relative', overflow: 'hidden',
            }}>
                {/* Ambient glow */}
                <div style={{
                    position: 'absolute', top: '-60px', right: '-60px',
                    width: '250px', height: '250px', borderRadius: '50%',
                    background: 'radial-gradient(ellipse, rgba(16,185,129,0.1) 0%, transparent 70%)',
                    filter: 'blur(30px)', pointerEvents: 'none',
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '32px', maxWidth: '520px' }}>
                        Create a project, lock BCH in escrow, and let your community verify your progress.
                        No trust required — just code and consensus.
                    </p>
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => navigate('/projects')}
                            style={{
                                padding: '12px 28px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                                background: `linear-gradient(135deg, ${GREEN_DARK}, ${GREEN})`,
                                color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                                boxShadow: `0 0 24px rgba(16,185,129,0.35)`,
                                transition: 'all 0.25s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 0 36px rgba(16,185,129,0.5)` }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 0 24px rgba(16,185,129,0.35)` }}
                        >🚀 Launch App</button>

                        <a href="https://github.com/jeevansridharan/bch1" target="_blank" rel="noopener noreferrer"
                            style={{
                                padding: '12px 28px', borderRadius: '10px', textDecoration: 'none',
                                background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.12)`,
                                color: '#cbd5e1', fontWeight: 600, fontSize: '0.9rem',
                                transition: 'all 0.2s ease', display: 'inline-flex', alignItems: 'center', gap: '8px',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = TEXT }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#cbd5e1' }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
                            View on GitHub
                        </a>

                        <a href="https://x.com/jovan_0406" target="_blank" rel="noopener noreferrer"
                            style={{
                                padding: '12px 28px', borderRadius: '10px', textDecoration: 'none',
                                background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.12)`,
                                color: '#cbd5e1', fontWeight: 600, fontSize: '0.9rem',
                                transition: 'all 0.2s ease', display: 'inline-flex', alignItems: 'center', gap: '8px',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = TEXT }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#cbd5e1' }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                            Follow on X
                        </a>
                    </div>
                </div>
            </div>
        </Section>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DocsPage() {
    const [activeSection, setActiveSection] = useState('overview')

    // Scroll spy
    useEffect(() => {
        const handler = () => {
            const scrollY = window.scrollY + 120
            let current = 'overview'
            for (const { id } of SECTIONS) {
                const el = document.getElementById(id)
                if (el && el.offsetTop <= scrollY) current = id
            }
            setActiveSection(current)
        }
        window.addEventListener('scroll', handler, { passive: true })
        return () => window.removeEventListener('scroll', handler)
    }, [])

    return (
        <div style={{ background: BG, minHeight: '100vh', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", color: TEXT }}>

            {/* ── Top header bar ─────────────────────────────────────────────── */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 100,
                background: 'rgba(10,10,15,0.92)', backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(16,185,129,0.12)',
                padding: '0 32px',
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
                            <div style={{
                                width: '34px', height: '34px', borderRadius: '9px',
                                background: `linear-gradient(135deg, ${GREEN_DARK}, ${GREEN})`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '16px', fontWeight: 800, color: '#fff',
                                boxShadow: `0 0 14px rgba(16,185,129,0.3)`,
                            }}>M</div>
                            <span style={{ fontWeight: 800, fontSize: '1rem', color: TEXT }}>Milestara</span>
                        </a>
                        <div style={{ width: '1px', height: '20px', background: BORDER }} />
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: MUTED }}>Documentation</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                            borderRadius: '999px', padding: '4px 12px',
                        }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: GREEN_LIGHT, letterSpacing: '0.06em' }}>CHIPNET LIVE</span>
                        </div>
                        <a href="/projects" style={{
                            padding: '8px 18px', borderRadius: '9px', textDecoration: 'none',
                            background: `linear-gradient(135deg, ${GREEN_DARK}, ${GREEN})`,
                            color: '#fff', fontWeight: 700, fontSize: '0.825rem',
                            boxShadow: `0 0 16px rgba(16,185,129,0.25)`,
                        }}>Launch App →</a>
                    </div>
                </div>
            </div>

            {/* ── Hero ───────────────────────────────────────────────────────── */}
            <div style={{
                maxWidth: '1200px', margin: '0 auto', padding: '60px 32px 0',
                borderBottom: `1px solid ${BORDER}`, marginBottom: '60px',
            }}>
                {/* Breadcrumb */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                    <a href="/" style={{ color: MUTED, fontSize: '0.8rem', textDecoration: 'none' }}
                        onMouseOver={e => e.currentTarget.style.color = GREEN_LIGHT}
                        onMouseOut={e => e.currentTarget.style.color = MUTED}
                    >Home</a>
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem' }}>/</span>
                    <span style={{ color: GREEN_LIGHT, fontSize: '0.8rem', fontWeight: 600 }}>Documentation</span>
                </div>

                <div style={{ paddingBottom: '48px', maxWidth: '680px' }}>
                    <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: 900, letterSpacing: '-0.04em', color: TEXT, marginBottom: '16px', lineHeight: 1.1 }}>
                        How{' '}
                        <span style={{ background: `linear-gradient(135deg, ${GREEN}, ${GREEN_LIGHT})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                            Milestara
                        </span>{' '}
                        Works
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: 1.65 }}>
                        A trustless milestone-based funding protocol on Bitcoin Cash Chipnet.
                        Learn how funds flow from escrow to release — and who controls each step.
                    </p>
                </div>
            </div>

            {/* ── Body: ToC + content ─────────────────────────────────────────── */}
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 32px 80px', display: 'flex', gap: '56px', alignItems: 'flex-start' }}>
                <TableOfContents active={activeSection} />

                <div style={{ flex: 1, minWidth: 0 }}>
                    <Overview />
                    <Flow />
                    <SmartContract />
                    <Governance />
                    <FAQ />
                    <GetStarted />
                </div>
            </div>

            {/* ── Footer strip ───────────────────────────────────────────────── */}
            <div style={{
                borderTop: `1px solid ${BORDER}`, background: 'rgba(8,8,12,1)',
                padding: '24px 32px', textAlign: 'center',
            }}>
                <span style={{ color: MUTED, fontSize: '0.78rem' }}>
                    © {new Date().getFullYear()} Milestara ·{' '}
                    <span style={{ color: GREEN, fontWeight: 600 }}>Built on Bitcoin Cash</span>
                </span>
            </div>
        </div>
    )
}
