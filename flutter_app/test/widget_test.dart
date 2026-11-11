import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

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
    await tester.tap(find.text('Profile'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sign in with organizer key'));
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
        onDictateSpeech: () async => throw StateError('Microphone denied'),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ask AI'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Microphone'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Microphone unavailable'), findsOneWidget);
    final input = find.byType(TextField);
    final send = find.byTooltip('Send');
    expect(tester.getCenter(input).dy, closeTo(tester.getCenter(send).dy, 1));
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
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('PayPal Hackathon'), findsOneWidget);
    expect(find.textContaining('No activity yet'), findsOneWidget);
    expect(find.text('Scan & pay'), findsOneWidget);
    await tester.tap(find.text('Request money'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'allen');
    await tester.tap(find.text('Allen'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, '20');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Review request'));
    await tester.pumpAndSettle();
    expect(find.text('20.00 GBP'), findsOneWidget);
    await tester.tap(find.text('Create practice requests'));
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
          onPlayAudio: (bytes) async => played.add(bytes),
          onDictateSpeech: () async =>
              'Ask Maya for twenty dollars for dinner and Arun for fifteen for drinks.',
        ),
      );
      await connect(tester);
      await tester.tap(find.text('Ask AI'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextField).last,
        'Ask Maya for 20 and Arun for 15.',
      );
      await tester.pump();
      await tester.tap(find.byTooltip('Send'));
      await tester.pumpAndSettle();
      expect(played, hasLength(1));
      expect(voiced.single, contains('Maya owes 20.00 USD'));
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
      expect(find.text('Type, dictate, or attach a receipt'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Allen voice instruction shows the USD amount, GBP quote, and one demo receipt',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(667, 375);
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        SplitSync(httpClient: mockBackend(), enableLiveCamera: false),
      );
      await tester.pumpAndSettle();
      expect(find.byType(NavigationRail), findsOneWidget);
      await tester.ensureVisible(find.text('Ask AI'));
      await tester.tap(find.text('Ask AI'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextField).last,
        'Allen, send him 20 dollars saying thanks for coffee.',
      );
      await tester.ensureVisible(find.byTooltip('Send'));
      await tester.pump();
      await tester.tap(find.byTooltip('Send'));
      await tester.pumpAndSettle();
      expect(find.text('Review payment'), findsOneWidget);
      expect(find.text('14.90 GBP'), findsOneWidget);
      await tester.ensureVisible(find.text('Pay'));
      await tester.tap(find.text('Pay'));
      await tester.pumpAndSettle();
      expect(find.text('Payment receipt'), findsOneWidget);
      expect(find.text('Paid Allen'), findsOneWidget);
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
          SplitSync(httpClient: client, enableLiveCamera: false),
        );
        await tester.pumpAndSettle();
        if (connected) {
          await connect(tester);
        }
        await tester.tap(find.text('Ask AI'));
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
        expect(find.text('24.00 USD'), findsOneWidget);
        expect(find.text('20.00 USD'), findsNothing);

        await tester.tap(find.text('Review 4 payments'));
        await tester.pumpAndSettle();
        await tester.tap(find.byTooltip('Back'));
        await tester.pumpAndSettle();
        expect(find.text('Review 4 payments'), findsOneWidget);
        await tester.ensureVisible(find.text('Review 4 payments'));
        await tester.tap(find.text('Review 4 payments'));
        await tester.pumpAndSettle();
        expect(find.text('69.00 USD'), findsOneWidget);
        await tester.ensureVisible(find.text('Confirm practice payments'));
        await tester.tap(find.text('Confirm practice payments'));
        await tester.pumpAndSettle();
        expect(find.text('4 practice payments completed'), findsOneWidget);
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
        SplitSync(httpClient: mockBackend(), enableLiveCamera: false),
      );
      await tester.pumpAndSettle();

      final scan = find.text('Scan bill');
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
      expect(find.text('42.00 USD'), findsOneWidget);
      final split = find.text('Split in Ask AI');
      expect(split.hitTestable(), findsOneWidget);
      expect(find.text('Pasta Dinner Bowl'), findsNothing);
      final currency = find.byType(DropdownButtonFormField<String>);
      await tester.ensureVisible(currency);
      await tester.tap(currency);
      await tester.pumpAndSettle();
      await tester.tap(find.text('CAD').last);
      await tester.pumpAndSettle();
      expect(find.text('42.00 CAD'), findsOneWidget);
      final items = find.text('Line items (3)');
      await tester.ensureVisible(items);
      await tester.tap(items);
      await tester.pumpAndSettle();
      expect(find.text('Pasta Dinner Bowl'), findsOneWidget);
      expect(split.hitTestable(), findsOneWidget);

      await tester.tap(split);
      await tester.pumpAndSettle();
      expect(find.text('Ask AI'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Store keeps the cart and hands the split into the conversation',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(390, 844);
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        SplitSync(httpClient: mockBackend(), enableLiveCamera: false),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Store'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('View').first);
      await tester.tap(find.text('View').first);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Add to shared purchase'));
      await tester.tap(find.text('Add to shared purchase'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Split this purchase'));
      await tester.tap(find.text('Split this purchase'));
      await tester.pumpAndSettle();
      expect(find.text('Type, dictate, or attach a receipt'), findsOneWidget);
      tester.view.physicalSize = const Size(667, 375);
      await tester.pumpAndSettle();
      expect(find.text('Review requests'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
