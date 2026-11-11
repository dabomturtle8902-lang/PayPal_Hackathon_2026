# SplitSync AI Design Contract (Payment App, Bills & Storefront Pass)

Visual reference: **Medfarm** (`C:\Users\gurpr\OneDrive\Desktop\Projects\Flutter\Work - Freelance\medfarm`) — translated across `website/dist/` and `flutter_app/` using Medfarm's `#0F67FE` / `#1457D9` Electric Blue, `#172846` / `#242E49` Navy canvas cards, `#48B3A9` / `#136B63` Teal received status, `#FA4D5E` Coral accent, `#F1F5FC` canvas, `#FFFFFF` bordered cards (`1px solid #DCE1E8`), `#EDF5FF` tinted panels, self-hosted `Plus Jakarta Sans` with `tabular-nums`, `4px` input focus halo, and `48dp`/`44px` touch targets.

---

## 1. Screen-by-Screen Audit of Pulled Code (`179104b`)

Audited live on `http://localhost:3000` (`1280x860` desktop, `390x844` mobile) and via source inspection of `flutter_app/` + `website/dist/`:

1. **Inconsistent Naming & Mixed Demo Vocabulary**: Pulled code mixed `"PayPal Hackathon"`, `"Practice mode"`, `"Practice transfer"`, `"Ask AI"`, `"Split expense"`, `"splitStore"`, and `"Sandbox Merchant Sandbox flow"`. Standardizing short, user-facing action labels across Web & Flutter: **SplitSync AI** brand identity (`Demo mode` for fictional contact transfers & timed receipts; `PayPal Sandbox` strictly for verified `SS-001` / Demo Merchant Orders v2 checkout), **`Scan & Pay`**, **`Send Money`**, **`Request Money`**, **`Split a Bill`**, **`Ask SplitSync`**, **`Activity`**, **`Store`**, **`Electricity`**, **`Rent`**.
2. **Home Fold Density & Missing Bill Utility**: Oversized hero stack + full-width Profile bar pushed recent contacts, bills, and store below the `390x844` fold; Home lacked a **`Requests awaiting payment`** summary card and completely lacked **`Electricity`** under household bills.
3. **Broken Back Behavior & Missing Transitions (`flutter_app` + `website`)**: Flutter rendered inside one flat `String page` switch with no `Navigator` stack or `PopScope`, causing Android system Back to exit the app immediately from detail/form/cart/assistant screens; switching bottom tabs reset/lost scroll context; web used hardcoded `backRoute` links rather than parent history and lacked subtle slide transitions + re-animated the whole DOM on keystrokes.
4. **Touch Targets & Flag Fallback Defects**: Secondary buttons, chips, text links, and toggles measured `20px–38px` tall (below `44x44px` web / `48x48dp` Flutter floor). Regional emoji flags rendered as serif letters (`GB`, `US`, `CA`) in Windows Chromium without fallback badges/avatars.
5. **Currency Conversion Side & Precision Gaps**: Send flow could only enter the source ("You send") amount; entering recipient currency ("Recipient receives") was unsupported. Zero-decimal `JPY` still used `step="0.01"` and `.toFixed(2)` in Review, Ask Drafts, Manual Requests, and Rent, and USD amounts omitted `USD` next to `$`. `Receipt` and `Activity` recomputed FX dynamically instead of locking the reviewed quote.
6. **Staggered Notifications & Activity Detail Gaps**: Home lacked live awaiting-payment totals updated by settlements; Flutter `Activity` lacked direction (`Outgoing` / `Incoming` / `Merchant`), receipt reference (`receiptRef`), conversion breakdown, persisted `settledAt` timestamps, and OS notification capability handling with in-app fallback.
7. **Ask SplitSync Editable Review**: Flutter's `Review payment` (`transferReviewScreen`) displayed read-only labels instead of editable extracted fields after `"Send Allen $20 and say thanks for coffee."`
8. **Storefront & Checkout Gaps**: Only 6 products rendered with generic vector icons instead of real product images; missing at least 10 identifiable products; missing hidden-by-default **Sponsored** placement with visible disclosure when enabled; Product Detail lacked quantity picker, sticky bottom bar, and `Buy Now with PayPal` (for Demo Merchant items vs honest external retailer links); Flutter Cart lacked quantity `- / +` and `Remove`; Cart lacked a `Checkout review` screen.
9. **Flutter Toolchain Constraint**: `pubspec.yaml` required `sdk: '>=3.13.0 <4.0.0'`, blocking `flutter pub get` / `flutter test` under installed Flutter `3.44.8` (`Dart 3.12.2`).
10. **Presenter Controls**: `handoff` route retained forced outcome buttons (`Processing / Paid / Cancelled`) on user flows, and presenter reset lacked a clean separate developer entry point (`#dev` / `#dev-reset`) in Flutter.

