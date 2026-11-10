import 'dart:async';
import 'dart:convert';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'models/splitsync_models.dart';
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
        title: 'SplitSync AI',
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

enum _ScannerState { ready, permission, scanning, denied, unavailable, invalid }

enum _AiState { idle, loading, clarify, unavailable, error }

enum _TtsState { idle, loading, ready, unavailable }

enum _MicState { idle, listening, denied, unavailable }

enum _ConnectErrorKind { none, invalidKey, backendUnavailable }

class _DemoState extends State<Demo> {
  static const names = ['Maya', 'Arun', 'Leah'];

  late final http.Client _client;
  late final bool _ownsClient;
  AudioPlayer? _audio;

  // Navigation & mode state
  String page = 'welcome';
  bool connected = false;
  bool staticPreview = false;
  bool showBackendConfig = false;
  bool obscureKey = true;
  bool backendBusy = false;

  // Providers capability state
  bool paypalConfigured = false;
  bool aiConfigured = false;
  bool deliveryConfigured = false;

  // SS-001 Demo Merchant purchase state
  String lamp = 'Maya';
  String selected = 'Maya';
  String result = 'processing';
  bool published = false;
  bool rentReviewed = false;
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
  String billExtractState = 'idle'; // idle | loading | ready | error
  String billExtractError = '';
  ExtractedBillDraft billDraft = ExtractedBillDraft.oliveSample();

