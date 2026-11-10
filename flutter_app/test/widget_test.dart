import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:splitsync/main.dart';

MockClient mockBackend({
  bool aiUnavailable = false,
  bool ttsUnavailable = false,
  bool failEmailDelivery = true,
}) {
  var lamp = 'Maya';
  var published = false;
  final wavBytes = Uint8List.fromList([82, 73, 70, 70, ...List.filled(60, 0)]);

  return MockClient((request) async {
    final auth = request.headers['authorization'];
    if (auth != 'Bearer valid-organizer-key') {
      return http.Response(
        jsonEncode({'error': 'Invalid SplitSync organizer key.'}),
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
            {'id': 'maya', 'name': 'Maya', 'handle': 'maya@house.local', 'note': 'Roommate'},
            {'id': 'arun', 'name': 'Arun', 'handle': 'arun@house.local', 'note': 'Roommate'},
            {'id': 'leah', 'name': 'Leah', 'handle': 'leah@house.local', 'note': 'Organizer'},
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
        return http.Response(jsonEncode({'error': 'Vision AI unavailable.'}), 502);
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

    if (path == '/api/organizer/read-split' || path == '/api/organizer/read-text') {
      if (ttsUnavailable) {
        return http.Response(jsonEncode({'error': 'Chatterbox unavailable.'}), 502);
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
          'deliveryOutcomes': [{'ok': !failed}],
        }),
        200,
      );
    }

    return http.Response(jsonEncode({'ok': true}), 200);
  });
}

void main() {
  testWidgets('Welcome shows invalid key error and opens PhonePe Hub on sign in', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      SplitSync(httpClient: mockBackend(), enableLiveCamera: false),
    );
    await tester.enterText(find.byType(TextField).first, 'wrong-key');
    await tester.tap(find.text('Sign in as organizer'));
    await tester.pumpAndSettle();
    expect(find.text('Invalid organizer key'), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, 'valid-organizer-key');
    await tester.tap(find.text('Sign in as organizer'));
    await tester.pumpAndSettle();

    expect(find.text('Scan & Pay'), findsOneWidget);
    expect(find.text('Request Money'), findsOneWidget);
    expect(find.text('Scan Bill'), findsOneWidget);
    expect(find.text('Talk to SplitSync'), findsOneWidget);
  });

  testWidgets('Scan Bill -> extract -> voice dictate -> Chatterbox -> failed Email stays Created', (
    WidgetTester tester,
  ) async {
    tester.view.devicePixelRatio = 1.0;
    tester.view.physicalSize = const Size(1280, 860);
    addTearDown(tester.view.reset);

    Uint8List? spokenAudio;
    await tester.pumpWidget(
      SplitSync(
        httpClient: mockBackend(failEmailDelivery: true),
        enableLiveCamera: false,
        onPlayAudio: (bytes) async => spokenAudio = bytes,
        onDictateSpeech: () async =>
            'Ask Maya for twenty dollars for dinner and Arun for fifteen for drinks.',
      ),
    );

    await tester.enterText(find.byType(TextField).first, 'valid-organizer-key');
    await tester.tap(find.text('Sign in as organizer'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Scan Bill'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Use bundled sample receipt'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Extract bill details'));
    await tester.pumpAndSettle();
    expect(find.text('Olive Kitchen'), findsOneWidget);

    await tester.ensureVisible(find.text('Tap mic to speak'));
    await tester.tap(find.text('Tap mic to speak'));
    await tester.pumpAndSettle();
    expect(
      find.text('Ask Maya for twenty dollars for dinner and Arun for fifteen for drinks.'),
      findsWidgets,
    );

    await tester.ensureVisible(find.text('Review spoken request'));
    await tester.tap(find.text('Review spoken request'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Unallocated balance'), findsOneWidget);
    expect(find.text('\$7.00 USD'), findsOneWidget);
    expect(
      find.textContaining('I’ll request \$20 from Maya for dinner and \$15 from Arun for drinks'),
      findsOneWidget,
    );

    await tester.ensureVisible(find.text('Hear reply'));
    await tester.tap(find.text('Hear reply'));
    await tester.pumpAndSettle();
    expect(spokenAudio, isNotNull);

    await tester.ensureVisible(find.byType(DropdownButtonFormField<String>));
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('Email gateway').last);
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Confirm & create requests'));
    await tester.tap(find.text('Confirm & create requests'));
    await tester.pumpAndSettle();

    expect(find.text('Created'), findsWidgets);
    expect(find.text('Failed'), findsWidgets);
    expect(find.text('Sent'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Store -> product -> shared cart -> Split with people works & preserves portrait/landscape', (
    WidgetTester tester,
  ) async {
    tester.view.devicePixelRatio = 1.0;
    tester.view.physicalSize = const Size(390, 844);
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      SplitSync(httpClient: mockBackend(), enableLiveCamera: false),
    );
    await tester.ensureVisible(find.text('Explore static preview (no server)'));
    await tester.tap(find.text('Explore static preview (no server)'));
    await tester.pumpAndSettle();
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'home portrait 390x844');

    await tester.tap(find.text('Store'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull, reason: 'store portrait 390x844');

    await tester.ensureVisible(find.text('View').first);
    await tester.tap(find.text('View').first);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Add to shared purchase'));
    await tester.tap(find.text('Add to shared purchase'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Split with people'));
    await tester.tap(find.text('Split with people'));
    await tester.pumpAndSettle();

    const customDraft = 'Draft retained across orientation change';
    await tester.enterText(find.byType(TextField).first, customDraft);

    tester.view.physicalSize = const Size(667, 375);
    await tester.pumpAndSettle();
    expect(find.text(customDraft), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'request-review landscape 667x375');

    // Return home in short landscape and verify compact rail renders cleanly
    await tester.tap(find.byIcon(Icons.arrow_back_rounded).first);
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.arrow_back_rounded).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Home'));
    await tester.pumpAndSettle();
    expect(find.byType(NavigationRail), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'home short landscape 667x375');

    // Also verify Rent shortcut, Activity tab, and Profile tab render cleanly in short landscape
    await tester.ensureVisible(find.text('Rent (Preview)'));
    await tester.tap(find.text('Rent (Preview)'));
    await tester.pumpAndSettle();
    expect(find.text('Monthly rent draft'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'rent short landscape 667x375');

    await tester.tap(find.byIcon(Icons.arrow_back_rounded).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Activity'));
    await tester.pumpAndSettle();
    expect(find.text('Reimbursement requests, SS-001 orders, and Rent.'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'activity short landscape 667x375');

    await tester.tap(find.text('Profile'));
    await tester.pumpAndSettle();
    expect(find.text('Profile & Settings'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'profile short landscape 667x375');
  });
}
