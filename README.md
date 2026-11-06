# SplitSync AI

A Flutter app and responsive website for shared purchases, now connected through a local PayPal Sandbox backend.

## Run the connected app

Start with [server/README.md](server/README.md). It explains credentials, VS Code commands, organizer access, Flutter setup, testing, and webhooks.

```sh
cd server
cp -n .env.example .env
# Open .env in VS Code and fill in your Sandbox Client ID and Client Secret.
npm start
```

Open http://localhost:3000, enter the SplitSync organizer key from the terminal, and confirm the purchase split. The server calculates Maya $70, Arun $40 and Leah $40 for the $150 bill. Each participant gets a private link. PayPal approval occurs on PayPal's Sandbox screen; completed captures update the shared ledger.

Secrets belong only in `server/.env`. Do not put PayPal credentials in Flutter, browser JavaScript or GitHub. Sandbox only: there is no live-payment switch.

## Project structure

- `server/`: Node.js 22+ backend, PayPal client, durable local ledger, and mocked payment tests. No npm dependencies.
- `website/dist/`: responsive organizer and payer interface served by the backend.
- `website/test/demo.cjs`: static visual-demo regression checks.
- `flutter_app/`: companion Flutter source; connect it to the backend using its settings icon. Generate platform folders in this directory if needed, rather than at the repository root.
- `previews/`: screenshots. The original five frames depict the earlier visual demo, whose statuses and receipt were simulated; `backend-checkout.jpg` shows the connected checkout awaiting credentials.

## Flutter

Use Flutter 3.35+ and its bundled Dart SDK. From `flutter_app`:

```sh
flutter create --platforms=android,ios,web --project-name splitsync .
flutter pub get
flutter analyze
flutter run -d chrome --web-port=5173 --dart-define=PAYER_ORIGIN=http://localhost:3000
```

Do not rerun `flutter create` if the needed platform folders already exist. Add `NSCameraUsageDescription` to iOS `Runner/Info.plist` for camera scanning, and verify Android camera/Internet permissions. Use a reachable HTTPS backend for physical phones. The settings key is the SplitSync organizer access key, not a PayPal secret or buyer password.

## Visual demo and later workflows

Serving `website/dist` with a static server still opens the original visual walkthrough. It is separate from backend checkout and cannot process payments. AI allocation remains a deterministic shared-essentials/lamp rule. Rent and shop remain later-workflow demos. Medfarm assets were not provided, so the visual treatment follows the attached SplitSync mockups.

The backend is intended for one household's Sandbox testing with one Node process and a persistent ledger. Production account management, refunds, disputes, multi-merchant onboarding, payouts and rent payments are outside this implementation. See [VALIDATION.md](VALIDATION.md) for verification limits.

## Original static demo screenshots and step-by-step guide

The following walkthrough describes the original static visual demo. Use [server/README.md](server/README.md) for connected PayPal Sandbox checkout.

These pictures show the responsive website demo. The Flutter source implements the companion mobile flow; native builds have not been validated. Images are static: use the running website to try the controls described below.

### 1. Scan or open a purchase

![Mobile purchase scanner](previews/portrait-scanner.jpg)

**What is happening:** The organizer is opening a merchant purchase before reviewing the bill. The camera frame illustrates where a merchant QR would appear.

1. From **Overview**, select **Scan QR** or **New purchase** to reach this screen.
2. Select **Enable camera** and allow browser camera access to show a live preview. Camera access requires HTTPS or localhost. This website demo does not decode QR codes from the preview.
3. For the sample walkthrough, select **Open demo purchase**. Alternatively, enter `#purchase/SS-001` in the purchase-link field and select **Open pasted link**.
4. If camera access fails, use either of those fallback options. **Permission denied state** opens the example error screen so you can inspect that experience.
5. On the purchase-details screen, review the $120 kitchen essentials and $30 lamp. Check who is sharing and read the split instruction, then select **Prepare AI split →**.

### 2. Review each person's share on mobile

![Mobile split review](previews/portrait-ai-split.jpg)

**What is happening:** The $150 purchase has been allocated among Maya, Arun, and Leah. Each person pays $40 for the shared kitchen essentials; Maya also pays $30 for the lamp, bringing her total to $70.

1. Tap a participant's name or amount row to expand or collapse their item breakdown.
2. Compare the shares with the **Original bill** shown below the allocations. The three shares should add up to $150.
3. To change who pays for the lamp, select **Edit split**, choose a person from **Who should pay for the lamp?**, then select **Back to review**. The shared essentials remain $40 per person.
4. Once the amounts are correct, select **Confirm split →** to open the payment-request screen.
5. Use **Copy link** beside each participant to copy their individual share link, or select their QR button to display a scannable share link. Copying a link does not send it automatically.

The “AI assisted demo” label describes a fixed allocation rule in this prototype; it does not call an AI service.

### 3. Compare the bill and split in a wider layout

![Landscape split review](previews/landscape-ai-split.jpg)

**What is happening:** This is the same split-review screen in a wider layout. The original bill appears on the left, and the suggested allocations appear on the right.

1. Check the original bill: $120 shared essentials plus a $30 lamp equals $150.
2. Expand the participant rows on the right to inspect each person's assigned items.
3. Read the calculation note: $120 divided by three is $40 each, with the lamp charged to its selected owner.
4. Select **Edit split** if the lamp owner needs changing, or **Confirm split →** to proceed to payment requests.

Changing the screen orientation changes the arrangement of the cards; it does not change the allocations.

### 4. Open an individual payment request

![Desktop payer view](previews/desktop-payer.jpg)

**What is happening:** Maya has opened her participant link. Her page shows $40 for shared essentials and $30 for her personal lamp, for a total of $70.

1. Open the participant link copied from the organizer's payment-request screen. For Maya, the website route ends in `#share/maya`.
2. Check the participant name, the purchase, and the **Your items** breakdown.
3. Compare the breakdown with **Total to pay** in the payment summary.
4. Select **Pay with PayPal** to open the demo handoff screen.
5. On that screen, select **Preview Processing**, **Preview Paid**, or **Preview Cancelled** to inspect a possible result, or **Return to your share** to go back.

This prototype does not sign you into PayPal, create an order, or transfer money. Participant links are demo routes, not secure authorization tokens.

### 5. Inspect a payment-result preview

![Demo payment result](previews/mobile-payment-result.jpg)

**What is happening:** The **Paid** preview is selected for Maya's $70 share. The page displays a sample completion message, participant name, status, and demo receipt reference.

1. Read the displayed amount and participant name to check whose result you are viewing.
2. Select **Processing**, **Paid**, or **Cancelled** at the top to switch between the example outcomes.
3. In the paid or processing preview, select **View your share** to return to the participant's item breakdown.
4. In the cancelled preview, select **Return to share & retry** to return to the participant page and try the demo handoff again.

These controls only switch preview screens. The receipt reference is an example, and selecting **Paid** does not confirm a real payment or update the organizer's seeded group ledger.
