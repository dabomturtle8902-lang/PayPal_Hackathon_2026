import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:ui' as ui;
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:share_plus/share_plus.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'models/splitsync_models.dart';
import 'speech_recorder_stub.dart'
    if (dart.library.js_interop) 'speech_recorder_web.dart';
import 'theme/medfarm_theme.dart';

const payerOrigin = String.fromEnvironment(
  'PAYER_ORIGIN',
  defaultValue: 'http://localhost:3000',
);

void main() => runApp(const SplitSync());

class SplitSync extends StatelessWidget {
  final http.Client? httpClient;
  final bool enableLiveCamera;
  final Future<void> Function(Uint8List wavBytes)? onPlayAudio;
  final Future<String?> Function()? onDictateSpeech;

  const SplitSync({
    super.key,
    this.httpClient,
    this.enableLiveCamera = true,
    this.onPlayAudio,
    this.onDictateSpeech,
  });

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'PayPal Hackathon',
    debugShowCheckedModeBanner: false,
    theme: buildSplitSyncTheme(brightness: Brightness.light),
    darkTheme: buildSplitSyncTheme(brightness: Brightness.dark),
    themeMode: ThemeMode.light,
    home: Demo(
      httpClient: httpClient,
      enableLiveCamera: enableLiveCamera,
      onPlayAudio: onPlayAudio,
      onDictateSpeech: onDictateSpeech,
    ),
  );
}

class Demo extends StatefulWidget {
  final http.Client? httpClient;
  final bool enableLiveCamera;
  final Future<void> Function(Uint8List wavBytes)? onPlayAudio;
  final Future<String?> Function()? onDictateSpeech;

  const Demo({
    super.key,
    this.httpClient,
    this.enableLiveCamera = true,
    this.onPlayAudio,
    this.onDictateSpeech,
  });

  @override
  State<Demo> createState() => _DemoState();
}

enum _ScannerState { ready, permission, scanning, invalid }

enum _AiState { idle, loading, clarify, unavailable, error }

enum _TtsState { idle, loading, ready, unavailable }

enum _MicState { idle, listening, transcribing, unavailable }

enum _ConnectErrorKind { none, invalidKey, backendUnavailable }

class _DemoState extends State<Demo> {
  static const names = ['Maya', 'Arun', 'Leah'];

  late final http.Client _client;
  late final bool _ownsClient;
  AudioPlayer? _audio;

  Map<String, double> fxRates = const {
    'USD': 1.0,
    'GBP': 0.74501,
    'CAD': 1.4136,
    'EUR': 0.89174,
    'JPY': 158.180,
    'INR': 93.930,
  };
  String fxRateDate = '2026-11-10';
  DateTime? fxRefreshAttempt;
  static const localDemoKey = 'paypal-hackathon-demo-v1';
  final amountController = TextEditingController();
  final noteController = TextEditingController();
  final contactSearch = TextEditingController();
  final activitySearch = TextEditingController();
  final Map<String, TextEditingController> rentShares = {};
  List<Map<String, dynamic>> demoTransfers = [];
  List<Map<String, dynamic>> localRequests = [];
  Map<String, dynamic>? activeTransfer;
  Map<String, dynamic>? savedRentRule;
  Timer? demoTimer;
  bool pollingDemo = false;
  bool loadingLocalDemo = true;
  bool sending = false;
  SplitContact? paymentContact;
  String paymentCurrency = 'USD';
  String receiveCurrency = 'USD';
  String requestKind = 'request';
  String? requestAttemptId;
  String? transferAttemptId;
  DateTime? rentDue;
  bool rentCreating = false;
  bool rentCustom = false;
  bool rememberRent = false;
  final rentContacts = <String>{};

  String demoId() => List.generate(
    4,
    (_) => _random.nextInt(1 << 24).toRadixString(16).padLeft(6, '0'),
  ).join();
  static final _random = Random.secure();

  String dateLabel(DateTime date) => date.toIso8601String().split('T').first;
  String currencyAmount(int cents, String currency) =>
      '${(cents / 100).toStringAsFixed(currency == 'JPY' ? 0 : 2)} $currency';

  int inputCents(String text, String currency) {
    final pattern = currency == 'JPY'
        ? r'^\d{1,7}$'
        : r'^\d{1,7}(?:\.\d{1,2})?$';
    if (!RegExp(pattern).hasMatch(text.trim())) return 0;
    final value = ((double.tryParse(text.trim()) ?? 0) * 100).round();
    return value <= 100000000 ? value : 0;
  }

  int convertCents(int cents, String from, String to) {
    final converted = cents * (fxRates[to] ?? 1) / (fxRates[from] ?? 1);
    return to == 'JPY' ? (converted / 100).round() * 100 : converted.round();
  }

  Widget paypalIcon({double size = 36}) => ClipRRect(
    borderRadius: BorderRadius.circular(9),
    child: Image.asset(
      'assets/paypal.png',
      width: size,
      height: size,
      excludeFromSemantics: true,
    ),
  );

  Future<void> restoreLocalDemo() async {
    try {
      final storage = SharedPreferencesAsync();
      if (const bool.fromEnvironment('RESET_LOCAL_DEMO')) {
        await storage.remove(localDemoKey);
      }
      final raw = await storage.getString(localDemoKey);
      if (!mounted || connected || backendBusy) return;
      if (raw != null) {
        final state = jsonDecode(raw) as Map;
        localRequests = List<Map<String, dynamic>>.from(
          state['requests'] as List,
        );
        demoTransfers = List<Map<String, dynamic>>.from(
          state['transfers'] as List,
        );
        savedRentRule = state['rent'] as Map<String, dynamic>?;
        setState(() {
          reimbursements = localRequests
              .map(ReimbursementRequest.fromJson)
              .toList();
        });
      }
    } catch (_) {
      // Demo remains usable on devices with storage disabled.
    } finally {
      if (mounted) setState(() => loadingLocalDemo = false);
    }
    if (mounted) unawaited(reconcileDemo());
  }

  Future<void> saveLocalDemo() async {
    try {
      await SharedPreferencesAsync().setString(
        localDemoKey,
        jsonEncode({
          'requests': localRequests,
          'transfers': demoTransfers,
          'rent': savedRentRule,
        }),
      );
    } catch (_) {
      if (mounted) {
        showFeedback('This browser could not save the local practice session.');
      }
    }
  }

  Future<void> reconcileDemo() async {
    if (!mounted || pollingDemo || backendBusy || loadingLocalDemo) return;
    final pending = {
      for (final request in reimbursements.where((r) => r.demo))
        for (final r in request.recipients.where(
          (r) => r.status == 'Waiting for payment',
        ))
          r.id: r.name,
    };
    if (pending.isEmpty) return;
    final received = <String>[];
    pollingDemo = true;
    try {
      if (connected) {
        final before = _organizerKey;
        final result = await backend('/api/organizer/state');
        if (!mounted ||
            !connected ||
            before != _organizerKey ||
            backendBusy ||
            result['reimbursements'] is! List) {
          return;
        }
        final fresh = (result['reimbursements'] as List)
            .map(
              (r) => ReimbursementRequest.fromJson(
                Map<String, dynamic>.from(r as Map),
              ),
            )
            .toList();
        for (final r
            in fresh.where((r) => r.demo).expand((r) => r.recipients)) {
          if (pending.containsKey(r.id) && r.status == 'Paid') {
            received.add(r.name);
          }
        }
        if (received.isNotEmpty) setState(() => reimbursements = fresh);
      } else {
        final now = DateTime.now().millisecondsSinceEpoch;
        for (final req in localRequests.where((r) => r['demo'] == true)) {
          for (final r in req['recipients'] as List) {
            if (r['status'] == 'Waiting for payment' &&
                (r['settleAt'] as int) <= now) {
              r['status'] = 'Payment received';
              r['receiptRef'] = 'DEMO-${r['id']}';
              received.add(r['name'] as String);
            }
          }
        }
        if (received.isNotEmpty) {
          setState(
            () => reimbursements = localRequests
                .map(ReimbursementRequest.fromJson)
                .toList(),
          );
          await saveLocalDemo();
        }
      }
      if (mounted && received.isNotEmpty) {
        showFeedback('Payment received from ${received.join(', ')} · Practice');
      }
    } catch (_) {
      // Keep pending requests visible and retry on the next poll.
    } finally {
      pollingDemo = false;
    }
  }

  void openContactPayment({required bool send, SplitContact? contact}) {
    contactSearch.clear();
    amountController.clear();
    noteController.clear();
    paymentContact = contact;
    paymentCurrency = send ? 'USD' : contact?.currency ?? 'USD';
    receiveCurrency = contact?.currency ?? 'USD';
    transferAttemptId = null;
    transferFromAsk = false;
    go(send ? 'send-money' : 'manual-request');
  }

  Widget currencyPicker(
    String label,
    String selected,
    ValueChanged<String> change,
  ) => DropdownButtonFormField<String>(
    initialValue: selected,
    isExpanded: true,
    decoration: InputDecoration(labelText: label.isEmpty ? null : label),
    items: fxRates.keys
        .map((c) => DropdownMenuItem(value: c, child: Text(c)))
        .toList(),
    onChanged: (value) {
      if (value != null) change(value);
    },
  );

