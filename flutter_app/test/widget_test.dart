import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'package:splitsync/main.dart';
import 'package:splitsync/models/splitsync_models.dart';

MockClient mockBackend({
  bool aiUnavailable = false,
  bool ttsUnavailable = false,
  bool failEmailDelivery = true,
  void Function(String)? onVoice,
}) {
  var lamp = 'Maya';
  var published = false;
  final wavBytes = Uint8List.fromList([82, 73, 70, 70, ...List.filled(60, 0)]);

  return MockClient((request) async {
    final auth = request.headers['authorization'];
    if (auth != 'Bearer valid-organizer-key') {
      return http.Response(
        jsonEncode({'error': 'Invalid organizer key.'}),
        401,
      );
    }

    final path = request.url.path;
    if (path == '/api/organizer/state' && request.method == 'GET') {
      return http.Response(
        jsonEncode({
          'purchase': {
            'purchaseId': 'SS-001',
            'lamp': lamp,
            'published': published,
            'participants': [
              {
                'name': 'Maya',
                'amountCents': lamp == 'Maya' ? 7000 : 4000,
                'status': 'Awaiting payment',
                'shareUrl': 'http://localhost:3000/#pay/${'a' * 48}',
              },
              {
                'name': 'Arun',
                'amountCents': lamp == 'Arun' ? 7000 : 4000,
                'status': 'Awaiting payment',
                'shareUrl': 'http://localhost:3000/#pay/${'b' * 48}',
              },
              {
                'name': 'Leah',
                'amountCents': lamp == 'Leah' ? 7000 : 4000,
                'status': 'Awaiting payment',
                'shareUrl': 'http://localhost:3000/#pay/${'c' * 48}',
              },
            ],
          },
          'contacts': [
            {
              'id': 'maya',
              'name': 'Maya',
              'handle': 'maya@house.local',
              'note': 'Roommate',
            },
            {
              'id': 'arun',
              'name': 'Arun',
              'handle': 'arun@house.local',
              'note': 'Roommate',
            },
            {
              'id': 'leah',
              'name': 'Leah',
              'handle': 'leah@house.local',
              'note': 'Organizer',
            },
          ],
          'reimbursements': [],
          'providers': {
            'paypalConfigured': false,
            'aiConfigured': !aiUnavailable,
            'ttsConfigured': !ttsUnavailable,
            'emailConfigured': false,
          },
        }),
        200,
      );
    }

    if (path == '/api/organizer/suggest-split') {
      if (aiUnavailable) {
        return http.Response(jsonEncode({'error': 'DeepSeek offline.'}), 503);
      }
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      final instr = (body['instruction'] as String).toLowerCase();
      final owner = instr.contains('leah')
          ? 'Leah'
          : instr.contains('arun')
          ? 'Arun'
          : 'Maya';
      return http.Response(jsonEncode({'lamp': owner}), 200);
    }

    if (path == '/api/organizer/split') {
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      lamp = body['lamp'] as String;
      published = true;
      return http.Response(jsonEncode({'lamp': lamp, 'published': true}), 200);
    }

    if (path == '/api/organizer/extract-bill') {
      if (aiUnavailable) {
        return http.Response(
          jsonEncode({'error': 'Vision AI unavailable.'}),
          502,
        );
      }
      return http.Response(
        jsonEncode({
          'merchant': 'Olive Kitchen',
          'date': '2026-11-10',
          'currency': 'USD',
          'items': [
            {'name': 'Pasta Dinner Bowl', 'amountCents': 2000},
            {'name': 'Craft Drinks (2)', 'amountCents': 1500},
            {'name': 'Shared Herb Flatbread', 'amountCents': 700},
          ],
          'taxCents': 0,
          'tipCents': 0,
          'totalCents': 4200,
          'unreadableFields': [],
          'totalMismatch': false,
          'modelUsed': 'nvidia/nemotron-3.5-super-vl-120b-a12b',
        }),
        200,
      );
    }

    if (path == '/api/organizer/parse-request') {
      if (aiUnavailable) {
        return http.Response(jsonEncode({'error': 'Parser unavailable.'}), 503);
      }
      return http.Response(
        jsonEncode({
          'recipients': [
            {
              'name': 'Maya',
              'contactId': 'maya',
              'known': true,
              'ambiguous': false,
              'amountCents': 2000,
              'currency': 'USD',
              'reason': 'dinner',
            },
            {
              'name': 'Arun',
              'contactId': 'arun',
              'known': true,
              'ambiguous': false,
              'amountCents': 1500,
              'currency': 'USD',
              'reason': 'drinks',
            },
          ],
          'allocatedCents': 3500,
          'billTotalCents': 4200,
          'unallocatedCents': 700,
          'needsClarification': false,
          'clarificationPrompt': '',
          'modelUsed': 'nvidia/nemotron-3.5-lightning-30b-a3b',
        }),
        200,
      );
    }

    if (path == '/api/organizer/read-split' ||
        path == '/api/organizer/read-text') {
      if (ttsUnavailable) {
        return http.Response(
          jsonEncode({'error': 'Chatterbox unavailable.'}),
          502,
        );
      }
      if (path.endsWith('read-text')) {
        onVoice?.call((jsonDecode(request.body) as Map)['text'] as String);
      }
      return http.Response(jsonEncode({'audio': base64Encode(wavBytes)}), 200);
    }

    if (path == '/api/organizer/requests' && request.method == 'POST') {
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      final ch = body['channel']?.toString() ?? 'link';
      final failed = ch != 'link' && failEmailDelivery;
      final recs = (body['recipients'] as List).asMap().entries.map((e) {
        final r = e.value as Map<String, dynamic>;
        return {
          'id': 'REC-${e.key + 1}',
          'name': r['name'],
          'amountCents': r['amountCents'],
          'currency': r['currency'] ?? 'USD',
          'reason': r['reason'] ?? 'Shared expense',
          'status': 'Created',
          'deliveryStatus': failed ? 'Failed' : 'Created',
          'deliveryMessage': failed
              ? 'Email delivery not configured. Copy link or Show QR.'
              : 'Ready to share manually.',
          'shareToken': '${e.key + 1}' * 48,
          'shareUrl': 'http://localhost:3000/#req/${'${e.key + 1}' * 48}',
        };
      }).toList();
      return http.Response(
        jsonEncode({
          'request': {
            'id': 'REQ-1001',
            'title': body['title'] ?? 'Olive Kitchen',
            'merchant': body['merchant'] ?? 'Olive Kitchen',
            'billDate': body['billDate'] ?? '2026-11-10',
            'currency': 'USD',
            'items': body['items'] ?? [],
            'taxCents': 0,
            'tipCents': 0,
            'totalCents': body['totalCents'] ?? 4200,
            'recipients': recs,
          },
          'deliveryOutcomes': [
            {'ok': !failed},
          ],
        }),
        200,
      );
    }

    return http.Response(jsonEncode({'ok': true}), 200);
  });
}

