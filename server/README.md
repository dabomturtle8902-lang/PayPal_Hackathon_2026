# SplitSync PayPal Sandbox backend

This Node server serves the existing website and implements PayPal Sandbox Orders v2. It has no npm dependencies. Use Node.js 22 or later.

## Start in VS Code

From the repository root:

```sh
cd server
cp -n .env.example .env
```

Open `server/.env` in VS Code. Fill `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` with the credentials from the **Sandbox** app in your PayPal Developer dashboard. These are API credentials, not the Personal/Business account passwords. Do not paste secrets into chat. `.env` and the payment database are excluded from Git.

```sh
npm start
```

Open **http://localhost:3000** (use `localhost`, not `127.0.0.1`). Enter the **SplitSync organizer access key** printed in this server's terminal. A temporary key is generated each startup unless `ORGANIZER_TOKEN` is set in `.env` to a private random string of at least 24 characters.

1. Open Scan QR → Open demo purchase → Prepare AI split.
2. Confirm Maya $70, Arun $40, Leah $40, then Confirm split.
3. Copy each person's private link or open their QR view. The old predictable `#share/maya` demo links are not the payment credentials.
4. Open Maya's private link and choose Pay with PayPal. Sign in **on PayPal's screen** with the Personal Sandbox buyer account; approve the test payment yourself.
5. PayPal returns to SplitSync. The backend captures the order and verifies its amount, currency, purchase reference and capture status. Only a completed capture becomes Paid. Pending captures display Processing.
6. Check the Business Sandbox account's activity to confirm receipt. Refresh the organizer dashboard to see the ledger; opening a dashboard route reloads it from the server.
7. Test Cancel on PayPal and retry. A cancel redirect does not assert that an order was captured; already completed captures stay paid.

The backend starts with **all shares awaiting payment**, not the original mockup's seeded mixed states. After an order has been started, lamp ownership is locked to prevent changing amounts underneath an approval. To test a different purchase, stop the server and use a new `DATA_FILE` path; keep old ledgers for reconciliation. Don't reset a ledger containing unresolved payments.

Stop the server with Control+C. The old Python server on port 8080 remains a static visual demo; it cannot process payments. Opening a deployed static Sites URL also does not run this Node server.

## Flutter connection

From `flutter_app`, resolve dependencies and run on a stable development port:

```sh
flutter pub get
flutter run -d chrome --web-port=5173 --dart-define=PAYER_ORIGIN=http://localhost:3000
```

If platform files haven't been generated in that folder yet, run `flutter create --platforms=android,ios,web --project-name splitsync .` once, before the commands above. Open the **settings icon** in SplitSync and enter the **same SplitSync organizer key**, then Connect. Confirm split publishes the allocation to the server. Payment requests use the server's private share URLs. Pay with PayPal opens the hosted share page in a browser. Return to the app and tap Refresh payment status on Group payment to sync completed payments.

For Flutter web, `FLUTTER_WEB_ORIGIN` must match the exact Flutter origin; the example `.env` allows `http://localhost:5173`. No wildcard CORS is enabled. To test a native Android/iOS device, use a reachable HTTPS backend and set `PAYER_ORIGIN` to that origin; `localhost` on a phone refers to the phone. Native camera/platform permissions still need the platform setup described in the project README.

## Webhooks

Capture and manual refresh work without webhooks. To receive asynchronous updates even if the buyer closes the browser:

1. Expose this server at a stable **HTTPS** origin using a Node hosting service or your chosen development tunnel. Configure `PUBLIC_BASE_URL` to that origin without a trailing slash; set `HOST` and `PORT` as required by your hosting service.
2. In your PayPal **Sandbox app**, add the webhook URL `https://YOUR_ORIGIN/api/paypal/webhook`.
3. Subscribe to `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, and `PAYMENT.CAPTURE.DENIED`.
4. Copy the subscription's Webhook ID into `PAYPAL_WEBHOOK_ID`, then restart the server.

Signatures are verified through PayPal's verification endpoint. The handler fetches the authoritative order before changing the ledger, checks the stored order binding and amount, and deduplicates event IDs. PayPal's standalone webhook simulator does not support this postback verification flow; test with actual Sandbox app events.

This build handles the purchase capture lifecycle; it does not implement refunds, disputes, payouts, multiple merchants, or automatic transfers to the organizer. All payments go to the Sandbox merchant associated with your API credentials.

## Persistence and retries

`server/data/sandbox-ledger.json` stores allocations, private participant tokens, order IDs, idempotency keys, capture receipts and processed event IDs. Writes use atomic rename and owner-only file permissions. Use exactly **one server process per ledger file**. Back up the ledger privately and use persistent storage if hosting it.

Order creation and capture use stable PayPal request IDs stored before requests. Retries reuse the same attempt; duplicate requests are serialized within the process. Unresolved operations older than five hours stop for operator reconciliation rather than risk replaying after PayPal's finite idempotency window. Do not delete unresolved orders to bypass this guard.

Organizer access uses an in-memory session cookie or the organizer Bearer token used by Flutter. Session cookies expire at browser close/expiry or server restart. Private links grant access to one participant's share and should be treated as credentials. This is a single-household Sandbox development backend, not a production account or multi-tenant identity system.

## Tests

```sh
npm test
node ../website/test/demo.cjs
```

Tests use mocked PayPal responses and do not contact PayPal or require credentials. Actual approval and capture must still be tested by you with your Sandbox buyer and seller accounts.

References: [Sandbox setup](https://github.com/paypaldev/getting-started-with-paypal-sandbox), [Checkout integration](https://developer.paypal.com/studio/checkout/standard/integrate), [Orders API](https://developer.paypal.com/api/orders/v2), [Webhook verification](https://developer.paypal.com/api/rest/webhooks/rest/).

## Hosted NVIDIA models

In `server/.env`, add `NVIDIA_API_KEY=<your key>`. Keep the key in that ignored local file. Both providers use it server-side. The connected web and Flutter organizer screens use DeepSeek for **Prepare AI split** and Chatterbox for **Read split aloud**. The demo supports equal shares for the essentials and one lamp owner. The model proposes the owner, and the organizer confirms before publication.

Install the Python speech client and start Node from the server folder:

```powershell
cd server
python -m pip install -r requirements.txt
npm start
```

If the speech client lives in a virtual environment, set `NVIDIA_PYTHON` in `server/.env` to the path of that environment's Python executable. Restart after changing settings. At http://localhost:3000, connect with the organizer key printed by the server, open the demo purchase, and ask to assign the lamp to Leah. The suggested amounts should be Maya $40, Arun $40, and Leah $70. Select **Read split aloud** to hear the amounts. This check does not require PayPal credentials or publishing the split.
