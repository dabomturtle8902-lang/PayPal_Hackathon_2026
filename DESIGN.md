# SplitSync AI Design System

Visual design system for the **SplitSync AI** web app (`website/dist/`) and Flutter app (`flutter_app/`), translated from the Medfarm visual system while keeping PhonePe-style action-first payment utility, bidirectional cross-border FX, `Demo mode` simulation transparency, and `PayPal Sandbox` isolation.

## 1. Color Tokens

| Role | Token (Web `style.css`) | Value (`Flutter SplitColors`) | Usage |
|---|---|---|---|
| Primary Brand | `--primary` / `--primary-hover` | `#1457D9` / `#0F67FE` | Primary CTAs, active nav highlights, active border accents |
| Primary Accessible Ink | `--primary-ink` | `#0A4EC4` | Text on white / `#EDF5FF` tinted surfaces (WCAG AA >= 4.5:1) |
| Focus Halo | `--focus-ring` | `rgba(15, 103, 254, 0.20)` | 4px outer focus ring on inputs and interactive controls |
| Structural Navy | `--navy` / `--navy-deep` | `#172846` / `#242E49` | Display headings, banners, QR scanner frame |
| Positive / Received | `--teal` / `--teal-ink` / `--teal-bg` | `#48B3A9` / `#136B63` / `#E3F5F3` | `Payment received`, `Completed`, `Paid`, `Demo transfer` status pills |
| Secondary Link Accent | `--coral` / `--coral-ink` | `#FA4D5E` / `#C62839` | Secondary utility links |
| Warning / Waiting | `--amber` / `--amber-bg` | `#9E6200` / `#FFF4DE` | `Waiting for payment`, `Processing`, AI fallback notices |
| Error / Cancelled | `--error` / `--error-bg` | `#B00020` / `#FFF2F4` | Invalid organizer key, unrecognized QR, `Cancelled` / `Failed` banners |
| PayPal CTA Exception | `--paypal-bg` / `--paypal-ink` | `#FFC439` / `#003087` | Strictly Demo Merchant (`SS-001` / PayPal-eligible Store items) checkout |
| Canvas & Surfaces | `--bg` / `--surface` / `--surface-tint` | `#F1F5FC` / `#FFFFFF` / `#EDF5FF` | Page ground (`#F1F5FC`), cards (`#FFFFFF`, `1px solid #DCE1E8`), tinted callouts |

## 2. Typography

- **Font Family**: Self-hosted `Plus Jakarta Sans` (`PlusJakartaSans-Regular.ttf`, `PlusJakartaSans-ExtraBold.ttf`) in `website/dist/fonts/` and `flutter_app/fonts/`.
- **Scale & Figures**: `800` headings, `700/400` body, and `font-variant-numeric: tabular-nums` (`FontFeature.tabularFigures()`) on all FX quotes, totals, and counts (`JPY` formatted with 0 decimals; currency codes shown alongside symbols, e.g., `$20.00 USD`, `£14.90 GBP`, `¥3,000 JPY`).

## 3. Shared Component Primitives & Touch Targets

- **Minimum Targets**: `>= 44x44px` on Web and `>= 48x48dp` on Flutter across buttons, Back controls, nav destinations, chips, quantity steppers, and contact pills.
- **Contact Avatars & Country Flags**: `contactAvatarHtml` / `SplitContactAvatar` renders color-coded circular monogram avatars with crisp vector/custom-painted flag badges (`GB`, `US`, `CA`, `DE`/`EU`, `JP`, `IN`).
- **Web (`website/dist/`)**: `.nav-rail`, `.bottom-nav`, `.btn-back`, `.action-quad` / `.action-tile`, `.ask-compact-bar`, `.contact-pill`, `.awaiting-card`, `.fx-side-tabs` (bidirectional FX entry), `.bill-action-btn` (`Electricity`, `Rent`, `Scan a Bill`, `Split a Bill`), `.product-card` (11 products + honest `object-fit: contain` thumbnails), `.qty-stepper`, `.sticky-buy-bar`, `#dev` (`Developer Tools` — Reset demo session + Sponsored placement toggle).
- **Flutter (`flutter_app/`)**: `SplitBackButton` (`48x48dp`), `SplitTextField` (`4px` focus halo), `SplitContactAvatar` + `SplitCountryFlagBadge`, `SplitStatusPill`, `CupertinoPageRoute` push/pop stack (with `Duration.zero` under `MediaQuery.disableAnimationsOf`), `PopScope` + `IndexedStack` preserving the 4 root tabs (`Home`, `Activity`, `Store`, `Profile`).

## 4. Payment Scope & Store Boundaries

- **`PayPal Sandbox`**: Strictly isolated to Demo Merchant `SS-001` QR/checkout and PayPal-eligible `Demo Merchant` catalog items (`Buy Now with PayPal` / `Continue with PayPal Sandbox`).
- **`Demo mode` & `Demo rate`**: Contact transfers, editable `Review payment`, group splits, blank `Electricity` / `Rent` requests, staggered settlement notifications, and sample catalog fixture orders stay transparently labeled in the Demo ledger.
- **Sponsored Placement**: Hidden by default in Store (`_sponsoredEnabled == false` / `sponsoredEnabled == false`) and explicitly badged `'Sponsored · Paid placement disclosure'` only when enabled from `#dev` / `Developer Tools`.
