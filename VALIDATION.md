# Verification

## PayPal Sandbox backend

- Thirteen Node backend tests pass with mocked PayPal responses. Coverage includes organizer sessions, participant isolation, amount/reference checks, persisted creation request IDs across restart, create/capture retries, capture-timeout reconciliation, pending/completed webhook updates, signature verification requests, CSRF/host/traversal checks, and refreshing orders without a return URL.
- Twenty-two static website route regression checks pass.
- Flutter dependency resolution succeeded and `flutter analyze` reported no issues. A release Flutter web build succeeded in a temporary generated web wrapper. Native Android/iOS builds and native device camera access have not been tested.
- Browser walkthrough verified organizer login, initial $0 paid ledger, confirmed split publication, private participant links, $70 Maya breakdown, and missing-credentials error handling. The compiled Flutter web app connected to the same backend and displayed the $0 paid / $150 remaining ledger. No real credentials were supplied or accessed.
- No actual PayPal Sandbox order, approval, capture or delivered webhook has been tested against the provider. Complete that test locally with your Sandbox credentials and approve the payment yourself on PayPal's screen.
- The backend uses a local JSON ledger and one process. It has not been deployed; a static Sites deployment cannot run this Node server.

## Earlier visual design

The original five screenshots show static website routes at desktop, portrait and landscape widths. Their payment statuses and receipt are sample data. The new backend starts with everyone Awaiting payment and relies on provider capture status. AI allocation, rent and shop remain demos.
