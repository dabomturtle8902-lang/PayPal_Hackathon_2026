# SplitSync AI Design Contract (Finished App Spec)

## 1. Current State Audit (Pre-Redesign Findings)

Inspected all existing routes on `website/dist/` (`#home`, `#welcome`, `#scan`, `#scan-error`, `#review`, `#split`, `#clarify`, `#edit`, `#requests`, `#qr/:name`, `#dashboard`, `#share/:name`, `#handoff/:name`, `#result/:name/:state`, `#pay/:token`, `#rent`, `#shop`, `#product`, `#preferences`) and corresponding screens in `flutter_app/lib/main.dart`:

- **Shell**: Currently uses a desktop web top `<header>`, breadcrumb bar (`Workspace / Overview`), wide 248px text sidebar, and generic `<footer>`. Narrow screens show a horizontal pill strip instead of native app bottom navigation; Flutter uses a single `AppBar` without bottom navigation or compact desktop rail.
- **Home**: Currently leads with a large promotional navy banner (`Start a shared purchase in seconds`) instead of an action-first payment hub.
- **Signature Multimodal Flow**: Currently only supports QR scanning (`Scan QR`) to open the fixed `$150.00` Demo Merchant purchase (`SS-001`) and assign a `$30.00` lamp via typed instruction. Missing: camera/upload/sample **Scan Bill** receipt capture with Crop/Retake, vision receipt field extraction (`merchant`, `date`, `currency`, `items`, `tax`, `tip`, `total`, unreadable/mismatch flags), **microphone Speech-to-Text**, general multi-recipient reimbursement parsing with contact resolution & unallocated balance, **Chatterbox** spoken request confirmation (`"I'll request $20 from Maya for dinner and $15 from Arun for drinks. Review and send?"`), explicit request creation, and honest delivery channel state tracking (`Created` vs `Sent` vs `Processing` vs `Paid`).
- **Activity & Requests**: Currently only shows `#dashboard` for `SS-001`. Missing: unified **Activity** feed with status filters and Request Detail showing photographed receipt evidence separately from PayPal Sandbox merchant checkout.
- **Store**: Currently shows 2 large static cards (`Kitchen essentials bundle` and `IKEA`). Missing: browseable `splitStore` grid with search, category shortcuts, product artwork, seller labels, multi-item shared cart (`Add to shared purchase` -> `Split with people`), and external retailer links.

## 2. Design Reference Translation (Medfarm + PhonePe + super.money splitStore)

Pulled directly from `medfarm/lib/global/colors.dart`, `button.dart`, `entry.dart`, `layout.dart`, and `signin.dart`:

| Element | Medfarm Source Token / Pattern | SplitSync AI App Translation |
|---|---|---|
| Primary & Active | `primaryColor` `#0F67FE`, `primaryBorder` `rgba(15,103,254,0.20)` | Primary CTAs, active bottom-nav/rail tab, selected chips, 4px input focus halo (`#0F67FE` border + `20%` ring) |
| Deep Navy Structure | `secondaryColor` `#242E49` | Display headings, active capsule progress fill, camera/receipt viewfinder surface, balance & scan card headers |
| Teal Positive / Paid | `logoPrimaryColor` `#48B3A9` | Settled bars, `Paid` & `Sent` positive badges (`#136B63` ink on `#E3F5F3`), mic active state |
| Coral Secondary Link | `signUpBg` `#FA4D5E` | Coral utility/reset accents (`#C62839` accessible ink on light cards) |
| Error / Warning | `errorColor` `#B00020` | Unreadable/mismatch receipt flags, denied permission warnings, `Delivery failed`, `Cancelled` pills |
| Grounds & Surfaces | `gettingStartedBg` `#F2F5F9`, `imageBg` `#EDF5FF`, `backgroundColor` `#FFFFFF`, `surfaceColor` `#FAFAFA` | Soft slate scaffold `#F2F5F9`, crisp `#FFFFFF` cards (`1px solid #DCE1E8`), `#EDF5FF` tinted summary & cart surfaces |
| Typography | `PlusJakartaSans-Regular.ttf` & `PlusJakartaSans-ExtraBold.ttf` | Self-hosted `Plus Jakarta Sans` everywhere with `tabular-nums` (`FontFeature.tabularFigures()`) on all currency totals |
| Inputs & Back Header | `CustomTextField` (`12px` radius + `4px` focus halo), `CustomLayout` (`CustomBackButton` + capsule track) | Label-above inputs with `4px` halo; focused flows use in-screen bordered back square (`SplitBackButton` / `.btn-back`) + step capsule |
| Payment Hub (PhonePe) | Instant 4-tile action grid above the fold | `Scan & Pay`, `Request Money`, `Scan Bill`, `Talk to SplitSync` right below compact greeting/hub header, followed by Active Requests, Recent Activity, and smaller `Split Expense`, `Rent`, `Store` shortcuts |
| Storefront (`splitStore`) | Compact category pills + dense product tiles + cart handoff | Category shortcuts (`All`, `Kitchen`, `Lighting`, `Furniture`, `Cleaning`, `Retailers`), seller tags, cart count pill -> `Add to shared purchase` -> Shared Cart -> `Split with people` |