  _MicState micState = _MicState.idle;
  String micError = '';
  String requestParseState = 'idle'; // idle | loading | clarify | ready | error
  String requestParseError = '';
  String requestModelUsed = '';
  String clarificationPrompt = '';
  List<RecipientDraft> recipientDrafts = [];
  String deliveryChannel = 'link';
  _TtsState reqTtsState = _TtsState.idle;
  String reqTtsError = '';

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
  final transcriptController = TextEditingController();
  final billMerchantController = TextEditingController(text: 'Olive Kitchen');
  final billDateController = TextEditingController(text: '2026-11-10');
  final billTotalController = TextEditingController(text: '42.00');
  final storeSearchController = TextEditingController();
  final newContactNameController = TextEditingController();
  final newContactHandleController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _ownsClient = widget.httpClient == null;
    _client = widget.httpClient ?? http.Client();
  }

  @override
  void dispose() {
    if (_audio != null) unawaited(_audio!.dispose());
    if (_ownsClient) _client.close();
    organizerKeyController.dispose();
    originController.dispose();
    instructionController.dispose();
    linkController.dispose();
    transcriptController.dispose();
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
  }) async {
    final uri = Uri.parse('$_origin$path');
    final headers = {
      'Authorization': 'Bearer $_organizerKey',
      'Content-Type': 'application/json',
    };
    final response = await (body == null
            ? _client.get(uri, headers: headers)
            : _client.post(uri, headers: headers, body: jsonEncode(body)))
        .timeout(const Duration(seconds: 25));

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

  Future<void> signInOrganizer() async {
    if (_organizerKey.isEmpty) {
      setState(() {
        connectErrorKind = _ConnectErrorKind.invalidKey;
        connectErrorMessage =
            'Enter the SplitSync organizer key printed in the server terminal.';
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
      final purchase = Map<String, dynamic>.from(full['purchase'] as Map);
      lamp = purchase['lamp'] as String;
      selected = lamp;
      published = purchase['published'] as bool;
      serverParticipants = (purchase['participants'] as List)
          .map((p) => Map<String, dynamic>.from(p as Map))
          .toList();
      if (full['contacts'] is List) {
        contacts = (full['contacts'] as List)
            .map((c) => SplitContact.fromJson(Map<String, dynamic>.from(c as Map)))
            .toList();
      }
      if (full['reimbursements'] is List) {
        reimbursements = (full['reimbursements'] as List)
            .map((r) => ReimbursementRequest.fromJson(
                  Map<String, dynamic>.from(r as Map),
                ))
            .toList();
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
      page = 'welcome';
    });
  }

  static final Uint8List _fallbackPngBytes = base64Decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  );

  // ---------- Scan Bill -> Crop -> Extract -> Voice -> Confirm Actions ----------
  void openBundledSampleReceipt() {
    setState(() {
      billRawPng = _fallbackPngBytes;
      cropTop = 0.03;
      cropBottom = 0.03;
      billDraft = ExtractedBillDraft.oliveSample();
      billMerchantController.text = billDraft.merchant;
      billDateController.text = billDraft.date;
      billTotalController.text = (billDraft.totalCents / 100).toStringAsFixed(2);
      page = 'bill-crop';
    });
    if (widget.enableLiveCamera) {
      unawaited(buildSampleReceiptPng().then((png) {
        if (mounted && png.isNotEmpty) setState(() => billRawPng = png);
      }));
    }
  }

  Future<void> extractBillDetails() async {
    setState(() {
      billExtractState = 'loading';
      billExtractError = '';
      page = 'bill-review';
    });
    if (!connected) {
      setState(() {
        billExtractState = 'ready';
        billMerchantController.text = billDraft.merchant;
        billDateController.text = billDraft.date;
        billTotalController.text = (billDraft.totalCents / 100).toStringAsFixed(2);
      });
      return;
    }
    try {
      final png = billRawPng ?? _fallbackPngBytes;
      final res = await backend(
        '/api/organizer/extract-bill',
        body: {'imageDataUrl': pngBytesToDataUrl(png)},
      );
      if (!mounted) return;
      final items = ((res['items'] as List?) ?? [])
          .map((i) => BillLineItem(
                name: (i as Map)['name']?.toString() ?? 'Item',
                amountCents: (i['amountCents'] as num?)?.toInt() ?? 0,
              ))
          .toList();
      setState(() {
        billDraft = ExtractedBillDraft(
          merchant: res['merchant']?.toString() ?? 'Olive Kitchen',
          date: res['date']?.toString() ?? '2026-11-10',
          currency: res['currency']?.toString() ?? 'USD',
          items: items.isEmpty ? billDraft.items : items,
          taxCents: (res['taxCents'] as num?)?.toInt() ?? 0,
          tipCents: (res['tipCents'] as num?)?.toInt() ?? 0,
          totalCents: (res['totalCents'] as num?)?.toInt() ?? 4200,
          unreadableFields: ((res['unreadableFields'] as List?) ?? [])
              .map((e) => e.toString())
              .toList(),
          modelUsed: res['modelUsed']?.toString() ?? '',
        );
        billMerchantController.text = billDraft.merchant;
        billDateController.text = billDraft.date;
        billTotalController.text = (billDraft.totalCents / 100).toStringAsFixed(2);
        billExtractState = 'ready';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        billExtractState = 'error';
        billExtractError = e.toString();
      });
    }
  }

  Future<void> triggerMicDictation() async {
    if (widget.onDictateSpeech != null) {
      setState(() {
        micState = _MicState.listening;
        micError = '';
      });
      final spoken = await widget.onDictateSpeech!();
      if (!mounted) return;
      setState(() {
        micState = _MicState.idle;
        if (spoken != null && spoken.trim().isNotEmpty) {
          transcriptController.text = spoken.trim();
        } else {
          micState = _MicState.unavailable;
          micError = 'No speech detected. Type or choose a sample below.';
        }
      });
      return;
    }
    setState(() {
      micState = _MicState.unavailable;
      micError =
          'Device microphone capture requires Android/iOS runtime permissions. Type your instruction or tap the sample voice phrase below.';
    });
  }

  Future<void> parseDictatedRequest() async {
    if (transcriptController.text.trim().isEmpty) {
      transcriptController.text =
          'Ask Maya for twenty dollars for dinner and Arun for fifteen for drinks.';
    }
    final text = transcriptController.text.trim();
    setState(() {
      requestParseState = 'loading';
      requestParseError = '';
      reqTtsState = _TtsState.idle;
      page = 'request-review';
    });

    if (!connected) {
      final local = parseStaticTranscript(text, contacts);
      final clarify = local.isEmpty || local.any((r) => r.ambiguous);
      setState(() {
        recipientDrafts = local;
        clarificationPrompt = clarify
            ? 'Confirm unknown or ambiguous recipient names against your contacts below.'
            : '';
        requestModelUsed = 'Static parser';
        requestParseState = clarify ? 'clarify' : 'ready';
      });
      return;
    }

    try {
      final res = await backend(
        '/api/organizer/parse-request',
        body: {
          'transcript': text,
          'bill': {
            'merchant': billDraft.merchant,
            'totalCents': billDraft.totalCents,
            'currency': billDraft.currency,
          },
        },
      );
      if (!mounted) return;
      final list = ((res['recipients'] as List?) ?? [])
          .map((r) => RecipientDraft.fromJson(Map<String, dynamic>.from(r as Map)))
          .toList();
      setState(() {
        recipientDrafts = list;
        clarificationPrompt = res['clarificationPrompt']?.toString() ?? '';
        requestModelUsed = res['modelUsed']?.toString() ?? '';
        requestParseState =
            res['needsClarification'] == true ? 'clarify' : 'ready';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        requestParseState = 'error';
        requestParseError = e.toString();
        if (recipientDrafts.isEmpty) {
          recipientDrafts = parseStaticTranscript(text, contacts);
        }
      });
    }
  }

  String get confirmationPhrase {
    if (recipientDrafts.isEmpty) {
      return 'Add at least one recipient to review and send.';
    }
    final parts = recipientDrafts.map((r) {
      final amtText = centsStr(r.amountCents).replaceFirst('.00', '');
      return '$amtText from ${r.name} for ${r.reason}';
    }).toList();
    final joined = parts.length == 1
        ? parts.first
        : '${parts.sublist(0, parts.length - 1).join(', ')} and ${parts.last}';
    return 'I’ll request $joined. Review and send?';
  }

  Future<void> playAudioBytes(Uint8List wav) async {
    if (widget.onPlayAudio != null) {
      await widget.onPlayAudio!(wav);
    } else {
      _audio ??= AudioPlayer();
      await _audio!.play(BytesSource(wav, mimeType: 'audio/wav'));
    }
  }

  Future<void> readRequestConfirmationAloud() async {
    setState(() {
      reqTtsState = _TtsState.loading;
      reqTtsError = '';
    });
    if (!connected) {
      setState(() {
        reqTtsState = _TtsState.unavailable;
        reqTtsError =
            'Chatterbox audio requires the connected Node backend with NVIDIA_API_KEY.';
      });
      return;
    }
    try {
      final res = await backend(
        '/api/organizer/read-text',
        body: {'text': confirmationPhrase},
      );
      final wav = base64Decode(res['audio'] as String);
      await playAudioBytes(wav);
      if (!mounted) return;
      setState(() => reqTtsState = _TtsState.ready);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        reqTtsState = _TtsState.unavailable;
        reqTtsError = e.toString();
      });
    }
  }

  Future<void> confirmCreateRequests() async {
    if (recipientDrafts.isEmpty ||
        recipientDrafts.any((r) => r.name.trim().isEmpty || r.amountCents <= 0)) {
      showFeedback('Every row requires a recipient name and positive USD amount.');
      return;
    }
    setState(() => backendBusy = true);
    final evidence = billRawPng != null ? pngBytesToDataUrl(billRawPng!) : '';
    final payload = {
      'title': billDraft.merchant,
      'merchant': billDraft.merchant,
      'billDate': billDraft.date,
      'currency': billDraft.currency,
      'items': billDraft.items.map((i) => i.toJson()).toList(),
      'taxCents': billDraft.taxCents,
      'tipCents': billDraft.tipCents,
      'totalCents': billDraft.totalCents,
      'evidenceImageDataUrl': evidence,
      'transcript': transcriptController.text.trim(),
      'channel': deliveryChannel,
      'recipients': recipientDrafts
          .map((r) => {
                'name': r.name.trim(),
                'contactId': r.contactId,
                'amountCents': r.amountCents,
                'currency': r.currency,
                'reason': r.reason,
              })
          .toList(),
    };

    if (!connected) {
      final id = 'REQ-DEMO${reimbursements.length + 1}';
      final failed = deliveryChannel != 'link';
      final rec = ReimbursementRequest(
        id: id,
        title: billDraft.merchant,
        merchant: billDraft.merchant,
        billDate: billDraft.date,
        currency: billDraft.currency,
        items: List.of(billDraft.items),
        taxCents: billDraft.taxCents,
        tipCents: billDraft.tipCents,
        totalCents: billDraft.totalCents,
        evidenceDataUrl: evidence,
        recipients: List.generate(recipientDrafts.length, (i) {
          final r = recipientDrafts[i];
          final tok = 'demo-$id-$i';
          return ReimbursementRecipient(
            id: 'REC-$i',
            name: r.name,
            amountCents: r.amountCents,
            currency: r.currency,
            reason: r.reason,
            status: 'Created',
            deliveryStatus: failed ? 'Failed' : 'Created',
            deliveryMessage: failed
                ? '${deliveryChannel.toUpperCase()} gateway not configured. Use Copy link or Show QR.'
                : 'Ready to share via Copy link or Show QR.',
            shareToken: tok,
            shareUrl: '$_origin/#req/$tok',
          );
        }),
      );
      setState(() {
        reimbursements = [rec, ...reimbursements];
        activeRequestId = rec.id;
        activeRequestQrRecId = rec.recipients.first.id;
        backendBusy = false;
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
        reimbursements = [rec, ...reimbursements];
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
      final data =
          await backend('/api/organizer/read-split', body: {'lamp': lamp});
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
  }) =>
      LayoutBuilder(
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
                          fontSize: 12,
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
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: SplitColors.primary,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.north_east_rounded,
                  color: Colors.white,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'SplitSync AI',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
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
            'Photograph receipts, dictate split instructions by voice, confirm Chatterbox readbacks, and track Sandbox requests.',
            style: TextStyle(color: Color(0xFFDCE1E8), fontSize: 13),
          ),
        ],
      ),
    );

    final signInCard = SplitCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Organizer sign-in',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          const Text(
            'Enter the SplitSync organizer key printed in the Node terminal.',
          ),
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
              child: Text(showBackendConfig
                  ? 'Hide server settings'
                  : 'Backend URL settings'),
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
  Widget homeScreen() {
    final rem = 150 - paidAmount;
    return Column(
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
                    Text('Hello, Leah',
                        style: Theme.of(context).textTheme.headlineMedium),
                    const Text('The new place · Maya, Arun & Leah'),
                  ],
                ),
              ),
              if (cartCount > 0) ...[
                TextButton.icon(
                  onPressed: () => go('cart'),
                  icon: const Icon(Icons.shopping_cart_outlined, size: 18),
                  label: Text('Cart ($cartCount)'),
                ),
                const SizedBox(width: 6),
              ],
              SplitBadge(
                connected ? 'Connected Sandbox' : 'Preview mode',
                preview: !connected,
              ),
            ],
          ),
        ),
        // Action-first PhonePe Payment Hub Card
        Container(
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: SplitColors.navy,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Payments & splits',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  SplitBadge(
                    '$paidPeople/3 settled · ${money(paidAmount)} paid',
                    navy: true,
                  ),
                ],
              ),
              const SizedBox(height: 14),
              LayoutBuilder(
                builder: (context, constraints) {
                  final fourCols = constraints.maxWidth >= 520;
                  final tiles = [
                    SplitHubTile(
                      icon: Icons.qr_code_scanner_rounded,
                      label: 'Scan & Pay',
                      onTap: () => go('scan'),
                    ),
                    SplitHubTile(
                      icon: Icons.north_east_rounded,
                      label: 'Request Money',
                      iconBg: SplitColors.teal,
                      iconFg: const Color(0xFF092421),
                      onTap: () => go('talk'),
                    ),
                    SplitHubTile(
                      icon: Icons.receipt_long_rounded,
                      label: 'Scan Bill',
                      iconBg: Colors.white,
                      iconFg: SplitColors.primaryInk,
                      onTap: () => go('scan-bill'),
                    ),
                    SplitHubTile(
                      icon: Icons.mic_rounded,
                      label: 'Talk to SplitSync',
                      onTap: () => go('talk'),
                    ),
                  ];
                  if (fourCols) {
                    return Row(
                      children: [
                        for (int i = 0; i < tiles.length; i++) ...[
                          Expanded(child: tiles[i]),
                          if (i < tiles.length - 1) const SizedBox(width: 10),
                        ],
                      ],
                    );
                  }
                  return Column(
                    children: [
                      Row(
                        children: [
                          Expanded(child: tiles[0]),
                          const SizedBox(width: 10),
                          Expanded(child: tiles[1]),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(child: tiles[2]),
                          const SizedBox(width: 10),
                          Expanded(child: tiles[3]),
                        ],
                      ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
        // Compact secondary shortcuts (Split Expense, Rent, Store)
        LayoutBuilder(
          builder: (context, constraints) {
            final cards = [
              _shortcutTile(
                Icons.auto_awesome_outlined,
                'Split Expense',
                '\$150 Move-in bill',
                () => go('review'),
              ),
              _shortcutTile(
                Icons.calendar_today_outlined,
                'Rent (Preview)',
                '\$2,400 Dec draft',
                () => go('rent'),
              ),
              _shortcutTile(
                Icons.shopping_bag_outlined,
                'Store (Preview)',
                '${kStoreCatalog.length} demo items',
                () => go('store'),
              ),
            ];
            if (constraints.maxWidth >= 560) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Row(
                  children: [
                    for (int i = 0; i < cards.length; i++) ...[
                      Expanded(child: cards[i]),
                      if (i < cards.length - 1) const SizedBox(width: 10),
                    ],
                  ],
                ),
              );
            }
            return Column(
              children: cards
                  .map((c) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: c,
                      ))
                  .toList(),
            );
          },
        ),
        twoPane(
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text('Active requests',
                          style: Theme.of(context).textTheme.titleLarge),
                    ),
                    TextButton(
                      onPressed: () => go('activity'),
                      child: const Text('All activity'),
                    ),
                  ],
                ),
                const Divider(height: 16, color: SplitColors.line),
                lineRow('Move-in essentials (SS-001)', '${money(paidAmount)} paid'),
                Text('${money(rem)} remaining · Demo Merchant',
                    style: const TextStyle(fontSize: 12, color: SplitColors.muted)),
                const SizedBox(height: 8),
                ...reimbursements.take(3).map((r) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const CircleAvatar(
                        backgroundColor: SplitColors.surfaceTint,
                        child: Icon(Icons.receipt_outlined,
                            color: SplitColors.primaryInk),
                      ),
                      title: Text(r.merchant,
                          style: const TextStyle(fontWeight: FontWeight.w800)),
                      subtitle: Text(
                        '${r.recipients.map((x) => x.name).join(', ')} · ${centsStr(r.totalRequestedCents)}',
                      ),
                      trailing: SplitStatusPill(r.aggregateStatus),
                      onTap: () => setState(() {
                        activeRequestId = r.id;
                        activeRequestQrRecId = r.recipients.firstOrNull?.id;
                        page = 'request-detail';
                      }),
                    )),
              ],
            ),
          ),
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Recent activity',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 6),
                ...names.map((n) => participantRow(n, showStatus: true)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _shortcutTile(
    IconData icon,
    String title,
    String sub,
    VoidCallback onTap,
  ) =>
      Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.all(14),
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
                      Text(title,
                          style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              color: SplitColors.navy,
                              fontSize: 13)),
                      Text(sub,
                          style: const TextStyle(
                              fontSize: 12, color: SplitColors.muted)),
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
      'Created',
      'Sent',
      'Awaiting payment',
      'Processing',
      'Paid',
    ];
    final ssStatus = paidPeople == 3
        ? 'Paid'
        : names.any((n) => paymentStatus(n) == 'Processing')
            ? 'Processing'
            : 'Awaiting payment';
    final filteredReimbs = reimbursements
        .where((r) =>
            activityFilter == 'All' ||
            r.aggregateStatus == activityFilter ||
            r.recipients.any((x) => x.status == activityFilter))
        .toList();
    final showSs = activityFilter == 'All' ||
        ssStatus == activityFilter ||
        names.any((n) => paymentStatus(n) == activityFilter);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Activity',
                        style: Theme.of(context).textTheme.headlineMedium),
                    const Text('Reimbursement requests, SS-001 orders, and Rent.'),
                  ],
                ),
              ),
              if (connected)
                SplitSecondaryButton(
                  label: 'Refresh',
                  leadingIcon: Icons.refresh_rounded,
                  expand: false,
                  onPressed: () => syncLedger(),
                ),
            ],
          ),
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: filters
                .map((f) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(f),
                        selected: activityFilter == f,
                        onSelected: (_) => setState(() => activityFilter = f),
                      ),
                    ))
                .toList(),
          ),
        ),
        const SizedBox(height: 14),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ...filteredReimbs.map((r) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const CircleAvatar(
                      backgroundColor: SplitColors.surfaceTint,
                      child: Icon(Icons.receipt_long_rounded,
                          color: SplitColors.primaryInk),
                    ),
                    title: Text(r.merchant,
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: Text(
                      '${r.recipients.length} recipients · ${centsStr(r.owedCents)} owed',
                    ),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(centsStr(r.totalRequestedCents),
                            style:
                                const TextStyle(fontWeight: FontWeight.w800)),
                        SplitStatusPill(r.aggregateStatus),
                      ],
                    ),
                    onTap: () => setState(() {
                      activeRequestId = r.id;
                      activeRequestQrRecId = r.recipients.firstOrNull?.id;
                      page = 'request-detail';
                    }),
                  )),
              if (showSs)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const CircleAvatar(
                    backgroundColor: SplitColors.surfaceTint,
                    child: Icon(Icons.storefront_rounded,
                        color: SplitColors.primaryInk),
                  ),
                  title: const Text('Move-in essentials · Demo Merchant',
                      style: TextStyle(fontWeight: FontWeight.w800)),
                  subtitle: Text(
                    'SS-001 · \$${150 - paidAmount}.00 owed',
                  ),
                  trailing: SplitStatusPill(ssStatus),
                  onTap: () => go('dashboard'),
                ),
              if (!showSs && filteredReimbs.isEmpty)
                Text('No requests match "$activityFilter".'),
            ],
          ),
        ),
        SplitCard(
          child: Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SplitBadge('Preview feature', preview: true),
                    SizedBox(height: 6),
                    Text('December 2026 Rent Draft',
                        style: TextStyle(fontWeight: FontWeight.w800)),
                    Text('\$2,400.00 USD due Dec 1 · Equal \$800 shares'),
                  ],
                ),
              ),
              SplitSecondaryButton(
                label: 'Open Rent',
                expand: false,
                onPressed: () => go('rent'),
              ),
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
    final activeRec = req.recipients
            .where((r) => r.id == activeRequestQrRecId)
            .firstOrNull ??
        req.recipients.firstOrNull;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: req.merchant,
          subtitle: '${req.id} · ${centsStr(req.owedCents)} still owed',
          onBack: () => go('activity'),
          trailing: const SplitBadge('Receipt reimbursement', preview: true),
        ),
        twoPane(
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Receipt evidence',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 10),
                if (billRawPng != null && billRawPng!.isNotEmpty)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.memory(
                      billRawPng!,
                      height: 180,
                      width: double.infinity,
                      fit: BoxFit.contain,
                    ),
                  ),
                const SizedBox(height: 10),
                ...req.items.map((i) => lineRow(i.name, centsStr(i.amountCents))),
                if (req.taxCents > 0) lineRow('Tax', centsStr(req.taxCents)),
                if (req.tipCents > 0) lineRow('Tip', centsStr(req.tipCents)),
                const Divider(height: 18, color: SplitColors.line),
                lineRow('Bill total', centsStr(req.totalCents), bold: true),
                const SplitCallout(
                  message:
                      'Photographed receipt evidence creates peer reimbursement links. Commercial PayPal Orders v2 checkout applies only to Demo Merchant SS-001.',
                ),
              ],
            ),
          ),
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Recipients (${req.recipients.length})',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 10),
                ...req.recipients.map((r) => Container(
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
                                    Text('${r.name} · ${centsStr(r.amountCents)} USD',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w800)),
                                    Text('Reason: ${r.reason}',
                                        style: const TextStyle(
                                            fontSize: 12,
                                            color: SplitColors.muted)),
                                  ],
                                ),
                              ),
                              SplitStatusPill(r.status),
                              if (r.deliveryStatus == 'Failed') ...[
                                const SizedBox(width: 4),
                                const SplitStatusPill('Failed'),
                              ],
                            ],
                          ),
                          if (r.deliveryMessage.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(r.deliveryMessage,
                                style: const TextStyle(fontSize: 12)),
                          ],
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              ActionChip(
                                label: const Text('Copy link'),
                                onPressed: () {
                                  Clipboard.setData(
                                      ClipboardData(text: r.shareUrl));
                                  showFeedback('${r.name}’s request link copied');
                                },
                              ),
                              ActionChip(
                                label: const Text('Show QR'),
                                onPressed: () => setState(
                                    () => activeRequestQrRecId = r.id),
                              ),
                              ActionChip(
                                label: const Text('Open share'),
                                onPressed: () => setState(() {
                                  payerReimbRequest = req;
                                  payerReimbRecipient = r;
                                  page = 'reimbursement-payer';
                                }),
                              ),
                              if (r.status == 'Created')
                                ActionChip(
                                  label: const Text('Mark Sent'),
                                  onPressed: () async {
                                    if (connected) {
                                      await backend(
                                        '/api/organizer/requests/${req.id}/deliver',
                                        body: {
                                          'action': 'mark_shared',
                                          'recipientId': r.id,
                                        },
                                      );
                                    }
                                    setState(() {
                                      r.status = 'Sent';
                                      r.deliveryStatus = 'Sent';
                                    });
                                  },
                                ),
                              if (r.status != 'Paid')
                                ActionChip(
                                  label: const Text('Mark Paid'),
                                  onPressed: () async {
                                    if (connected) {
                                      await backend(
                                        '/api/organizer/requests/${req.id}/recipients/${r.id}/status',
                                        body: {'status': 'Paid'},
                                      );
                                    }
                                    setState(() => r.status = 'Paid');
                                  },
                                ),
                            ],
                          ),
                        ],
                      ),
                    )),
                if (activeRec != null) ...[
                  const Divider(height: 20, color: SplitColors.line),
                  Center(
                    child: Column(
                      children: [
                        QrImageView(data: activeRec.shareUrl, size: 128),
                        const SizedBox(height: 6),
                        Text(
                          '${activeRec.name} · ${centsStr(activeRec.amountCents)} USD (${activeRec.reason})',
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
          title: 'Reimbursement · ${centsStr(rec.amountCents)} USD',
          subtitle: 'From Leah for ${rec.reason}',
          onBack: () => go('request-detail'),
          trailing: SplitStatusPill(rec.status),
        ),
        twoPane(
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Bill evidence · ${req.merchant}',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 10),
                if (billRawPng != null && billRawPng!.isNotEmpty)
                  Image.memory(billRawPng!, height: 150, fit: BoxFit.contain),
                ...req.items.map((i) => lineRow(i.name, centsStr(i.amountCents))),
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
                lineRow('Amount requested', '${centsStr(rec.amountCents)} USD',
                    bold: true),
                const SplitCallout(
                  message:
                      'Personal receipt reimbursement link. Commercial PayPal Orders v2 checkout applies only to Demo Merchant SS-001.',
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitStepHeader(
            step: 1,
            total: 4,
            label: 'Scan Bill · Step 1',
            onBack: () => go('home')),
        SplitScreenHeader(
          title: 'Scan paper bill',
          subtitle: 'Separate from merchant QR. Use camera or bundled receipt.',
          onBack: () => go('home'),
        ),
        twoPane(
          Container(
            height: 240,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: SplitColors.navy,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    billCamState == 'denied'
                        ? Icons.no_photography_outlined
                        : billCamState == 'unavailable'
                            ? Icons.videocam_off_outlined
                            : Icons.receipt_long_rounded,
                    color: Colors.white,
                    size: 42,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    billCamState == 'denied'
                        ? 'Camera permission denied'
                        : billCamState == 'unavailable'
                            ? 'Camera unavailable'
                            : 'Ready for receipt photo',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 17,
                    ),
                  ),
                  if (billCamError.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(billCamError,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                            color: Color(0xFFDCE1E8), fontSize: 12)),
                  ],
                ],
              ),
            ),
          ),
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Receipt source',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                const Text(
                  'Use the bundled Olive Kitchen receipt or test camera permission/unavailable fallbacks.',
                ),
                const SizedBox(height: 14),
                SplitPrimaryButton(
                  label: 'Use bundled sample receipt',
                  leadingIcon: Icons.receipt_outlined,
                  onPressed: openBundledSampleReceipt,
                ),
                const SizedBox(height: 10),
                twoButtons(
                  SplitSecondaryButton(
                    label: 'Test denied',
                    onPressed: () => setState(() {
                      billCamState = 'denied';
                      billCamError =
                          'Permission blocked. Open the bundled sample receipt.';
                    }),
                  ),
                  SplitSecondaryButton(
                    label: 'Test unavailable',
                    onPressed: () => setState(() {
                      billCamState = 'unavailable';
                      billCamError =
                          'No live camera detected. Use bundled sample receipt.';
                    }),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget billCropScreen() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitStepHeader(
            step: 2,
            total: 4,
            label: 'Crop & Extract · Step 2',
            onBack: () => go('scan-bill')),
        SplitScreenHeader(
          title: 'Crop or retake bill',
          onBack: () => go('scan-bill'),
        ),
        twoPane(
          SplitCard(
            child: billRawPng != null && billRawPng!.isNotEmpty
                ? ClipRect(
                    child: Align(
                      alignment: Alignment.center,
                      heightFactor: (1 - (cropTop + cropBottom)).clamp(0.4, 1.0),
                      child: Image.memory(billRawPng!, height: 260, fit: BoxFit.contain),
                    ),
                  )
                : const SizedBox(
                    height: 200,
                    child: Center(child: Text('Bundled Olive Kitchen sample receipt')),
                  ),
          ),
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Adjust crop frame',
                    style: Theme.of(context).textTheme.titleLarge),
                Slider(
                  value: cropTop,
                  min: 0,
                  max: 0.3,
                  label: 'Top ${(cropTop * 100).round()}%',
                  onChanged: (v) => setState(() => cropTop = v),
                ),
                Slider(
                  value: cropBottom,
                  min: 0,
                  max: 0.3,
                  label: 'Bottom ${(cropBottom * 100).round()}%',
                  onChanged: (v) => setState(() => cropBottom = v),
                ),
                twoButtons(
                  SplitSecondaryButton(
                    label: 'Retake photo',
                    onPressed: () => go('scan-bill'),
                  ),
                  SplitPrimaryButton(
                    label: 'Extract bill details',
                    onPressed: extractBillDetails,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget micPanelWidget() {
    return Container(
      margin: const EdgeInsets.only(top: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: SplitColors.surfaceTint,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFCFE0FF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Voice split instruction',
                  style: TextStyle(
                      fontWeight: FontWeight.w800, color: SplitColors.navy),
                ),
              ),
              SplitPrimaryButton(
                label: micState == _MicState.listening
                    ? 'Listening…'
                    : micState == _MicState.denied
                        ? 'Mic blocked'
                        : 'Tap mic to speak',
                leadingIcon: Icons.mic_rounded,
                trailingIcon: null,
                expand: false,
                onPressed: triggerMicDictation,
              ),
            ],
          ),
          if (micError.isNotEmpty)
            SplitCallout(kind: CalloutKind.warning, message: micError),
          const SizedBox(height: 10),
          SplitTextField(
            label: 'Transcript / split instruction',
            hintText:
                'Ask Maya for twenty dollars for dinner and Arun for fifteen for drinks.',
            controller: transcriptController,
            maxLines: 3,
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ActionChip(
                label: const Text('Sample: Maya \$20 + Arun \$15'),
                onPressed: () => setState(() {
                  transcriptController.text =
                      'Ask Maya for twenty dollars for dinner and Arun for fifteen for drinks.';
                }),
              ),
              ActionChip(
                label: const Text('Test clarify (unknown Alex)'),
                onPressed: () => setState(() {
                  transcriptController.text =
                      'Ask Alex for ten dollars for coffee';
                }),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SplitPrimaryButton(
            label: 'Review spoken request',
            onPressed: parseDictatedRequest,
          ),
        ],
      ),
    );
  }

  Widget billReviewScreen() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitStepHeader(
            step: 3,
            total: 4,
            label: 'Review Bill & Dictate · Step 3',
            onBack: () => go('bill-crop')),
        SplitScreenHeader(
          title: 'Extracted bill & voice split',
          subtitle: billDraft.modelUsed.isNotEmpty
              ? 'Extracted with ${billDraft.modelUsed}'
              : 'Editable receipt & voice mic',
          onBack: () => go('bill-crop'),
        ),
        twoPane(
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (billRawPng != null && billRawPng!.isNotEmpty)
                  Image.memory(billRawPng!, height: 220, fit: BoxFit.contain),
                if (billExtractState == 'loading') ...[
                  const SizedBox(height: 10),
                  const LinearProgressIndicator(color: SplitColors.primary),
                  const SplitCallout(message: 'Extracting receipt details…'),
                ],
                if (billExtractState == 'error')
                  SplitCallout(
                    kind: CalloutKind.warning,
                    title: 'Extraction unavailable',
                    message: billExtractError,
                  ),
              ],
            ),
          ),
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (billDraft.unreadableFields.isNotEmpty)
                  SplitCallout(
                    kind: CalloutKind.warning,
                    message:
                        'Flagged unreadable fields: ${billDraft.unreadableFields.join(', ')}',
                  ),
                if (billDraft.totalMismatch)
                  SplitCallout(
                    kind: CalloutKind.error,
                    message:
                        'Items total ${centsStr(billDraft.computedTotalCents)} differs from bill total ${centsStr(billDraft.totalCents)}.',
                    trailing: SplitSecondaryButton(
                      label: 'Match ${centsStr(billDraft.computedTotalCents)}',
                      expand: false,
                      onPressed: () => setState(() {
                        billDraft.totalCents = billDraft.computedTotalCents;
                        billTotalController.text =
                            (billDraft.totalCents / 100).toStringAsFixed(2);
                      }),
                    ),
                  ),
                SplitTextField(
                  label: 'Merchant',
                  controller: billMerchantController,
                  onChanged: (v) => billDraft.merchant = v,
                ),
                const SizedBox(height: 10),
                SplitTextField(
                  label: 'Total (${billDraft.currency})',
                  controller: billTotalController,
                  onChanged: (v) {
                    setState(() {
                      billDraft.totalCents =
                          ((double.tryParse(v) ?? 0) * 100).round();
                    });
                  },
                ),
                const SizedBox(height: 10),
                ...billDraft.items
                    .map((i) => lineRow(i.name, centsStr(i.amountCents))),
                micPanelWidget(),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget talkScreen() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: 'Talk to SplitSync',
          subtitle: 'Dictate or type any split request and hear Chatterbox confirm.',
          onBack: () => go('home'),
        ),
        SplitCard(child: micPanelWidget()),
      ],
    );
  }

  Widget requestReviewScreen() {
    final alloc = recipientDrafts.fold(0, (s, r) => s + r.amountCents);
    final billTotal = billDraft.totalCents;
    final unalloc = billTotal > 0 ? billTotal - alloc : 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitStepHeader(
            step: 4,
            total: 4,
            label: 'Confirm Request · Step 4',
            onBack: () => go(billRawPng != null ? 'bill-review' : 'talk')),
        SplitScreenHeader(
          title: 'Review & confirm requests',
          subtitle: requestModelUsed.isNotEmpty ? 'Parsed with $requestModelUsed' : '',
          onBack: () => go(billRawPng != null ? 'bill-review' : 'talk'),
        ),
        twoPane(
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SplitTextField(
                  label: 'Transcript',
                  controller: transcriptController,
                  maxLines: 3,
                ),
                const SizedBox(height: 10),
                twoButtons(
                  SplitSecondaryButton(
                    label: 'Re-parse',
                    onPressed: parseDictatedRequest,
                  ),
                  SplitSecondaryButton(
                    label: 'Add recipient',
                    onPressed: () => setState(() {
                      recipientDrafts.add(RecipientDraft(
                        name: 'Maya',
                        contactId: 'maya',
                        known: true,
                        amountCents: 1000,
                        reason: 'Shared expense',
                      ));
                    }),
                  ),
                ),
                if (billTotal > 0) ...[
                  const Divider(height: 20, color: SplitColors.line),
                  lineRow('Bill (${billDraft.merchant})', centsStr(billTotal)),
                  lineRow('Allocated', centsStr(alloc)),
                  lineRow('Unallocated balance', '${centsStr(unalloc)} USD',
                      bold: true),
                ],
              ],
            ),
          ),
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (requestParseState == 'loading')
                  const LinearProgressIndicator(color: SplitColors.primary),
                if (requestParseState == 'error')
                  SplitCallout(
                      kind: CalloutKind.warning, message: requestParseError),
                if (clarificationPrompt.isNotEmpty)
                  SplitCallout(
                      kind: CalloutKind.warning,
                      title: 'Clarification needed',
                      message: clarificationPrompt),
                ...recipientDrafts.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final r = entry.value;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: !r.known
                            ? const Color(0xFFF4DA9C)
                            : SplitColors.line,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        lineRow('${r.name} · ${r.reason}',
                            '${centsStr(r.amountCents)} ${r.currency}',
                            bold: true),
                        if (!r.known)
                          Wrap(
                            spacing: 6,
                            children: contacts
                                .map((c) => ActionChip(
                                      label: Text('Use ${c.name}'),
                                      onPressed: () => setState(() {
                                        r.name = c.name;
                                        r.contactId = c.id;
                                        r.known = true;
                                        r.ambiguous = false;
                                        clarificationPrompt = '';
                                      }),
                                    ))
                                .toList(),
                          ),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: () => setState(
                                () => recipientDrafts.removeAt(idx)),
                            child: const Text('Remove'),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: SplitColors.surfaceSubtle,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: SplitColors.line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Chatterbox voice reply',
                          style: TextStyle(fontWeight: FontWeight.w800)),
                      Text('“$confirmationPhrase”',
                          style: const TextStyle(fontSize: 13)),
                      const SizedBox(height: 8),
                      SplitSecondaryButton(
                        label: reqTtsState == _TtsState.loading
                            ? 'Speaking…'
                            : 'Hear reply',
                        leadingIcon: Icons.volume_up_rounded,
                        onPressed: reqTtsState == _TtsState.loading
                            ? null
                            : readRequestConfirmationAloud,
                      ),
                      if (reqTtsState == _TtsState.unavailable)
                        SplitCallout(
                            kind: CalloutKind.warning, message: reqTtsError),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: deliveryChannel,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Delivery channel'),
                  items: const [
                    DropdownMenuItem(
                        value: 'link', child: Text('Private link & QR')),
                    DropdownMenuItem(
                        value: 'email',
                        child: Text('Email gateway (unconfigured stays Created)')),
                    DropdownMenuItem(
                        value: 'sms',
                        child: Text('SMS gateway (unconfigured stays Created)')),
                  ],
                  onChanged: (v) {
                    if (v != null) setState(() => deliveryChannel = v);
                  },
                ),
                const SizedBox(height: 14),
                SplitPrimaryButton(
                  label: backendBusy
                      ? 'Creating…'
                      : 'Confirm & create requests',
                  onPressed: backendBusy ? null : confirmCreateRequests,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ---------- Existing SS-001 Demo Merchant Screens (Updated with SplitScreenHeader) ----------
  Widget scannerScreen({bool forceError = false}) {
    final effective = forceError ? _ScannerState.denied : scannerState;
    Widget previewBox;
    if (effective == _ScannerState.denied || effective == _ScannerState.unavailable) {
      previewBox = Container(
        height: 240,
        decoration: BoxDecoration(
          color: SplitColors.navy,
          borderRadius: BorderRadius.circular(16),
        ),
        padding: const EdgeInsets.all(20),
        child: Center(
          child: Text(
            effective == _ScannerState.denied
                ? 'Camera permission denied. Open demo purchase below.'
                : 'Camera unavailable. Open demo purchase below.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
          ),
        ),
      );
    } else if (effective == _ScannerState.scanning && widget.enableLiveCamera) {
      previewBox = ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: SizedBox(
          height: 240,
          child: MobileScanner(
            onDetect: (c) {
              final raw = c.barcodes.firstOrNull?.rawValue;
              if (raw != null && raw.contains('#purchase/SS-001')) go('review');
            },
          ),
        ),
      );
    } else {
      previewBox = Container(
        height: 240,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: SplitColors.navy,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Center(
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
            ),
            child: QrImageView(data: '$_origin/#purchase/SS-001', size: 124),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitStepHeader(
            step: 1,
            total: 4,
            label: 'Scan & Pay · Step 1',
            onBack: () => go('home')),
        SplitScreenHeader(
          title: 'Scan merchant QR',
          subtitle: 'Merchant checkout QR for SS-001 (\$150.00 Demo Merchant).',
          onBack: () => go('home'),
        ),
        twoPane(
          previewBox,
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SplitPrimaryButton(
                  label: 'Open demo purchase',
                  onPressed: () => go('review'),
                ),
                const SizedBox(height: 10),
                SplitTextField(
                  label: 'Or paste merchant link',
                  hintText: '#purchase/SS-001',
                  controller: linkController,
                ),
                const SizedBox(height: 10),
                SplitSecondaryButton(
                  label: 'Open pasted link',
                  onPressed: () {
                    final raw = linkController.text.trim();
                    if (raw.isEmpty || raw.contains('SS-001')) {
                      go('review');
                    } else {
                      setState(() {
                        scannerState = _ScannerState.invalid;
                        scannerError = 'Only #purchase/SS-001 is supported.';
                      });
                    }
                  },
                ),
                if (scannerState == _ScannerState.invalid)
                  SplitCallout(kind: CalloutKind.error, message: scannerError),
              ],
            ),
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
          SplitStepHeader(
              step: 2,
              total: 4,
              label: 'Review Bill · Step 2',
              onBack: () => go('scan')),
          SplitScreenHeader(
            title: 'Review purchase',
            subtitle: 'Move-in essentials · Demo Merchant · SS-001',
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
        SplitStepHeader(
            step: 3,
            total: 4,
            label: 'AI Split · Step 3',
            onBack: () => go('review')),
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
                        labelText: 'Who pays for the \$30.00 lamp?'),
                    items: names
                        .map((n) => DropdownMenuItem(
                            value: n, child: Text('$n (\$70.00)')))
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
                  onPressed: ttsState == _TtsState.loading ? null : readSplitAloud,
                ),
                if (ttsState == _TtsState.unavailable)
                  SplitCallout(
                      kind: CalloutKind.warning,
                      title: 'Audio unavailable',
                      message: ttsError),
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
        SplitStepHeader(
            step: 4,
            total: 4,
            label: 'Share · Step 4',
            onBack: () => go('split')),
        SplitScreenHeader(
          title: 'Share payment requests',
          onBack: () => go('split'),
        ),
        twoPane(
          SplitCard(
            child: Column(
              children: [
                ...names.map((n) => Column(
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
                    )),
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
                if (activeUrl != null)
                  QrImageView(data: activeUrl, size: 136),
                const SizedBox(height: 10),
                Text(
                  '$selected · ${money(share(selected))} USD',
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w800),
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
                  Text('${money(paidAmount)} / \$150.00 USD paid',
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                      value: (paidAmount / 150).clamp(0.0, 1.0),
                      color: SplitColors.teal),
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
            .where((p) =>
                (storeCategory == 'All' || p.category == storeCategory) &&
                (q.isEmpty ||
                    p.name.toLowerCase().contains(q) ||
                    p.seller.toLowerCase().contains(q)))
            .toList();
    final retailers = (storeCategory == 'All' || storeCategory == 'Retailers')
        ? kExternalRetailers
            .where((r) =>
                (storeCategory == 'All' ||
                    storeCategory == 'Retailers' ||
                    r.category == storeCategory) &&
                (q.isEmpty || r.name.toLowerCase().contains(q)))
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
                      Text('splitStore',
                          style: Theme.of(context).textTheme.headlineMedium),
                      Text(interests.isEmpty
                          ? 'Sample inventory · Preview'
                          : 'Preferences: ${interests.join(', ')}'),
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
                .map((c) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(c),
                        selected: storeCategory == c,
                        onSelected: (_) => setState(() => storeCategory = c),
                      ),
                    ))
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
                  .map((c) => SizedBox(
                        width: (constraints.maxWidth - (cols - 1) * 14) / cols,
                        child: c,
                      ))
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
            Text(centsStr(p.priceCents),
                style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: SplitColors.primaryInk,
                    fontSize: 16)),
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
                    final row =
                        cart.where((c) => c.product.id == p.id).firstOrNull;
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
              child: const Icon(Icons.storefront_outlined,
                  size: 42, color: SplitColors.navy),
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
                    child: Icon(activeProduct.icon,
                        size: 68, color: SplitColors.primaryInk)),
                const SizedBox(height: 12),
                Text('${centsStr(activeProduct.priceCents)} USD',
                    style: Theme.of(context).textTheme.headlineMedium),
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
    final totalCents =
        cart.fold(0, (s, c) => s + c.product.priceCents * c.qty);
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
                    ...cart.map((c) => lineRow(
                        '${c.product.name} × ${c.qty}',
                        centsStr(c.product.priceCents * c.qty))),
                    const Divider(height: 20, color: SplitColors.line),
                    lineRow('Subtotal', '${centsStr(totalCents)} USD',
                        bold: true),
                    const SizedBox(height: 12),
                    twoButtons(
                      SplitSecondaryButton(
                        label: 'Clear cart',
                        onPressed: () => setState(cart.clear),
                      ),
                      SplitPrimaryButton(
                        label: 'Split with people',
                        onPressed: () {
                          final each = (totalCents / 3).round();
                          setState(() {
                            billRawPng = null;
                            billDraft = ExtractedBillDraft(
                              merchant: 'splitStore Shared Cart',
                              date: '2026-11-10',
                              items: cart
                                  .map((c) => BillLineItem(
                                      name: '${c.product.name} x${c.qty}',
                                      amountCents:
                                          c.product.priceCents * c.qty))
                                  .toList(),
                              totalCents: totalCents,
                              modelUsed: 'Store Cart',
                            );
                            transcriptController.text =
                                'Split ${centsStr(totalCents)} store cart evenly between Maya, Arun, and Leah.';
                            recipientDrafts = [
                              RecipientDraft(
                                  name: 'Maya',
                                  contactId: 'maya',
                                  known: true,
                                  amountCents: each,
                                  reason: cart.first.product.name),
                              RecipientDraft(
                                  name: 'Arun',
                                  contactId: 'arun',
                                  known: true,
                                  amountCents: each,
                                  reason: cart.first.product.name),
                              RecipientDraft(
                                  name: 'Leah',
                                  contactId: 'leah',
                                  known: true,
                                  amountCents:
                                      (totalCents - each * 2).clamp(100, totalCents),
                                  reason: cart.first.product.name),
                            ];
                            requestModelUsed = 'Store Cart';
                            page = 'request-review';
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
                    onChanged: (v) => setState(() =>
                        v == true ? interests.add(n) : interests.remove(n)),
                  ),
                ),
                twoButtons(
                  SplitSecondaryButton(
                    label: 'Skip',
                    onPressed: () => go('store'),
                  ),
                  SplitPrimaryButton(
                    label: 'Save',
                    onPressed: () => go('store'),
                  ),
                ),
              ],
            ),
          ),
        ],
      );

  Widget rentScreen() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SplitScreenHeader(
            title: 'Monthly rent draft',
            subtitle: 'Preview workflow · Separate from PayPal checkout',
            onBack: () => go('home'),
            trailing: const SplitBadge('Preview', preview: true),
          ),
          twoPane(
            SplitCard(
              child: Column(
                children: [
                  lineRow('December 2026 total', '\$2,400.00 USD', bold: true),
                  lineRow('Due date', 'December 1, 2026'),
                  ...names.map((n) => lineRow(n, '\$800.00')),
                  const SizedBox(height: 10),
                  SplitPrimaryButton(
                    label: rentReviewed
                        ? 'Reviewed (demo only)'
                        : 'Review monthly draft',
                    onPressed: () =>
                        setState(() => rentReviewed = !rentReviewed),
                  ),
                ],
              ),
            ),
            SplitCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Saved split rules',
                      style: Theme.of(context).textTheme.titleLarge),
                  lineRow('Household', 'The new place (3 roommates)'),
                  lineRow('Rule', 'Equal 3-way (\$800.00 each)'),
                  lineRow('Schedule', '1st of every month'),
                ],
              ),
            ),
          ),
        ],
      );

  // ---------- Tab 4: Profile & Contacts & Providers ----------
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
                      Text('Profile & Settings',
                          style: Theme.of(context).textTheme.headlineMedium),
                      const Text('Contacts, Sandbox session, and providers.'),
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
                  Text('Organizer Sandbox Session',
                      style: Theme.of(context).textTheme.titleLarge),
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
                  lineRow('AI Extract & Split', aiConfigured ? 'Configured' : 'Preview/Manual'),
                  lineRow('Chatterbox TTS', aiConfigured ? 'Configured' : 'Unavailable'),
                  lineRow('PayPal Sandbox (SS-001)', paypalConfigured ? 'Configured' : 'Unconfigured'),
                  lineRow('Email / SMS Delivery', deliveryConfigured ? 'Configured' : 'Manual link/QR'),
                ],
              ),
            ),
            SplitCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Contacts (${contacts.length})',
                      style: Theme.of(context).textTheme.titleLarge),
                  ...contacts.map((c) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: participantAvatar(c.name),
                        title: Text(c.name,
                            style: const TextStyle(fontWeight: FontWeight.w800)),
                        subtitle: Text(c.handle.isEmpty ? c.note : c.handle),
                      )),
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
                        await backend('/api/organizer/contacts',
                            body: {'name': name});
                      }
                      setState(() {
                        contacts.add(SplitContact(id: name.toLowerCase(), name: name));
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
        'request-review' => requestReviewScreen(),
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
                Text('PayPal Sandbox preview',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 10),
                ...['processing', 'paid', 'cancelled'].map((s) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: SplitPrimaryButton(
                        label: 'Preview ${s[0].toUpperCase()}${s.substring(1)}',
                        onPressed: () => setState(() {
                          result = s;
                          page = 'result';
                        }),
                      ),
                    )),
              ],
            ),
          ),
        'result' => SplitCard(
            child: Column(
              children: [
                Text('Result: $result',
                    style: Theme.of(context).textTheme.headlineMedium),
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
        padding: const EdgeInsets.all(18),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1020),
            child: currentBody(),
          ),
        ),
      ),
    );

    if (useRail) {
      content = Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          NavigationRail(
            selectedIndex: tabIdx,
            backgroundColor: Colors.white,
            labelType: NavigationRailLabelType.all,
            onDestinationSelected: (i) => go(_tabPages[i]),
            leading: Container(
              margin: const EdgeInsets.symmetric(vertical: 8),
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: SplitColors.primary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.north_east_rounded,
                  color: Colors.white, size: 19),
            ),
            destinations: [
              const NavigationRailDestination(
                  icon: Icon(Icons.home_outlined),
                  selectedIcon: Icon(Icons.home_rounded),
                  label: Text('Home')),
              const NavigationRailDestination(
                  icon: Icon(Icons.history_rounded),
                  label: Text('Activity')),
              NavigationRailDestination(
                  icon: Badge(
                    isLabelVisible: cartCount > 0,
                    label: Text('$cartCount'),
                    child: const Icon(Icons.shopping_bag_outlined),
                  ),
                  label: const Text('Store')),
              const NavigationRailDestination(
                  icon: Icon(Icons.person_outline_rounded),
                  label: Text('Profile')),
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
                    label: 'Home'),
                const NavigationDestination(
                    icon: Icon(Icons.history_rounded), label: 'Activity'),
                NavigationDestination(
                    icon: Badge(
                      isLabelVisible: cartCount > 0,
                      label: Text('$cartCount'),
                      child: const Icon(Icons.shopping_bag_outlined),
                    ),
                    label: 'Store'),
                const NavigationDestination(
                    icon: Icon(Icons.person_outline_rounded),
                    label: 'Profile'),
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