---

## 2. Navigation, Transitions & App Shell

- **Four Persistent Root Tabs (`Home`, `Activity`, `Store`, `Profile`)**:
  - Bottom `NavigationBar` / `.bottom-nav` on narrow portrait (`< 681px` web / `< 720px` Flutter) preserving each tab's state & scroll position (`IndexedStack` in Flutter; persisted tab containers/state in Web).
  - Compact left `NavigationRail` / `.nav-rail` on tablet/desktop & short landscape (`<= 540px` height & `>= 540px` width on web; `>= 720px` or landscape `>= 540px` in Flutter).
  - System Back from non-Home tabs returns to `Home` before exiting the app cleanly.
- **Logical Parent Back & Cupertino Push/Pop Stack**:
  - **Flutter**: Dedicated `CupertinoPageRoute` routes pushed on a nested/app `Navigator` for all task screens (`SendMoney`, `RequestMoney`, `ReviewTransfer`, `TransferReceipt`, `AskSplitSync`, `ScanPay`, `ScanBill`, `BillCrop`, `BillReview`, `RequestDetail`, `PayerReimbursement`, `Electricity`, `Rent`, `StoreProduct`, `Cart`, `CheckoutReview`, `SS001Review`, `SS001Split`, `SS001Links`, `SS001Dashboard`, `DevTools`). Supports iOS edge-swipe back, Android hardware/predictive Back, and app `SplitBackButton` returning to the true logical parent. Honors `MediaQuery.disableAnimationsOf(context)` with instant transition when Reduced Motion is active.
  - **Web**: Parent-aware stack (`navHistory`) synchronized with `hashchange` + `history.back()` cleanly without leaving `localhost:3000`. Task views apply a restrained slide-in transition only on actual route change (never on input re-renders), suppressed completely under `prefers-reduced-motion: reduce`, guarded against overlapping transition timers.

---

## 3. Core Flows & Acceptance Criteria

### 3.1 Home & Utility Bills (`#home`, `#electricity`, `#rent`)
- **Above the Fold**: Compact header (`Hello, Leah` + `Demo mode`), 2x2 payment actions (`Scan & Pay`, `Send Money`, `Request Money`, `Split a Bill`) + compact `Ask SplitSync` bar, **Recent contacts** strip (circular colored avatar + crisp SVG flag + currency code), **Requests awaiting payment** summary (pending count & total waiting in primary currency) + **Recent transactions** (`See all`), **Bills & Household** (`Electricity`, `Rent`, `Scan a Bill`, `Split a Bill`), and compact **Store** preview.
- **`Electricity` & `Rent`**: Both start completely blank (`Create electricity request` / `Create rent request` or blank fields with zero defaults). Organizer selects household contacts, enters optional provider/note, total amount, currency, due date picker, equal or custom shares, optional unchecked `Save rule for future bills`, reviews per-person amounts, and creates requests through the shared request & receiving flow.