## 3. Navigation & App Shell Architecture

- **Remove Chrome Clutter**: No top website `<header>`, no `#breadcrumb` strip, and no `<footer>` across main app views.
- **Primary Tabs (4)**:
  1. `Home` (`#home`): Action-first Payment Hub (`Scan & Pay`, `Request Money`, `Scan Bill`, `Talk to SplitSync`), Active Requests summary, Recent Activity preview, and compact shortcuts (`Split Expense`, `Rent`, `Store`).
  2. `Activity` (`#activity`): Filterable ledger (`All`, `Created`, `Sent`, `Awaiting payment`, `Processing`, `Paid`) across both Demo Merchant `SS-001` shares and Photographed Bill Reimbursement Requests, plus quick jump to `Rent` monthly draft and full Request Detail (`#request/:id`).
  3. `Store` (`#store`): `splitStore` catalog with search, category chips, preferences shortcut (skippable), sample product tiles with bundled SVG/vector artwork, Product Detail (`#product/:id`), and Shared Cart (`#cart`) linking to `Split with people`.
  4. `Profile` (`#profile`): Organizer info (`Maya, Arun & Leah` Household), Contacts directory (resolve spoken names like `Maya`, `Arun`, `Leah`), Backend URL & Organizer Key sign-in/sign-out, live Provider Diagnostics badges (AI Model, STT/TTS, PayPal Sandbox status, Delivery channels), and Sandbox safety note.
- **Responsive Chrome**:
  - **Mobile Portrait & Short Landscape (`<= 760px`)**: Fixed bottom navigation bar (`Home`, `Activity`, `Store`, `Profile`, `>= 48dp` targets, `env(safe-area-inset-bottom)` aware; auto-hides on focused sub-screens!).
  - **Desktop Web & Wide Tablet (`> 760px`)**: Compact left icon+label **Navigation Rail** (`76px–88px` wide, clean tooltips/labels, cart badge), maximizing workspace width.
- **Focused Sub-Screens**: `Scan & Pay` (`#scan`), `Scan Bill` (`#scan-bill`), `Bill Crop & Extract` (`#bill-crop`), `Bill Review` (`#bill-review`), `Talk to SplitSync / Dictate` (`#talk`), `Request Review & Confirm` (`#request-review`), `SS-001 Purchase Review` (`#review`), `SS-001 AI Split` (`#split`), `Share Links & QR` (`#requests`, `#request/:id`), `Payer Checkout` (`#pay/:token`, `#req/:token`), `Activity Detail`, `Rent` (`#rent`), `Cart` (`#cart`), `Product Detail` (`#product/:id`), `Preferences` (`#preferences`) use an in-screen compact header with bordered Back button + title (`no bottom bar / no rail overlap`).
- **Private Payer Isolation**: `#pay/:token` (Demo Merchant `SS-001` PayPal Sandbox checkout) and `#req/:token` (Personal Receipt Reimbursement request view) render in a standalone compact single/two-column payer shell without organizer nav or sign-in required.

## 4. Signature Flow & Provider Boundaries

1. **Merchant QR vs Photographed Receipt Separation**:
   - **Scan & Pay (`#scan`)**: Strictly for merchant QR codes (`#purchase/SS-001`, Demo Merchant `$150.00` Move-in essentials), feeding **Purchase Review (`#review`) -> AI Split (`#split`) -> Share (`#requests`) -> PayPal Orders v2 Checkout (`#pay/:token`)**. Keep end-to-end demonstrable!
   - **Scan Bill (`#scan-bill`)**: For personal photographed receipts (`camera capture`, `file upload`, or `Use bundled sample receipt`).
2. **Bill Crop -> AI Extract -> Editable Bill Review**:
   - Step 1: Take photo (`getUserMedia` / camera) or upload image or click `Use bundled sample receipt` (generates/loads a real PNG receipt image of a `$52.00` / `$35.00+tax+tip` dinner & drinks bill).
   - Step 2: **Crop / Retake** panel allows adjusting receipt crop bounds on `<canvas>` (web) / image frame (Flutter) or retaking before uploading base64 image to `POST /api/organizer/extract-bill`.
   - Step 3: Extraction returns `{ merchant, date, currency, items, taxCents, tipCents, totalCents, unreadableFields, totalMismatch, modelUsed }` and renders fully editable form fields. Unreadable fields & math mismatches (`items + tax + tip !== total`) display clear amber/red inline flags for manual fix. Manual bill entry/editing remains 100% functional if AI providers fail.
