# PayPal Hackathon Design Contract (Payment App & Voice Assistant Spec)

PayPal Hackathon is the public app name. The PayPal icon appears in the app identity and launcher assets. Keep the existing Ask SplitSync label for the assistant. Demo contact payments and verified PayPal Sandbox merchant checkout have separate status and settlement.

## 1. Current Audit & Strategic Shifts

Compared against the prior prototype (`SplitSync-AI`) and visual reference (`medfarm`), this redesign shifts from a 4-square feature dashboard with pre-populated `$150`/`$2,400` demo clutter to a focused, clean-start payment app inspired by **PhonePe** (action-first home + contact payments) and **super.money** (`splitStore` paired beneath payment utility):

- **Clean Start & Separate Ledgers**: Empty initial Home activity, empty payment/request sheets, empty Ask SplitSync composer, unopened QR scanner camera, and blank Rent creator. Demo transfers and demo requests run in their own `Demo mode` ledger (`demoTransactions` + `reimbursements`), completely separate from verified PayPal Sandbox Orders v2 merchant checkout (`SS-001`, marked **`Sandbox`**).
- **Zero Chrome Clutter**: Main tabs (`Home`, `Activity`, `Store`, `Profile`) use bottom nav on portrait phones (`<= 680px` web / `< 720px` Flutter) and a compact left navigation rail on desktop & short landscape (`<= 540px` height & `>= 540px` width). No top header, breadcrumb strip, step progress bars, duplicate headers, or footer chrome. Focused tasks show one clean `Back` button and screen title.
- **No Presenter Clutter Buttons**: Removed **"Test failed"**, **"Test camera denied"**, **"Test camera unavailable"**, **"Test clarify"**, **"Simulate error"**, and manual **"Mark Paid"** demo-override controls. Permissions, unreadable fields, and clarification prompts trigger naturally from real browser/device states and live inputs, while presenter reset (**`Reset demo session`**) uses the separate `#dev-reset` entry on the web or the local Flutter reset flag.

## 2. Visual System (Medfarm Translation Kept Intact)

- **Colors**: Primary `#0F67FE` (`#0A4EC4` accessible ink on light/tint cards), Focus ring `rgba(15, 103, 254, 0.20)`, Navy `#242E49` / `#182035`, Teal `#48B3A9` / `#136B63` (`#E3F5F3` paid fill), Amber `#9E6200` / `#FFF4DE` (`Waiting for payment`), Error `#B00020` / `#FFF2F4`, Canvas `#F2F5F9`, Card `#FFFFFF` (`1px solid #DCE1E8`), Tinted Surface `#EDF5FF`, PayPal yellow `#FFC439` / `#003087` strictly for commercial PayPal checkout.
- **Typography**: Self-hosted `Plus Jakarta Sans` (`400`, `600–800`) with `tabular-nums` (`FontFeature.tabularFigures()`) on all amounts and FX quotes.
- **Components**: Unified stroke/icon family, `4px` input focus halo, bordered square `Back` control, restrained status pills (`Waiting for payment`, `Payment received`, `Demo transfer`, `Created`, `Sent`, `Failed`, `Sandbox · Awaiting payment`, `Paid`).

## 3. Navigation & Short Everyday Routes

1. **`Home` (`#home`)**: Compact identity row (`Hello, Leah` + `Demo mode`), primary quick actions right at the top (**`Scan & pay`**, **`Request money`**, **`Send money`**, and compact **`Ask SplitSync`** entry), latest Activity rows immediately below, then the international contact row (`🇬🇧 Allen`, `🇺🇸 Maya`, `🇨🇦 Arun`, `🇩🇪 Sofia`, `🇯🇵 Yuki`), Household Actions (**`Rent`**, **`Split expense`**), and a compact 2-item `splitStore` shelf linking to **Store**.
2. **`Activity` (`#activity`)**: Searchable & filterable unified ledger (`All`, `Waiting`, `Received`, `Transfers`, `Sandbox`) showing counterparty, flag/currency amount, date, and single-source status (`Waiting for payment` -> `Payment received from <Name>`, `Demo transfer`, or `SS-001` Sandbox status). Tapping opens full Receipt / Detail / Share / QR.
3. **`Store` (`#store`, `#product/:id`, `#cart`)**: `splitStore` (`Sample inventory · Demo mode`) with persistent visible Cart chip, category filters, search, seller labels, external retailers, and Product -> Shared Cart -> optional **Split this purchase** handoff.
4. **`Profile` (`#profile`)**: Organizer connection (`Connected Sandbox` / `Demo mode` login & server URL), saved International Contacts directory, Voice autoplay default, provider capabilities (AI, STT, Chatterbox TTS, PayPal Sandbox, Delivery) and delivery capabilities.

