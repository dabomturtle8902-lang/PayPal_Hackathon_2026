# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Household organizers and roommates splitting shared move-in or home purchases (demo household: Maya, Arun, and Leah) and tracking settlement through individual payment links.

## Product Purpose

SplitSync AI guides a household organizer from scanning a merchant purchase QR through AI-assisted or manual bill allocation, voice readback, private payment-link sharing, and verified PayPal Sandbox settlement tracking without exposing organizer credentials or other participants' payment links.

## Positioning

Connected purchase-splitting workflow backed by a single-process Node Sandbox ledger: DeepSeek proposes item ownership within validated totals, Chatterbox reads the reviewed split aloud, the organizer confirms before publishing, and PayPal Sandbox handles buyer approval and server-verified capture per private share token.

## Operating Context

- Local connected Sandbox server (`http://localhost:3000`) serving `website/dist/` and `/api/*` endpoints, paired with the Flutter companion app (`flutter_app/`) targeting mobile and web.
- Evaluated across portrait phones, short landscape phones (with active camera/bill side-by-side layout and rotation draft preservation), and desktop web browsers.

## Capabilities and Constraints

- Fixed `$150.00 USD` demo purchase (`Move-in essentials` at `Demo Merchant · SS-001`): `$120.00` shared kitchen essentials split equally (`$40.00` each) plus `$30.00` personal lamp assigned to one participant (e.g., Leah `$70.00`, Maya `$40.00`, Arun `$40.00`).
- Secrets (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NVIDIA_API_KEY`, `ORGANIZER_TOKEN`) remain server-side in `server/.env`.
- Shares become `Paid` only after server-verified PayPal capture or verified webhook event.
- `Rent` and `Shop` are clearly labeled preview workflows; no real money moves anywhere (`Sandbox demo`).

## Brand Commitments

- Name: **SplitSync AI** (`Shared purchases, settled.`)
- Visual system reference: translated from **Medfarm** (`#0F67FE` Electric Blue, `#242E49` Deep Navy, `#48B3A9` Teal, `#FA4D5E` Coral accent, `#F2F5F9` / `#EDF5FF` cool slate surfaces, `Plus Jakarta Sans` typography, bordered square back button, `4px` focus-halo inputs, step-progress header) while retaining SplitSync AI's own identity and content.

## Evidence on Hand

- Node backend (`server/`) with PayPal Orders v2, NVIDIA DeepSeek + Chatterbox integration, durable JSON store, and mocked tests (`server/test/payments.test.mjs`).
- Responsive web interface (`website/dist/`) with regression tests (`website/test/demo.cjs`).
- Companion Flutter source (`flutter_app/lib/main.dart`).

## Product Principles

1. Connected flow first, honest previews everywhere else (never pretend simulated controls process real payments or decode live web QR streams when they don't).
2. Server truth over client claims (server validates allocations, locks after PayPal order creation, and verifies captures).
3. Graceful degradation when AI or TTS providers are unavailable (manual editing and core checkout keep working).
4. Orientation-intentional ergonomics without overlapping overlays or lost drafts.