void main() {
  test('receipt splits leave the remainder with the organizer', () {
    final bill = ExtractedBillDraft.blank()
      ..currency = 'JPY'
      ..totalCents = 100000;
    final rows = equalReceiptDraft(
      'Split this receipt equally between Maya, Arun and me.',
      bill,
      kDefaultContacts,
    )!;
    expect(rows.map((row) => row.amountCents), [33300, 33300, 33400]);
    expect(rows.last.contactId, 'leah');
  });

  test('the amount currency comes from beside the amount', () {
    final usd = parseStaticTranscript(
      r'Send $20 to Yuki in JPY.',
      kDefaultContacts,
    ).single;
    final jpy = parseStaticTranscript(
      'Send ¥1,200 to Maya.',
      kDefaultContacts,
    ).single;
    expect(usd.currency, 'USD');
    expect(usd.amountCents, 2000);
    expect(jpy.currency, 'JPY');
    expect(jpy.amountCents, 120000);
  });

  Future<void> connect(WidgetTester tester) async {
    await tester.tap(find.byKey(const Key('profile-avatar-btn')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Organizer key'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'valid-organizer-key');
    await tester.tap(find.text('Sign in as organizer'));
    await tester.pumpAndSettle();
  }

  testWidgets('Microphone failure leaves typing and aligned Send available', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 844);
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      SplitSync(
        httpClient: mockBackend(),
        enableLiveCamera: false,
        initialUnlocked: true,
        onDictateSpeech: () async => throw StateError('Microphone denied'),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('fab-ask-ai')));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Microphone'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Microphone unavailable'), findsOneWidget);
    final input = find.byType(TextField);
    final send = find.byTooltip('Send');
    expect(tester.getCenter(input).dy, closeTo(tester.getCenter(send).dy, 2));
    await tester.enterText(input, 'Ask Maya for 20 dollars.');
    await tester.pumpAndSettle();
    await tester.tap(send);
    await tester.pumpAndSettle();
    expect(find.text('Ask Maya for 20 dollars.'), findsOneWidget);
    expect(find.textContaining('Maya owes'), findsOneWidget);
  });

  testWidgets('Clean Home and manual international request need no AI', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 844);
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      SplitSync(
        httpClient: mockBackend(aiUnavailable: true),
        enableLiveCamera: false,
        initialUnlocked: true,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Hello, Leah'), findsOneWidget);
    expect(find.text('SplitSync AI'), findsNothing);
    expect(find.text('PayPal Wallet'), findsAtLeastNWidgets(1));
    expect(find.text('Quick contacts'), findsOneWidget);
    expect(find.textContaining('No activity yet'), findsOneWidget);
    expect(find.text('Scan & Pay'), findsOneWidget);
    await tester.tap(find.text('Request Money'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'allen');
    await tester.tap(find.text('Allen'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, '20');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Review request'));
    await tester.pumpAndSettle();
    expect(find.text('£20.00 GBP'), findsOneWidget);
    await tester.tap(find.text('Create demo requests'));
    await tester.pumpAndSettle();
    expect(find.text('Waiting for payment'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'Typed and edited microphone turns auto-play a validated reply in the same conversation',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1280, 860);
      addTearDown(tester.view.reset);
      final played = <Uint8List>[];
      final voiced = <String>[];
      await tester.pumpWidget(
        SplitSync(
          httpClient: mockBackend(onVoice: voiced.add),
          enableLiveCamera: false,
          initialUnlocked: true,
          onPlayAudio: (bytes) async => played.add(bytes),
          onDictateSpeech: () async =>
              'Ask Maya for twenty dollars for dinner and Arun for fifteen for drinks.',
        ),
      );
      await connect(tester);
      await tester.tap(find.byKey(const Key('fab-ask-ai')));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextField).last,
        'Ask Maya for 20 and Arun for 15.',
      );
      await tester.pump();
      await tester.tap(find.byTooltip('Send'));
      await tester.pumpAndSettle();
      expect(played, hasLength(1));
      expect(voiced.single, contains('Maya owes \$20.00 USD'));
      expect(find.text(voiced.single), findsOneWidget);
      expect(find.text('Review requests'), findsOneWidget);

      await tester.ensureVisible(find.byTooltip('Microphone'));
      await tester.tap(find.byTooltip('Microphone'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Ask Maya for twenty dollars'),
        findsOneWidget,
      );
      await tester.pump();
      await tester.tap(find.byTooltip('Send'));
      await tester.pumpAndSettle();
      expect(played, hasLength(2));
      expect(find.text('Buy store items, send money, or split'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Allen voice instruction shows the USD amount, GBP quote, editable review, and one demo receipt',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(667, 375);
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        SplitSync(
          httpClient: mockBackend(),
          enableLiveCamera: false,
          initialUnlocked: true,
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(NavigationRail), findsOneWidget);
      await tester.ensureVisible(find.byKey(const Key('fab-ask-ai')));
      await tester.tap(find.byKey(const Key('fab-ask-ai')));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextField).last,
        'Send Allen \$20 and say thanks for coffee.',
      );
      await tester.ensureVisible(find.byTooltip('Send'));
      await tester.pump();
      await tester.tap(find.byTooltip('Send'));
      await tester.pumpAndSettle();
      expect(find.text('Review payment'), findsOneWidget);
      expect(find.text('£14.90 GBP'), findsOneWidget);
      final payBtn = find.text('Pay');
      await tester.ensureVisible(payBtn);
      await tester.tap(payBtn);
      await tester.pumpAndSettle();
      expect(find.text('Payment receipt'), findsOneWidget);
      expect(find.text('Sent \$20.00 USD'), findsOneWidget);
      expect(find.textContaining('Allen'), findsAtLeastNWidgets(1));
      expect(tester.takeException(), isNull);
    },
  );

  for (final connected in [false, true]) {
    testWidgets(
      'Ask appends and pays four recipients with connected backend = $connected',
      (tester) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = const Size(390, 844);
        addTearDown(tester.view.reset);
        final base = mockBackend(ttsUnavailable: true);
        var parseCalls = 0;
        final client = MockClient((request) async {
          if (request.url.path.endsWith('/parse-request')) {
            final body = jsonDecode(request.body) as Map<String, dynamic>;
            expect(
              (body['currentDraft'] as List).length,
              [0, 2, 4][parseCalls++],
            );
            final rows = parseStaticTranscript(
              body['transcript'] as String,
              kDefaultContacts,
            );
            return http.Response(
              jsonEncode({
                'intent': 'request',
                'recipients': rows
                    .map(
                      (r) => {
                        'name': r.name,
                        'contactId': r.contactId,
                        'known': r.known,
                        'amountCents': r.amountCents,
                        'currency': r.currency,
                        'reason': r.reason,
                      },
                    )
                    .toList(),
              }),
              200,
            );
          }
          if (request.url.path.endsWith('/demo-pay')) {
            final body = jsonDecode(request.body) as Map<String, dynamic>;
            expect(body['payments'], hasLength(4));
            return http.Response(
              jsonEncode({
                'transactions': [
                  for (final row in body['payments'] as List)
                    {
                      ...row as Map,
                      'id': row['clientTxId'],
                      'recipientName': kDefaultContacts
                          .firstWhere((c) => c.id == row['contactId'])
                          .name,
                      'flag': '',
                      'createdAt': DateTime.now().toIso8601String(),
                    },
                ],
              }),
              200,
            );
          }
          final response = request.method == 'GET'
              ? await base.get(request.url, headers: request.headers)
              : await base.post(
                  request.url,
                  headers: request.headers,
                  body: request.bodyBytes,
                );
          if (request.url.path.endsWith('/state')) {
            final json = jsonDecode(response.body) as Map<String, dynamic>;
            json['contacts'] = kDefaultContacts
                .map(
                  (c) => {
                    'id': c.id,
                    'name': c.name,
                    'currency': c.currency,
                    'flag': c.flag,
                    'country': c.country,
                  },
                )
                .toList();
            return http.Response(
              jsonEncode(json),
              200,
              headers: {'content-type': 'application/json; charset=utf-8'},
            );
          }
          return response;
        });
        await tester.pumpWidget(
          SplitSync(
            httpClient: client,
            enableLiveCamera: false,
            initialUnlocked: true,
          ),
        );
        await tester.pumpAndSettle();
        if (connected) {
          await connect(tester);
        }
        await tester.tap(find.byKey(const Key('fab-ask-ai')));
        await tester.pumpAndSettle();

        Future<void> ask(String message) async {
          await tester.enterText(find.byType(TextField).last, message);
          await tester.pump();
          await tester.tap(find.byTooltip('Send'));
          await tester.pumpAndSettle();
        }

        await ask(r'Give Maya $20 and Arun $15.');
        expect(find.text('Review 2 payments'), findsOneWidget);
        await ask(r'And Allen $12 and Sofia $18.');
        expect(find.text('Review 4 payments'), findsOneWidget);
        await ask(r'Make Maya $24.');
        expect(find.text('Review 4 payments'), findsOneWidget);
        expect(find.text('Maya'), findsOneWidget);
        expect(find.text('\$24.00 USD'), findsOneWidget);
        expect(find.text('\$20.00 USD'), findsNothing);

        await tester.tap(find.text('Review 4 payments'));
        await tester.pumpAndSettle();
        await tester.tap(find.byTooltip('Back'));
        await tester.pumpAndSettle();
        expect(find.text('Review 4 payments'), findsOneWidget);
        await tester.ensureVisible(find.text('Review 4 payments'));
        await tester.tap(find.text('Review 4 payments'));
        await tester.pumpAndSettle();
        expect(find.text('\$69.00 USD'), findsOneWidget);
        await tester.ensureVisible(find.text('Confirm demo payments'));
        await tester.tap(find.text('Confirm demo payments'));
        await tester.pumpAndSettle();
        expect(find.text('4 demo payments completed'), findsOneWidget);
        for (final name in ['Maya', 'Arun', 'Allen', 'Sofia']) {
          expect(find.textContaining(name), findsOneWidget);
        }
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets(
    'Receipt review keeps editing and split actions separate on a small screen',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 568);
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        SplitSync(
          httpClient: mockBackend(),
          enableLiveCamera: false,
          initialUnlocked: true,
        ),
      );
      await tester.pumpAndSettle();

      final scan = find.text('Scan a Bill');
      await tester.ensureVisible(scan);
      await tester.tap(scan);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Use sample receipt'));
      await tester.tap(find.text('Use sample receipt'));
      await tester.pumpAndSettle();
      final extract = find.text('Extract bill details');
      await tester.ensureVisible(extract);
      await tester.tap(extract);
      await tester.pumpAndSettle();

      expect(find.text('Review receipt'), findsOneWidget);
      expect(find.text('\$42.00 USD'), findsOneWidget);
      final split = find.text('Split in Ask AI');
      expect(split.hitTestable(), findsOneWidget);
      expect(find.text('Pasta Dinner Bowl'), findsNothing);
      final currency = find.byType(DropdownButtonFormField<String>);
      await tester.ensureVisible(currency);
      await tester.tap(currency);
      await tester.pumpAndSettle();
      await tester.tap(find.text('CAD').last);
      await tester.pumpAndSettle();
      expect(find.text('CA\$42.00 CAD'), findsOneWidget);
      final items = find.text('Line items (3)');
      await tester.ensureVisible(items);
      await tester.tap(items);
      await tester.pumpAndSettle();
      expect(find.text('Pasta Dinner Bowl'), findsOneWidget);
      expect(split.hitTestable(), findsOneWidget);

      await tester.tap(split);
      await tester.pumpAndSettle();
      expect(find.text('Ask AI'), findsWidgets);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Store has 11 products, Developer Tools Sponsored toggle, Qty stepper, Checkout review & Back navigation',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(390, 844);
      addTearDown(tester.view.reset);
      expect(kStoreCatalog.length, 11);

      await tester.pumpWidget(
        SplitSync(
          httpClient: mockBackend(),
          enableLiveCamera: false,
          initialUnlocked: true,
        ),
      );
      await tester.pumpAndSettle();

      // Switch to Store tab via bottom navigation bar
      await tester.tap(find.byIcon(Icons.shopping_bag_outlined));
      await tester.pumpAndSettle();
      expect(find.text('Sponsored · Paid placement disclosure'), findsNothing);

      // System Back on non-Home root tab switches cleanly back to Home instead of exiting
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('Scan & Pay'), findsOneWidget);

      // Toggle Sponsored visibility in Profile -> Developer Tools
      await tester.tap(find.byKey(const Key('profile-avatar-btn')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Developer Tools'));
      await tester.tap(find.text('Developer Tools'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Show sponsored card in Store'));
      await tester.pumpAndSettle();
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();

      await tester.tap(find.byIcon(Icons.shopping_bag_outlined));
      await tester.pumpAndSettle();
      expect(find.text('Sponsored · Paid placement disclosure'), findsOneWidget);

      // Product Detail Qty stepper -> Add to Cart -> Checkout Review -> Back stack
      // With Sponsored disclosure enabled above, index 0 is the Sponsored item
      // and index 1 is the PayPal-eligible Move-In Kitchen Essentials Bundle.
      await tester.ensureVisible(find.text('View').at(1));
      await tester.tap(find.text('View').at(1));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byTooltip('Increase quantity'));
      await tester.tap(find.byTooltip('Increase quantity'));
      await tester.pumpAndSettle();
      expect(find.text('\$240.00 USD'), findsWidgets);
      await tester.ensureVisible(find.text('Add to Cart'));
      await tester.tap(find.text('Add to Cart'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Checkout review'));
      await tester.tap(find.text('Checkout review'));
      await tester.pumpAndSettle();
      expect(find.text('Complete purchase'), findsOneWidget);

      // Pop back to Cart -> Split this purchase -> Ask SplitSync
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Split this purchase'));
      await tester.tap(find.text('Split this purchase'));
      await tester.pumpAndSettle();
      expect(find.text('Buy store items, send money, or split'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Bidirectional FX in JPY, Editable Review, and Blank Electricity flow',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(390, 844);
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        SplitSync(
          httpClient: mockBackend(),
          enableLiveCamera: false,
          initialUnlocked: true,
        ),
      );
      await tester.pumpAndSettle();

      // Open Yuki directly from Home contacts strip & enter receive-side JPY
      await tester.ensureVisible(find.text('Yuki'));
      await tester.tap(find.text('Yuki'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Yuki receives (JPY)'));
      await tester.tap(find.text('Yuki receives (JPY)'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, '3000');
      await tester.pumpAndSettle();
      expect(find.text('¥3,000 JPY'), findsOneWidget);
      await tester.ensureVisible(find.text('Review payment'));
      await tester.tap(find.text('Review payment'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byType(TextField).last);
      await tester.enterText(find.byType(TextField).last, 'Tokyo coffee');
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Pay'));
      await tester.tap(find.text('Pay'));
      await tester.pumpAndSettle();
      expect(find.text('Payment receipt'), findsOneWidget);
      expect(find.text('¥3,000 JPY'), findsOneWidget);
      expect(find.text('Recipient amount (JPY)'), findsOneWidget);
      expect(find.text('Tokyo coffee'), findsOneWidget);
      await tester.ensureVisible(find.text('Done'));
      await tester.tap(find.text('Done'));
      await tester.pumpAndSettle();

      // Blank Electricity bill -> open form
      await tester.ensureVisible(find.text('Electricity'));
      await tester.tap(find.text('Electricity'));
      await tester.pumpAndSettle();
      expect(find.text('No active electricity bill'), findsOneWidget);
      await tester.ensureVisible(find.text('Create electricity request'));
      await tester.tap(find.text('Create electricity request'));
      await tester.pumpAndSettle();
      expect(find.text('Review electricity requests'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Electricity creation, staggered settlement notification without duplicates, and responsive layouts',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      const notifChannel = MethodChannel('splitsync/notifications');
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        notifChannel,
        (call) async => false,
      );
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          notifChannel,
          null,
        ),
      );

      final realNow = DateTime.now();
      var fakeNow = DateTime(
        realNow.year,
        realNow.month,
        realNow.day,
        12,
        0,
        0,
        0,
      );

      await tester.pumpWidget(
        SplitSync(
          httpClient: mockBackend(),
          enableLiveCamera: false,
          initialUnlocked: true,
          nowProvider: () => fakeNow,
        ),
      );
      await tester.pumpAndSettle();

      // Blank Electricity bill -> enter City Power, due date, $90.00 USD, select Maya & Arun
      await tester.ensureVisible(find.text('Electricity'));
      await tester.tap(find.text('Electricity'));
      await tester.pumpAndSettle();
      expect(find.text('No active electricity bill'), findsOneWidget);
      await tester.ensureVisible(find.text('Create electricity request'));
      await tester.tap(find.text('Create electricity request'));
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.byType(TextField).at(0));
      await tester.enterText(find.byType(TextField).at(0), 'City Power');
      await tester.enterText(find.byType(TextField).at(1), '90');
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.text('Choose due date'));
      await tester.tap(find.text('Choose due date'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.text('Maya · USD'));
      await tester.tap(find.text('Maya · USD'));
      await tester.ensureVisible(find.text('Arun · CAD'));
      await tester.tap(find.text('Arun · CAD'));
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.text('Review electricity requests'));
      await tester.tap(find.text('Review electricity requests'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Create demo requests'));
      await tester.pumpAndSettle();

      expect(find.textContaining('City Power due'), findsWidgets);
      expect(find.text('Waiting for payment'), findsWidgets);

      // Advance past first staggered threshold (+3000ms) -> Maya settles, Arun stays pending.
      fakeNow = fakeNow.add(const Duration(seconds: 4));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();
      expect(find.text('Payment received'), findsOneWidget);
      expect(find.textContaining('Payment received from Maya'), findsOneWidget);

      // Dismiss/let banner timer expire (4s), navigate away and return -> no duplicate alert for Maya.
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();
      expect(find.textContaining('Payment received from Maya'), findsNothing);

      await tester.tap(find.byIcon(Icons.arrow_back_rounded).first);
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
      expect(find.textContaining('Payment received from Maya'), findsNothing);

      // Advance past second staggered threshold (+5600ms) -> Arun settles once.
      fakeNow = fakeNow.add(const Duration(seconds: 3));
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
      expect(find.textContaining('Payment received from Arun'), findsOneWidget);

      // Let second notification auto-dismiss; verify no replay after subsequent ticks.
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();
      expect(find.textContaining('Payment received from Arun'), findsNothing);
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
      expect(find.textContaining('Payment received from Arun'), findsNothing);
      expect(find.textContaining('Payment received from Maya'), findsNothing);

      // Verify responsive viewports: 320x568 portrait, 667x375 short landscape, 1280x860 desktop
      tester.view.physicalSize = const Size(320, 568);
      await tester.pumpAndSettle();
      expect(find.byType(NavigationBar), findsOneWidget);
      await tester.tap(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.byIcon(Icons.shopping_bag_outlined),
        ),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('View').first);
      await tester.tap(find.text('View').first);
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.arrow_back_rounded).first);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      tester.view.physicalSize = const Size(667, 375);
      await tester.pumpAndSettle();
      expect(find.byType(NavigationRail), findsOneWidget);
      await tester.tap(
        find.descendant(
          of: find.byType(NavigationRail),
          matching: find.byIcon(Icons.history_rounded),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(
        find.descendant(
          of: find.byType(NavigationRail),
          matching: find.byIcon(Icons.support_agent_outlined),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      tester.view.physicalSize = const Size(1280, 860);
      await tester.pumpAndSettle();
      expect(find.byType(NavigationRail), findsOneWidget);
      await tester.tap(
        find.descendant(
          of: find.byType(NavigationRail),
          matching: find.byIcon(Icons.home_outlined),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Home Ask AI store buy, direct Store Checkout + Split cash receipt, Profile Receive QR scan, Medfarm dark mode, and .env auto-link',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(412, 892);
      addTearDown(tester.view.reset);

      final autoLinkClient = MockClient((request) async {
        final path = request.url.path;
        if (path == '/api/health') {
          return http.Response(
            jsonEncode({
              'mode': 'sandbox',
              'configured': true,
              'aiConfigured': true,
              'localOrganizerAutoLogin': true,
            }),
            200,
          );
        }
        if (path == '/api/organizer/state' && request.method == 'GET') {
          return http.Response(
            jsonEncode({
              'purchase': {
                'purchaseId': 'SS-001',
                'lamp': 'Maya',
                'published': false,
                'participants': [],
              },
              'contacts': [
                {'id': 'maya', 'name': 'Maya', 'country': 'United States', 'currency': 'USD'},
                {'id': 'arun', 'name': 'Arun', 'country': 'Canada', 'currency': 'CAD'},
                {'id': 'leah', 'name': 'Leah', 'country': 'United States', 'currency': 'USD'},
              ],
              'reimbursements': [],
              'demoTransactions': [],
              'providers': {'paypalConfigured': true, 'aiConfigured': true},
            }),
            200,
          );
        }
        if (path == '/api/organizer/demo-pay' && request.method == 'POST') {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          return http.Response(
            jsonEncode({
              'transaction': {
                'id': 'DTX-STORE01',
                'clientTxId': body['clientTxId'],
                'type': body['type'] ?? 'store-demo',
                'direction': 'outgoing',
                'recipientName': body['recipientName'] ?? 'SplitSync Store (Demo)',
                'sourceAmountCents': body['sourceAmountCents'],
                'sourceCurrency': body['sourceCurrency'] ?? 'USD',
                'targetAmountCents': body['sourceAmountCents'],
                'targetCurrency': body['targetCurrency'] ?? 'USD',
                'note': body['note'] ?? '',
                'status': 'Completed',
                'demo': true,
                'createdAt': '2026-11-11T12:00:00.000Z',
              },
            }),
            200,
          );
        }
        return http.Response('{}', 200);
      });

      await tester.pumpWidget(
        SplitSync(
          httpClient: autoLinkClient,
          enableLiveCamera: false,
          initialUnlocked: true,
        ),
      );
      await tester.pumpAndSettle();

      // Auto-connected via .env localOrganizerAutoLogin without prompting
      expect(find.byKey(const Key('fab-ask-ai')), findsOneWidget);
      expect(find.text('Demo mode · Sandbox ready'), findsNothing);
      expect(find.text('Quick contacts'), findsOneWidget);
      expect(
        find.descendant(
          of: find.byKey(const Key('home-receive-qr-card')),
          matching: find.text('leah@paypal'),
        ),
        findsOneWidget,
      );
      expect(
        tester
            .getSize(
              find.descendant(
                of: find.byKey(const Key('home-receive-qr-card')),
                matching: find.byType(QrImageView),
              ),
            )
            .width,
        greaterThanOrEqualTo(200),
      );
      expect(find.text('Demo catalog'), findsNothing);
      final store0 = find.byKey(const Key('home-store-card-0'));
      final store1 = find.byKey(const Key('home-store-card-1'));
      final store2 = find.byKey(const Key('home-store-card-2'));
      final store3 = find.byKey(const Key('home-store-card-3'));
      await tester.ensureVisible(store0);
      await tester.pumpAndSettle();
      final r0 = tester.getRect(store0);
      final r1 = tester.getRect(store1);
      final r2 = tester.getRect(store2);
      final r3 = tester.getRect(store3);
      expect(r0.height, greaterThan(r1.height));
      expect(r2.top, greaterThan(r1.top));
      expect(r2.top, closeTo(r3.top, 2));
      await tester.tap(store0);
      await tester.pumpAndSettle();
      expect(find.text('Move-In Kitchen Essentials Bundle'), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();

      // Shuffle 3D credit cards & recharge PayPal Wallet (+$50 -> $295.00 USD)
      expect(find.textContaining('PayPal Balance Card'), findsWidgets);
      await tester.ensureVisible(find.byKey(const Key('shuffle-card-btn')));
      await tester.tap(find.byKey(const Key('shuffle-card-btn')));
      await tester.pumpAndSettle();
      expect(find.textContaining('PayPal Cashback'), findsWidgets);

      await tester.ensureVisible(find.byKey(const Key('recharge-wallet-btn')));
      await tester.tap(find.byKey(const Key('recharge-wallet-btn')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Add from Linked Card'));
      await tester.pumpAndSettle();
      expect(find.text('\$295.00 USD'), findsWidgets);

      // Tap Home Ask AI FAB -> Buy 2 desk lamps ($60.00) -> Buy now -> Pay from Wallet -> Receipt Split cash
      await tester.tap(find.byKey(const Key('fab-ask-ai')));
      await tester.pumpAndSettle();
      expect(find.text('Ask AI to buy, send, or split.'), findsOneWidget);
      await tester.enterText(find.byType(TextField).last, 'Buy 2 desk lamps');
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Send'));
      await tester.pumpAndSettle();
      expect(find.text('2 × Matte LED Task Desk Lamp'), findsOneWidget);
      expect(find.textContaining('\$60.00 USD'), findsWidgets);

      await tester.ensureVisible(find.text('Buy now'));
      await tester.tap(find.text('Buy now'));
      await tester.pumpAndSettle();
      expect(find.text('Checkout review'), findsOneWidget);
      expect(find.text('PayPal Wallet'), findsWidgets);
      expect(find.text('Complete purchase'), findsOneWidget);

      await tester.ensureVisible(find.text('Complete purchase'));
      await tester.tap(find.text('Complete purchase'));
      await tester.pumpAndSettle();
      expect(find.text('Purchased \$60.00 USD'), findsOneWidget);
      expect(find.text('Split cash'), findsOneWidget);

      // Tapping Split cash splits the $60.00 purchase into equal Maya/Arun shares ($20 each)
      await tester.ensureVisible(find.text('Split cash'));
      await tester.tap(find.text('Split cash'));
      await tester.pumpAndSettle();
      expect(find.text('Ask AI'), findsOneWidget);
      expect(find.text('Request draft'), findsOneWidget);

      // Return to Home root tabs -> Activity Payment Cycle graph -> Contact PayPal AI -> Profile via CircleAvatar
      while (find.byType(NavigationBar).evaluate().isEmpty) {
        await tester.binding.handlePopRoute();
        await tester.pumpAndSettle();
      }
      await tester.tap(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.byIcon(Icons.history_rounded),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('payment-cycle-card')), findsOneWidget);
      expect(find.text('Payment cycle'), findsOneWidget);

      await tester.tap(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.byIcon(Icons.support_agent_outlined),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Contact PayPal'), findsOneWidget);
      await tester.tap(find.text('How do I recharge wallet?'));
      await tester.pumpAndSettle();
      expect(find.text('PayPal AI'), findsOneWidget);

      await tester.tap(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.byIcon(Icons.home_outlined),
        ),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('profile-avatar-btn')));
      await tester.tap(find.byKey(const Key('profile-avatar-btn')));
      await tester.pumpAndSettle();
      expect(find.text('Connected Sandbox'), findsOneWidget);
      expect(find.text('Receive Money QR'), findsOneWidget);
      expect(find.text('leah@paypal'), findsOneWidget);
      expect(find.text('Help & FAQs'), findsOneWidget);
      expect(find.text('Copy link'), findsNothing);
      expect(find.text('Test in Scan & Pay'), findsNothing);

      await tester.tap(find.text('Dark'));
      await tester.pumpAndSettle();
      final ctx = tester.element(find.text('Receive Money QR'));
      expect(Theme.of(ctx).scaffoldBackgroundColor, const Color(0xFF090E1D));
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Medfarm Welcome Leah login with close PIN (1234) boxes, PayPal icon, no fingerprint button, and Phone Authenticator unlock',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(390, 844);
      addTearDown(tester.view.reset);

      var phoneAuthCalls = 0;
      await tester.pumpWidget(
        SplitSync(
          httpClient: mockBackend(),
          enableLiveCamera: false,
          initialThemeMode: ThemeMode.dark,
          autoPromptPhoneAuth: false,
          authenticateOverride: () async {
            phoneAuthCalls++;
            return true;
          },
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('medfarm-login-screen')), findsOneWidget);
      expect(find.text('Welcome, Leah'), findsOneWidget);
      expect(find.byKey(const Key('login-paypal-icon')), findsOneWidget);
      expect(find.byKey(const Key('pin-key-biometric')), findsNothing);
      expect(find.text('Unlock with Biometrics'), findsNothing);

      // Verify 4 PIN boxes are closely spaced together
      final box0Left = tester.getTopLeft(find.byKey(const Key('pin-box-0'))).dx;
      final box3Right = tester.getTopRight(find.byKey(const Key('pin-box-3'))).dx;
      expect(box3Right - box0Left, lessThan(260));

      // Invalid PIN rejects and shows error callout
      for (final d in const ['9', '9', '9', '9']) {
        await tester.ensureVisible(find.byKey(Key('pin-key-$d')));
        await tester.tap(find.byKey(Key('pin-key-$d')));
        await tester.pump();
      }
      await tester.pumpAndSettle();
      expect(find.textContaining('Incorrect PIN'), findsOneWidget);
      expect(find.byKey(const Key('medfarm-login-screen')), findsOneWidget);

      // Valid PIN 1234 unlocks into Home
      for (final d in const ['1', '2', '3', '4']) {
        await tester.ensureVisible(find.byKey(Key('pin-key-$d')));
        await tester.tap(find.byKey(Key('pin-key-$d')));
        await tester.pump();
      }
      await tester.pumpAndSettle();
      expect(find.text('Hello, Leah'), findsOneWidget);

      // Lock from Profile -> unlock via Phone Authenticator
      await tester.tap(find.byKey(const Key('profile-avatar-btn')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('lock-app-btn')));
      await tester.tap(find.byKey(const Key('lock-app-btn')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('medfarm-login-screen')), findsOneWidget);

      await tester.ensureVisible(find.byKey(const Key('phone-auth-btn')));
      await tester.tap(find.byKey(const Key('phone-auth-btn')));
      await tester.pumpAndSettle();
      expect(phoneAuthCalls, 1);
      expect(find.text('Hello, Leah'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Mobile dark-mode layouts align Scan Bill row, Review Receipt contrast/baseline, Profile controls, and Send Money FX tabs',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(360, 780);
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        SplitSync(
          httpClient: mockBackend(),
          enableLiveCamera: false,
          initialThemeMode: ThemeMode.dark,
          initialUnlocked: true,
        ),
      );
      await tester.pumpAndSettle();

      // 1. Scan bill: Upload photo and Enter manually sit side-by-side in one Row
      await tester.ensureVisible(find.text('Scan a Bill'));
      await tester.tap(find.text('Scan a Bill'));
      await tester.pumpAndSettle();
      expect(
        tester.getTopLeft(find.text('Upload photo')).dy,
        closeTo(tester.getTopLeft(find.text('Enter manually')).dy, 2),
      );

      // 2. Review receipt dark mode: dark tint containers & level Total/Currency row
      await tester.ensureVisible(find.text('Use sample receipt'));
      await tester.tap(find.text('Use sample receipt'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Extract bill details'));
      await tester.tap(find.text('Extract bill details'));
      await tester.pumpAndSettle();

      final totalCard = tester.widget<Material>(
        find.ancestor(
          of: find.text('Receipt total'),
          matching: find.byType(Material),
        ).first,
      );
      expect(totalCard.color, const Color(0xFF1B2746));

      final itemsTile = tester.widget<ExpansionTile>(find.byType(ExpansionTile));
      expect(itemsTile.collapsedBackgroundColor, const Color(0xFF1B2746));
      expect(
        tester.getTopLeft(find.text('Total')).dy,
        closeTo(tester.getTopLeft(find.text('Currency')).dy, 1),
      );

      // 3. Return to Home -> Send Money recipient cards omit countries -> Allen receives (GBP) stays compact & single-line
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Send Money'));
      await tester.tap(find.text('Send Money'));
      await tester.pumpAndSettle();
      expect(find.text('GBP'), findsOneWidget);
      expect(find.textContaining('United Kingdom'), findsNothing);
      expect(find.textContaining('United States'), findsNothing);
      await tester.ensureVisible(find.text('Allen'));
      await tester.tap(find.text('Allen'));
      await tester.pumpAndSettle();
      expect(find.textContaining('United Kingdom'), findsNothing);
      final segBefore = tester.getSize(find.byType(SegmentedButton<String>)).height;
      await tester.tap(find.text('Allen receives (GBP)'));
      await tester.pumpAndSettle();
      final segAfter = tester.getSize(find.byType(SegmentedButton<String>)).height;
      expect(segAfter, closeTo(segBefore, 2));
      expect(segAfter, lessThan(56));

      // Verify Review payment uses plain "Pay" aligned identically with "Back"
      await tester.enterText(find.byType(TextField).first, '14.90');
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Review payment'));
      await tester.tap(find.text('Review payment'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Pay'));
      expect(find.text('Pay'), findsOneWidget);
      expect(find.textContaining(r'Pay $'), findsNothing);
      final backRect = tester.getRect(
        find.ancestor(
          of: find.text('Back'),
          matching: find.bySubtype<ButtonStyleButton>(),
        ),
      );
      final payRect = tester.getRect(
        find.ancestor(
          of: find.text('Pay'),
          matching: find.bySubtype<ButtonStyleButton>(),
        ),
      );
      expect(payRect.height, closeTo(backRect.height, 1));
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();

      // 4. Profile & Settings -> compact Appearance SegmentedButton & no overflow
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('profile-avatar-btn')));
      await tester.tap(find.byKey(const Key('profile-avatar-btn')));
      await tester.pumpAndSettle();
      expect(
        tester.getSize(find.byType(SegmentedButton<ThemeMode>)).height,
        lessThan(56),
      );
      expect(tester.takeException(), isNull);
    },
  );
}
