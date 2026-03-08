# UI Reference: Top Bar (PageHeader)

**Locked as correct behaviour** — use this as the reference for size, position, and layout. If top bar or boost UI regresses, compare against this state (this commit / file set).

## Scope

- **PageHeader** (`components/PageHeader.tsx`) — coin wallet, player level, active boosts row, settings
- **ActiveBoostIndicator** (`components/ActiveBoostIndicator.tsx`) — single boost circle (radial progress, stroke, icon)
- **BoostParticle** (`components/BoostParticle.tsx`) — particle from “Activate Reward” to boost slot (rendered inside header left wrapper)
- **App** — header refs (`headerLeftWrapperRef`, `activeBoostAreaRef`), boost state, particle portal, burst position
- **index.html** — `.boost-slide` transition for boost removal

## Key behaviour

- Left section: `marginLeft: 10`, `gap: 18`, `transform: scale(0.88)`, `transformOrigin: 'left center'`
- Coin panel: wallet **85×22px**; coin amount `pl-[12px]`; icon `-ml-3`; text cream `#fcf0c7`, `text-xs`
- Player level: **155×22px**; goals text `X/X` centered over bar, cream, black stroke 50%, `text-xs`, `z-10`
- Boost area: `marginLeft: -10`, `height: 22`, absolute slots at `left: index * 28` (26px indicator + 2px gap), slide on remove (350ms)
- Boost indicator: 26×26px; pixel offsets; tap opens limited offer in "active" view (brown button, countdown)
- Particle: rendered via portal into `headerLeftWrapperRef`; start/target in wrapper-local coords; target = `boostArea.offsetLeft + slotIndex * 28 + 13`, `offsetTop + 11`

## Boost system (this save point)

- Tap boost opens LimitedOfferPopup in "active" mode (brown "Active: XXs", X/backdrop close only). `getLimitedOfferContent(offerId)` in App.

## Commit to restore / compare

When locking: commit with message like  
`chore(ui): save point — top bar UI + boost system (wallet 85, level 155, goals X/X, tap boost → active popup)`

Use that commit (or this doc + listed files) as the “correct UI” baseline.
