# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Household organizers and roommates splitting shared move-in or home purchases (demo household: Maya, Arun, and Leah) and tracking settlement through individual payment links.

## Product Purpose

**SplitSync AI** is an action-first payment, cross-border demo transfer, shared bill, and store application across Flutter and responsive web, pairing PhonePe-style payment utility and Medfarm design precision with AI bill/voice drafting, honest demo simulation boundaries, and server-verified PayPal Sandbox checkout for Demo Merchant (`SS-001`).

## Positioning

Connected workspace backed by a single-process Node Sandbox ledger: bidirectional reference FX (`Demo rate`), multimodal bill scanning and voice drafting via NVIDIA NIM + Chatterbox TTS, blank `Electricity` & `Rent` household split builders, staggered `Demo mode` settlement notifications, an 11-product household `Store` with quantity controls and honest retail scoping, and strict per-share `PayPal Sandbox` checkout isolation for `Demo Merchant`.

## Operating Context

- Local connected Sandbox server (`http://localhost:3000`) serving `website/dist/` and `/api/*` endpoints, paired with the Flutter companion app (`flutter_app/`) targeting Android, iOS, desktop, and web.
- Evaluated across narrow portrait (`320x568` / `390x844`), short landscape (`667x375`), and desktop (`1280x860` / `1440x900`) viewports with parent-aware Back navigation and reduced-motion support.

## Capabilities and Constraints

- Fixed `$150.00 USD` demo purchase (`Move-in essentials` at `Demo Merchant · SS-001`): `$120.00` shared kitchen essentials split equally (`$40.00` each) plus `$30.00` personal lamp assigned to one participant.
- Secrets (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NVIDIA_API_KEY`, `ORGANIZER_TOKEN`) remain server-side in `server/.env`.
- Shares become `Paid` only after server-verified PayPal capture or verified webhook event.
- Contact transfers, staggered settlement timers, `Electricity`, `Rent`, and sample Store fixtures are clearly labeled `Demo mode` / `Demo rate` / `Demo price`; no real money moves.

## Brand Commitments

- Name: **SplitSync AI**
- Visual system reference: translated from **Medfarm** (`#1457D9` / `#0F67FE` Electric Blue, `#172846` / `#242E49` Deep Navy, `#48B3A9` Teal, `#F1F5FC` cool canvas, `Plus Jakarta Sans` typography, `48dp`/`44px` bordered Back button, `4px` focus-halo inputs) while keeping SplitSync AI's own identity.

## Evidence on Hand

- Node backend (`server/`) with PayPal Orders v2, NVIDIA DeepSeek + Chatterbox integration, durable JSON store, and mocked tests (`server/test/payments.test.mjs`).
- Responsive web interface (`website/dist/`) with regression tests (`website/test/demo.cjs`).
- Companion Flutter source (`flutter_app/lib/main.dart`).

## Product Principles

1. Connected flow first, honest previews everywhere else (never pretend simulated controls process real payments or decode live web QR streams when they don't).
2. Server truth over client claims (server validates allocations, locks after PayPal order creation, and verifies captures).
3. Graceful degradation when AI or TTS providers are unavailable (manual editing and core checkout keep working).
4. Orientation-intentional ergonomics without overlapping overlays or lost drafts.
