# PayPal Hackathon Design System

Visual design system for the **PayPal Hackathon** web app (`website/dist/`) and Flutter app (`flutter_app/`), translated from the Medfarm reference architecture while preserving SplitSync's household expense-splitting identity and server-enforced PayPal Sandbox security boundaries.

## 1. Color Tokens

| Role | Token (Web `style.css`) | Value (`Flutter SplitColors`) | Usage |
|---|---|---|---|
| Primary Brand | `--primary` / `--primary-hover` | `#0F67FE` / `#0B55D6` | Primary CTAs, active nav highlights, active border accents |
| Primary Accessible Ink | `--primary-ink` | `#0A4EC4` | Text on white / `#EDF5FF` tinted surfaces (WCAG AA >= 4.5:1) |
| Focus Halo | `--focus-ring` | `rgba(15, 103, 254, 0.20)` | 4px outer focus ring on inputs and interactive controls |
| Structural Navy | `--navy` / `--navy-deep` | `#242E49` / `#182035` | Display headings, dark hero card, progress bar fill, QR scanner frame |
| Positive / Paid | `--teal` / `--teal-ink` / `--teal-bg` | `#48B3A9` / `#136B63` / `#E3F5F3` | Group settlement bar fill, `Paid` / `Reviewed` status pills |
| Secondary Link Accent | `--coral` / `--coral-ink` | `#FA4D5E` / `#C62839` | Coral underlined utility links (darkened `#C62839` on white cards) |
| Warning / Processing | `--amber` / `--amber-bg` | `#9E6200` / `#FFF4DE` | `Processing` status pills, DeepSeek/Chatterbox unavailable notices |
| Error / Cancelled | `--error` / `--error-bg` | `#B00020` / `#FFF2F4` | Invalid organizer key, unrecognized QR, `Cancelled` checkout banner |
| PayPal CTA Exception | `--paypal-bg` / `--paypal-ink` | `#FFC439` / `#003087` | Dedicated `Pay with PayPal` / `Retry with PayPal` button on payer screens |
| Canvas & Surfaces | `--bg` / `--surface` / `--surface-tint` | `#F2F5F9` / `#FFFFFF` / `#EDF5FF` | Page ground (`#F2F5F9`), cards (`#FFFFFF`, `1px solid #DCE1E8`), callouts (`#EDF5FF`) |

## 2. Typography

- **Font Family**: Self-hosted `Plus Jakarta Sans` (`PlusJakartaSans-Regular.ttf`, `PlusJakartaSans-ExtraBold.ttf`) in `website/dist/fonts/` and `flutter_app/fonts/`.
- **Scale & Figures**: Strong weight hierarchy (`800` headings, `600`/`400` body) and `font-variant-numeric: tabular-nums` (`FontFeature.tabularFigures()`) on all USD currency amounts and counters.

## 3. Shared Component Primitives

- **Web (`website/dist/style.css`, `website/dist/app.js`)**:
  - `.btn-primary`, `.btn-secondary`, `.btn-navy`, `.btn-paypal`, `.btn-back` (44x44 bordered back button inside screen headers), `.btn-ghost-sm`, `.link-coral`
  - `.nav-rail` (Desktop & short-landscape left rail with cart badge), `.bottom-nav` (Mobile portrait 4-tab bar: Home, Activity, Store, Profile)
  - `.hub-card` + `.hub-actions-grid` + `.hub-tile` (PhonePe-inspired action-first Payment Hub: `Scan & Pay`, `Request Money`, `Scan Bill`, `Talk to SplitSync`)
  - `.shortcuts-grid` + `.shortcut-card` (uniform-height `Split Expense`, `Rent Preview`, `Store Preview`)
  - `.step-header` + `.step-track` (`transform: scaleX()` step indicator), `.crop-box` / sliders, `.mic-panel`, `.tts-panel`, `.draft-row-card`, `.store-grid` / `.product-card` (`splitStore`)
  - `.field-group input, textarea, select` (`4px solid var(--focus-ring)` focus halo), `.pill` (`created`, `sent`, `awaiting`, `processing`, `paid`, `failed`, `error`, `reviewed`), `.callout`
- **Flutter (`flutter_app/lib/theme/medfarm_theme.dart`)**:
  - `SplitColors`, `buildSplitSyncTheme`
  - `SplitPrimaryButton`, `SplitSecondaryButton`, `SplitBackButton`
  - `SplitTextField` (label-above, `4px` halo, optional key obscure toggle, optional `hintText`)
  - `SplitScreenHeader`, `SplitHubTile`, `SplitStepHeader`, `SplitCard` (`Material`-backed), `SplitBadge`, `SplitStatusPill` (`Created`, `Sent`, `Failed`, `Draft`, `Paid`, `Processing`), `SplitCallout`

## 4. App Shell & Responsive Architecture

- **Shell Elimination & Navigation**: Generic web top header, breadcrumb strip, and footer are removed (`#welcome`, focused workflows, `#pay/<token>`, and `#req/<token>` suppress primary nav completely).
- **Desktop (`>= 681px` web / `>= 720px` Flutter)**: Compact left `.nav-rail` / `NavigationRail` (`Home`, `Activity`, `Store`, `Profile`). Private `#pay/<token>` and `#req/<token>` isolate payer screens (`body.payer` / standalone Scaffold) without leaking organizer controls.
- **Portrait Phone (`<= 680px` web / `390x844` Flutter)**: Fixed 4-tab `.bottom-nav` / `NavigationBar` (`Home`, `Activity`, `Store`, `Profile`), 2x2 hub action grid, wrapping category chips, and stacked cards. `#pay/<token>` promotes `.payment-summary.is-priority` on return/paid states.
- **Short Landscape Phone (`<= 540px` height & `>= 540px` width web / `667x375` Flutter)**: Uses compact left rail (`68px` web `.nav-rail`, `NavigationRail` in Flutter) instead of bottom nav to maximize vertical reading height; keeps hub tiles in a 4-column bar, keeps bill/request editing side-by-side (`split-grid` on web; `twoPane` stacks cleanly below `620px` in Flutter so narrow cards like `participantRow` never clip), and preserves draft inputs across orientation changes.

## 5. Multimodal Bill-to-Voice Workflow & Payment Boundaries

- **Merchant QR (`#scan` -> `#review` -> `#split` -> `#requests` -> `#pay/<token>`)**: Strictly reserved for the fixed `$150.00` Demo Merchant (`SS-001`) PayPal Sandbox Orders v2 checkout.
- **Photographed Receipt & Voice Split (`#scan-bill` -> `#bill-crop` -> `#bill-review` / `#talk` -> `#request-review` -> `#request/<id>` -> `#req/<token>`)**: Captures or loads the bundled Olive Kitchen receipt PNG (`4MB` server limit), crops, extracts fields (`nvidia/nemotron-3.5-super-vl-120b-a12b` fallback when DeepSeek times out), flags unreadable totals/mismatches, accepts live mic STT (`Web Speech` / `faster-whisper`) or typed transcripts, parses recipients with `nvidia/nemotron-3.5-lightning-30b-a3b`, plays Chatterbox WAV voice confirmation (`/api/organizer/read-text`), confirms into per-recipient tokens (`Created` / `Failed` on unconfigured gateways — never falsely `Sent`), and separates reimbursement links from PayPal merchant checkout.
