# SplitSync AI redesign handoff

Project: `C:\Users\gurpr\OneDrive\Desktop\Projects\Flutter\Work - Freelance\Games\SplitSync-AI`
Design reference: `C:\Users\gurpr\OneDrive\Desktop\Projects\Flutter\Work - Freelance\medfarm`
Connected website: http://localhost:3000/#home
Flutter web preview: http://127.0.0.1:5173/

## What the current run showed

The website and Flutter preview share the same navy payment card, four equally prominent actions and separate shortcuts for Split Expense, Rent and Store. The same destinations appear in several places. The result feels like a feature dashboard. The current Store already has product search, sample inventory and a cart. Keep those parts and improve how a shopper reaches them.

On the connected website, submitting “Ask Maya for twenty dollars for dinner and Arun for fifteen for drinks” opened a separate review screen and generated the correct two recipient rows. Chatterbox produced audio, and the browser player advanced after a separate **Hear reply** click. The current flow speaks only when asked to read the review aloud. The Flutter app was rendered in preview mode. Native playback and live Flutter integration were outside that run.

## 1. Make the first screen a payment app

Read the workspace guidance and update the existing design contract. Use PhonePe as the interaction reference for quick payment actions and super.money for the relationship between payments and shopping. Keep Medfarm's visual language through the existing shared typography, colors and component treatments. Use consistent icons with labels, clear amounts, and restrained status colors.

Use a compact identity row and a short group of everyday actions at the top of Home. Put **Scan & pay** and **Request money** first. Show the latest payment or request rows immediately below. Offer a small **Ask SplitSync** entry for receipt and voice assistance. Move Split expense and Rent under household actions. Store has its own tab and can surface a small product collection below activity when appropriate.

Use Home, Activity, Store and Profile as the main tabs. The desktop rail exposes the same destinations. Remove duplicate headers, breadcrumb strips, step indicators and footer chrome. Keep a simple title and back control where a task needs them. Move organizer connection, provider labels and test setup into Profile or a compact connection screen. Keep a short Sandbox label on payment review and results.

## 2. Shorten the everyday routes

- **Pay.** Home → scan a supported merchant QR or open a supported link → review payee and amount → approve on PayPal → see the result. Put paste-link and camera fallback inside the scan screen. Give unsupported codes a specific error.
- **Request.** Home → choose a contact, enter amount and optional note on one sheet → review and create the request. Offer Share, Copy link and QR in the result. Leave the manual request usable independently of AI.
- **Activity.** Show a searchable or filterable list with the counterparty, amount, date and status. Tap a row for details, receipt or sharing. Use a single source for pending and paid status.
- **Store.** Browse categories and real-looking sample product cards with clear seller labels and prices. Product detail → shared cart → optional Split this purchase. Keep the cart visible on Store screens. External listings open the retailer. Sample inventory and checkout use the existing demo boundaries.
- **Rent and splitting.** Keep them easy to find from household actions and relevant activity. Reuse the same compact review and request controls. Show the actual settlement capability available for each request type.

The supported PayPal Sandbox merchant flow should still use the existing approval and verified capture behavior. Distinguish a request for a personal reimbursement from a purchase made through the demo merchant. Label sample and unsupported features in context, including any UI-only feature tiles.

## 3. Build a real voice conversation

**Ask SplitSync** opens one conversation surface. Provide a text field, Send, a microphone, a voice on/off control and an attachment button. A user can dictate, type, or attach a photo in the same thread. Offer a clear recording and transcription state with text editing before Send. An attachment can open a receipt camera or file picker. Return extracted merchant, total and line items inline as an editable receipt card. Put crop and retake behind the attachment preview when useful.

After **Send** or a completed voice turn, show the user's message and keep the conversation open. Run the existing parser with the bill and known contacts. Return the assistant's actual reply text together with the validated draft or a clarification state. Generate that reply from validated data when it includes amounts, recipients, or payment status. Use the same text for the visible assistant message and for Chatterbox. With voice enabled, start synthesis and play the reply automatically as soon as audio is ready. This applies to typed and spoken turns. Keep Replay, Stop, and a visible Play fallback if the browser blocks automatic playback.

Example:

> **Leah:** Ask Maya for $20 for dinner and Arun for $15 for drinks.
> **SplitSync:** Maya owes $20 for dinner and Arun owes $15 for drinks. Ready to create both requests?

Show the two editable recipient rows in the conversation beneath that reply. If a name or amount is unclear, show and speak one focused question. The next reply updates the same draft. Open a compact confirmation sheet only for creating or sending requests. Track Created separately from Sent when an actual delivery channel is available. Confirming a request creates the appropriate request records and links. PayPal separately handles any supported payment approval.

Reuse the current `parse-request`, transcription, and `read-text` routes where possible. Start with short, automatic turn-by-turn speech. Keep the reply text responsive while audio loads. If measured latency warrants it, test sentence streaming after the basic conversation works. Cancel queued speech when the user records again, presses Stop, submits another turn, or leaves the conversation. Ignore stale audio responses and avoid letting the microphone capture the assistant's own reply. Keep editing and confirmation available when speech synthesis fails.

