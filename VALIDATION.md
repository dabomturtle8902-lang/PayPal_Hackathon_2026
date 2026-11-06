# Verification

- Node syntax check passed for the website script.
- `node website/test/demo.cjs` passed: 22 rendered routes, allocation sum invariant, lamp ownership edits, participant-specific breakdowns, payment result variants, and publication state.
- Browser walkthrough verified organizer entry, scanner demo fallback, purchase review, AI split, confirmation, requests, QR rendering, participant share and payment result.
- Responsive visual inspection at desktop 1440×1000, portrait 390×844 and landscape 844×390. Five website screenshots are in previews/. These are browser renders, not native Flutter screenshots.
- Flutter SDK is unavailable; native app build, dependency resolution and camera behavior have not been tested.
- PayPal handoff and AI are simulations; no provider transaction or model integration was tested.
- Private hosting registration succeeded but the source upload was blocked by automatic approval review. No deployment was completed.