3. **Voice Dictation (STT) + Request Parsing + Chatterbox Reply**:
   - On Bill Review or `Talk to SplitSync` (`#talk`), tapping the **Mic** records audio (`MediaRecorder` -> `POST /api/organizer/transcribe` via `faster-whisper` or browser `SpeechRecognition` live transcript). Denied/unavailable microphone permission immediately offers clear error messaging + editable text input + sample voice prompt button (`"Ask Maya for twenty dollars for dinner and Arun for fifteen for drinks."`).
   - `POST /api/organizer/parse-request` proposes per-recipient rows `{ name, matchedContact, known, amountCents, currency, reason, ambiguous }`, computes `unallocatedCents` against the attached bill (if any), and triggers clarification warnings for unknown/ambiguous names or ambiguous amounts. Server-side validation enforces `amountCents > 0`, integer cents, valid currency, and prevents negative/tampered totals; **only the organizer can confirm**.
   - **Chatterbox spoken reply** (`POST /api/organizer/read-text`): speaks `"I’ll request $20 from Maya for dinner and $15 from Arun for drinks. Review and send?"` (and dynamic edited amounts) via `server/chatterbox.py` (`nvidia-riva-client`), surfacing real loading, audio player, or honest `502`/`503` unavailable feedback if the speech client/endpoint fails.
4. **Confirm & Deliver (`Created` vs `Sent` vs `Processing` vs `Paid`)**:
   - Confirming creates persistent request records (`POST /api/organizer/requests`) backed by `Store` (`version: 2` migrating `version: 1` seamlessly) attaching receipt evidence metadata (`merchant`, `date`, `items`, `totalCents`, optional cropped thumbnail data URL).
   - Choosing a delivery channel (`Link / QR`, `Email preview`, `SMS preview`) calls server send (`POST /api/organizer/requests/:id/deliver`): if no external SMTP/SMS gateway is configured, status stays `Created` (or `Delivery failed` on attempted automated send without credentials) and displays real `Copy link`, `Show QR`, `Share` buttons. Choosing `Mark shared via link/QR` after copying/sharing transitions `Created` -> `Sent` cleanly. Failed delivery **never** marks a request as `Sent`.
5. **Reimbursement vs PayPal Checkout Verification Boundary**:
   - `server/paypal.mjs` implements **PayPal Sandbox Orders v2** (`/v2/checkout/orders`, commercial Checkout bound to Demo Merchant `SS-001`) and requires `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET`.
   - Photographed personal receipts create **Reimbursement requests** (`#req/:token`) showing recipient amount, reason, receipt evidence, and settlement status without falsely attaching commercial Orders v2 checkout to arbitrary P2P reimbursements. Demo Merchant (`#pay/:token`) preserves full PayPal Sandbox create/approve/capture/webhook verification.

## 5. Responsive & Rotation Contract

- **Portrait Mobile (`390x844`)**: Single-column vertical flow, `>= 48px` tap targets, fixed 4-tab bottom navigation on primary tabs (`Home`, `Activity`, `Store`, `Profile`), hidden on focused flows.
- **Short Landscape (`667x375`)**: No sticky top header consuming vertical space; split/review/scanner/bill screens use 2-column side-by-side panes (source camera/bill left, task/editing right); inputs/drafts (`bill`, `transcript`, `recipientRows`, `cart`) preserve state across rotation.
- **Desktop Web (`1440x900`)**: Left Navigation Rail + wide canvas; `#pay/:token` and `#req/:token` display breakdown/evidence left beside Payment/Status summary right.

## 6. Acceptance Criteria

- **AC1 (`web-demo`)**: Website build/tests verify shell redesign (4 tabs, no header/footer clutter), PhonePe hub actions, Scan QR vs Scan Bill separation, bill extraction/edit/clarification/voice transcript/draft parsing, `Created`/`Sent`/`Processing`/`Paid` state rules, private `#pay/:token` & `#req/:token` boundaries, Store/Cart/`Split with people`, and Rent draft.
- **AC2 (`server-test`)**: Server test suite (`npm test` in `server/`) passes all existing PayPal v2 / security / idempotency tests plus new tests for bill extraction validation, speech transcription/parsing validation, request creation/delivery honest failure (`never Sent on failed delivery`), per-request share token isolation, and v1->v2 store migration.
- **AC3 (`flutter-analyze` & `flutter test`)**: Flutter app passes `flutter analyze` with 0 issues and `flutter test` verifying mobile bottom nav, desktop rail, Scan Bill / Crop / Dictate / Clarification / Confirm flow, Store / Cart -> Split with people, Activity filter/detail, and zero overflow across `390x844` portrait & `667x375` short landscape with draft persistence on rotation.
- **Live Verification**: Inspect desktop (`1440x900`), portrait (`390x844`), and short landscape (`667x375`) via Chrome DevTools MCP across all new journeys, and probe real `NVIDIA_API_KEY` (LLM/VLM), STT/TTS, Delivery, and PayPal Sandbox endpoints, reporting honest real-provider outcomes.