## 4. Build order and acceptance checks

1. Restructure Home and navigation. Connect Scan & pay and manual Request money to their compact paths. Verify recent activity is visible on a phone without scrolling past a large promotional block.
2. Put receipt capture, message entry, spoken response and draft review in one assistant screen. Verify that both typed Send and a completed mic turn can trigger automatic speech. Test two successive turns, a clarification, and interruption while audio is loading or playing.
3. Bring Activity, Store, Rent and payer results into the same shell and component system. Remove duplicate routes and controls after their replacements work. Keep important distinctions between failed delivery, pending payment and verified payment.
4. Verify on web at portrait, short landscape, and desktop widths, and on a native Flutter device where available. Exercise the supported QR path, manual request, a receipt with two recipients, voice permissions and autoplay fallback, and Store → cart → optional split. Report actual audio playback and which external payment or delivery paths were verified.

References: [PhonePe Payments](https://www.phonepe.com/payments/) · [super.money products](https://www.super.money/product)

## 5. Hackathon walkthrough from a clean start

Use this section as the acceptance script for the demo. Seed a fictional contact directory and a small catalog. Start with an empty payment form, an empty assistant composer, an unopened camera, and no active rent draft. Populate amounts, notes, items, and activity only when the user creates them. Keep presenter controls out of Home, checkout, receipts, and Activity. A presenter can reset the fictional demo session before a run from a separate development entry point.

### International contacts and payment review

Use fictional contacts such as Allen (United Kingdom, GBP), Maya (United States, USD), Arun (Canada, CAD), Sofia (Germany, EUR), and Yuki (Japan, JPY). Show a flag alongside the country and currency labels. Use the same contact IDs in search, recent contacts, and AI. A flag is a display hint. Resolve currency from the saved contact preference and let the user change it where the selected flow permits.

From **Send money** or **Request money**, open a searchable contact picker. Selecting a contact opens one amount screen with currency and optional note. For a different recipient currency, show **You send**, **Allen receives**, and the conversion details on the same screen. Label the demo quote and use a stable fixture rate for each presentation run. Preserve which amount the user entered and round the converted display to the correct currency precision. Treat an India-based sender's INR display as a demo quote for the fictional transfer. The PayPal merchant checkout uses a supported settlement currency and provider-confirmed terms.

In **Ask SplitSync**, type or say “Allen, send him 20 dollars saying thanks for coffee.” Resolve Allen to the selected fictional contact, show and speak the reply, and transition to **Review payment** with Allen, USD 20.00, the GBP estimate, and “Thanks for coffee” filled from the instruction. Say **Verify the recipient and amount before you pay**. Let the user edit those details, then tap **Pay**. In Demo mode, show a brief progress animation followed by a success receipt and a matching Activity row. A tap or retry should create a single transaction. Ask a focused question if the name or currency is ambiguous.

### Requests that progress on their own

Create a request by choosing a contact and entering an amount or by confirming the assistant's draft. Show **Waiting for payment**, then advance to **Payment received from Allen** automatically using a short, variable delay in the demo session. For group requests, stagger each contact so the pending count and amount collected update one at a time. Show an in-app notification, animate the matching row, and let the user open its receipt. Persist the demo completion time so leaving the screen or refreshing preserves progress and never triggers duplicate completion. Follow reduced motion preferences.

Remove visible buttons such as **Test failed**, **Mark completed**, and **Simulate error**. The demo route should run the successful path on its own. Label the walkthrough **Demo mode** in the workspace and identify simulated amounts and receipts as demo data. Keep simulated events in their own ledger. A PayPal Sandbox checkout gets a paid status only from verified provider confirmation. A timer can only settle a fictional demo transaction.

### Receipt and rent flows

- **Scan Bill.** Open the camera on first tap and wait for capture. Offer upload or manual entry if permission is unavailable. After capture, show a thumbnail, retake option, and extraction progress. Reveal fields only when extraction returns. Let the user correct missing fields, select contacts, and create a request or split. A sample receipt is available through an explicit demo action. The default camera flow starts blank.
- **Rent.** Open an empty rent screen with **Create rent request**. Choose household contacts, enter the rent amount and currency, pick a due date, and choose equal or custom shares. Review and create the requests through the same flow used elsewhere. Activity shows pending and received shares. A future month's draft can reuse a rule only after the user chooses to save it.
- **Scan & Pay.** Wait for the user to scan a code or open a link before showing the payee or amount. Keep the demonstrable PayPal Sandbox merchant path alongside the clearly identified fictional contact transfers.

Run the showcase from a clean session: send Allen USD 20 with an automatic spoken reply and GBP estimate, confirm and watch the demo receipt appear, create a request and see it settle automatically in Activity, then photograph a bill and build a rent request from blank forms. Confirm the same transitions on web and Flutter.

References: [PayPal REST currencies](https://developer.paypal.com/api/codes/currency/) · [PayPal World availability](https://www.paypalworld.com/us/faq)