  Widget contactPaymentScreen({required bool send}) {
    final contact = paymentContact;
    final amount = inputCents(amountController.text, paymentCurrency);
    final title = send ? 'Send money' : 'Request money';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: title,
          onBack: contact == null
              ? () => go('home')
              : () => setState(() => paymentContact = null),
        ),
        if (contact == null) ...[
          SplitTextField(
            label: 'Search contacts',
            controller: contactSearch,
            onChanged: (_) => setState(() {}),
          ),
          for (final c in contacts.where(
            (c) =>
                c.id != 'leah' &&
                '${c.name} ${c.country} ${c.currency}'.toLowerCase().contains(
                  contactSearch.text.trim().toLowerCase(),
                ),
          ))
            paymentTile(
              name: c.name,
              leading: Text(c.flag, style: const TextStyle(fontSize: 26)),
              detail: [
                c.country,
                c.currency,
              ].where((value) => value.isNotEmpty).join(' · '),
              onTap: () => setState(() {
                paymentContact = c;
                paymentCurrency = send ? 'USD' : c.currency;
                receiveCurrency = c.currency;
              }),
            ),
        ] else
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${contact.flag} ${contact.name} · ${contact.country}',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                SplitTextField(
                  label: 'Amount',
                  controller: amountController,
                  onChanged: (_) => setState(() {}),
                ),
                currencyPicker(
                  'Currency',
                  paymentCurrency,
                  (c) => setState(() => paymentCurrency = c),
                ),
                const SizedBox(height: 10),
                SplitTextField(
                  label: 'Note (optional)',
                  controller: noteController,
                ),
                if (send) ...[
                  const SizedBox(height: 10),
                  currencyPicker(
                    'Recipient currency',
                    receiveCurrency,
                    (c) => setState(() => receiveCurrency = c),
                  ),
                  if (amount > 0) transferQuote(contact, amount),
                ],
                const SizedBox(height: 14),
                SplitPrimaryButton(
                  label: send ? 'Review payment' : 'Review request',
                  onPressed: amount <= 0 || loadingLocalDemo
                      ? null
                      : () {
                          if (send) {
                            transferAttemptId = demoId();
                            go('review-transfer');
                          } else {
                            prepareRequests(
                              'Money request',
                              'request',
                              paymentCurrency,
                              [
                                RecipientDraft(
                                  name: contact.name,
                                  contactId: contact.id,
                                  known: true,
                                  amountCents: amount,
                                  currency: paymentCurrency,
                                  reason: noteController.text.trim().isEmpty
                                      ? 'Money request'
                                      : noteController.text.trim(),
                                ),
                              ],
                            );
                            unawaited(reviewRequests());
                          }
                        },
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget transferQuote(SplitContact contact, int amount) => Column(
    children: [
      lineRow('You send', currencyAmount(amount, paymentCurrency)),
      lineRow(
        '${contact.name} receives',
        currencyAmount(
          convertCents(amount, paymentCurrency, receiveCurrency),
          receiveCurrency,
        ),
      ),
      lineRow(
        'ECB reference · $fxRateDate',
        '1 $paymentCurrency ≈ ${(fxRates[receiveCurrency]! / fxRates[paymentCurrency]!).toStringAsPrecision(6)} $receiveCurrency',
      ),
      if (paymentCurrency != 'INR')
        lineRow(
          'INR display estimate',
          currencyAmount(convertCents(amount, paymentCurrency, 'INR'), 'INR'),
        ),
    ],
  );

  Widget transferReviewScreen() {
    final contact = paymentContact;
    if (contact == null) return contactPaymentScreen(send: true);
    final amount = inputCents(amountController.text, paymentCurrency);
    return Column(
      children: [
        SplitScreenHeader(
          title: 'Review payment',
          subtitle: 'Verify the recipient and amount before you pay',
          onBack: () {
            if (!sending) go(transferFromAsk ? 'talk' : 'send-money');
          },
        ),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SplitBadge('Practice mode', preview: true),
              Text(
                '${contact.flag} ${contact.name}',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              transferQuote(contact, amount),
              if (noteController.text.trim().isNotEmpty)
                lineRow('Note', noteController.text.trim()),
              const SizedBox(height: 12),
              if (sending) const LinearProgressIndicator(),
              SplitPrimaryButton(
                label: sending ? 'Paying…' : 'Pay',
                onPressed: sending || amount <= 0
                    ? null
                    : () => submitTransfer(contact, amount),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> submitTransfer(SplitContact contact, int amount) async {
    if (sending) return;
    setState(() => sending = true);
    final id = transferAttemptId ??= demoId();
    final input = {
      'contactId': contact.id,
      'recipientName': contact.name,
      'sourceAmountCents': amount,
      'sourceCurrency': paymentCurrency,
      'targetCurrency': receiveCurrency,
      'note': noteController.text.trim(),
      'clientTxId': id,
    };
    try {
      final transaction = connected
          ? Map<String, dynamic>.from(
              (await backend(
                    '/api/organizer/demo-pay',
                    body: input,
                  ))['transaction']
                  as Map,
            )
          : {
              ...input,
              'id': id,
              'flag': contact.flag,
              'status': 'Completed',
              'targetAmountCents': convertCents(
                amount,
                paymentCurrency,
                receiveCurrency,
              ),
              'createdAt': DateTime.now().toIso8601String(),
            };
      if (!mounted) return;
      if (!MediaQuery.disableAnimationsOf(context)) {
        await Future<void>.delayed(const Duration(milliseconds: 400));
      }
      if (!mounted) return;
      setState(() {
        demoTransfers = [
          transaction,
          ...demoTransfers.where((t) => t['id'] != transaction['id']),
        ];
        activeTransfer = transaction;
        if (transferFromAsk) clearPaymentDraft();
        page = 'transfer-receipt';
      });
      if (!connected) await saveLocalDemo();
    } catch (e) {
      if (mounted) showFeedback('Could not complete the practice payment. $e');
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Widget groupPaymentScreen() {
    if (!validPaymentDraft) return talkScreen();
    final totals = <String, int>{};
    for (final row in recipientDrafts) {
      totals.update(
        row.currency,
        (total) => total + row.amountCents,
        ifAbsent: () => row.amountCents,
      );
    }
    return Column(
      children: [
        SplitScreenHeader(
          title: 'Review ${recipientDrafts.length} payments',
          subtitle: 'Check what each person will receive.',
          onBack: () {
            if (!sending) go('talk');
          },
        ),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SplitBadge('Practice mode', preview: true),
              const SizedBox(height: 16),
              for (final row in recipientDrafts) ...groupPaymentLine(row),
              const Divider(height: 24),
              for (final entry in totals.entries)
                lineRow(
                  'Total in ${entry.key}',
                  currencyAmount(entry.value, entry.key),
                ),
              const SizedBox(height: 16),
              if (sending) const LinearProgressIndicator(),
              SplitPrimaryButton(
                label: sending ? 'Paying…' : 'Confirm practice payments',
                onPressed: sending ? null : submitGroupPayments,
              ),
            ],
          ),
        ),
      ],
    );
  }

  List<Widget> groupPaymentLine(RecipientDraft row) {
    final contact = contacts.firstWhere((c) => c.id == row.contactId);
    final target = fxRates.containsKey(contact.currency)
        ? contact.currency
        : 'USD';
    return [
      paymentTile(
        name: '${contact.flag} ${contact.name}'.trim(),
        amount: currencyAmount(row.amountCents, row.currency),
        detail: target == row.currency
            ? null
            : 'Receives about ${currencyAmount(convertCents(row.amountCents, row.currency, target), target)}',
      ),
    ];
  }

  Future<void> submitGroupPayments() async {
    if (sending || !validPaymentDraft) return;
    final attemptId = groupAttemptId ??= demoId();
    final inputs = [
      for (final (index, row) in recipientDrafts.indexed)
        {
          'clientTxId': '$attemptId-$index',
          'contactId': row.contactId!,
          'sourceAmountCents': row.amountCents,
          'sourceCurrency': row.currency,
          'note': row.reason,
        },
    ];
    setState(() => sending = true);
    try {
      final transactions = connected
          ? ((await backend(
                      '/api/organizer/demo-pay',
                      body: {'payments': inputs},
                    ))['transactions']
                    as List)
                .map((tx) => Map<String, dynamic>.from(tx as Map))
                .toList()
          : inputs.map((input) {
              final contact = contacts.firstWhere(
                (c) => c.id == input['contactId'],
              );
              final target = fxRates.containsKey(contact.currency)
                  ? contact.currency
                  : 'USD';
              return <String, dynamic>{
                ...input,
                'id': input['clientTxId'],
                'recipientName': contact.name,
                'flag': contact.flag,
                'status': 'Completed',
                'targetCurrency': target,
                'targetAmountCents': convertCents(
                  input['sourceAmountCents'] as int,
                  input['sourceCurrency'] as String,
                  target,
                ),
                'createdAt': DateTime.now().toIso8601String(),
              };
            }).toList();
      if (!mounted) return;
      final ids = transactions.map((tx) => tx['id']).toSet();
      setState(() {
        demoTransfers = [
          ...transactions,
          ...demoTransfers.where((tx) => !ids.contains(tx['id'])),
        ];
        groupReceipt = transactions;
        clearPaymentDraft();
        askMessages.add((
          user: false,
          text: '${transactions.length} practice payments completed.',
        ));
        page = 'payment-draft-receipt';
      });
      if (!connected) await saveLocalDemo();
    } catch (_) {
      if (mounted) {
        showFeedback('Could not confirm the practice payments. Try again.');
      }
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Widget groupReceiptScreen() => Column(
    children: [
      SplitScreenHeader(
        title: '${groupReceipt.length} practice payments completed',
        onBack: () => go('activity'),
      ),
      SplitCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SplitBadge('Practice mode', preview: true),
            const SizedBox(height: 12),
            for (final tx in groupReceipt)
              paymentTile(
                name: '${tx['flag'] ?? ''} ${tx['recipientName']}'.trim(),
                amount: currencyAmount(
                  tx['sourceAmountCents'] as int,
                  tx['sourceCurrency'] as String,
                ),
                detail:
                    tx['targetAmountCents'] is int &&
                        tx['targetCurrency'] != tx['sourceCurrency']
                    ? 'Received ${currencyAmount(tx['targetAmountCents'] as int, tx['targetCurrency'] as String)}'
                    : null,
              ),
            const SizedBox(height: 12),
            SplitPrimaryButton(
              label: 'View activity',
              onPressed: () => go('activity'),
            ),
          ],
        ),
      ),
    ],
  );

  Widget transferReceiptScreen() {
    final t = activeTransfer;
    if (t == null) return activityScreen();
    return Column(
      children: [
        SplitScreenHeader(
          title: 'Payment receipt',
          onBack: () => go('activity'),
        ),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SplitBadge('Practice mode', preview: true),
              Text(
                'Paid ${t['recipientName']}',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              lineRow(
                'You sent',
                currencyAmount(
                  t['sourceAmountCents'] as int,
                  t['sourceCurrency'] as String,
                ),
              ),
              lineRow(
                'Recipient received',
                currencyAmount(
                  t['targetAmountCents'] as int,
                  t['targetCurrency'] as String,
                ),
              ),
              if ((t['note'] as String?)?.isNotEmpty == true)
                lineRow('Note', t['note'] as String),
              lineRow('Date', (t['createdAt'] as String).split('T').first),
            ],
          ),
        ),
      ],
    );
  }

  int equalShare(int total, int count, String currency) {
    final unit = currency == 'JPY' ? 100 : 1;
    return (total ~/ unit ~/ count) * unit;
  }

  Iterable<RecipientDraft> get requestPayers =>
      recipientDrafts.where((row) => row.contactId != 'leah');

  int get ownRequestShare => max(
    0,
    billDraft.totalCents -
        requestPayers.fold(
          0,
          (sum, row) =>
              sum +
              convertCents(row.amountCents, row.currency, billDraft.currency),
        ),
  );

  void prepareRequests(
    String title,
    String kind,
    String currency,
    List<RecipientDraft> rows, {
    int? total,
  }) {
    billRawPng = null;
    billDraft = ExtractedBillDraft(
      merchant: title,
      date: dateLabel(DateTime.now()),
      currency: currency,
      items: [],
      totalCents: total ?? rows.fold(0, (sum, row) => sum + row.amountCents),
    );
    recipientDrafts = rows;
    requestKind = kind;
    requestAttemptId = null;
    deliveryChannel = 'demo';
  }

  Future<void> reviewRequests() async {
    if (requestPayers.isEmpty ||
        requestPayers.any((r) => !r.known || r.amountCents <= 0)) {
      return;
    }
    if (page == 'talk') setState(() => stopVoice(clear: false));
    final channel = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheet) => SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Review requests',
              style: Theme.of(sheet).textTheme.titleLarge,
            ),
            const Text('Practice requests show simulated payment progress.'),
            for (final r in requestPayers)
              lineRow(
                '${r.name} owes',
                currencyAmount(r.amountCents, r.currency),
              ),
            if (ownRequestShare > 0)
              lineRow(
                'Your share',
                currencyAmount(ownRequestShare, billDraft.currency),
                bold: true,
              ),
            const SizedBox(height: 12),
            SplitPrimaryButton(
              label: 'Create practice requests',
              onPressed: () => Navigator.pop(sheet, 'demo'),
            ),
            if (connected) ...[
              const SizedBox(height: 8),
              SplitSecondaryButton(
                label: 'Create reimbursement links',
                onPressed: () => Navigator.pop(sheet, 'link'),
              ),
            ],
          ],
        ),
      ),
    );
    if (!mounted || channel == null) return;
    deliveryChannel = channel;
    await confirmCreateRequests();
  }

  // Navigation & mode state
  String page = 'home';
  bool connected = false;
  bool staticPreview = false;
  bool showBackendConfig = false;
  bool obscureKey = true;
  bool backendBusy = false;

  // Providers capability state
  bool paypalConfigured = false;
  bool aiConfigured = false;
  bool deliveryConfigured = false;

  // SS-001 Sandbox Merchant purchase state
  String lamp = 'Maya';
  String selected = 'Maya';
  String result = 'processing';
  bool published = false;
  bool merchantOpened = false;
  List<Map<String, dynamic>> serverParticipants = [];

  _ScannerState scannerState = _ScannerState.ready;
  String scannerError = '';
  _AiState aiState = _AiState.idle;
  String aiError = '';
  _TtsState ttsState = _TtsState.idle;
  String ttsError = '';
  _ConnectErrorKind connectErrorKind = _ConnectErrorKind.none;
  String connectErrorMessage = '';

  // Bill Capture -> Crop -> Extract -> Voice Dictate -> Confirm state
  String billCamState = 'ready'; // ready | scanning | denied | unavailable
  String billCamError = '';
  Uint8List? billRawPng;
  double cropTop = 0.03;
  double cropBottom = 0.03;
  bool usingDemoReceipt = false;
  bool croppingReceipt = false;
  int receiptExtraction = 0;
  String billExtractState = 'idle'; // idle | loading | ready | error
  String billExtractError = '';
  ExtractedBillDraft billDraft = ExtractedBillDraft.blank();

  _MicState micState = _MicState.idle;
  String micError = '';
  List<RecipientDraft> recipientDrafts = [];
  String deliveryChannel = 'link';

  // Activity, Contacts & Reimbursement Requests
  String activityFilter = 'All';
  List<SplitContact> contacts = List.of(kDefaultContacts);
  List<ReimbursementRequest> reimbursements = [];
  String? activeRequestId;
  String? activeRequestQrRecId;
  ReimbursementRequest? payerReimbRequest;
  ReimbursementRecipient? payerReimbRecipient;

  // Store & Shared Cart
  String storeCategory = 'All';
  String storeQuery = '';
  StoreProduct activeProduct = kStoreCatalog.first;
  final List<CartEntry> cart = [];
  final Set<String> interests = <String>{};

  // Persistent controllers so rotation never resets user drafts
  final organizerKeyController = TextEditingController();
  final originController = TextEditingController(text: payerOrigin);
  final instructionController = TextEditingController(
    text:
        'Split the \$120 kitchen essentials equally between Maya, Arun and Leah. The \$30 lamp is for Leah.',
  );
  final linkController = TextEditingController();
  final billMerchantController = TextEditingController();
  final billDateController = TextEditingController();
  final billTotalController = TextEditingController();
  final storeSearchController = TextEditingController();
  final newContactNameController = TextEditingController();
  final newContactHandleController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _ownsClient = widget.httpClient == null;
    _client = widget.httpClient ?? http.Client();
    unawaited(restoreLocalDemo());
    unawaited(restoreOrganizerConnection());
    unawaited(refreshFxRates());
    demoTimer = Timer.periodic(
      const Duration(seconds: 1),
      (_) => reconcileDemo(),
    );
  }

  @override
  void dispose() {
    demoTimer?.cancel();
    if (audioComplete != null) unawaited(audioComplete!.cancel());
    cancelBrowserRecording();
    askInput.dispose();
    askScroll.dispose();
    if (speech.isListening) unawaited(speech.cancel());
    if (_audio != null) unawaited(_audio!.dispose());
    if (_ownsClient) _client.close();
    amountController.dispose();
    noteController.dispose();
    contactSearch.dispose();
    activitySearch.dispose();
    for (final controller in rentShares.values) {
      controller.dispose();
    }
    organizerKeyController.dispose();
    originController.dispose();
    instructionController.dispose();
    linkController.dispose();
    billMerchantController.dispose();
    billDateController.dispose();
    billTotalController.dispose();
    storeSearchController.dispose();
    newContactNameController.dispose();
    newContactHandleController.dispose();
    super.dispose();
  }

  String get _origin {
    final raw = originController.text.trim();
    if (raw.isEmpty) return payerOrigin;
    return raw.endsWith('/') ? raw.substring(0, raw.length - 1) : raw;
  }

  String get _organizerKey => organizerKeyController.text.trim();
  String money(num n) => '\$${n.toStringAsFixed(2)}';
  String centsStr(int c) => money(c / 100.0);

  int share(String n) {
    final rows = serverParticipants.where((p) => p['name'] == n);
    return rows.isEmpty
        ? 40 + (n == lamp ? 30 : 0)
        : (rows.first['amountCents'] as int) ~/ 100;
  }

  String paymentStatus(String n) {
    final rows = serverParticipants.where((p) => p['name'] == n);
    if (rows.isEmpty) {
      if (!staticPreview) return 'Awaiting payment';
      return n == 'Maya'
          ? 'Paid'
          : n == 'Arun'
          ? 'Processing'
          : 'Awaiting payment';
    }
    return rows.first['status'] as String;
  }

  int get paidAmount {
    if (connected) {
      return serverParticipants
          .where((p) => p['status'] == 'Paid')
          .fold(0, (t, p) => t + (p['amountCents'] as int) ~/ 100);
    }
    return staticPreview ? share('Maya') : 0;
  }

  int get paidPeople {
    if (connected) {
      return serverParticipants.where((p) => p['status'] == 'Paid').length;
    }
    return staticPreview ? 1 : 0;
  }

  bool get hasExistingOrders =>
      connected &&
      serverParticipants.any(
        (p) => p['orders'] is List && (p['orders'] as List).isNotEmpty,
      );

  int get cartCount => cart.fold(0, (s, e) => s + e.qty);

  String? shareLink(String n) {
    if (connected) {
      final rows = serverParticipants.where((p) => p['name'] == n);
      return published && rows.isNotEmpty
          ? rows.first['shareUrl'] as String
          : null;
    }
    return published ? '$_origin/#share/${n.toLowerCase()}' : null;
  }

  void go(String nextPage) {
    if (nextPage == 'send-money' ||
        nextPage == 'talk' ||
        nextPage == 'review-transfer') {
      unawaited(refreshFxRates());
    }
    if (page == 'talk' && nextPage != 'talk') {
      turnEpoch++;
      stopVoice();
      cancelAskMic();
      askBusy = false;
    }
    if (nextPage == 'review') merchantOpened = true;
    setState(() {
      page = nextPage;
      if (nextPage != 'scan' && nextPage != 'scan-error') {
        if (scannerState == _ScannerState.scanning ||
            scannerState == _ScannerState.permission) {
          scannerState = _ScannerState.ready;
        }
      }
    });
  }

  void showFeedback(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  // ---------- HTTP Helpers ----------
  Future<Map<String, dynamic>> backend(
    String path, {
    Map<String, dynamic>? body,
    Duration timeout = const Duration(seconds: 25),
  }) async {
    final uri = Uri.parse('$_origin$path');
    final headers = {
      'Authorization': 'Bearer $_organizerKey',
      'Content-Type': 'application/json',
    };
    final response =
        await (body == null
                ? _client.get(uri, headers: headers)
                : _client.post(uri, headers: headers, body: jsonEncode(body)))
            .timeout(timeout);

    Map<String, dynamic> decoded = {};
    if (response.body.isNotEmpty) {
      final raw = jsonDecode(response.body);
      if (raw is Map<String, dynamic>) decoded = raw;
    }
    if (response.statusCode >= 400) {
      throw _ApiException(
        response.statusCode,
        decoded['error']?.toString() ?? 'Payment server returned an error.',
      );
    }
    return decoded;
  }

  Future<void> refreshFxRates() async {
    final now = DateTime.now();
    final previous = fxRefreshAttempt;
    if (previous != null &&
        now.difference(previous) < const Duration(minutes: 15)) {
      return;
    }
    fxRefreshAttempt = now;
    try {
      final snapshot = await backend(
        '/api/fx-rates',
        timeout: const Duration(seconds: 6),
      );
      if (mounted) {
        setState(() => applyFxRates(snapshot['rates'], snapshot['date']));
      }
    } catch (_) {
      // Keep using the dated reference rates when the provider is unreachable.
    }
  }

  void applyFxRates(Object? raw, Object? date) {
    if (raw is! Map ||
        date is! String ||
        date.compareTo(fxRateDate) < 0 ||
        fxRates.keys.any(
          (code) =>
              raw[code] is! num ||
              (raw[code] as num) <= 0 ||
              !(raw[code] as num).isFinite,
        )) {
      return;
    }
    fxRates = {
      for (final code in fxRates.keys) code: (raw[code] as num).toDouble(),
    };
    fxRateDate = date;
  }

  Future<void> restoreOrganizerConnection() async {
    try {
      final health = await backend(
        '/api/health',
        timeout: const Duration(seconds: 4),
      );
      if (!mounted ||
          connected ||
          backendBusy ||
          health['localOrganizerAutoLogin'] != true) {
        return;
      }
      await _loadFullState();
      if (!mounted || connected || backendBusy) return;
      setState(() {
        connected = true;
        merchantOpened = published;
        staticPreview = false;
      });
    } catch (_) {
      // The local preview stays available when the server is offline.
    }
  }

  Future<void> signInOrganizer() async {
    if (_organizerKey.isEmpty) {
      setState(() {
        connectErrorKind = _ConnectErrorKind.invalidKey;
        connectErrorMessage =
            'Enter the organizer key printed in the server terminal.';
      });
      return;
    }
    setState(() {
      backendBusy = true;
      connectErrorKind = _ConnectErrorKind.none;
      connectErrorMessage = '';
    });
    try {
      await _loadFullState();
      if (!mounted) return;
      setState(() {
        connected = true;
        merchantOpened = published;
        staticPreview = false;
        page = 'home';
      });
    } on _ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        connectErrorKind = e.statusCode == 401
            ? _ConnectErrorKind.invalidKey
            : _ConnectErrorKind.backendUnavailable;
        connectErrorMessage = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        connectErrorKind = _ConnectErrorKind.backendUnavailable;
        connectErrorMessage =
            'Could not reach $_origin. Start the Node server or update Backend URL.';
      });
    } finally {
      if (mounted) setState(() => backendBusy = false);
    }
  }

  Future<void> _loadFullState() async {
    try {
      final full = await backend('/api/organizer/state');
      applyFxRates(full['fxRates'], full['fxRateDate']);
      final purchase = Map<String, dynamic>.from(full['purchase'] as Map);
      lamp = purchase['lamp'] as String;
      selected = lamp;
      published = purchase['published'] as bool;
      serverParticipants = (purchase['participants'] as List)
          .map((p) => Map<String, dynamic>.from(p as Map))
          .toList();
      if (full['contacts'] is List) {
        contacts = (full['contacts'] as List)
            .map(
              (c) => SplitContact.fromJson(Map<String, dynamic>.from(c as Map)),
            )
            .toList();
      }
      if (full['reimbursements'] is List) {
        reimbursements = (full['reimbursements'] as List)
            .map(
              (r) => ReimbursementRequest.fromJson(
                Map<String, dynamic>.from(r as Map),
              ),
            )
            .toList();
      }
      savedRentRule = full['savedRentRule'] as Map<String, dynamic>?;
      if (full['demoTransactions'] is List) {
        demoTransfers = List<Map<String, dynamic>>.from(
          full['demoTransactions'] as List,
        );
      }
      if (full['providers'] is Map) {
        final pr = full['providers'] as Map;
        paypalConfigured = pr['paypalConfigured'] == true;
        aiConfigured = pr['aiConfigured'] == true;
        deliveryConfigured =
            pr['emailConfigured'] == true || pr['smsConfigured'] == true;
      }
    } on _ApiException catch (e) {
      if (e.statusCode != 404) rethrow;
      // Fallback for legacy test mocks serving only /api/organizer/purchase
      final data = await backend('/api/organizer/purchase');
      lamp = data['lamp'] as String;
      selected = lamp;
      published = data['published'] as bool;
      serverParticipants = (data['participants'] as List)
          .map((p) => Map<String, dynamic>.from(p as Map))
          .toList();
      paypalConfigured = data['configured'] == true;
      aiConfigured = data['aiConfigured'] == true;
    }
  }

  Future<bool> syncLedger({bool publish = false}) async {
    if (!connected && _organizerKey.isEmpty) {
      go('welcome');
      return false;
    }
    if (backendBusy) return false;
    setState(() => backendBusy = true);
    try {
      if (publish) {
        await backend('/api/organizer/split', body: {'lamp': lamp});
      }
      await _loadFullState();
      if (!mounted) return false;
      setState(() => connected = true);
      return true;
    } catch (e) {
      if (mounted) showFeedback('Unable to sync: $e');
      return false;
    } finally {
      if (mounted) setState(() => backendBusy = false);
    }
  }

  void signOutOrganizer() {
    setState(() {
      connected = false;
      staticPreview = false;
      serverParticipants = [];
      organizerKeyController.clear();
      connectErrorKind = _ConnectErrorKind.none;
      connectErrorMessage = '';
      page = 'home';
      merchantOpened = false;
      reimbursements = [];
      demoTransfers = [];
      contacts = List.of(kDefaultContacts);
    });
    unawaited(restoreLocalDemo());
  }

  static final Uint8List _fallbackPngBytes = base64Decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  );

  // ---------- Scan Bill -> Crop -> Extract -> Voice -> Confirm Actions ----------
  void openBundledSampleReceipt() {
    setState(() {
      clearReceipt();
      usingDemoReceipt = true;
      billRawPng = _fallbackPngBytes;
      cropTop = 0;
      cropBottom = 0;
      billDraft = ExtractedBillDraft.oliveSample();
      billMerchantController.text = billDraft.merchant;
      billDateController.text = billDraft.date;
      billTotalController.text = (billDraft.totalCents / 100).toStringAsFixed(
        2,
      );
      page = 'bill-crop';
    });
    if (widget.enableLiveCamera) {
      unawaited(
        buildSampleReceiptPng().then((png) {
          if (mounted &&
              usingDemoReceipt &&
              identical(billRawPng, _fallbackPngBytes) &&
              png.isNotEmpty) {
            setState(() => billRawPng = png);
          }
        }),
      );
    }
  }

  Future<void> extractBillDetails({bool inline = false}) async {
    final extraction = ++receiptExtraction;
    final reviewPage = inline ? 'talk' : 'bill-review';
    setState(() {
      billExtractState = 'loading';
      billExtractError = '';
      if (!inline) page = 'bill-review';
    });
    if (!connected || usingDemoReceipt) {
      setState(() {
        if (billDraft.merchant.isEmpty && billRawPng != null) {
          billExtractError =
              'Connect in Profile to extract receipt text, or enter the details below.';
        }
        billExtractState = 'ready';
        billMerchantController.text = billDraft.merchant;
        billDateController.text = billDraft.date;
        billTotalController.text = (billDraft.totalCents / 100).toStringAsFixed(
          billDraft.currency == 'JPY' ? 0 : 2,
        );
      });
      return;
    }
    try {
      await WidgetsBinding.instance.endOfFrame;
      if (!mounted || page != reviewPage || extraction != receiptExtraction) {
        return;
      }
      final png = billRawPng ?? _fallbackPngBytes;
      final res = await backend(
        '/api/organizer/extract-bill',
        body: {'imageDataUrl': receiptDataUrl(png)},
      );
      if (!mounted || page != reviewPage || extraction != receiptExtraction) {
        return;
      }
      final items = ((res['items'] as List?) ?? [])
          .map(
            (i) => BillLineItem(
              name: (i as Map)['name']?.toString() ?? 'Item',
              amountCents: (i['amountCents'] as num?)?.toInt() ?? 0,
            ),
          )
          .toList();
      setState(() {
        billDraft = ExtractedBillDraft(
          merchant: res['merchant']?.toString() ?? '',
          date: res['date']?.toString() ?? '',
          currency: fxRates.containsKey(res['currency'])
              ? res['currency'] as String
              : 'USD',
          items: items,
          taxCents: (res['taxCents'] as num?)?.toInt() ?? 0,
          tipCents: (res['tipCents'] as num?)?.toInt() ?? 0,
          totalCents: (res['totalCents'] as num?)?.toInt() ?? 0,
          unreadableFields: ((res['unreadableFields'] as List?) ?? [])
              .map((e) => e.toString())
              .toList(),
          modelUsed: res['modelUsed']?.toString() ?? '',
        );
        billMerchantController.text = billDraft.merchant;
        billDateController.text = billDraft.date;
        billTotalController.text = (billDraft.totalCents / 100).toStringAsFixed(
          billDraft.currency == 'JPY' ? 0 : 2,
        );
        billExtractState = 'ready';
      });
    } catch (_) {
      if (!mounted || page != reviewPage || extraction != receiptExtraction) {
        return;
      }
      setState(() {
        billExtractState = 'error';
        billExtractError =
            'We couldn’t read this receipt. You can enter the details below.';
      });
    }
  }

  Future<void> playAudioBytes(Uint8List wav) async {
    if (widget.onPlayAudio != null) {
      await widget.onPlayAudio!(wav);
    } else {
      _audio ??= AudioPlayer();
      await _audio!.play(BytesSource(wav, mimeType: 'audio/wav'));
    }
  }

  Future<void> confirmCreateRequests() async {
    if (backendBusy) return;
    if (requestPayers.isEmpty ||
        requestPayers.any((r) => r.name.trim().isEmpty || r.amountCents <= 0)) {
      showFeedback('Every row requires a recipient name and positive amount.');
      return;
    }
    setState(() => backendBusy = true);
    final evidence = billRawPng != null ? receiptDataUrl(billRawPng!) : '';
    final now = DateTime.now();
    final isDemo = deliveryChannel == 'demo';
    final draftId = requestAttemptId ??= demoId();
    final payload = {
      'clientRequestId': draftId,
      'kind': requestKind,
      'dueDate': rentDue == null || requestKind != 'rent'
          ? ''
          : dateLabel(rentDue!),
      'title': billDraft.merchant.isEmpty
          ? 'Money request'
          : billDraft.merchant,
      'merchant': billDraft.merchant,
      'billDate': billDraft.date,
      'currency': billDraft.currency,
      'items': billDraft.items.map((i) => i.toJson()).toList(),
      'taxCents': billDraft.taxCents,
      'tipCents': billDraft.tipCents,
      'totalCents': billDraft.totalCents > 0
          ? billDraft.totalCents
          : requestPayers.fold<int>(
              0,
              (sum, row) =>
                  sum +
                  convertCents(
                    row.amountCents,
                    row.currency,
                    billDraft.currency,
                  ),
            ),
      'ownShareCents': ownRequestShare,
      'evidenceImageDataUrl': evidence,
      'transcript': page == 'talk'
          ? (askMessages.where((message) => message.user).lastOrNull?.text ??
                '')
          : '',
      'channel': deliveryChannel,
      'recipients': requestPayers
          .map(
            (r) => {
              'name': r.name.trim(),
              'contactId': r.contactId,
              'amountCents': r.amountCents,
              'currency': r.currency,
              'reason': r.reason,
            },
          )
          .toList(),
    };

    if (!connected) {
      final id = 'REQ-$draftId';
      final local = {
        ...payload,
        'id': id,
        'createdAt': now.toIso8601String(),
        'demo': isDemo,
        'recipients': [
          for (final (index, row) in requestPayers.indexed)
            {
              'id': '$id-$index',
              'name': row.name,
              'amountCents': row.amountCents,
              'currency': row.currency,
              'reason': row.reason,
              'status': isDemo ? 'Waiting for payment' : 'Created',
              'deliveryStatus': 'Created',
              'deliveryMessage':
                  'Local demo. Connect to create a shareable link.',
              if (isDemo)
                'settleAt':
                    now.millisecondsSinceEpoch +
                    3000 +
                    (index * 2600) +
                    now.millisecond,
            },
        ],
      };
      localRequests.insert(0, local);
      await saveLocalDemo();
      if (!mounted) return;
      final rec = ReimbursementRequest.fromJson(local);
      setState(() {
        reimbursements = [rec, ...reimbursements.where((r) => r.id != rec.id)];
        requestAttemptId = null;
        activeRequestId = rec.id;
        activeRequestQrRecId = rec.recipients.first.id;
        backendBusy = false;
        requestAttemptId = null;
        page = 'request-detail';
      });
      return;
    }

    try {
      final res = await backend('/api/organizer/requests', body: payload);
      final rec = ReimbursementRequest.fromJson(
        Map<String, dynamic>.from(res['request'] as Map),
      );
      if (!mounted) return;
      setState(() {
        reimbursements = [rec, ...reimbursements.where((r) => r.id != rec.id)];
        requestAttemptId = null;
        activeRequestId = rec.id;
        activeRequestQrRecId = rec.recipients.first.id;
        page = 'request-detail';
      });
      final outcomes = (res['deliveryOutcomes'] as List?) ?? [];
      if (outcomes.any((o) => (o as Map)['ok'] != true)) {
        showFeedback(
          'Created requests. Delivery gateway unconfigured — use Copy link or Show QR.',
        );
      }
    } catch (e) {
      if (mounted) showFeedback('Could not create requests: $e');
    } finally {
      if (mounted) setState(() => backendBusy = false);
    }
  }

  // ---------- SS-001 Merchant QR AI Split + Chatterbox ----------
  String? _parseStaticLampOwner(String text) {
    final lower = text.toLowerCase();
    final direct = names
        .where((n) => RegExp('\\b${n.toLowerCase()}\\b').hasMatch(lower))
        .toList();
    if (direct.length == 1) return direct.first;
    for (final sentence in lower.split(RegExp(r'[.;\n]'))) {
      if (!sentence.contains('lamp')) continue;
      final owners = names
          .where((n) => RegExp('\\b${n.toLowerCase()}\\b').hasMatch(sentence))
          .toList();
      if (owners.length == 1) return owners.first;
    }
    return null;
  }

  Future<void> prepareSplit() async {
    final text = instructionController.text.trim();
    if (staticPreview && !connected) {
      final owner = _parseStaticLampOwner(text);
      setState(() {
        if (owner != null) {
          lamp = owner;
          selected = owner;
          aiState = _AiState.idle;
          page = 'split';
        } else {
          aiState = _AiState.clarify;
          page = 'clarify';
        }
      });
      return;
    }
    if (!connected && _organizerKey.isEmpty) {
      go('welcome');
      return;
    }
    setState(() {
      aiState = _AiState.loading;
      aiError = '';
      page = 'split';
    });
    try {
      final res = await backend(
        '/api/organizer/suggest-split',
        body: {'instruction': text},
      );
      if (!mounted) return;
      final owner = res['lamp'];
      if (owner is String && names.contains(owner)) {
        setState(() {
          lamp = owner;
          selected = owner;
          aiState = _AiState.idle;
          serverParticipants = [];
        });
      } else {
        setState(() {
          aiState = _AiState.clarify;
          page = 'clarify';
        });
      }
    } on _ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        aiState = (e.statusCode == 502 || e.statusCode == 503)
            ? _AiState.unavailable
            : _AiState.error;
        aiError = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        aiState = _AiState.unavailable;
        aiError = 'DeepSeek provider unavailable. Retry or edit manually.';
      });
    }
  }

  Future<void> readSplitAloud() async {
    setState(() {
      ttsState = _TtsState.loading;
      ttsError = '';
    });
    if (!connected) {
      setState(() {
        ttsState = _TtsState.unavailable;
        ttsError =
            'Chatterbox audio requires the connected Node backend with NVIDIA_API_KEY.';
      });
      return;
    }
    try {
      final data = await backend(
        '/api/organizer/read-split',
        body: {'lamp': lamp},
      );
      final wav = base64Decode(data['audio'] as String);
      await playAudioBytes(wav);
      if (!mounted) return;
      setState(() => ttsState = _TtsState.ready);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        ttsState = _TtsState.unavailable;
        ttsError = e.toString();
      });
    }
  }

  Future<void> publishSplit() async {
    if (!connected) {
      setState(() {
        published = true;
        selected = lamp;
        page = 'requests';
      });
      return;
    }
    if (await syncLedger(publish: true)) {
      if (mounted) go('requests');
    }
  }

  Future<void> openPayerUrl(String? url) async {
    if (url == null) return;
    final launched = await launchUrl(Uri.parse(url));
    if (!launched && mounted) {
      showFeedback('Could not open browser. Copy the link instead.');
    }
  }

  // ---------- Responsive Layout Helpers ----------
  Widget twoPane(Widget left, Widget right) => LayoutBuilder(
    builder: (context, constraints) {
      final sideBySide = constraints.maxWidth >= 620;
      if (sideBySide) {
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: left),
            const SizedBox(width: 16),
            Expanded(child: right),
          ],
        );
      }
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [left, right],
      );
    },
  );

  Widget twoButtons(
    Widget first,
    Widget second, {
    int firstFlex = 1,
    int secondFlex = 1,
  }) => LayoutBuilder(
    builder: (context, constraints) {
      if (constraints.maxWidth < 300) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [first, const SizedBox(height: 10), second],
        );
      }
      return Row(
        children: [
          Expanded(flex: firstFlex, child: first),
          const SizedBox(width: 12),
          Expanded(flex: secondFlex, child: second),
        ],
      );
    },
  );

  Widget lineRow(String label, String value, {bool bold = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 7),
    child: LayoutBuilder(
      builder: (context, constraints) {
        final maxVal = constraints.maxWidth.isFinite
            ? constraints.maxWidth * 0.56
            : 220.0;
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                  color: bold ? SplitColors.navy : SplitColors.muted,
                ),
              ),
            ),
            const SizedBox(width: 10),
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxVal),
              child: Text(
                value,
                textAlign: TextAlign.end,
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  color: SplitColors.navy,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
            ),
          ],
        );
      },
    ),
  );

  Widget participantAvatar(String n) {
    final (bg, fg) = switch (n) {
      'Arun' => (SplitColors.tealBg, SplitColors.tealInk),
      'Leah' => (const Color(0xFFEAEFF8), SplitColors.navy),
      'Samir Patel' => (SplitColors.amberBg, SplitColors.amber),
      _ => (SplitColors.surfaceTint, SplitColors.primaryInk),
    };
    return CircleAvatar(
      radius: 18,
      backgroundColor: bg,
      child: Text(
        n.isEmpty ? '?' : n[0],
        style: TextStyle(color: fg, fontWeight: FontWeight.w800, fontSize: 13),
      ),
    );
  }

  Widget participantRow(String n, {bool showStatus = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 7),
    child: LayoutBuilder(
      builder: (context, constraints) {
        final stackPill = showStatus && constraints.maxWidth < 290;
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            participantAvatar(n),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    n,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: SplitColors.navy,
                    ),
                  ),
                  Text(
                    n == lamp
                        ? '\$40.00 shared + \$30.00 lamp'
                        : '\$40.00 shared essentials',
                    style: const TextStyle(
                      fontSize: 14,
                      color: SplitColors.muted,
                    ),
                  ),
                  if (stackPill) ...[
                    const SizedBox(height: 5),
                    SplitStatusPill(paymentStatus(n)),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  money(share(n)),
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: SplitColors.navy,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
                if (showStatus && !stackPill) ...[
                  const SizedBox(height: 3),
                  SplitStatusPill(paymentStatus(n)),
                ],
              ],
            ),
          ],
        );
      },
    ),
  );

  // ---------- Welcome / Sign-in Screen ----------
  Widget welcomeScreen() {
    final heroCard = Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: SplitColors.navy,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              paypalIcon(),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'PayPal Hackathon',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Text(
            'Scan bills, speak splits, settle with roommates.',
            style: TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w800,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Pay, request, and split shared expenses in one place.',
            style: TextStyle(color: Color(0xFFDCE1E8), fontSize: 16),
          ),
        ],
      ),
    );

    final signInCard = SplitCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Organizer sign-in',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 4),
          const Text('Enter the organizer key printed in the Node terminal.'),
          if (connectErrorMessage.isNotEmpty)
            SplitCallout(
              kind: CalloutKind.error,
              title: connectErrorKind == _ConnectErrorKind.invalidKey
                  ? 'Invalid organizer key'
                  : 'Backend unavailable',
              message: connectErrorMessage,
            ),
          const SizedBox(height: 14),
          SplitTextField(
            label: 'Organizer access key',
            hintText: 'Paste organizer key from terminal',
            controller: organizerKeyController,
            obscureText: obscureKey,
            prefixIcon: Icons.vpn_key_outlined,
            onToggleObscure: () => setState(() => obscureKey = !obscureKey),
            onSubmitted: (_) => signInOrganizer(),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () =>
                  setState(() => showBackendConfig = !showBackendConfig),
              child: Text(
                showBackendConfig
                    ? 'Hide server settings'
                    : 'Backend URL settings',
              ),
            ),
          ),
          if (showBackendConfig)
            SplitTextField(
              label: 'Backend origin URL',
              hintText: 'http://localhost:3000',
              controller: originController,
              prefixIcon: Icons.dns_outlined,
            ),
          const SizedBox(height: 12),
          SplitPrimaryButton(
            label: backendBusy ? 'Connecting…' : 'Sign in as organizer',
            onPressed: backendBusy ? null : signInOrganizer,
          ),
          const SizedBox(height: 8),
          Center(
            child: TextButton(
              onPressed: () => setState(() {
                staticPreview = true;
                connected = false;
                page = 'home';
              }),
              child: const Text(
                'Explore static preview (no server)',
                style: TextStyle(
                  color: Color(0xFFC62839),
                  fontWeight: FontWeight.w800,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ),
        ],
      ),
    );

    return twoPane(heroCard, signInCard);
  }

  // ---------- Tab 1: Home (PhonePe Action-First Payment Hub) ----------
  Widget homeAction({
    required String label,
    required IconData icon,
    required VoidCallback? onTap,
    String subtitle = '',
    bool primary = false,
    bool compact = false,
  }) {
    final theme = Theme.of(context);
    final ink = primary ? Colors.white : SplitColors.navy;
    final radius = BorderRadius.circular(20);
    final iconBox = DecoratedBox(
      decoration: BoxDecoration(
        color: primary ? const Color(0xFF235BDC) : SplitColors.surfaceTint,
        borderRadius: BorderRadius.circular(14),
      ),
      child: SizedBox.square(
        dimension: primary ? 60 : 46,
        child: Icon(
          icon,
          size: primary ? 34 : 24,
          color: primary ? Colors.white : SplitColors.primaryInk,
        ),
      ),
    );
    final copy = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style:
              (primary
                      ? theme.textTheme.headlineSmall
                      : theme.textTheme.titleMedium)
                  ?.copyWith(color: ink),
        ),
        if (subtitle.isNotEmpty) ...[
          const SizedBox(height: 3),
          Text(
            subtitle,
            style: theme.textTheme.bodySmall?.copyWith(
              color: primary ? const Color(0xFFDCE8FF) : SplitColors.muted,
            ),
          ),
        ],
      ],
    );
    return Semantics(
      button: true,
      child: Material(
        color: primary ? const Color(0xFF103693) : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: radius,
          side: BorderSide(
            color: primary ? Colors.transparent : SplitColors.line,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: EdgeInsets.all(primary ? 20 : 16),
            child: compact
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [iconBox, const SizedBox(height: 10), copy],
                  )
                : Row(
                    children: [
                      iconBox,
                      const SizedBox(width: 14),
                      Expanded(child: copy),
                      const SizedBox(width: 8),
                      Icon(Icons.arrow_forward_rounded, color: ink),
                    ],
                  ),
          ),
        ),
      ),
    );
  }

  Widget homeScreen() {
    final latest = activityRows().take(3).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            paypalIcon(size: 42),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'PayPal Hackathon',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            const SizedBox(width: 8),
            const SplitBadge('Practice mode', preview: true),
          ],
        ),
        const SizedBox(height: 24),
        Text('Hello, Leah', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 6),
        const Text('Pay a QR code, send money, or split a bill.'),
        const SizedBox(height: 20),
        homeAction(
          label: 'Scan & pay',
          subtitle: 'Scan a payment QR code',
          icon: Icons.qr_code_scanner_rounded,
          primary: true,
          onTap: () {
            linkController.clear();
            go('scan');
          },
        ),
        const SizedBox(height: 10),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: homeAction(
                label: 'Send money',
                icon: Icons.north_east_rounded,
                compact: true,
                onTap: () => openContactPayment(send: true),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: homeAction(
                label: 'Request money',
                icon: Icons.south_west_rounded,
                compact: true,
                onTap: () => openContactPayment(send: false),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        homeAction(
          label: 'Ask AI',
          subtitle: 'Draft a payment in your own words',
          icon: Icons.mic_none_rounded,
          onTap: () => go('talk'),
        ),
        const SizedBox(height: 26),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Latest activity',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  TextButton(
                    onPressed: () => go('activity'),
                    child: const Text('See all'),
                  ),
                ],
              ),
              if (latest.isEmpty) const Text('No activity yet.'),
              for (final row in latest) activityTile(row),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final contact
                  in contacts.where((c) => c.id != 'leah').take(5))
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ActionChip(
                    label: Text(
                      '${contact.flag} ${contact.name} · ${contact.currency}',
                    ),
                    onPressed: () =>
                        openContactPayment(send: true, contact: contact),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Text('Household', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        _shortcutTile(
          Icons.calendar_today_outlined,
          'Rent',
          'Create rent request',
          () {
            resetRent();
            go('rent');
          },
        ),
        const SizedBox(height: 8),
        _shortcutTile(
          Icons.people_outline,
          'Split expense',
          'Create a shared request',
          () => go('talk'),
        ),
        const SizedBox(height: 8),
        _shortcutTile(
          Icons.receipt_long_outlined,
          'Scan bill',
          'Capture a receipt',
          openReceiptCamera,
        ),
      ],
    );
  }

  List<
    ({
      String title,
      String date,
      String amount,
      String status,
      VoidCallback open,
    })
  >
  activityRows() {
    final rows = [
      for (final transfer in demoTransfers)
        (
          title: '${transfer['flag'] ?? ''} ${transfer['recipientName']}'
              .trim(),
          date: transfer['createdAt'] as String,
          amount: currencyAmount(
            transfer['sourceAmountCents'] as int,
            transfer['sourceCurrency'] as String,
          ),
          status: 'Practice transfer',
          open: () {
            activeTransfer = transfer;
            go('transfer-receipt');
          },
        ),
      for (final request in reimbursements)
        for (final r in request.recipients)
          (
            title: '${r.name} · ${request.title}',
            date: request.createdAt,
            amount: currencyAmount(r.amountCents, r.currency),
            status: displayRequestStatus(request, r),
            open: () {
              activeRequestId = request.id;
              activeRequestQrRecId = r.id;
              go('request-detail');
            },
          ),
      if (merchantOpened)
        (
          title: 'Sandbox Merchant · Sandbox',
          date: '',
          amount: '150.00 USD',
          status: paidPeople == 3 ? 'Paid' : 'Awaiting payment',
          open: () => go('dashboard'),
        ),
    ];
    rows.sort((a, b) => b.date.compareTo(a.date));
    return rows;
  }

  String displayRequestStatus(
    ReimbursementRequest request,
    ReimbursementRecipient r,
  ) => request.demo && (r.status == 'Paid' || r.status == 'Payment received')
      ? 'Payment received'
      : r.status;

  Widget paymentTile({
    required String name,
    String? detail,
    String? amount,
    Widget? leading,
    VoidCallback? onTap,
  }) {
    final type = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: SplitColors.surfaceTint,
        borderRadius: BorderRadius.circular(16),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 76),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              child: Row(
                children: [
                  if (leading != null) ...[leading, const SizedBox(width: 12)],
                  Expanded(
                    flex: 3,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(name, style: type.titleMedium),
                        if (detail != null && detail.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(detail, style: type.bodySmall),
                        ],
                      ],
                    ),
                  ),
                  if (amount != null) ...[
                    const SizedBox(width: 12),
                    Flexible(
                      flex: 2,
                      child: Text(
                        amount,
                        textAlign: TextAlign.end,
                        style: type.titleMedium,
                      ),
                    ),
                  ] else if (onTap != null) ...[
                    const SizedBox(width: 8),
                    const Icon(Icons.chevron_right_rounded),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget activityTile(
    ({
      String title,
      String date,
      String amount,
      String status,
      VoidCallback open,
    })
    row,
  ) => paymentTile(
    name: row.title,
    detail: [
      row.date.split('T').first,
      row.status,
    ].where((value) => value.isNotEmpty).join(' · '),
    amount: row.amount,
    onTap: row.open,
  );

  Widget _shortcutTile(
    IconData icon,
    String title,
    String sub,
    VoidCallback onTap,
  ) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(14),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: SplitColors.line),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: SplitColors.surfaceTint,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: SplitColors.primaryInk, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: SplitColors.navy,
                      fontSize: 15,
                    ),
                  ),
                  Text(
                    sub,
                    style: const TextStyle(
                      fontSize: 14,
                      color: SplitColors.muted,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );

  // ---------- Tab 2: Activity & Request Detail ----------
  Widget activityScreen() {
    const filters = [
      'All',
      'Waiting for payment',
      'Payment received',
      'Practice transfer',
      'Awaiting payment',
      'Paid',
    ];
    final query = activitySearch.text.toLowerCase().trim();
    final rows = activityRows()
        .where(
          (row) =>
              (activityFilter == 'All' || row.status == activityFilter) &&
              '${row.title} ${row.amount} ${row.date}'.toLowerCase().contains(
                query,
              ),
        )
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Activity',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
            ),
            if (connected)
              IconButton(
                onPressed: () => syncLedger(),
                icon: const Icon(Icons.refresh),
                tooltip: 'Refresh activity',
              ),
          ],
        ),
        const SizedBox(height: 10),
        SplitTextField(
          label: 'Search activity',
          controller: activitySearch,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 6,
          children: [
            for (final filter in filters)
              ChoiceChip(
                label: Text(filter),
                selected: activityFilter == filter,
                onSelected: (_) => setState(() => activityFilter = filter),
              ),
          ],
        ),
        const SizedBox(height: 12),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (rows.isEmpty) const Text('No matching activity.'),
              for (final row in rows) activityTile(row),
            ],
          ),
        ),
      ],
    );
  }

  Widget requestDetailScreen() {
    final req = reimbursements
        .where((r) => r.id == activeRequestId)
        .firstOrNull;
    if (req == null) {
      return Column(
        children: [
          SplitScreenHeader(
            title: 'Request not found',
            onBack: () => go('activity'),
          ),
          SplitCard(
            child: SplitPrimaryButton(
              label: 'Back to Activity',
              onPressed: () => go('activity'),
            ),
          ),
        ],
      );
    }
    final activeRec =
        req.recipients.where((r) => r.id == activeRequestQrRecId).firstOrNull ??
        req.recipients.firstOrNull;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: req.title,
          subtitle:
              '${req.id} · ${req.recipients.where((r) => !['Paid', 'Payment received'].contains(r.status)).length} pending',
          onBack: () => go('activity'),
          trailing: SplitBadge(
            req.demo ? 'Practice mode' : 'Reimbursement',
            preview: true,
          ),
        ),
        twoPane(
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Receipt evidence',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 10),
                if (req.evidenceDataUrl.contains(','))
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.memory(
                      base64Decode(req.evidenceDataUrl.split(',').last),
                      height: 180,
                      width: double.infinity,
                      fit: BoxFit.contain,
                    ),
                  ),
                const SizedBox(height: 10),
                ...req.items.map(
                  (i) => lineRow(
                    i.name,
                    currencyAmount(i.amountCents, req.currency),
                  ),
                ),
                if (req.taxCents > 0)
                  lineRow('Tax', currencyAmount(req.taxCents, req.currency)),
                if (req.tipCents > 0)
                  lineRow('Tip', currencyAmount(req.tipCents, req.currency)),
                const Divider(height: 18, color: SplitColors.line),
                lineRow(
                  'Bill total',
                  currencyAmount(req.totalCents, req.currency),
                  bold: true,
                ),
                if (req.ownShareCents > 0)
                  lineRow(
                    'Your share',
                    currencyAmount(req.ownShareCents, req.currency),
                    bold: true,
                  ),
                const SplitCallout(
                  message:
                      'Photographed receipt evidence creates peer reimbursement links. Commercial PayPal Orders v2 checkout applies only to Sandbox Merchant SS-001.',
                ),
              ],
            ),
          ),
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Recipients (${req.recipients.length})',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 10),
                ...req.recipients.map(
                  (r) => Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: r.deliveryStatus == 'Failed'
                            ? const Color(0xFFF4DA9C)
                            : SplitColors.line,
                      ),
                      color: r.deliveryStatus == 'Failed'
                          ? SplitColors.amberBg.withValues(alpha: 0.4)
                          : Colors.white,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            participantAvatar(r.name),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${r.name} ${r.status == 'Paid' || r.status == 'Payment received' ? 'paid' : 'owes'} ${currencyAmount(r.amountCents, r.currency)}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  Text(
                                    'Reason: ${r.reason}',
                                    style: const TextStyle(
                                      fontSize: 14,
                                      color: SplitColors.muted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            SplitStatusPill(displayRequestStatus(req, r)),
                            if (r.deliveryStatus == 'Failed')
                              const SplitStatusPill('Failed'),
                            if (r.receiptRef != null)
                              Text('Receipt ${r.receiptRef}'),
                          ],
                        ),
                        if (r.deliveryMessage.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            r.deliveryMessage,
                            style: const TextStyle(fontSize: 14),
                          ),
                        ],
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            if (r.shareUrl.isNotEmpty)
                              Builder(
                                builder: (context) => ActionChip(
                                  label: const Text('Share'),
                                  onPressed: () async {
                                    final box =
                                        context.findRenderObject()
                                            as RenderBox?;
                                    await SharePlus.instance.share(
                                      ShareParams(
                                        uri: Uri.parse(r.shareUrl),
                                        sharePositionOrigin: box == null
                                            ? null
                                            : box.localToGlobal(Offset.zero) &
                                                  box.size,
                                      ),
                                    );
                                  },
                                ),
                              ),
                            if (r.shareUrl.isNotEmpty)
                              ActionChip(
                                label: const Text('Copy link'),
                                onPressed: () {
                                  Clipboard.setData(
                                    ClipboardData(text: r.shareUrl),
                                  );
                                  showFeedback(
                                    '${r.name}’s request link copied',
                                  );
                                },
                              ),
                            if (r.shareUrl.isNotEmpty)
                              ActionChip(
                                label: const Text('Show QR'),
                                onPressed: () =>
                                    setState(() => activeRequestQrRecId = r.id),
                              ),
                            ActionChip(
                              label: Text(
                                r.shareUrl.isEmpty
                                    ? 'View receipt'
                                    : 'Open share',
                              ),
                              onPressed: () => setState(() {
                                payerReimbRequest = req;
                                payerReimbRecipient = r;
                                page = 'reimbursement-payer';
                              }),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                if (activeRec != null && activeRec.shareUrl.isNotEmpty) ...[
                  const Divider(height: 20, color: SplitColors.line),
                  Center(
                    child: Column(
                      children: [
                        QrImageView(data: activeRec.shareUrl, size: 128),
                        const SizedBox(height: 6),
                        Text(
                          '${activeRec.name} · ${currencyAmount(activeRec.amountCents, activeRec.currency)} (${activeRec.reason})',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget reimbursementPayerScreen() {
    final req = payerReimbRequest;
    final rec = payerReimbRecipient;
    if (req == null || rec == null) {
      return SplitCard(
        child: SplitPrimaryButton(
          label: 'Return home',
          onPressed: () => go('home'),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title:
              '${req.demo ? 'Practice request' : 'Reimbursement'} · ${currencyAmount(rec.amountCents, rec.currency)}',
          subtitle: 'From Leah for ${rec.reason}',
          onBack: () => go('request-detail'),
          trailing: SplitStatusPill(displayRequestStatus(req, rec)),
        ),
        twoPane(
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Bill evidence · ${req.merchant}',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 10),
                if (req.evidenceDataUrl.contains(','))
                  Image.memory(
                    base64Decode(req.evidenceDataUrl.split(',').last),
                    height: 150,
                    fit: BoxFit.contain,
                  ),
                ...req.items.map(
                  (i) => lineRow(i.name, centsStr(i.amountCents)),
                ),
                const Divider(height: 16, color: SplitColors.line),
                lineRow('Bill total', centsStr(req.totalCents), bold: true),
              ],
            ),
          ),
          SplitCard(
            color: SplitColors.surfaceTint,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                lineRow('Recipient', rec.name),
                lineRow('Reason', rec.reason),
                lineRow(
                  'Amount requested',
                  currencyAmount(rec.amountCents, rec.currency),
                  bold: true,
                ),
                SplitCallout(
                  message: req.demo
                      ? 'Practice request with simulated settlement. No money moves.'
                      : 'Personal receipt reimbursement link. PayPal Sandbox merchant checkout applies to Sandbox Merchant SS-001.',
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ---------- Scan Bill -> Crop -> Extract -> Voice -> Confirm ----------
  Widget scanBillScreen() {
    final theme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SplitScreenHeader(
          title: 'Scan bill',
          subtitle: 'Add a receipt to split an expense.',
          onBack: () => go('home'),
        ),
        if (capturingReceipt) ...[
          const LinearProgressIndicator(),
          const SizedBox(height: 12),
        ],
        SplitCard(
          color: SplitColors.navyDeep,
          borderColor: SplitColors.navyDeep,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFF235BDC),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(
                  Icons.receipt_long_rounded,
                  size: 32,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Add a receipt photo',
                style: theme.headlineSmall?.copyWith(color: Colors.white),
              ),
              const SizedBox(height: 6),
              Text(
                'Keep the merchant, line items, and total in the frame.',
                style: theme.bodyMedium?.copyWith(
                  color: const Color(0xFFDCE8FF),
                ),
              ),
              const SizedBox(height: 20),
              SplitPrimaryButton(
                leadingIcon: Icons.camera_alt_outlined,
                label: 'Open camera',
                onPressed: capturingReceipt
                    ? null
                    : () => captureReceipt(ImageSource.camera, inline: false),
              ),
            ],
          ),
        ),
        LayoutBuilder(
          builder: (context, constraints) {
            final actions = [
              homeAction(
                label: 'Upload photo',
                icon: Icons.upload_file_rounded,
                onTap: capturingReceipt
                    ? null
                    : () => captureReceipt(ImageSource.gallery, inline: false),
              ),
              homeAction(
                label: 'Enter manually',
                icon: Icons.edit_note_rounded,
                onTap: capturingReceipt
                    ? null
                    : () {
                        setState(() {
                          clearReceipt();
                          billExtractState = 'ready';
                        });
                        go('bill-review');
                      },
              ),
            ];
            if (constraints.maxWidth >= 600) {
              return Row(
                children: [
                  Expanded(child: actions[0]),
                  const SizedBox(width: 12),
                  Expanded(child: actions[1]),
                ],
              );
            }
            return Column(
              children: [actions[0], const SizedBox(height: 12), actions[1]],
            );
          },
        ),
        const SizedBox(height: 12),
        homeAction(
          label: 'Use sample receipt',
          icon: Icons.receipt_outlined,
          onTap: capturingReceipt ? null : openBundledSampleReceipt,
        ),
      ],
    );
  }

  Future<void> extractCroppedReceipt() async {
    if (croppingReceipt) return;
    final raw = billRawPng;
    if (raw != null &&
        !identical(raw, _fallbackPngBytes) &&
        widget.enableLiveCamera &&
        (cropTop > 0 || cropBottom > 0)) {
      setState(() => croppingReceipt = true);
      try {
        await WidgetsBinding.instance.endOfFrame;
        if (!mounted || page != 'bill-crop' || !identical(billRawPng, raw)) {
          return;
        }
        final codec = await ui.instantiateImageCodec(raw);
        final image = (await codec.getNextFrame()).image;
        codec.dispose();
        final top = (image.height * cropTop).round();
        final height = max(
          1,
          image.height - top - (image.height * cropBottom).round(),
        );
        final recorder = ui.PictureRecorder();
        final canvas = Canvas(recorder);
        final bounds = Rect.fromLTWH(
          0,
          0,
          image.width.toDouble(),
          height.toDouble(),
        );
        canvas.drawImageRect(
          image,
          bounds.shift(Offset(0, top.toDouble())),
          bounds,
          Paint(),
        );
        final picture = recorder.endRecording();
        final cropped = await picture.toImage(image.width, height);
        picture.dispose();
        image.dispose();
        final png = await cropped.toByteData(format: ui.ImageByteFormat.png);
        cropped.dispose();
        if (!mounted || page != 'bill-crop' || !identical(billRawPng, raw)) {
          return;
        }
        if (png != null && png.lengthInBytes < 1200000) {
          setState(() => billRawPng = png.buffer.asUint8List());
        } else {
          showFeedback('The crop is too large. Choose a smaller photo.');
          return;
        }
      } catch (_) {
        if (mounted) showFeedback('This image could not be cropped.');
        return;
      } finally {
        if (mounted) setState(() => croppingReceipt = false);
      }
    }
    if (mounted) await extractBillDetails();
  }

  Widget billCropScreen() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: 'Crop or retake bill',
          onBack: () => go('scan-bill'),
        ),
        twoPane(
          SplitCard(
            child:
                billRawPng != null &&
                    !identical(billRawPng, _fallbackPngBytes) &&
                    billRawPng!.isNotEmpty
                ? ClipRect(
                    child: Align(
                      alignment: Alignment.center,
                      heightFactor: (1 - (cropTop + cropBottom)).clamp(
                        0.4,
                        1.0,
                      ),
                      child: Image.memory(
                        billRawPng!,
                        height: 260,
                        fit: BoxFit.contain,
                      ),
                    ),
                  )
                : const SizedBox(
                    height: 200,
                    child: Center(child: Text('Olive Kitchen sample receipt')),
                  ),
          ),
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Adjust crop frame',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                Slider(
                  value: cropTop,
                  min: 0,
                  max: 0.3,
                  label: 'Top ${(cropTop * 100).round()}%',
                  onChanged: croppingReceipt
                      ? null
                      : (v) => setState(() => cropTop = v),
                ),
                Slider(
                  value: cropBottom,
                  min: 0,
                  max: 0.3,
                  label: 'Bottom ${(cropBottom * 100).round()}%',
                  onChanged: croppingReceipt
                      ? null
                      : (v) => setState(() => cropBottom = v),
                ),
                twoButtons(
                  SplitSecondaryButton(
                    label: 'Retake photo',
                    onPressed: croppingReceipt ? null : openReceiptCamera,
                  ),
                  SplitPrimaryButton(
                    label: croppingReceipt
                        ? 'Preparing photo…'
                        : 'Extract bill details',
                    onPressed: croppingReceipt ? null : extractCroppedReceipt,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget billReviewScreen() {
    final theme = Theme.of(context).textTheme;
    final photo = billRawPng;
    final hasPhoto = photo != null && !identical(photo, _fallbackPngBytes);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: 'Review receipt',
          subtitle: 'Check the details before you split the bill.',
          onBack: () => go('scan-bill'),
        ),
        if (billExtractState == 'loading')
          SplitCard(
            color: SplitColors.surfaceTint,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Reading your receipt…', style: theme.titleLarge),
                const SizedBox(height: 16),
                const LinearProgressIndicator(),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => setState(() {
                    receiptExtraction++;
                    billExtractState = 'ready';
                  }),
                  child: const Text('Enter details manually'),
                ),
              ],
            ),
          )
        else
          twoPane(
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SplitCard(
                  color: SplitColors.surfaceTint,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Receipt total', style: theme.titleMedium),
                      const SizedBox(height: 4),
                      ValueListenableBuilder<TextEditingValue>(
                        valueListenable: billTotalController,
                        builder: (context, value, _) => Text(
                          value.text.trim().isEmpty
                              ? 'Enter an amount'
                              : currencyAmount(
                                  billDraft.totalCents,
                                  billDraft.currency,
                                ),
                          style: theme.headlineMedium,
                        ),
                      ),
                    ],
                  ),
                ),
                if (hasPhoto)
                  SplitCard(
                    padding: const EdgeInsets.all(12),
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.memory(
                          photo,
                          width: 48,
                          height: 48,
                          cacheHeight: 128,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) =>
                              const Icon(Icons.receipt_long_outlined),
                        ),
                      ),
                      title: const Text('Receipt photo'),
                      trailing: const Icon(Icons.open_in_full_rounded),
                      onTap: () => showDialog<void>(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: const Text('Receipt photo'),
                          content: SizedBox(
                            width: 480,
                            height: MediaQuery.sizeOf(context).height * 0.55,
                            child: InteractiveViewer(
                              child: Image.memory(photo, fit: BoxFit.contain),
                            ),
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(context),
                              child: const Text('Close'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SplitCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Receipt details', style: theme.titleLarge),
                      const SizedBox(height: 12),
                      receiptFields(),
                    ],
                  ),
                ),
                Wrap(
                  spacing: 12,
                  runSpacing: 4,
                  children: [
                    if (hasPhoto)
                      TextButton.icon(
                        onPressed: () => go('bill-crop'),
                        icon: const Icon(Icons.crop_rounded),
                        label: const Text('Crop photo'),
                      ),
                    TextButton.icon(
                      onPressed: openReceiptCamera,
                      icon: const Icon(Icons.camera_alt_outlined),
                      label: const Text('Retake photo'),
                    ),
                  ],
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget receiptReviewAction() => Material(
    color: Colors.white,
    child: SafeArea(
      top: false,
      child: Center(
        heightFactor: 1,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 10, 18, 12),
            child: SplitPrimaryButton(
              label: 'Split in Ask AI',
              onPressed: attachToAsk,
            ),
          ),
        ),
      ),
    ),
  );

  final speech = SpeechToText();
  final askMessages = <({bool user, String text})>[];
  final askInput = TextEditingController();
  bool askBusy = false;
  bool voiceEnabled = true;
  bool askSend = false;
  final askScroll = ScrollController();

  void scrollToAskDraft() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || page != 'talk' || !askScroll.hasClients) return;
      askScroll.jumpTo(askScroll.position.maxScrollExtent);
    });
  }

  bool sendReady = false;
  final editingAskRows = <RecipientDraft>{};
  bool transferFromAsk = false;
  String? groupAttemptId;
  List<Map<String, dynamic>> groupReceipt = [];

  bool get validPaymentDraft =>
      recipientDrafts.isNotEmpty &&
      recipientDrafts.length <= 20 &&
      recipientDrafts.map((r) => r.contactId).toSet().length ==
          recipientDrafts.length &&
      recipientDrafts.every(
        (r) =>
            r.known &&
            !r.ambiguous &&
            r.amountCents > 0 &&
            r.amountCents <= 100000000 &&
            fxRates.containsKey(r.currency) &&
            contacts.any((c) => c.id == r.contactId),
      );

  void clearPaymentDraft() {
    recipientDrafts = [];
    editingAskRows.clear();
    sendReady = false;
    askSend = false;
    groupAttemptId = null;
    transferFromAsk = false;
    transferAttemptId = null;
  }

  bool speechReady = false;
  int micEpoch = 0;
  bool browserRecording = false;
  bool capturingReceipt = false;
  bool receiptAttached = false;
  String voiceStatus = '';
  Uint8List? replyAudio;
  int voiceEpoch = 0;
  int turnEpoch = 0;
  StreamSubscription<void>? audioComplete;

  void stopVoice({bool clear = true}) {
    voiceEpoch++;
    if (audioComplete != null) unawaited(audioComplete!.cancel());
    audioComplete = null;
    if (_audio != null) unawaited(_audio!.stop().catchError((Object _) {}));
    if (clear) replyAudio = null;
    voiceStatus = '';
  }

  void cancelAskMic() {
    micEpoch++;
    if (browserRecording) cancelBrowserRecording();
    browserRecording = false;
    if (speech.isListening) unawaited(speech.cancel());
    micState = _MicState.idle;
    micError = '';
  }

  Future<void> recordAskSpeech() async {
    if (micState == _MicState.listening) {
      if (browserRecording) {
        stopBrowserRecording();
        return;
      }
      await speech.stop();
      if (mounted) setState(() => micState = _MicState.idle);
      return;
    }
    if (micState == _MicState.transcribing) return;
    final epoch = ++micEpoch;
    var expectedText = askInput.text;
    bool current() => mounted && page == 'talk' && epoch == micEpoch;
    void putTranscript(String text) {
      if (askInput.text == expectedText && text.trim().isNotEmpty) {
        askInput.text = text.trim();
        expectedText = askInput.text;
      }
    }

    setState(() {
      stopVoice(clear: false);
      micState = _MicState.listening;
      micError = '';
    });
    try {
      if (widget.onDictateSpeech != null) {
        final spoken = await widget.onDictateSpeech!();
        if (!current()) return;
        setState(() {
          if (spoken != null) putTranscript(spoken);
          micState = _MicState.idle;
        });
        return;
      }
      if (kIsWeb && connected) {
        browserRecording = true;
        final recording = await startBrowserRecording();
        if (!current()) return;
        browserRecording = false;
        if (recording.isEmpty) {
          setState(() => micState = _MicState.idle);
          return;
        }
        setState(() => micState = _MicState.transcribing);
        final response = await backend(
          '/api/organizer/transcribe',
          timeout: const Duration(seconds: 35),
          body: Map<String, dynamic>.from(jsonDecode(recording) as Map),
        );
        if (!current()) return;
        final transcript = response['transcript']?.toString() ?? '';
        setState(() {
          putTranscript(transcript);
          micState = _MicState.idle;
          if (transcript.trim().isEmpty) {
            micError = 'No speech detected. Try again.';
          }
        });
        return;
      }
      speechReady =
          speechReady ||
          await speech.initialize(
            onStatus: (status) {
              if (mounted &&
                  page == 'talk' &&
                  (status == 'done' || status == 'notListening')) {
                setState(() => micState = _MicState.idle);
              }
            },
            onError: (_) {
              if (mounted && page == 'talk') {
                setState(() {
                  micState = _MicState.unavailable;
                  micError = kIsWeb
                      ? 'Connect in Profile to use the microphone in this browser.'
                      : 'Speech recognition unavailable.';
                });
              }
            },
          );
      if (!current()) return;
      if (!speechReady) throw StateError('Speech unavailable');
      await speech.listen(
        onResult: (result) {
          if (!current()) return;
          setState(() {
            putTranscript(result.recognizedWords);
            if (result.finalResult) micState = _MicState.idle;
          });
        },
      );
    } catch (_) {
      if (current()) {
        setState(() {
          browserRecording = false;
          final transcribing = micState == _MicState.transcribing;
          micState = _MicState.unavailable;
          micError = transcribing
              ? 'Could not transcribe this recording. Try again.'
              : kIsWeb && !connected
              ? 'Connect in Profile to use the microphone in this browser.'
              : 'Microphone unavailable. Check browser or device permissions.';
        });
      }
    }
  }

  Map<String, dynamic> draftJson(RecipientDraft row) => {
    'name': row.name,
    'contactId': row.contactId,
    'known': row.known,
    'amountCents': row.amountCents,
    'currency': row.currency,
    'reason': row.reason,
  };

  Future<void> submitAsk() async {
    final message = askInput.text.trim();
    if (message.isEmpty || askBusy) return;
    final epoch = ++turnEpoch;
    setState(() {
      stopVoice();
      cancelAskMic();
      askInput.clear();
      askMessages.add((user: true, text: message));
      askBusy = true;
      sendReady = false;
    });
    final equalRows = receiptAttached
        ? equalReceiptDraft(message, billDraft, contacts)
        : null;
    Map<String, dynamic>? parsed;
    if (connected && equalRows == null) {
      try {
        parsed = await backend(
          '/api/organizer/parse-request',
          body: {
            'transcript': message,
            'bill': receiptAttached
                ? {
                    'merchant': billDraft.merchant,
                    'totalCents': billDraft.totalCents,
                    'currency': billDraft.currency,
                    'items': billDraft.items
                        .map((item) => item.toJson())
                        .toList(),
                  }
                : null,
            'currentDraft': recipientDrafts.map(draftJson).toList(),
            'lastIntent': askSend ? 'send' : 'request',
          },
        );
      } catch (_) {
        // The same draft stays editable if the connected parser is unavailable.
      }
    }
    if (!mounted || page != 'talk' || epoch != turnEpoch) return;
    var rows =
        equalRows ??
        (parsed?['recipients'] is List
            ? (parsed!['recipients'] as List)
                  .map(
                    (r) => RecipientDraft.fromJson(
                      Map<String, dynamic>.from(r as Map),
                    ),
                  )
                  .toList()
            : parseStaticTranscript(message, contacts));
    var resolvedContact = false;
    if (parsed == null &&
        rows.isEmpty &&
        recipientDrafts.where((r) => !r.known).length == 1) {
      final matches = contacts
          .where(
            (c) =>
                c.name.toLowerCase() ==
                message.toLowerCase().replaceAll(RegExp(r'[.!?]'), '').trim(),
          )
          .toList();
      if (matches.length == 1) {
        final contact = matches.single;
        resolvedContact = true;
        rows.addAll(
          recipientDrafts.map(
            (r) => r.known
                ? r
                : RecipientDraft(
                    name: contact.name,
                    contactId: contact.id,
                    known: true,
                    amountCents: r.amountCents,
                    currency: r.currency,
                    reason: r.reason,
                  ),
          ),
        );
      }
    }
    if (parsed == null &&
        rows.length == 1 &&
        recipientDrafts.isNotEmpty &&
        !rows.single.known &&
        rows.single.name == 'Unknown contact' &&
        RegExp(
          r'^(make it|change it to|actually|\d|\$)',
          caseSensitive: false,
        ).hasMatch(message) &&
        recipientDrafts.length == 1) {
      final prior = recipientDrafts.single;
      rows.single
        ..name = prior.name
        ..contactId = prior.contactId
        ..known = prior.known
        ..ambiguous = !prior.known || rows.single.amountCents <= 0
        ..currency = prior.currency
        ..reason = prior.reason;
    }
    final intentMessage = message.toLowerCase();
    final explicitIntent = RegExp(
      r'\b(send|pay|transfer|give|request|charge|owes?|split|ask(?=\s+\w+\s+for\b))\b',
    ).firstMatch(intentMessage)?.group(1);
    final send = explicitIntent == null
        ? (recipientDrafts.isNotEmpty ? askSend : parsed?['intent'] == 'send')
        : const {'send', 'pay', 'transfer', 'give'}.contains(explicitIntent);
    final replace =
        equalRows != null ||
        RegExp(
          r'\b(start over|replace (?:the |this )?draft|only (?:send|pay|give|request|charge))\b',
        ).hasMatch(intentMessage);
    final isFollowUp = !replace && send == askSend;
    final foundRecipients = rows.isNotEmpty;
    if (isFollowUp && !resolvedContact) {
      rows = mergeRecipientDrafts(recipientDrafts, rows);
    }
    final clarify =
        parsed?['needsClarification'] == true ||
        !foundRecipients ||
        rows.length > 20 ||
        rows.any(
          (r) =>
              !r.known ||
              r.ambiguous ||
              r.amountCents <= 0 ||
              r.amountCents > 100000000 ||
              !fxRates.containsKey(r.currency),
        );
    final target = rows.length == 1
        ? contacts.where((c) => c.id == rows.single.contactId).firstOrNull
        : null;
    final quote = !clarify && send && target != null ? rows.single : null;
    String reply;
    if (clarify) {
      final prompt = parsed?['clarificationPrompt']?.toString().trim() ?? '';
      reply = prompt.isEmpty
          ? 'Which contact and amount should I use?'
          : prompt;
    } else if (quote != null) {
      final targetCurrency = fxRates.containsKey(target!.currency)
          ? target.currency
          : 'USD';
      final estimate = convertCents(
        quote.amountCents,
        quote.currency,
        targetCurrency,
      );
      final fx = quote.currency == targetCurrency
          ? ''
          : ' Estimated receipt: ${currencyAmount(estimate, targetCurrency)}.';
      reply =
          'Send ${currencyAmount(quote.amountCents, quote.currency)} to ${target.name}.$fx Verify the recipient and amount before you pay.';
    } else if (send) {
      reply =
          'Your draft has ${rows.length} payments. Add another person or review the payments when you’re ready.';
    } else {
      final payers = rows.where((row) => row.contactId != 'leah').toList();
      final details = payers
          .take(3)
          .map(
            (row) =>
                '${row.name} owes ${currencyAmount(row.amountCents, row.currency)}',
          )
          .join(', ');
      reply = details.isEmpty
          ? 'Choose someone to request money from.'
          : '$details${payers.length > 3 ? ', and ${payers.length - 3} more' : ''}. Ready to review the requests?';
    }
    if (reply.length > 390) reply = '${reply.substring(0, 387)}…';
    setState(() {
      askBusy = false;
      requestAttemptId = null;
      askSend = send;
      sendReady = send && !clarify;
      if (foundRecipients || !isFollowUp) recipientDrafts = rows;
      editingAskRows.retainAll(recipientDrafts);
      groupAttemptId = null;
      askMessages.add((user: false, text: reply));
      if (quote != null) {
        transferAttemptId = null;
        prepareAskTransfer(quote);
      }
    });
    if (voiceEnabled) {
      unawaited(speakAskReply(reply, advance: quote != null));
    } else if (quote != null) {
      go('review-transfer');
    }
    if (quote == null) scrollToAskDraft();
  }

  Future<void> speakAskReply(String reply, {bool advance = false}) async {
    if (!connected) {
      if (advance && mounted && page == 'talk') {
        go('review-transfer');
      } else if (mounted) {
        setState(() => voiceStatus = 'Connect in Profile for spoken replies.');
      }
      return;
    }
    final epoch = ++voiceEpoch;
    setState(() => voiceStatus = 'Preparing audio…');
    try {
      final response = await backend(
        '/api/organizer/read-text',
        body: {'text': reply},
      );
      if (!mounted ||
          page != 'talk' ||
          epoch != voiceEpoch ||
          micState == _MicState.listening) {
        return;
      }
      replyAudio = base64Decode(response['audio'] as String);
      await playAskReply(advance: advance);
    } catch (_) {
      if (mounted && epoch == voiceEpoch) {
        setState(
          () => voiceStatus =
              'Audio unavailable. You can continue with the reply above.',
        );
      }
    }
  }

  Future<void> playAskReply({bool advance = false}) async {
    final wav = replyAudio;
    if (wav == null || micState == _MicState.listening) return;
    stopVoice(clear: false);
    final epoch = voiceEpoch;
    setState(() => voiceStatus = 'Playing reply');
    void complete() {
      if (!mounted || epoch != voiceEpoch || page != 'talk') return;
      setState(() => voiceStatus = '');
      if (advance) go('review-transfer');
    }

    try {
      if (widget.onPlayAudio == null) {
        _audio ??= AudioPlayer();
        await _audio!.stop();
        if (!mounted || epoch != voiceEpoch || page != 'talk') return;
        audioComplete = _audio!.onPlayerComplete.listen((_) => complete());
      }
      await playAudioBytes(wav);
      if (widget.onPlayAudio != null) complete();
    } catch (_) {
      if (mounted && epoch == voiceEpoch) {
        setState(() => voiceStatus = 'Tap Play reply to hear the audio.');
      }
    }
  }

  void clearReceipt() {
    receiptExtraction++;
    usingDemoReceipt = false;
    billRawPng = null;
    billDraft = ExtractedBillDraft.blank();
    billExtractState = 'idle';
    billExtractError = '';
    billMerchantController.clear();
    billDateController.clear();
    billTotalController.clear();
    receiptAttached = false;
  }

  String receiptDataUrl(Uint8List image) {
    final jpeg = image.length >= 2 && image[0] == 0xff && image[1] == 0xd8;
    final webp =
        image.length >= 12 &&
        ascii.decode(image.sublist(8, 12), allowInvalid: true) == 'WEBP';
    return 'data:image/${jpeg
        ? 'jpeg'
        : webp
        ? 'webp'
        : 'png'};base64,${base64Encode(image)}';
  }

  Future<void> captureReceipt(
    ImageSource source, {
    required bool inline,
  }) async {
    if (capturingReceipt) return;
    setState(() => capturingReceipt = true);
    try {
      if (!widget.enableLiveCamera) return;
      final file = await ImagePicker().pickImage(
        source: source,
        maxWidth: 1400,
        maxHeight: 2400,
        imageQuality: 78,
      );
      if (file == null ||
          !mounted ||
          (inline ? page != 'talk' : page != 'scan-bill')) {
        return;
      }
      if (await file.length() > 1200000) {
        showFeedback('Choose a receipt photo under 1.2 MB.');
        return;
      }
      final bytes = await file.readAsBytes();
      if (!mounted) return;
      setState(() {
        clearReceipt();
        billRawPng = bytes;
        receiptAttached = true;
      });
      unawaited(extractBillDetails(inline: inline));
    } catch (_) {
      if (mounted) {
        showFeedback(
          'Could not open the camera or image. Try Upload or manual entry.',
        );
      }
    } finally {
      if (mounted) setState(() => capturingReceipt = false);
    }
  }

  void openReceiptCamera() {
    setState(clearReceipt);
    go('scan-bill');
    if (widget.enableLiveCamera) {
      unawaited(captureReceipt(ImageSource.camera, inline: false));
    }
  }

  Widget receiptFields({bool inline = false}) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      if (billExtractState == 'loading') ...[
        const LinearProgressIndicator(),
        const SizedBox(height: 8),
        const Text('Reading your receipt…'),
      ] else ...[
        if (billExtractError.isNotEmpty) ...[
          SplitCallout(kind: CalloutKind.warning, message: billExtractError),
          const SizedBox(height: 12),
        ],
        if (inline &&
            billRawPng != null &&
            !identical(billRawPng, _fallbackPngBytes)) ...[
          Image.memory(
            billRawPng!,
            height: 100,
            cacheHeight: 200,
            fit: BoxFit.contain,
            errorBuilder: (_, _, _) => const Icon(Icons.receipt_long_outlined),
          ),
          const SizedBox(height: 12),
        ],
        SplitTextField(
          label: 'Merchant',
          controller: billMerchantController,
          onChanged: (value) => billDraft.merchant = value,
        ),
        const SizedBox(height: 12),
        if (!inline) ...[
          SplitTextField(
            label: 'Date',
            hintText: 'YYYY-MM-DD',
            controller: billDateController,
            onChanged: (value) => billDraft.date = value,
          ),
          const SizedBox(height: 12),
        ],
        twoButtons(
          SplitTextField(
            label: 'Total',
            controller: billTotalController,
            keyboardType: TextInputType.numberWithOptions(
              decimal: billDraft.currency != 'JPY',
            ),
            onChanged: (value) =>
                billDraft.totalCents = inputCents(value, billDraft.currency),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Currency', style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 8),
              currencyPicker('', billDraft.currency, (currency) {
                if (billDraft.currency == currency) return;
                setState(() {
                  billDraft.currency = currency;
                  if (currency == 'JPY') {
                    billDraft.totalCents =
                        (billDraft.totalCents / 100).round() * 100;
                    for (final item in billDraft.items) {
                      item.amountCents = (item.amountCents / 100).round() * 100;
                    }
                    billDraft.taxCents =
                        (billDraft.taxCents / 100).round() * 100;
                    billDraft.tipCents =
                        (billDraft.tipCents / 100).round() * 100;
                  }
                  if (billTotalController.text.isNotEmpty) {
                    billTotalController.text = (billDraft.totalCents / 100)
                        .toStringAsFixed(currency == 'JPY' ? 0 : 2);
                  }
                });
              }),
            ],
          ),
          firstFlex: 2,
        ),
        if (billDraft.items.isNotEmpty) ...[
          const SizedBox(height: 12),
          ExpansionTile(
            key: ObjectKey(billDraft),
            tilePadding: const EdgeInsets.symmetric(horizontal: 10),
            childrenPadding: const EdgeInsets.fromLTRB(4, 4, 4, 8),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            collapsedShape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            collapsedBackgroundColor: SplitColors.surfaceTint,
            backgroundColor: SplitColors.surfaceTint,
            title: Text('Line items (${billDraft.items.length})'),
            children: [
              for (final item in billDraft.items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: twoButtons(
                    TextFormField(
                      key: ObjectKey(item),
                      initialValue: item.name,
                      decoration: const InputDecoration(labelText: 'Item name'),
                      onChanged: (value) => item.name = value,
                    ),
                    TextFormField(
                      key: ValueKey((item, billDraft.currency)),
                      initialValue: (item.amountCents / 100).toStringAsFixed(
                        billDraft.currency == 'JPY' ? 0 : 2,
                      ),
                      decoration: InputDecoration(
                        labelText: 'Amount (${billDraft.currency})',
                      ),
                      keyboardType: TextInputType.numberWithOptions(
                        decimal: billDraft.currency != 'JPY',
                      ),
                      onChanged: (value) => item.amountCents = inputCents(
                        value,
                        billDraft.currency,
                      ),
                    ),
                    firstFlex: 2,
                  ),
                ),
            ],
          ),
        ],
      ],
    ],
  );

  void attachToAsk() {
    setState(() => receiptAttached = true);
    go('talk');
  }

  void updateAskRecipient(RecipientDraft row) {
    row.ambiguous = !row.known || row.amountCents <= 0;
    groupAttemptId = null;
    transferAttemptId = null;
    if (askSend) {
      editingAskRows.add(row);
      sendReady = validPaymentDraft;
    }
  }

  void openAskPaymentReview() {
    if (!validPaymentDraft) return;
    if (recipientDrafts.length == 1) {
      prepareAskTransfer(recipientDrafts.single);
      go('review-transfer');
    } else {
      groupAttemptId ??= demoId();
      go('review-payment-draft');
    }
  }

  void prepareAskTransfer(RecipientDraft row) {
    final contact = contacts.firstWhere((c) => c.id == row.contactId);
    paymentContact = contact;
    paymentCurrency = row.currency;
    receiveCurrency = fxRates.containsKey(contact.currency)
        ? contact.currency
        : 'USD';
    amountController.text = (row.amountCents / 100).toStringAsFixed(
      paymentCurrency == 'JPY' ? 0 : 2,
    );
    noteController.text = row.reason;
    transferAttemptId ??= demoId();
    transferFromAsk = true;
  }

  Widget talkScreen() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SplitScreenHeader(
        title: 'Ask AI',
        subtitle: 'Type, dictate, or attach a receipt',
        onBack: () => go('home'),
        trailing: IconButton(
          tooltip: voiceEnabled ? 'Turn voice off' : 'Turn voice on',
          icon: Icon(voiceEnabled ? Icons.volume_up : Icons.volume_off),
          onPressed: () => setState(() {
            voiceEnabled = !voiceEnabled;
            if (!voiceEnabled) stopVoice();
          }),
        ),
      ),
      SplitCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (askMessages.isEmpty) ...[
              Text(
                'Start with an amount and a name.',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              const Text(
                'Try “Give Maya \$20 and Arun \$15.” You can add more people in another message.',
              ),
            ],
            for (final msg in askMessages)
              Align(
                alignment: msg.user
                    ? Alignment.centerRight
                    : Alignment.centerLeft,
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: msg.user
                        ? SplitColors.surfaceTint
                        : SplitColors.surfaceSubtle,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(msg.text),
                ),
              ),
            if (askBusy) const LinearProgressIndicator(),
            if (voiceStatus.isNotEmpty)
              Semantics(liveRegion: true, child: Text(voiceStatus)),
            if (replyAudio != null || voiceStatus.startsWith('Preparing'))
              Wrap(
                spacing: 8,
                children: [
                  if (replyAudio != null)
                    TextButton(
                      onPressed: playAskReply,
                      child: const Text('Play reply'),
                    ),
                  TextButton(
                    onPressed: () => setState(() => stopVoice(clear: false)),
                    child: const Text('Stop'),
                  ),
                ],
              ),
            if (recipientDrafts.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text(
                askSend ? 'Payment draft' : 'Request draft',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              for (final row in recipientDrafts) ...[
                if (askSend &&
                    row.known &&
                    !editingAskRows.contains(row) &&
                    !row.ambiguous &&
                    row.amountCents > 0)
                  paymentTile(
                    name: row.name,
                    amount: currencyAmount(row.amountCents, row.currency),
                  )
                else ...[
                  SplitCard(
                    color: SplitColors.surfaceTint,
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      children: [
                        DropdownButtonFormField<String>(
                          key: ObjectKey(row),
                          initialValue:
                              contacts.any((c) => c.id == row.contactId)
                              ? row.contactId
                              : null,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            labelText: 'Recipient',
                          ),
                          items: contacts
                              .map(
                                (c) => DropdownMenuItem(
                                  value: c.id,
                                  child: Text('${c.flag} ${c.name}'),
                                ),
                              )
                              .toList(),
                          onChanged: (id) {
                            final contact = contacts.firstWhere(
                              (c) => c.id == id,
                            );
                            setState(() {
                              row.contactId = id;
                              row.name = contact.name;
                              row.known = true;
                              updateAskRecipient(row);
                            });
                          },
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          key: ValueKey((row, 'amount')),
                          initialValue: row.amountCents == 0
                              ? ''
                              : (row.amountCents / 100).toStringAsFixed(
                                  row.currency == 'JPY' ? 0 : 2,
                                ),
                          decoration: InputDecoration(
                            labelText: 'Amount (${row.currency})',
                          ),
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          onChanged: (value) => setState(() {
                            row.amountCents = inputCents(value, row.currency);
                            updateAskRecipient(row);
                          }),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
              const SizedBox(height: 12),
              if (askSend)
                SplitPrimaryButton(
                  label: recipientDrafts.length == 1
                      ? 'Review payment'
                      : 'Review ${recipientDrafts.length} payments',
                  onPressed: !askBusy && sendReady && validPaymentDraft
                      ? openAskPaymentReview
                      : null,
                )
              else
                SplitPrimaryButton(
                  label: 'Review requests',
                  onPressed:
                      askBusy ||
                          recipientDrafts.any(
                            (r) => !r.known || r.amountCents <= 0,
                          )
                      ? null
                      : () {
                          requestAttemptId ??= demoId();
                          if (requestKind != 'store' || !receiptAttached) {
                            requestKind = receiptAttached
                                ? 'receipt'
                                : 'request';
                          }
                          if (!receiptAttached) {
                            billDraft = ExtractedBillDraft(
                              merchant: 'Money request',
                              date: dateLabel(DateTime.now()),
                              currency: recipientDrafts.first.currency,
                              items: [],
                              totalCents: 0,
                            );
                          }
                          unawaited(reviewRequests());
                        },
                ),
            ],
            if (receiptAttached) ...[
              const Divider(),
              receiptFields(inline: true),
            ],
          ],
        ),
      ),
    ],
  );

  Widget talkComposer() => Material(
    color: Colors.white,
    child: SafeArea(
      top: false,
      child: Center(
        heightFactor: 1,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 680),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (micState == _MicState.listening)
                  const Text('Recording… Tap the microphone to finish.'),
                if (micState == _MicState.transcribing)
                  const Text('Transcribing…'),
                if (micError.isNotEmpty)
                  Semantics(liveRegion: true, child: Text(micError)),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    PopupMenuButton<ImageSource>(
                      tooltip: 'Attach receipt',
                      enabled: !capturingReceipt && !askBusy,
                      icon: const Icon(Icons.attach_file),
                      onSelected: (source) =>
                          captureReceipt(source, inline: true),
                      itemBuilder: (_) => const [
                        PopupMenuItem(
                          value: ImageSource.camera,
                          child: Text('Camera'),
                        ),
                        PopupMenuItem(
                          value: ImageSource.gallery,
                          child: Text('Upload'),
                        ),
                      ],
                    ),
                    IconButton(
                      onPressed: askBusy || micState == _MicState.transcribing
                          ? null
                          : recordAskSpeech,
                      tooltip: micState == _MicState.listening
                          ? 'Stop recording'
                          : 'Microphone',
                      icon: Icon(
                        micState == _MicState.listening
                            ? Icons.stop_circle
                            : Icons.mic,
                      ),
                    ),
                    Expanded(
                      child: TextField(
                        controller: askInput,
                        minLines: 1,
                        maxLines: 4,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => submitAsk(),
                        decoration: const InputDecoration(
                          labelText: 'Message',
                          hintText: 'Type a message',
                          isDense: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ValueListenableBuilder<TextEditingValue>(
                      valueListenable: askInput,
                      builder: (context, value, _) => IconButton.filled(
                        tooltip: 'Send',
                        onPressed: askBusy || value.text.trim().isEmpty
                            ? null
                            : submitAsk,
                        icon: const Icon(Icons.send),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );

  void openScannedLink(String rawValue) {
    final raw = rawValue.trim();
    final fragment = raw.startsWith('#')
        ? raw.substring(1)
        : Uri.tryParse(raw)?.fragment;
    if (raw == 'SS-001' || fragment == 'purchase/SS-001') {
      go('review');
      return;
    }
    if (fragment != null &&
        RegExp(r'^(pay|req)/[a-zA-Z0-9-]+$').hasMatch(fragment)) {
      setState(() => scannerState = _ScannerState.ready);
      unawaited(
        launchUrl(
          Uri.parse('$_origin/#$fragment'),
          mode: LaunchMode.externalApplication,
        ),
      );
      return;
    }
    setState(() {
      scannerState = _ScannerState.invalid;
      scannerError = raw.isEmpty
          ? 'Scan a QR or paste a link first.'
          : 'Unsupported code. Use an SS-001 merchant code or a PayPal Hackathon payment link.';
    });
  }

  Widget scannerScreen({bool forceError = false}) {
    final scanning = scannerState == _ScannerState.scanning;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: 'Scan & pay',
          subtitle: 'Pay a supported merchant · Sandbox',
          onBack: () => go('home'),
        ),
        if (scanning && widget.enableLiveCamera)
          SizedBox(
            height: 240,
            child: MobileScanner(
              onDetect: (capture) {
                final raw = capture.barcodes.firstOrNull?.rawValue;
                if (raw != null &&
                    page == 'scan' &&
                    scannerState == _ScannerState.scanning) {
                  openScannedLink(raw);
                }
              },
              errorBuilder: (context, error) => const Center(
                child: Text(
                  'Camera unavailable. Paste a supported link below.',
                ),
              ),
            ),
          ),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              OutlinedButton.icon(
                onPressed: widget.enableLiveCamera
                    ? () => setState(
                        () => scannerState = scanning
                            ? _ScannerState.ready
                            : _ScannerState.scanning,
                      )
                    : null,
                icon: const Icon(Icons.qr_code_scanner),
                label: Text(scanning ? 'Stop camera' : 'Open camera'),
              ),
              SplitTextField(
                label: 'Paste link or code',
                hintText: '#purchase/SS-001',
                controller: linkController,
              ),
              const SizedBox(height: 8),
              SplitPrimaryButton(
                label: 'Open link',
                onPressed: () => openScannedLink(linkController.text),
              ),
              if (scannerState == _ScannerState.invalid || forceError)
                SplitCallout(
                  kind: CalloutKind.error,
                  message: scannerError.isEmpty
                      ? 'Camera unavailable. Paste a link instead.'
                      : scannerError,
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget receiptCard() => SplitCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        lineRow('Shared kitchen essentials', '\$120.00'),
        lineRow('Desk lamp ($lamp)', '\$30.00'),
        const Divider(height: 18, color: SplitColors.line),
        lineRow('Total', '\$150.00 USD', bold: true),
      ],
    ),
  );

  Widget reviewScreen() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SplitScreenHeader(
        title: 'Review purchase',
        subtitle: 'Move-in essentials · Sandbox Merchant · SS-001',
        onBack: () => go('scan'),
      ),
      twoPane(
        receiptCard(),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ...names.map((n) => participantRow(n)),
              const SizedBox(height: 10),
              SplitTextField(
                label: 'Split instruction',
                controller: instructionController,
                maxLines: 3,
              ),
              const SizedBox(height: 10),
              twoButtons(
                SplitSecondaryButton(
                  label: 'Back',
                  onPressed: () => go('scan'),
                ),
                SplitPrimaryButton(
                  label: 'Prepare AI split',
                  onPressed: prepareSplit,
                ),
                firstFlex: 1,
                secondFlex: 2,
              ),
            ],
          ),
        ),
      ),
    ],
  );

  Widget splitReviewScreen({bool edit = false, bool clarify = false}) {
    final isLoading = aiState == _AiState.loading && !edit && !clarify;
    final isUnavail =
        (aiState == _AiState.unavailable || aiState == _AiState.error) &&
        !edit &&
        !clarify;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: clarify
              ? 'Clarify lamp owner'
              : edit
              ? 'Edit allocations'
              : 'Review suggested split',
          onBack: () => go('review'),
        ),
        twoPane(
          receiptCard(),
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (isLoading)
                  const LinearProgressIndicator(color: SplitColors.primary),
                if (isUnavail)
                  SplitCallout(
                    kind: CalloutKind.warning,
                    title: 'DeepSeek AI unavailable',
                    message: aiError,
                    trailing: Wrap(
                      spacing: 8,
                      children: [
                        SplitSecondaryButton(
                          label: 'Retry AI split',
                          expand: false,
                          onPressed: prepareSplit,
                        ),
                        SplitPrimaryButton(
                          label: 'Edit manually',
                          expand: false,
                          onPressed: () => go('edit'),
                        ),
                      ],
                    ),
                  ),
                if (edit || clarify || isUnavail)
                  DropdownButtonFormField<String>(
                    initialValue: lamp,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Who pays for the \$30.00 lamp?',
                    ),
                    items: names
                        .map(
                          (n) => DropdownMenuItem(
                            value: n,
                            child: Text('$n (\$70.00)'),
                          ),
                        )
                        .toList(),
                    onChanged: hasExistingOrders
                        ? null
                        : (v) {
                            if (v != null) setState(() => lamp = v);
                          },
                  ),
                if (!isLoading) ...names.map((n) => participantRow(n)),
                const SizedBox(height: 10),
                SplitSecondaryButton(
                  label: ttsState == _TtsState.loading
                      ? 'Loading audio…'
                      : 'Read split aloud',
                  leadingIcon: Icons.volume_up_rounded,
                  onPressed: ttsState == _TtsState.loading
                      ? null
                      : readSplitAloud,
                ),
                if (ttsState == _TtsState.unavailable)
                  SplitCallout(
                    kind: CalloutKind.warning,
                    title: 'Audio unavailable',
                    message: ttsError,
                  ),
                const SizedBox(height: 12),
                twoButtons(
                  SplitSecondaryButton(
                    label: edit ? 'Done editing' : 'Edit split',
                    onPressed: () => go(edit ? 'split' : 'edit'),
                  ),
                  SplitPrimaryButton(
                    label: backendBusy ? 'Publishing…' : 'Confirm split',
                    onPressed: (backendBusy || isLoading) ? null : publishSplit,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget requestsScreen() {
    final activeUrl = shareLink(selected);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: 'Share payment requests',
          onBack: () => go('split'),
        ),
        twoPane(
          SplitCard(
            child: Column(
              children: [
                ...names.map(
                  (n) => Column(
                    children: [
                      participantRow(n, showStatus: true),
                      twoButtons(
                        SplitSecondaryButton(
                          label: 'Copy link',
                          onPressed: () {
                            final u = shareLink(n);
                            if (u != null) {
                              Clipboard.setData(ClipboardData(text: u));
                              showFeedback('$n’s link copied');
                            }
                          },
                        ),
                        SplitPrimaryButton(
                          label: 'Show QR',
                          onPressed: () => setState(() => selected = n),
                        ),
                      ),
                      const SizedBox(height: 10),
                    ],
                  ),
                ),
                SplitPrimaryButton(
                  label: 'Track group ledger',
                  onPressed: () => go('dashboard'),
                ),
              ],
            ),
          ),
          SplitCard(
            color: SplitColors.surfaceTint,
            child: Column(
              children: [
                if (activeUrl != null) QrImageView(data: activeUrl, size: 136),
                const SizedBox(height: 10),
                Text(
                  '$selected · ${money(share(selected))} USD',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 10),
                SplitPrimaryButton(
                  label: 'Open $selected’s share',
                  onPressed: () => go('payer'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget statusScreen() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SplitScreenHeader(
        title: 'Group payment ledger',
        subtitle: 'Move-in essentials · SS-001',
        onBack: () => go('activity'),
      ),
      twoPane(
        receiptCard(),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${money(paidAmount)} / \$150.00 USD paid',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              LinearProgressIndicator(
                value: (paidAmount / 150).clamp(0.0, 1.0),
                color: SplitColors.teal,
              ),
              ...names.map((n) => participantRow(n, showStatus: true)),
              const SizedBox(height: 10),
              SplitPrimaryButton(
                label: 'Share payment requests',
                onPressed: () => go('requests'),
              ),
            ],
          ),
        ),
      ),
    ],
  );

  Widget payerScreen() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SplitScreenHeader(
        title: 'Your share · ${money(share(selected))} USD',
        onBack: () => go('requests'),
      ),
      SplitCard(
        color: SplitColors.surfaceTint,
        child: Column(
          children: [
            lineRow('Participant', selected),
            lineRow('Total due', '${money(share(selected))} USD', bold: true),
            const SizedBox(height: 10),
            SplitPrimaryButton(
              label: 'Pay with PayPal',
              backgroundColor: SplitColors.paypalBg,
              foregroundColor: SplitColors.paypalInk,
              onPressed: () {
                final u = shareLink(selected);
                if (connected && u != null) {
                  openPayerUrl(u);
                } else {
                  go('handoff');
                }
              },
            ),
          ],
        ),
      ),
    ],
  );

  // ---------- Tab 3: Store (super.money splitStore) + Product + Cart + Rent ----------
  Widget storeScreen() {
    const categories = [
      'All',
      'Kitchen',
      'Lighting',
      'Furniture',
      'Cleaning',
      'Retailers',
    ];
    final q = storeQuery.trim().toLowerCase();
    final products = storeCategory == 'Retailers'
        ? <StoreProduct>[]
        : kStoreCatalog
              .where(
                (p) =>
                    (storeCategory == 'All' || p.category == storeCategory) &&
                    (q.isEmpty ||
                        p.name.toLowerCase().contains(q) ||
                        p.seller.toLowerCase().contains(q)),
              )
              .toList();
    final retailers = (storeCategory == 'All' || storeCategory == 'Retailers')
        ? kExternalRetailers
              .where(
                (r) =>
                    (storeCategory == 'All' ||
                        storeCategory == 'Retailers' ||
                        r.category == storeCategory) &&
                    (q.isEmpty || r.name.toLowerCase().contains(q)),
              )
              .toList()
        : <ExternalRetailer>[];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: LayoutBuilder(
            builder: (context, constraints) => Wrap(
              spacing: 12,
              runSpacing: 10,
              crossAxisAlignment: WrapCrossAlignment.center,
              alignment: WrapAlignment.spaceBetween,
              children: [
                ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: constraints.maxWidth >= 420
                        ? constraints.maxWidth - 220
                        : constraints.maxWidth,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'splitStore',
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                      Text(
                        interests.isEmpty
                            ? 'Sample inventory · Preview'
                            : 'Preferences: ${interests.join(', ')}',
                      ),
                    ],
                  ),
                ),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    TextButton(
                      onPressed: () => go('preferences'),
                      child: const Text('Preferences'),
                    ),
                    SplitPrimaryButton(
                      label: 'Cart ($cartCount)',
                      leadingIcon: Icons.shopping_cart_outlined,
                      trailingIcon: null,
                      expand: false,
                      onPressed: () => go('cart'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        SplitTextField(
          label: 'Search Store',
          hintText: 'Search cookware, lamp, storage, IKEA...',
          controller: storeSearchController,
          prefixIcon: Icons.search_rounded,
          onChanged: (v) => setState(() => storeQuery = v),
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: categories
                .map(
                  (c) => Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(c),
                      selected: storeCategory == c,
                      onSelected: (_) => setState(() => storeCategory = c),
                    ),
                  ),
                )
                .toList(),
          ),
        ),
        const SizedBox(height: 14),
        LayoutBuilder(
          builder: (context, constraints) {
            final cols = constraints.maxWidth >= 720
                ? 3
                : constraints.maxWidth >= 460
                ? 2
                : 1;
            final cards = [
              ...products.map((p) => _storeProductCard(p)),
              ...retailers.map((r) => _retailerCard(r)),
            ];
            if (cols == 1) {
              return Column(children: cards);
            }
            return Wrap(
              spacing: 14,
              runSpacing: 0,
              children: cards
                  .map(
                    (c) => SizedBox(
                      width: (constraints.maxWidth - (cols - 1) * 14) / cols,
                      child: c,
                    ),
                  )
                  .toList(),
            );
          },
        ),
      ],
    );
  }

  Widget _storeProductCard(StoreProduct p) => SplitCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          height: 92,
          width: double.infinity,
          decoration: BoxDecoration(
            color: SplitColors.surfaceTint,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(p.icon, size: 42, color: SplitColors.primaryInk),
        ),
        const SizedBox(height: 10),
        SplitBadge(p.seller, preview: !p.demoLinked),
        const SizedBox(height: 8),
        Text(p.name, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 4),
        Text(
          centsStr(p.priceCents),
          style: const TextStyle(
            fontWeight: FontWeight.w800,
            color: SplitColors.primaryInk,
            fontSize: 16,
          ),
        ),
        const SizedBox(height: 10),
        twoButtons(
          SplitSecondaryButton(
            label: 'View',
            onPressed: () => setState(() {
              activeProduct = p;
              page = 'product';
            }),
          ),
          SplitPrimaryButton(
            label: 'Add',
            trailingIcon: Icons.add_rounded,
            onPressed: () {
              setState(() {
                final row = cart.where((c) => c.product.id == p.id).firstOrNull;
                if (row != null) {
                  row.qty++;
                } else {
                  cart.add(CartEntry(product: p));
                }
              });
              showFeedback('${p.name} added to cart');
            },
          ),
        ),
      ],
    ),
  );

  Widget _retailerCard(ExternalRetailer r) => SplitCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          height: 92,
          width: double.infinity,
          decoration: BoxDecoration(
            color: const Color(0xFFEEF2F7),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(
            Icons.storefront_outlined,
            size: 42,
            color: SplitColors.navy,
          ),
        ),
        const SizedBox(height: 10),
        const SplitBadge('External retailer', preview: true),
        const SizedBox(height: 8),
        Text(r.name, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 6),
        SplitSecondaryButton(
          label: 'Open retailer',
          leadingIcon: Icons.open_in_new_rounded,
          onPressed: () => launchUrl(Uri.parse(r.url)),
        ),
      ],
    ),
  );

  Widget productScreen() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SplitScreenHeader(
        title: activeProduct.name,
        subtitle: activeProduct.seller,
        onBack: () => go('store'),
      ),
      SplitCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Icon(
                activeProduct.icon,
                size: 68,
                color: SplitColors.primaryInk,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              '${centsStr(activeProduct.priceCents)} USD',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 6),
            Text(activeProduct.description),
            const SizedBox(height: 14),
            SplitPrimaryButton(
              label: 'Add to shared purchase',
              leadingIcon: Icons.shopping_cart_outlined,
              onPressed: () => setState(() {
                final row = cart
                    .where((c) => c.product.id == activeProduct.id)
                    .firstOrNull;
                if (row != null) {
                  row.qty++;
                } else {
                  cart.add(CartEntry(product: activeProduct));
                }
                page = 'cart';
              }),
            ),
          ],
        ),
      ),
    ],
  );

  Widget cartScreen() {
    final totalCents = cart.fold(0, (s, c) => s + c.product.priceCents * c.qty);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: 'Shared cart ($cartCount)',
          onBack: () => go('store'),
        ),
        SplitCard(
          child: cart.isEmpty
              ? Column(
                  children: [
                    const Text('Your shared cart is empty.'),
                    const SizedBox(height: 12),
                    SplitPrimaryButton(
                      label: 'Browse Store',
                      onPressed: () => go('store'),
                    ),
                  ],
                )
              : Column(
                  children: [
                    ...cart.map(
                      (c) => lineRow(
                        '${c.product.name} × ${c.qty}',
                        centsStr(c.product.priceCents * c.qty),
                      ),
                    ),
                    const Divider(height: 20, color: SplitColors.line),
                    lineRow(
                      'Subtotal',
                      '${centsStr(totalCents)} USD',
                      bold: true,
                    ),
                    const SizedBox(height: 12),
                    twoButtons(
                      SplitSecondaryButton(
                        label: 'Clear cart',
                        onPressed: () => setState(cart.clear),
                      ),
                      SplitPrimaryButton(
                        label: 'Split this purchase',
                        onPressed: () {
                          final each = equalShare(totalCents, 3, 'USD');
                          setState(() {
                            billRawPng = null;
                            billDraft = ExtractedBillDraft(
                              merchant: 'splitStore Shared Cart',
                              date: dateLabel(DateTime.now()),
                              items: cart
                                  .map(
                                    (c) => BillLineItem(
                                      name: '${c.product.name} x${c.qty}',
                                      amountCents: c.product.priceCents * c.qty,
                                    ),
                                  )
                                  .toList(),
                              totalCents: totalCents,
                              modelUsed: 'Store Cart',
                            );
                            billMerchantController.text = billDraft.merchant;
                            billTotalController.text = (totalCents / 100)
                                .toStringAsFixed(2);
                            recipientDrafts = [
                              RecipientDraft(
                                name: 'Maya',
                                contactId: 'maya',
                                known: true,
                                amountCents: each,
                                reason: cart.first.product.name,
                              ),
                              RecipientDraft(
                                name: 'Arun',
                                contactId: 'arun',
                                known: true,
                                amountCents: each,
                                reason: cart.first.product.name,
                              ),
                              RecipientDraft(
                                name: 'Leah',
                                contactId: 'leah',
                                known: true,
                                amountCents: totalCents - each * 2,
                                reason: cart.first.product.name,
                              ),
                            ];
                            requestKind = 'store';
                            requestAttemptId = null;
                            receiptAttached = true;
                            askSend = false;
                            sendReady = false;
                            askMessages
                              ..clear()
                              ..add((
                                user: false,
                                text: 'Review the shared cart split below.',
                              ));
                            page = 'talk';
                          });
                        },
                      ),
                    ),
                  ],
                ),
        ),
      ],
    );
  }

  Widget preferencesScreen() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SplitScreenHeader(
        title: 'Shopping preferences',
        onBack: () => go('store'),
      ),
      SplitCard(
        child: Column(
          children: [
            ...['Kitchen', 'Lighting', 'Furniture', 'Cleaning'].map(
              (n) => CheckboxListTile(
                title: Text(n),
                value: interests.contains(n),
                onChanged: (v) => setState(
                  () => v == true ? interests.add(n) : interests.remove(n),
                ),
              ),
            ),
            twoButtons(
              SplitSecondaryButton(label: 'Skip', onPressed: () => go('store')),
              SplitPrimaryButton(label: 'Save', onPressed: () => go('store')),
            ),
          ],
        ),
      ),
    ],
  );

  void resetRent() {
    rentCreating = false;
    rentCustom = false;
    rememberRent = false;
    rentDue = null;
    rentContacts.clear();
    amountController.clear();
    paymentCurrency = 'USD';
    for (final controller in rentShares.values) {
      controller.clear();
    }
  }

  void applyRentRule() {
    final rule = savedRentRule!;
    setState(() {
      rentContacts.addAll(List<String>.from(rule['contactIds'] as List));
      paymentCurrency = rule['currency'] as String;
      final cents = rule['totalCents'] as int;
      amountController.text = (cents / 100).toStringAsFixed(
        paymentCurrency == 'JPY' ? 0 : 2,
      );
      rentCustom = rule['mode'] == 'custom';
      for (final entry in (rule['customShares'] as Map? ?? {}).entries) {
        rentShares
            .putIfAbsent(entry.key as String, TextEditingController.new)
            .text = ((entry.value as int) / 100).toStringAsFixed(
          paymentCurrency == 'JPY' ? 0 : 2,
        );
      }
    });
  }

  Widget rentScreen() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SplitScreenHeader(
        title: 'Rent',
        subtitle: 'Household requests · Practice mode',
        onBack: () => go('home'),
      ),
      SplitCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (!rentCreating)
              SplitPrimaryButton(
                label: 'Create rent request',
                onPressed: () => setState(() => rentCreating = true),
              )
            else ...[
              if (savedRentRule != null)
                TextButton(
                  onPressed: applyRentRule,
                  child: const Text('Use saved split rule'),
                ),
              SplitTextField(label: 'Total rent', controller: amountController),
              currencyPicker(
                'Currency',
                paymentCurrency,
                (currency) => setState(() => paymentCurrency = currency),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.calendar_today),
                title: Text(
                  rentDue == null ? 'Choose due date' : dateLabel(rentDue!),
                ),
                onTap: () async {
                  final now = DateTime.now();
                  final date = await showDatePicker(
                    context: context,
                    firstDate: now,
                    lastDate: now.add(const Duration(days: 730)),
                    initialDate: rentDue ?? now,
                  );
                  if (mounted && date != null) setState(() => rentDue = date);
                },
              ),
              const Text('Household contacts'),
              for (final c in contacts.where((c) => c.id != 'leah'))
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('${c.flag} ${c.name}'),
                  value: rentContacts.contains(c.id),
                  onChanged: (checked) => setState(() {
                    if (checked == true) {
                      rentContacts.add(c.id);
                    } else {
                      rentContacts.remove(c.id);
                    }
                  }),
                ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Custom shares'),
                value: rentCustom,
                onChanged: (value) => setState(() => rentCustom = value),
              ),
              if (rentCustom)
                for (final c in contacts.where(
                  (c) => rentContacts.contains(c.id),
                ))
                  SplitTextField(
                    label: '${c.name}’s share',
                    controller: rentShares.putIfAbsent(
                      c.id,
                      TextEditingController.new,
                    ),
                  ),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Save rule for future months'),
                value: rememberRent,
                onChanged: (value) =>
                    setState(() => rememberRent = value == true),
              ),
              SplitPrimaryButton(
                label: 'Review rent requests',
                onPressed: submitRentDraft,
              ),
            ],
          ],
        ),
      ),
    ],
  );

  Future<void> submitRentDraft() async {
    final due = rentDue;
    final total = inputCents(amountController.text, paymentCurrency);
    final selected = contacts
        .where((c) => rentContacts.contains(c.id))
        .toList();
    if (due == null || total <= 0 || selected.isEmpty) {
      showFeedback(
        'Choose a due date, enter a positive total, and select contacts.',
      );
      return;
    }
    final base = equalShare(total, selected.length, paymentCurrency);
    final shares = {
      for (final contact in selected)
        contact.id: rentCustom
            ? inputCents(rentShares[contact.id]?.text ?? '', paymentCurrency)
            : base,
    };
    if (shares.values.any((value) => value <= 0) ||
        shares.values.fold(0, (a, b) => a + b) > total) {
      showFeedback('Enter positive shares that do not exceed the rent total.');
      return;
    }
    prepareRequests('Rent · ${dateLabel(due)}', 'rent', paymentCurrency, [
      for (final c in selected)
        RecipientDraft(
          name: c.name,
          contactId: c.id,
          known: true,
          amountCents: shares[c.id]!,
          currency: paymentCurrency,
          reason: 'Rent due ${dateLabel(due)}',
        ),
    ], total: total);
    await reviewRequests();
    if (!mounted || page != 'request-detail' || !rememberRent) return;
    final rule = {
      'contactIds': selected.map((c) => c.id).toList(),
      'totalCents': total,
      'currency': paymentCurrency,
      'mode': rentCustom ? 'custom' : 'equal',
      'customShares': rentCustom ? shares : <String, int>{},
      'dayOfMonth': due.day,
    };
    try {
      if (connected) await backend('/api/organizer/rent-rule', body: rule);
      savedRentRule = rule;
      if (!connected) await saveLocalDemo();
    } catch (_) {
      if (mounted) {
        showFeedback(
          'Requests were created, but the rent rule could not be saved.',
        );
      }
    }
  }

  Widget profileScreen() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Profile & Settings',
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const Text('Manage your contacts and practice session.'),
                ],
              ),
            ),
            SplitBadge(
              connected ? 'Connected Sandbox' : 'Preview mode',
              preview: !connected,
            ),
          ],
        ),
      ),
      twoPane(
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Organizer Sandbox Session',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              if (connected)
                SplitSecondaryButton(
                  label: 'Sign out',
                  onPressed: signOutOrganizer,
                )
              else
                SplitPrimaryButton(
                  label: 'Sign in with organizer key',
                  onPressed: () => go('welcome'),
                ),
              const Divider(height: 22, color: SplitColors.line),
              lineRow(
                'AI Extract & Split',
                aiConfigured ? 'Configured' : 'Preview/Manual',
              ),
              lineRow(
                'Chatterbox TTS',
                aiConfigured ? 'Configured' : 'Unavailable',
              ),
              lineRow(
                'PayPal Sandbox (SS-001)',
                paypalConfigured ? 'Configured' : 'Unconfigured',
              ),
              lineRow(
                'Email / SMS Delivery',
                deliveryConfigured ? 'Configured' : 'Manual link/QR',
              ),
            ],
          ),
        ),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Contacts (${contacts.length})',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              ...contacts.map(
                (c) => paymentTile(
                  name: c.name,
                  leading: participantAvatar(c.name),
                  detail: [
                    '${c.flag} ${c.country}'.trim(),
                    c.currency,
                  ].where((value) => value.isNotEmpty).join(' · '),
                ),
              ),
              const Divider(height: 18, color: SplitColors.line),
              SplitTextField(
                label: 'Add contact name',
                hintText: 'e.g. Priya',
                controller: newContactNameController,
              ),
              const SizedBox(height: 8),
              SplitSecondaryButton(
                label: 'Add contact',
                onPressed: () async {
                  final name = newContactNameController.text.trim();
                  if (name.isEmpty) return;
                  if (connected) {
                    await backend(
                      '/api/organizer/contacts',
                      body: {'name': name},
                    );
                  }
                  setState(() {
                    contacts.add(
                      SplitContact(id: name.toLowerCase(), name: name),
                    );
                    newContactNameController.clear();
                  });
                },
              ),
            ],
          ),
        ),
      ),
    ],
  );

  // ---------- Scaffold & Responsive App Shell ----------
  Widget currentBody() => switch (page) {
    'welcome' => welcomeScreen(),
    'home' => homeScreen(),
    'activity' => activityScreen(),
    'store' || 'shop' => storeScreen(),
    'profile' => profileScreen(),
    'scan' => scannerScreen(),
    'scan-error' => scannerScreen(forceError: true),
    'scan-bill' => scanBillScreen(),
    'bill-crop' => billCropScreen(),
    'bill-review' => billReviewScreen(),
    'talk' => talkScreen(),
    'send-money' => contactPaymentScreen(send: true),
    'manual-request' => contactPaymentScreen(send: false),
    'review-transfer' => transferReviewScreen(),
    'review-payment-draft' => groupPaymentScreen(),
    'payment-draft-receipt' => groupReceiptScreen(),
    'transfer-receipt' => transferReceiptScreen(),
    'request-detail' => requestDetailScreen(),
    'reimbursement-payer' => reimbursementPayerScreen(),
    'review' => reviewScreen(),
    'split' => splitReviewScreen(),
    'edit' => splitReviewScreen(edit: true),
    'clarify' => splitReviewScreen(clarify: true),
    'requests' || 'qr' => requestsScreen(),
    'dashboard' || 'status' => statusScreen(),
    'payer' => payerScreen(),
    'handoff' => SplitCard(
      child: Column(
        children: [
          Text(
            'PayPal Sandbox preview',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 10),
          ...['processing', 'paid', 'cancelled'].map(
            (s) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: SplitPrimaryButton(
                label: 'Preview ${s[0].toUpperCase()}${s.substring(1)}',
                onPressed: () => setState(() {
                  result = s;
                  page = 'result';
                }),
              ),
            ),
          ),
        ],
      ),
    ),
    'result' => SplitCard(
      child: Column(
        children: [
          Text(
            'Result: $result',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 12),
          SplitPrimaryButton(
            label: 'Back to share',
            onPressed: () => go('payer'),
          ),
        ],
      ),
    ),
    'rent' => rentScreen(),
    'product' => productScreen(),
    'cart' => cartScreen(),
    'preferences' => preferencesScreen(),
    _ => homeScreen(),
  };

  static const _tabPages = ['home', 'activity', 'store', 'profile'];

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final isLandscape =
        MediaQuery.orientationOf(context) == Orientation.landscape;
    final showTabs = _tabPages.contains(page);
    final useRail =
        showTabs && (size.width >= 720 || (isLandscape && size.width >= 540));
    final useBottomNav = showTabs && !useRail;
    final tabIdx = _tabPages.indexOf(page).clamp(0, 3);

    Widget content = SafeArea(
      child: SingleChildScrollView(
        controller: page == 'talk' ? askScroll : null,
        padding: const EdgeInsets.all(18),
        child: Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: page == 'home' || page == 'talk' ? 680 : 1020,
            ),
            child: currentBody(),
          ),
        ),
      ),
    );

    if (page == 'talk') {
      content = Column(
        children: [
          Expanded(child: content),
          const Divider(height: 1, color: SplitColors.line),
          talkComposer(),
        ],
      );
    }

    if (page == 'bill-review') {
      content = Column(
        children: [
          Expanded(child: content),
          if (billExtractState != 'loading' &&
              MediaQuery.viewInsetsOf(context).bottom == 0) ...[
            const Divider(height: 1, color: SplitColors.line),
            receiptReviewAction(),
          ],
        ],
      );
    }

    if (useRail) {
      content = Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          NavigationRail(
            selectedIndex: tabIdx,
            backgroundColor: Colors.white,
            labelType: NavigationRailLabelType.all,
            onDestinationSelected: (i) => go(_tabPages[i]),
            leading: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: paypalIcon(),
            ),
            destinations: [
              const NavigationRailDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home_rounded),
                label: Text('Home'),
              ),
              const NavigationRailDestination(
                icon: Icon(Icons.history_rounded),
                label: Text('Activity'),
              ),
              NavigationRailDestination(
                icon: Badge(
                  isLabelVisible: cartCount > 0,
                  label: Text('$cartCount'),
                  child: const Icon(Icons.shopping_bag_outlined),
                ),
                label: const Text('Store'),
              ),
              const NavigationRailDestination(
                icon: Icon(Icons.person_outline_rounded),
                label: Text('Profile'),
              ),
            ],
          ),
          const VerticalDivider(width: 1, color: SplitColors.line),
          Expanded(child: content),
        ],
      );
    }

    return Scaffold(
      body: content,
      bottomNavigationBar: useBottomNav
          ? NavigationBar(
              selectedIndex: tabIdx,
              backgroundColor: Colors.white,
              indicatorColor: SplitColors.surfaceTint,
              onDestinationSelected: (i) => go(_tabPages[i]),
              destinations: [
                const NavigationDestination(
                  icon: Icon(Icons.home_outlined),
                  selectedIcon: Icon(Icons.home_rounded),
                  label: 'Home',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.history_rounded),
                  label: 'Activity',
                ),
                NavigationDestination(
                  icon: Badge(
                    isLabelVisible: cartCount > 0,
                    label: Text('$cartCount'),
                    child: const Icon(Icons.shopping_bag_outlined),
                  ),
                  label: 'Store',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.person_outline_rounded),
                  label: 'Profile',
                ),
              ],
            )
          : null,
    );
  }
}

class _ApiException implements Exception {
  final int statusCode;
  final String message;

  _ApiException(this.statusCode, this.message);

  @override
  String toString() => message;
}
