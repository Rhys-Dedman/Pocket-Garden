# UI Reference: Top Bar (PageHeader)

**Locked as correct behaviour** — use this as the reference for size, position, and layout. If top bar or boost UI regresses, compare against this state (this commit / file set).

## Scope

- **PageHeader** (`components/PageHeader.tsx`) — coin wallet, player level, active boosts row, settings
- **ActiveBoostIndicator** (`components/ActiveBoostIndicator.tsx`) — single boost circle (radial progress, stroke, icon)
- **BoostParticle** (`components/BoostParticle.tsx`) — particle from “Activate Reward” to boost slot (rendered inside header left wrapper)
- **App** — header refs (`headerLeftWrapperRef`, `activeBoostAreaRef`), boost state, particle portal, burst position
- **index.html** — `.boost-slide` transition for boost removal

## Key behaviour

- Left section: `marginLeft: 10`, `transform: scale(0.88)`, `transformOrigin: 'left center'`
- Coin panel: wallet 75×22px; coin amount `pl-[12px]`; icon `-ml-3`
- Boost area: `marginLeft: -10`, `height: 22`, absolute slots at `left: index * 28` (26px indicator + 2px gap), slide on remove (350ms)
- Boost indicator: 26×26px; inner circle and SVG ring centered with **pixel offsets** (no %/translate) so all slots align
- Particle: rendered via portal into `headerLeftWrapperRef`; start/target in wrapper-local coords; target = `boostArea.offsetLeft + slotIndex * 28 + 13`, `offsetTop + 11`

## Commit to restore / compare

When locking: commit with message like  
`chore(ui): lock top bar as reference — PageHeader, boosts, particle`

Use that commit (or this doc + listed files) as the “correct UI” baseline.