## 4. International Contacts, FX Quotes & Self-Settling Demo Flows

- **Shared Contact Directory**:
  - `allen`: Allen (`United Kingdom`, `🇬🇧`, `GBP`), `maya`: Maya (`United States`, `🇺🇸`, `USD`), `arun`: Arun (`Canada`, `🇨🇦`, `CAD`), `sofia`: Sofia (`Germany`, `🇩🇪`, `EUR`), `yuki`: Yuki (`Japan`, `🇯🇵`, `JPY`), `leah`: Leah (`United States`, `🇺🇸`, `USD`).
- **FX Display Fixture (`1 USD` base)**: `GBP 0.79`, `CAD 1.39`, `EUR 0.92`, `JPY 153.50`, `USD 1.00`, `INR 84.40` (optional India-based sender `INR` display quote). Preserves exact user-entered amount & currency, rounds converted target currency (`0` decimals `JPY`, `2` decimals otherwise), and explicitly labels conversion as a **`Demo quote`**.
- **Send Money & Review Payment (`#send`, `#review-transfer`)**: Searchable contact picker -> amount + currency + optional note + live **You send / Recipient receives** FX quote -> **Review payment** (`"Verify the recipient and amount before you pay"`) -> editable details -> single-submission idempotent **`Pay`** -> brief reduced-motion-safe progress animation -> **`Demo receipt`** + Activity row.
- **Auto-Progressing Demo Requests**: Manual **Request money** (`#request`), **Ask SplitSync** (`#ask`), or **Rent** (`#rent`) creates requests in **`Waiting for payment`** with staggered persisted `settleAt` timestamps (so multi-recipient requests advance one by one cleanly across refreshes/navigation without duplicates), firing an in-app notification, subtle highlight, and **`Payment received from <Name>`** Demo receipt. Selecting unconfigured Email/SMS delivery keeps `Created` / `Failed` honestly when testing real external channels.

## 5. Multimodal Voice Conversation (`Ask SplitSync` · `#ask`)

- Single open thread with empty start, scrollable chat bubbles, inline editable receipt card (crop & retake available behind attachment thumbnail), **Voice ON/OFF**, **Attach** (camera / upload / demo receipt), text input, **Mic** (`Recording` -> `Transcribing` -> editable transcript + Voice Turn submit), and **Send**.
- **Validated Reply = Visible Text = Chatterbox TTS**: Both typed **Send** and completed **Mic** turns call `/api/organizer/parse-request` (with active `currentDraft` context so successive turns & clarifications update the same draft) -> build validated `replyText` (e.g., *"Maya owes $20.00 for dinner and Arun owes $15.00 for drinks. Ready to create both requests?"*) -> display inline editable draft rows (or transition to **Review payment** for `"Allen, send him 20 dollars saying thanks for coffee."`) -> auto-synthesize via `/api/organizer/read-text` and play automatically with **`Replay`**, **`Stop`**, and visible **`Play`** autoplay fallback.
- **Speech Cancellation & Mic Isolation**: Recording again, tapping **Stop**, submitting a new turn, or leaving `#ask` cancels in-flight TTS fetch (`AbortController`), stops audio playback immediately, increments turn epoch to drop stale WAV responses, and locks out assistant playback during active mic capture.

## 6. Receipt, Rent & Scan & Pay Boundaries

- **Scan Bill (`#scan-bill`)**: Opens camera immediately on first tap (or upload/manual fallback if camera permission denied/unavailable; explicit `Use demo receipt` button). Keeps form blank until extraction finishes, then reveals editable fields + contacts/request handoff.
- **Rent (`#rent`)**: Starts blank (`Create rent request`) -> select household contacts, amount, currency, due date, equal/custom shares, opt-in **`Save rule for future months`** (unchecked by default; only reused when explicitly saved).
- **Scan & Pay (`#scan`)**: Unopened camera by default (`Open camera`) + inline **Paste link or code** (`#purchase/SS-001` or share links); specific error message on unsupported QR codes; PayPal Orders v2 checkout (`#review` -> `#pay/:token`) stays isolated and settles ONLY via real PayPal capture/webhook verification.