### 3.2 Contacts & Bidirectional FX (`#send`, `#review-transfer`, `#tx/:id`)
- **Unified Directory**: `allen` (Allen, United Kingdom, GBP), `maya` (Maya, United States, USD), `arun` (Arun, Canada, CAD), `sofia` (Sofia, Germany, EUR), `yuki` (Yuki, Japan, JPY), `leah` (Leah, United States, USD) — rendered with SVG flag + color-coded avatar + readable name + country + currency code across search, Home, forms, AI, Activity, and Profile.
- **Bidirectional FX Engine**: Selecting any contact opens Send or Request with a blank amount and optional note. Users toggle or edit either **"You send"** or **"Recipient receives"**, seeing the entered side preserved accurately, converted counterparty amount, currency codes beside every symbol (`$20.00 USD`, `CA$28.27 CAD`, `¥3,164 JPY` 0-decimal integer precision), and **`Demo rate`** (`1 USD = ... · ECB 2026-11-10 fixture`).
- **Locked Review -> Receipt -> Activity**: `Review payment` displays `"Verify the recipient and amount before you pay"` with editable contact, amount/side toggle, currency, and note. Tapping **`Pay`** executes idempotently via `/api/organizer/demo-pay` (storing `enteredSide`, `sourceAmountCents`, `targetAmountCents`, `rate`, `rateDate`) so Receipt & Activity always match the reviewed quote cleanly.

### 3.3 Receiving Screen & Staggered Demo Notifications (`#request/:id`)
- Creating any manual, bill, Ask SplitSync, Electricity, or Rent request opens the **Receiving** screen displaying collected total (`Collected / Total`), progress bar, and individual share rows (`Waiting for payment` -> `Payment received`).
- Local timers advance each Demo mode share at staggered variable intervals (`~2.4s + index * 2.3s`, variable jitter), persisting `settledAt`, `receiptRef`, and notification dedup state in storage so navigating away or refreshing updates totals once without duplicate receipts.
- Checks OS notification capability (`Notification.permission` on Web / native notification bridge when available) and falls back gracefully to a prominent in-app notification banner identifying the sender and amount (`Payment received from Maya · $20.00 USD`).

### 3.4 Activity List & Detail (`#activity`, `#tx/:id`)
- Filterable (`All`, `Awaiting payment`, `Payment received`, `Sent`, `Sandbox`) & searchable rows showing direction (`Sent` / `Receiving` / `Merchant`), counterparty, amount + currency code, date, and status.
- Activity detail displays direction, counterparty, status, note, full conversion breakdown (`You sent`, `Recipient receives`, `Demo rate`), timestamp, and `Receipt reference`.

### 3.5 Store (`#store`, `#product/:id`, `#cart`, `#checkout-review`)
- **10+ Identifiable Products** with locally bundled crisp studio product PNGs (`website/dist/assets/products/` + `flutter_app/assets/products/`), grounded descriptions, USD prices labeled `Demo price · Sample fixture`, honest sellers (`Demo Merchant` for SS-001 Sandbox items; named demo sellers; honest external retailer cards with `Open retailer` external link). No invented brand partnerships.
- **Hidden Sponsored Placement**: Hidden by default from `#store`; shown with an explicit **`Sponsored · Paid placement disclosure`** badge only when enabled in `#dev` or `?sponsored=1`.
- **Product Detail**: Studio product image, description, price + currency code, seller, fixture note, `- qty +` selector, and bottom bar pinned cleanly within thumb reach (`padding-bottom` clearance so content is never covered) with **`Add to Cart`** (updates badge + shows toast/snackbar feedback) and **`Buy Now with PayPal`** (connected ONLY for `Demo Merchant` catalog items via Sandbox checkout review; external items display **`Open on Retailer`** + explanation).
- **Cart & Checkout Review**: Quantity `- / +` & `Remove`, optional **`Split this purchase`** (AI split handoff), and **`Checkout review`** enforcing honest Demo Merchant PayPal Sandbox vs Demo fixture checkout boundaries.

### 3.6 Developer Entry Point (`#dev`, `#dev-reset`)
- Zero forced-outcome presenter shortcuts (`Test failed`, `Test error`, `Preview Paid/Cancelled`, `Mark Paid`) on user screens.
- Separate **`#dev`** (Web) / **Developer Tools** (Flutter) entry point hosts **`Reset demo session`**, **`Sponsored storefront preview` toggle**, and Sandbox provider diagnostics.
