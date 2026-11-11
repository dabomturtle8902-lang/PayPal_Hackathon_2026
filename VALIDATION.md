# Verification

## SplitSync AI Payment & Storefront Redesign

- **Backend (`server/`)**: `npm test` runs `node --test test/*.test.mjs` with 25 mocked tests covering organizer auth, `localOrganizerAutoLogin` defaults & loopback-restricted `.env` auto-connect (`server/index.mjs`), participant token isolation, amount/reference validation, durable request IDs across restarts, PayPal Orders v2 create/capture retry & timeout reconciliation, webhook signature postback checks, CSRF/host/traversal protection, AI split/TTS/STT fallbacks, FX snapshot caching & bidirectional precision, blank electricity/rent rule opt-in, staggered demo settlements, and reset behavior.
- **Website (`website/dist/` & `website/test/demo.cjs`)**: `node website/test/demo.cjs` exercises clean-start Home (`Ask AI` entry), Medfarm Light/Dark (`System` / `Light` / `Dark`) CSS tokens, AI Store buy parsing (`"Buy 2 desk lamps"`), direct Store checkout (`Complete purchase`) -> Store receipt `'Split cash'` handoff into Ask SplitSync, Profile Receive Money QR generation & `#receive/...` scanner prefill, bidirectional FX (Allen GBP & Yuki JPY), Ask SplitSync editable review, blank Electricity creation, staggered demo notifications, 11-product Store, Developer Tools Sponsored toggle isolation, Cart/Checkout review, Back stack navigation, PayPal Sandbox scoping to `SS-001` / PayPal-eligible Store items, and presenter session reset.
- **Live Browser & Connected Flow**: Verified against `http://localhost:3000` (Website + Node Sandbox API) and `http://localhost:5173` (Flutter web preview) in Chrome with automatic `.env` organizer connection (`Demo mode · Sandbox ready`), Medfarm Light & Dark (`#090E1D`) themes, Receive Money QR rendering, AI Store buy -> direct receipt -> `Split cash`, and zero console errors; `npx impeccable detect` reported 0 errors (4 font warnings noting required `'Plus Jakarta Sans'`).
- **Flutter (`flutter_app/`)**:
  - `flutter analyze` and `flutter test --no-pub` verify 13 widget and unit tests (bidirectional JPY FX, editable review, blank Electricity form creation, staggered settlement banner deduplication via `nowProvider` and mocked `splitsync/notifications` channel, 11-product Store, Developer Tools Sponsored toggle, Qty stepper, direct Store checkout, Back stack / tab-to-Home return, responsive overflow checks across `320x568`, `667x375`, and `1280x860`, plus Home `Ask AI` store buy, direct Checkout -> receipt `Split cash`, Profile Receive Money QR scan prefill, Medfarm Dark mode `#090E1D` theme switching, and `.env` `localOrganizerAutoLogin`).
  - `flutter build apk --release` built `flutter_app/build/app/outputs/flutter-apk/app-release.apk` (`72.3 MB`) including Android `MainActivity.kt` notification channel (`POST_NOTIFICATIONS`) and bundled product assets.

## Scope & Provider Limits

- Node backend tests and Flutter widget tests use mocked PayPal responses, fixture FX rates, and injected speech/playback/clock/channel hooks where native hardware or network credentials are absent.
- Live PayPal Sandbox order approval/capture, webhook delivery, and native physical-device testing (hardware camera QR/receipt capture, microphone dictation, runtime Android OS notification drawer display) remain outside automated CI checks until run with live credentials and on a target phone.
- The backend stores allocations in a single-process local JSON ledger (`server/data/sandbox-ledger.json`) intended for Sandbox development; static Sites hosting cannot run the Node server.

## Earlier visual design

The original five screenshots under `previews/` depict earlier static website routes; the current app and connected backend preserve strict separation between simulated `Demo mode` personal requests/transfers and PayPal Sandbox merchant checkout (`SS-001` and eligible Store items).
