import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:ui' as ui;
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/cupertino.dart';
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
import 'widgets/medfarm_login_screen.dart';
import 'widgets/wallet_and_cycle.dart';

const payerOrigin = String.fromEnvironment(
  'PAYER_ORIGIN',
  defaultValue: 'http://localhost:3000',
);

void main() => runApp(const SplitSync());

class SplitSync extends StatefulWidget {
  final http.Client? httpClient;
  final bool enableLiveCamera;
  final Future<void> Function(Uint8List wavBytes)? onPlayAudio;
  final Future<String?> Function()? onDictateSpeech;
  final DateTime Function()? nowProvider;
  final ThemeMode initialThemeMode;
  final bool initialUnlocked;
  final bool autoPromptPhoneAuth;
  final Future<bool> Function()? authenticateOverride;

  const SplitSync({
    super.key,
    this.httpClient,
    this.enableLiveCamera = true,
    this.onPlayAudio,
    this.onDictateSpeech,
    this.nowProvider,
    this.initialThemeMode = ThemeMode.system,
    this.initialUnlocked = false,
    this.autoPromptPhoneAuth = true,
    this.authenticateOverride,
  });

  @override
  State<SplitSync> createState() => _SplitSyncState();
}

class _SplitSyncState extends State<SplitSync> {
  late ThemeMode _themeMode = widget.initialThemeMode;

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'AI',
    debugShowCheckedModeBanner: false,
    theme: buildSplitSyncTheme(brightness: Brightness.light),
    darkTheme: buildSplitSyncTheme(brightness: Brightness.dark),
    themeMode: _themeMode,
    home: Demo(
      httpClient: widget.httpClient,
      enableLiveCamera: widget.enableLiveCamera,
      onPlayAudio: widget.onPlayAudio,
      onDictateSpeech: widget.onDictateSpeech,
      nowProvider: widget.nowProvider,
      themeMode: _themeMode,
      onThemeModeChanged: (mode) => setState(() => _themeMode = mode),
      initialUnlocked: widget.initialUnlocked,
      autoPromptPhoneAuth: widget.autoPromptPhoneAuth,
      authenticateOverride: widget.authenticateOverride,
    ),
  );
}

class Demo extends StatefulWidget {
  final http.Client? httpClient;
  final bool enableLiveCamera;
  final Future<void> Function(Uint8List wavBytes)? onPlayAudio;
  final Future<String?> Function()? onDictateSpeech;
  final DateTime Function()? nowProvider;
  final ThemeMode themeMode;
  final ValueChanged<ThemeMode>? onThemeModeChanged;
  final bool initialUnlocked;
  final bool autoPromptPhoneAuth;
  final Future<bool> Function()? authenticateOverride;

  const Demo({
    super.key,
    this.httpClient,
    this.enableLiveCamera = true,
    this.onPlayAudio,
    this.onDictateSpeech,
    this.nowProvider,
    this.themeMode = ThemeMode.system,
    this.onThemeModeChanged,
    this.initialUnlocked = false,
    this.autoPromptPhoneAuth = true,
    this.authenticateOverride,
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
  static const _notifChannel = MethodChannel('splitsync/notifications');
  final ValueNotifier<int> _uiTick = ValueNotifier<int>(0);
  final List<({String token, String name})> _pushedStack = [];
  int activeTab = 0;
  bool _sponsoredEnabled = false;
  bool _checkoutBusy = false;
  int _productDetailQty = 1;
  String _transferEnteredSide = 'send';
  bool _transferStartedWithContact = false;
  String? _inAppBanner;
  Timer? _bannerTimer;
  final Set<String> _notifiedSettlementIds = <String>{};
  final Set<String> _justSettledReqIds = <String>{};
  final ScrollController _homeScroll = ScrollController();
  final ScrollController _activityScroll = ScrollController();
  final ScrollController _storeScroll = ScrollController();
  final ScrollController _contactScroll = ScrollController();
  final ScrollController _profileScroll = ScrollController();
  final _elecProviderController = TextEditingController();
  final receiveAmountController = TextEditingController();
  String receiveQrCurrency = 'USD';
  StoreBuyMatch? _pendingStoreBuy;
  int walletBalanceCents = 24500;
  int activeWalletCardIndex = 0;
  String paymentSource = 'wallet';
  String cycleRange = '30D';
  late bool _unlocked = widget.initialUnlocked;
  final TextEditingController helpInput = TextEditingController();
  final List<({bool user, String text})> helpMessages = [];
  bool helpBusy = false;

  final amountController = TextEditingController();
  final noteController = TextEditingController();
  final contactSearch = TextEditingController();
  final activitySearch = TextEditingController();
  final Map<String, TextEditingController> rentShares = {};
  List<Map<String, dynamic>> demoTransfers = [];
  List<Map<String, dynamic>> localRequests = [];
  Map<String, dynamic>? activeTransfer;
  Map<String, dynamic>? savedRentRule;
  Map<String, dynamic>? savedElecRule;
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

  @override
  void setState(VoidCallback fn) {
    if (!mounted) return;
    super.setState(fn);
    _uiTick.value++;
  }

  String demoId() => List.generate(
    4,
    (_) => _random.nextInt(1 << 24).toRadixString(16).padLeft(6, '0'),
  ).join();
  static final _random = Random.secure();

  DateTime _now() => widget.nowProvider?.call() ?? DateTime.now();

  String dateLabel(DateTime date) => date.toIso8601String().split('T').first;
  String currencyAmount(int cents, String currency) =>
      formatCurrencyWithCode(cents, currency);

  int inputCents(String text, String currency) {
    final pattern = currency == 'JPY'
        ? r'^\d{1,7}$'
        : r'^\d{1,7}(?:\.\d{1,2})?$';
    if (!RegExp(pattern).hasMatch(text.trim())) return 0;
    final value = ((double.tryParse(text.trim()) ?? 0) * 100).round();
    return value <= 100000000 ? value : 0;
  }

  int convertCents(int cents, String from, String to) =>
      convertFxCents(cents, from, to, fxRates);

  FxQuote activeTransferQuote() {
    final raw = inputCents(
      amountController.text,
      _transferEnteredSide == 'receive' ? receiveCurrency : paymentCurrency,
    );
    return computeFxQuote(
      raw,
      paymentCurrency,
      receiveCurrency,
      fxRates,
      enteredSide: _transferEnteredSide,
    );
  }

  Widget _brandMarkTile({double size = 40}) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: SplitColors.primary,
      borderRadius: BorderRadius.circular(11),
    ),
    child: Icon(
      Icons.north_east_rounded,
      color: Colors.white,
      size: size * 0.52,
    ),
  );

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
        savedElecRule = state['elec'] as Map<String, dynamic>?;
        final wb = state['walletBalanceCents'];
        if (wb is int && wb >= 0) walletBalanceCents = wb;
        final wc = state['activeWalletCardIndex'];
        if (wc is int && wc >= 0) activeWalletCardIndex = wc;
        final notified = state['notifiedIds'] as List?;
        if (notified != null) {
          _notifiedSettlementIds.addAll(notified.map((e) => e.toString()));
        }
        setState(() {
          reimbursements = localRequests
              .map(ReimbursementRequest.fromJson)
              .toList();
          for (final req in reimbursements) {
            for (final r in req.recipients) {
              if (r.status == 'Paid' || r.status == 'Payment received') {
                _notifiedSettlementIds.add(r.id);
              }
            }
          }
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
          'elec': savedElecRule,
          'walletBalanceCents': walletBalanceCents,
          'activeWalletCardIndex': activeWalletCardIndex,
          'notifiedIds': _notifiedSettlementIds.toList(),
        }),
      );
    } catch (_) {
      // Demo remains usable in memory on devices with storage disabled.
    }
  }

  Future<void> _dispatchSettlementNotification(
    ReimbursementRecipient rec,
    ReimbursementRequest req,
  ) async {
    final amt = currencyAmount(rec.amountCents, rec.currency);
    final msg = 'Payment received from ${rec.name} · $amt';
    var osSent = false;
    if (!kIsWeb) {
      try {
        final permitted =
            await _notifChannel
                .invokeMethod<bool>('isPermitted')
                .timeout(const Duration(milliseconds: 500), onTimeout: () => false) ??
            false;
        if (permitted) {
          osSent =
              await _notifChannel
                  .invokeMethod<bool>('notify', {
                    'id': rec.id.hashCode & 0x7fffffff,
                    'title': 'AI · Payment received',
                    'body': '$msg (${req.title})',
                  })
                  .timeout(const Duration(milliseconds: 500), onTimeout: () => false) ??
              false;
        }
      } catch (_) {
        osSent = false;
      }
    }
    if (mounted && !osSent) {
      _showInAppBanner('$msg (${req.title})');
    }
  }

  void _showInAppBanner(String message) {
    _bannerTimer?.cancel();
    setState(() => _inAppBanner = message);
    _bannerTimer = Timer(const Duration(seconds: 4), () {
      if (mounted) setState(() => _inAppBanner = null);
    });
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
    final settledPairs = <({ReimbursementRecipient rec, ReimbursementRequest req})>[];
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
        for (final req in fresh.where((r) => r.demo)) {
          for (final r in req.recipients) {
            if (pending.containsKey(r.id) &&
                (r.status == 'Paid' || r.status == 'Payment received') &&
                !_notifiedSettlementIds.contains(r.id)) {
              _notifiedSettlementIds.add(r.id);
              _justSettledReqIds.add(req.id);
              settledPairs.add((rec: r, req: req));
            }
          }
        }
        if (settledPairs.isNotEmpty) setState(() => reimbursements = fresh);
      } else {
        final now = _now().millisecondsSinceEpoch;
        var changed = false;
        for (final req in localRequests.where((r) => r['demo'] == true)) {
          for (final r in req['recipients'] as List) {
            final recId = r['id']?.toString() ?? '';
            if (r['status'] == 'Waiting for payment' &&
                (r['settleAt'] as int) <= now) {
              r['status'] = 'Payment received';
              r['demoSettled'] = true;
              r['settledAt'] ??= _now().toIso8601String();
              r['receiptRef'] ??= 'DEMO-${r['id']}';
              changed = true;
              if (!_notifiedSettlementIds.contains(recId)) {
                _notifiedSettlementIds.add(recId);
                _justSettledReqIds.add(req['id']?.toString() ?? '');
                settledPairs.add((
                  rec: ReimbursementRecipient.fromJson(Map<String, dynamic>.from(r as Map)),
                  req: ReimbursementRequest.fromJson(Map<String, dynamic>.from(req)),
                ));
              }
            }
          }
        }
        if (changed) {
          setState(
            () => reimbursements = localRequests
                .map(ReimbursementRequest.fromJson)
                .toList(),
          );
          await saveLocalDemo();
        }
      }
      if (mounted && settledPairs.isNotEmpty) {
        for (final item in settledPairs) {
          await _dispatchSettlementNotification(item.rec, item.req);
        }
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
    _transferStartedWithContact = contact != null;
    _transferEnteredSide = 'send';
    paymentCurrency = send ? 'USD' : contact?.currency ?? 'USD';
    receiveCurrency = contact?.currency ?? 'USD';
    transferAttemptId = null;
    transferFromAsk = false;
    go(send ? 'send-money' : 'manual-request');
  }

  void _setTransferEnteredSide(String side) {
    final prevQ = activeTransferQuote();
    setState(() {
      _transferEnteredSide = side;
      final activeCents =
          side == 'receive' ? prevQ.targetAmountCents : prevQ.sourceAmountCents;
      final activeCurr =
          side == 'receive' ? receiveCurrency : paymentCurrency;
      if (activeCents > 0) {
        amountController.text = formatMajorInput(activeCents, activeCurr);
      }
    });
  }

  Widget _fxSideToggle(SplitContact contact) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: SizedBox(
      width: double.infinity,
      child: SegmentedButton<String>(
        showSelectedIcon: false,
        style: const ButtonStyle(
          visualDensity: VisualDensity.compact,
          padding: WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          ),
        ),
        segments: [
          ButtonSegment<String>(
            value: 'send',
            label: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text('You send ($paymentCurrency)', maxLines: 1),
            ),
          ),
          ButtonSegment<String>(
            value: 'receive',
            label: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                '${contact.name} receives ($receiveCurrency)',
                maxLines: 1,
              ),
            ),
          ),
        ],
        selected: {_transferEnteredSide},
        onSelectionChanged: (sel) => _setTransferEnteredSide(sel.first),
      ),
    ),
  );

  Widget currencyPicker(
    String label,
    String selected,
    ValueChanged<String> change,
  ) => SplitDropdownField<String>(
    key: ValueKey('curr-$label-$selected'),
    label: label.isEmpty ? 'Currency' : label,
    value: selected,
    items: fxRates.keys
        .map((c) => DropdownMenuItem(value: c, child: Text(c)))
        .toList(),
    onChanged: (value) {
      if (value != null) change(value);
    },
  );

  Widget contactPaymentScreen({required bool send}) {
    final contact = paymentContact;
    final title = send ? 'Send Money' : 'Request Money';
    final quote = activeTransferQuote();
    final activeCurr =
        send && _transferEnteredSide == 'receive'
            ? receiveCurrency
            : paymentCurrency;
    final activeAmt =
        send ? quote.sourceAmountCents : inputCents(amountController.text, paymentCurrency);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: title,
          subtitle: send
              ? 'Demo transfer with live reference conversion'
              : 'Request payment from any contact',
          onBack: contact != null && !_transferStartedWithContact
              ? () => setState(() => paymentContact = null)
              : goBack,
          trailing: const SplitBadge('Demo mode', preview: true),
        ),
        if (contact == null) ...[
          SplitTextField(
            label: 'Search contacts',
            controller: contactSearch,
            prefixIcon: Icons.search_rounded,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          for (final c in contacts.where(
            (c) =>
                c.id != 'leah' &&
                '${c.name} ${c.country} ${c.currency}'.toLowerCase().contains(
                  contactSearch.text.trim().toLowerCase(),
                ),
          ))
            paymentTile(
              name: c.name,
              leading: SplitContactAvatar(
                name: c.name,
                id: c.id,
                currency: c.currency,
              ),
              detail: c.currency,
              onTap: () => setState(() {
                paymentContact = c;
                _transferEnteredSide = 'send';
                paymentCurrency = send ? 'USD' : c.currency;
                receiveCurrency = c.currency;
              }),
            ),
        ] else
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    SplitContactAvatar(
                      name: contact.name,
                      id: contact.id,
                      currency: contact.currency,
                      size: 46,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            contact.name,
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          Text(
                            contact.currency,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (send) _fxSideToggle(contact),
                const SizedBox(height: 8),
                SplitTextField(
                  label: send
                      ? (_transferEnteredSide == 'receive'
                            ? '${contact.name} receives ($activeCurr)'
                            : 'You send ($activeCurr)')
                      : 'Request amount ($paymentCurrency)',
                  hintText: activeCurr == 'JPY' ? '0' : '0.00',
                  keyboardType: TextInputType.numberWithOptions(
                    decimal: activeCurr != 'JPY',
                  ),
                  controller: amountController,
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 10),
                if (send && _transferEnteredSide == 'receive')
                  currencyPicker(
                    'Recipient currency',
                    receiveCurrency,
                    (c) => setState(() => receiveCurrency = c),
                  )
                else
                  currencyPicker(
                    send ? 'Your currency' : 'Currency',
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
                  if (_transferEnteredSide == 'receive')
                    currencyPicker(
                      'Your currency',
                      paymentCurrency,
                      (c) => setState(() => paymentCurrency = c),
                    )
                  else
                    currencyPicker(
                      'Recipient currency',
                      receiveCurrency,
                      (c) => setState(() => receiveCurrency = c),
                    ),
                  if (quote.sourceAmountCents > 0) ...[
                    const SizedBox(height: 10),
                    transferQuote(contact, quote),
                  ],
                ],
                const SizedBox(height: 14),
                SplitPrimaryButton(
                  label: send ? 'Review payment' : 'Review request',
                  onPressed: activeAmt <= 0 || loadingLocalDemo
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
                                  amountCents: activeAmt,
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

  Widget transferQuote(SplitContact contact, FxQuote q) {
    final isDark = SplitColors.isDark(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: SplitColors.tint(context),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? SplitColors.darkFrameBorder : const Color(0xFFD6E4FE),
        ),
      ),
      child: Column(
        children: [
          lineRow('You send', currencyAmount(q.sourceAmountCents, q.sourceCurrency)),
          lineRow(
            '${contact.name} receives',
            currencyAmount(q.targetAmountCents, q.targetCurrency),
            bold: true,
          ),
          lineRow(
            'Demo rate ($fxRateDate)',
            '1 ${q.sourceCurrency} ≈ ${q.rate.toStringAsFixed(q.targetCurrency == 'JPY' ? 2 : 5)} ${q.targetCurrency}',
          ),
          if (q.sourceCurrency != 'INR')
            lineRow('INR estimate', currencyAmount(q.inrEquivalentCents, 'INR')),
        ],
      ),
    );
  }

  Future<void> _rechargeWallet(int cents) async {
    if (cents <= 0) return;
    final id = 'rch-${demoId()}';
    final tx = <String, dynamic>{
      'id': 'RCH-${id.substring(4, 10).toUpperCase()}',
      'clientTxId': id,
      'type': 'wallet-recharge',
      'direction': 'incoming',
      'recipientName': 'PayPal Wallet',
      'sourceAmountCents': cents,
      'sourceCurrency': 'USD',
      'targetAmountCents': cents,
      'targetCurrency': 'USD',
      'fundingSource': 'Linked Card •••• 9104',
      'note': 'Wallet recharge',
      'status': 'Completed',
      'demo': true,
      'createdAt': _now().toIso8601String(),
    };
    setState(() {
      walletBalanceCents += cents;
      demoTransfers = [tx, ...demoTransfers];
    });
    await saveLocalDemo();
    if (mounted) {
      showFeedback('Added ${currencyAmount(cents, 'USD')} to PayPal Wallet.');
    }
  }

  Future<void> openRechargeWalletSheet() async {
    final customCtrl = TextEditingController(text: '50.00');
    try {
      final selectedCents = await showModalBottomSheet<int>(
        context: context,
        isScrollControlled: true,
        backgroundColor: SplitColors.card(context),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (sheetCtx) => StatefulBuilder(
          builder: (sheetCtx, setSheetState) {
            final parsedCents = inputCents(customCtrl.text, 'USD');
            return Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                16,
                20,
                20 + MediaQuery.viewInsetsOf(sheetCtx).bottom,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Recharge PayPal Wallet',
                          style: Theme.of(sheetCtx).textTheme.titleLarge,
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(sheetCtx).pop(),
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ],
                  ),
                  Text(
                    'Current balance: ${currencyAmount(walletBalanceCents, 'USD')}',
                    style: Theme.of(sheetCtx).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final amt in const [2500, 5000, 10000, 25000])
                        ChoiceChip(
                          label: Text('+\$${amt ~/ 100}'),
                          selected: parsedCents == amt,
                          onSelected: (_) => setSheetState(
                            () => customCtrl.text = (amt / 100).toStringAsFixed(2),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SplitTextField(
                    label: 'Top-up amount (USD)',
                    controller: customCtrl,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    onChanged: (_) => setSheetState(() {}),
                  ),
                  const SizedBox(height: 14),
                  SplitPrimaryButton(
                    label: parsedCents > 0
                        ? 'Add from Linked Card'
                        : 'Enter amount',
                    onPressed: parsedCents > 0
                        ? () => Navigator.of(sheetCtx).pop(parsedCents)
                        : null,
                  ),
                ],
              ),
            );
          },
        ),
      );
      if (selectedCents != null && selectedCents > 0) {
        await _rechargeWallet(selectedCents);
      }
    } finally {
      customCtrl.dispose();
    }
  }

  bool _canFundPayment(int requiredUsdCents) =>
      paymentSource != 'wallet' || walletBalanceCents >= requiredUsdCents;

  void _deductWalletIfSelected(int requiredUsdCents) {
    if (paymentSource == 'wallet' && requiredUsdCents > 0) {
      walletBalanceCents = max(0, walletBalanceCents - requiredUsdCents);
    }
  }

  Widget _paymentSourceBlock(int requiredUsdCents) => PaymentSourceSelector(
    selectedSource: paymentSource,
    walletBalanceCents: walletBalanceCents,
    requiredUsdCents: requiredUsdCents,
    onChanged: (source) => setState(() => paymentSource = source),
    onRecharge: openRechargeWalletSheet,
  );

  Widget transferReviewScreen() {
    final contact = paymentContact;
    if (contact == null) return contactPaymentScreen(send: true);
    final q = activeTransferQuote();
    final activeCurr =
        _transferEnteredSide == 'receive' ? receiveCurrency : paymentCurrency;
    final requiredUsdCents = convertCents(q.sourceAmountCents, q.sourceCurrency, 'USD');
    final canPay = _canFundPayment(requiredUsdCents);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: 'Review payment',
          subtitle: 'Verify or edit details before you pay',
          onBack: () {
            if (!sending) goBack();
          },
          trailing: const SplitBadge('Demo mode', preview: true),
        ),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SplitCallout(
                message:
                    'Uses labeled Demo rate. You can edit the recipient, amount side, currency, or note here before paying.',
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: contact.id,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Recipient'),
                items: contacts
                    .where((c) => c.id != 'leah')
                    .map(
                      (c) => DropdownMenuItem(
                        value: c.id,
                        child: Text('${c.name} (${c.currency})'),
                      ),
                    )
                    .toList(),
                onChanged: sending
                    ? null
                    : (id) {
                        final next = contacts.where((c) => c.id == id).firstOrNull;
                        if (next != null) {
                          setState(() {
                            paymentContact = next;
                            receiveCurrency = next.currency;
                          });
                        }
                      },
              ),
              _fxSideToggle(contact),
              twoButtons(
                SplitTextField(
                  label: _transferEnteredSide == 'receive'
                      ? '${contact.name} receives ($activeCurr)'
                      : 'Send amount ($activeCurr)',
                  keyboardType: TextInputType.numberWithOptions(
                    decimal: activeCurr != 'JPY',
                  ),
                  controller: amountController,
                  onChanged: (_) => setState(() {}),
                ),
                currencyPicker(
                  _transferEnteredSide == 'receive'
                      ? 'Recipient currency'
                      : 'Your currency',
                  activeCurr,
                  (c) => setState(() {
                    if (_transferEnteredSide == 'receive') {
                      receiveCurrency = c;
                    } else {
                      paymentCurrency = c;
                    }
                  }),
                ),
              ),
              const SizedBox(height: 10),
              SplitTextField(
                label: 'Note',
                controller: noteController,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              transferQuote(contact, q),
              const SizedBox(height: 12),
              _paymentSourceBlock(requiredUsdCents),
              const SizedBox(height: 14),
              if (sending) const LinearProgressIndicator(),
              twoButtons(
                SplitSecondaryButton(
                  label: 'Back',
                  onPressed: sending ? null : goBack,
                ),
                SplitPrimaryButton(
                  label: sending ? 'Paying…' : 'Pay',
                  onPressed: sending || q.sourceAmountCents <= 0 || !canPay
                      ? null
                      : () => submitTransfer(contact, q),
                ),
                crossAxisAlignment: CrossAxisAlignment.stretch,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> submitTransfer(SplitContact contact, FxQuote q) async {
    if (sending) return;
    final requiredUsdCents = convertCents(q.sourceAmountCents, q.sourceCurrency, 'USD');
    if (!_canFundPayment(requiredUsdCents)) {
      showFeedback('PayPal Wallet balance too low. Recharge or switch card.');
      return;
    }
    setState(() => sending = true);
    final fundingLabel = paymentSource == 'wallet'
        ? 'PayPal Wallet'
        : 'PayPal Cashback •••• 9104';
    final id = transferAttemptId ??= demoId();
    final input = {
      'contactId': contact.id,
      'recipientName': contact.name,
      'enteredSide': q.enteredSide,
      'sourceAmountCents': q.sourceAmountCents,
      'sourceCurrency': q.sourceCurrency,
      'targetAmountCents': q.targetAmountCents,
      'targetCurrency': q.targetCurrency,
      'reviewedRate': q.rate,
      'reviewedRateDate': fxRateDate,
      'fundingSource': fundingLabel,
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
              'id': 'DTX-${id.substring(0, 6).toUpperCase()}',
              'direction': 'outgoing',
              'flag': contact.flag,
              'country': contact.country,
              'rate': q.rate,
              'rateDate': fxRateDate,
              'rateLabel': 'Demo rate',
              'inrEquivalentCents': q.inrEquivalentCents,
              'status': 'Completed',
              'createdAt': DateTime.now().toIso8601String(),
            };
      if (!mounted) return;
      if (!MediaQuery.disableAnimationsOf(context)) {
        await Future<void>.delayed(const Duration(milliseconds: 350));
      }
      if (!mounted) return;
      setState(() {
        _deductWalletIfSelected(requiredUsdCents);
        transaction['fundingSource'] ??= fundingLabel;
        demoTransfers = [
          transaction,
          ...demoTransfers.where((t) => t['id'] != transaction['id']),
        ];
        activeTransfer = transaction;
        if (transferFromAsk) clearPaymentDraft();
      });
      await saveLocalDemo();
      if (!mounted) return;
      go('transfer-receipt', replace: true);
    } catch (e) {
      if (mounted) showFeedback('Could not complete the demo payment. $e');
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Widget groupPaymentScreen() {
    if (!validPaymentDraft) return talkScreen();
    final totals = <String, int>{};
    var totalUsdCents = 0;
    for (final row in recipientDrafts) {
      totals.update(
        row.currency,
        (total) => total + row.amountCents,
        ifAbsent: () => row.amountCents,
      );
      totalUsdCents += convertCents(row.amountCents, row.currency, 'USD');
    }
    final canPay = _canFundPayment(totalUsdCents);
    return Column(
      children: [
        SplitScreenHeader(
          title: 'Review ${recipientDrafts.length} payments',
          subtitle: 'Check what each person will receive.',
          onBack: () {
            if (!sending) goBack();
          },
          trailing: const SplitBadge('Demo mode', preview: true),
        ),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SplitBadge('Demo mode', preview: true),
              const SizedBox(height: 16),
              for (final row in recipientDrafts) ...groupPaymentLine(row),
              const Divider(height: 24),
              for (final entry in totals.entries)
                lineRow(
                  'Total in ${entry.key}',
                  currencyAmount(entry.value, entry.key),
                ),
              const SizedBox(height: 12),
              _paymentSourceBlock(totalUsdCents),
              const SizedBox(height: 16),
              if (sending) const LinearProgressIndicator(),
              SplitPrimaryButton(
                label: sending ? 'Paying…' : 'Confirm demo payments',
                onPressed: sending || !canPay ? null : submitGroupPayments,
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
    final totalUsdCents = recipientDrafts.fold<int>(
      0,
      (sum, row) => sum + convertCents(row.amountCents, row.currency, 'USD'),
    );
    if (!_canFundPayment(totalUsdCents)) {
      showFeedback('PayPal Wallet balance too low. Recharge or switch card.');
      return;
    }
    final fundingLabel = paymentSource == 'wallet'
        ? 'PayPal Wallet'
        : 'PayPal Cashback •••• 9104';
    final attemptId = groupAttemptId ??= demoId();
    final inputs = [
      for (final (index, row) in recipientDrafts.indexed)
        {
          'clientTxId': '$attemptId-$index',
          'contactId': row.contactId!,
          'sourceAmountCents': row.amountCents,
          'sourceCurrency': row.currency,
          'fundingSource': fundingLabel,
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
        _deductWalletIfSelected(totalUsdCents);
        for (final tx in transactions) {
          tx['fundingSource'] ??= fundingLabel;
        }
        demoTransfers = [
          ...transactions,
          ...demoTransfers.where((tx) => !ids.contains(tx['id'])),
        ];
        groupReceipt = transactions;
        clearPaymentDraft();
        askMessages.add((
          user: false,
          text: '${transactions.length} demo payments completed.',
        ));
      });
      await saveLocalDemo();
      if (!mounted) return;
      go('payment-draft-receipt', replace: true);
    } catch (_) {
      if (mounted) {
        showFeedback('Could not confirm the demo payments. Try again.');
      }
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Widget groupReceiptScreen() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SplitScreenHeader(
        title: '${groupReceipt.length} demo payments completed',
        onBack: goBack,
        trailing: const SplitBadge('Demo mode', preview: true),
      ),
      SplitCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SplitBadge('Demo mode', preview: true),
            const SizedBox(height: 12),
            for (final tx in groupReceipt)
              paymentTile(
                name: tx['recipientName']?.toString() ?? 'Recipient',
                leading: SplitContactAvatar(
                  name: tx['recipientName']?.toString() ?? '?',
                  id: tx['contactId']?.toString() ?? '',
                  currency: tx['targetCurrency']?.toString() ?? 'USD',
                ),
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
            twoButtons(
              SplitSecondaryButton(
                label: 'Done',
                onPressed: () => go('home'),
              ),
              SplitPrimaryButton(
                label: 'View Activity',
                onPressed: () => go('activity'),
              ),
              crossAxisAlignment: CrossAxisAlignment.stretch,
            ),
          ],
        ),
      ),
    ],
  );

  Widget transferReceiptScreen() {
    final t = activeTransfer;
    if (t == null) return activityScreen();
    final isStore = t['type'] == 'store-demo';
    final recName = t['recipientName']?.toString() ?? 'Recipient';
    final contact = contacts
        .where(
          (c) =>
              c.id == t['contactId'] ||
              c.name.toLowerCase() == recName.toLowerCase(),
        )
        .firstOrNull;
    final srcCurr = t['sourceCurrency']?.toString() ?? 'USD';
    final tgtCurr = t['targetCurrency']?.toString() ?? srcCurr;
    final srcCents = (t['sourceAmountCents'] as num?)?.toInt() ?? 0;
    final tgtCents = (t['targetAmountCents'] as num?)?.toInt() ?? srcCents;
    final rateNum = (t['rate'] as num?)?.toDouble();
    final inrCents = (t['inrEquivalentCents'] as num?)?.toInt() ??
        convertCents(srcCents, srcCurr, 'INR');
    final enteredSide = t['enteredSide']?.toString() == 'receive'
        ? 'Recipient amount ($tgtCurr)'
        : 'Send amount ($srcCurr)';
    final txId = t['id']?.toString() ?? 'DTX-DEMO';
    final dateStr =
        (t['createdAt']?.toString() ?? '').replaceAll('T', ' ');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: isStore ? 'Store demo receipt' : 'Payment receipt',
          subtitle: 'Demo mode · $txId',
          onBack: goBack,
          trailing: const SplitStatusPill('Completed'),
        ),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  SplitContactAvatar(
                    name: recName,
                    id: contact?.id ?? '',
                    currency: tgtCurr,
                    size: 46,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isStore
                              ? 'Purchased ${currencyAmount(srcCents, srcCurr)}'
                              : 'Sent ${currencyAmount(srcCents, srcCurr)}',
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        Text(
                          isStore
                              ? recName
                              : 'to $recName${contact?.country.isNotEmpty == true ? ' (${contact!.country})' : ''}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              Divider(height: 22, color: SplitColors.lineColor(context)),
              lineRow('Direction', 'Outgoing · Sent'),
              lineRow('Receipt reference', txId),
              if (dateStr.length >= 16)
                lineRow('Date', dateStr.substring(0, 16)),
              lineRow('Entered side', enteredSide),
              lineRow('You sent', currencyAmount(srcCents, srcCurr)),
              if (srcCurr != tgtCurr) ...[
                lineRow(
                  '$recName receives',
                  currencyAmount(tgtCents, tgtCurr),
                  bold: true,
                ),
                if (rateNum != null)
                  lineRow(
                    'Demo rate (${t['rateDate'] ?? fxRateDate})',
                    '1 $srcCurr ≈ ${rateNum.toStringAsFixed(tgtCurr == 'JPY' ? 2 : 5)} $tgtCurr',
                  ),
              ],
              if (srcCurr != 'INR')
                lineRow('INR estimate', currencyAmount(inrCents, 'INR')),
              if ((t['note'] as String?)?.isNotEmpty == true)
                lineRow('Note', t['note'] as String),
              if ((t['fundingSource'] as String?)?.isNotEmpty == true)
                lineRow('Funded with', t['fundingSource'] as String),
              lineRow('Ledger', isStore ? 'Demo store purchase' : 'Demo transfer'),
              const SizedBox(height: 14),
              if (isStore) ...[
                SplitPrimaryButton(
                  label: 'Split cash',
                  leadingIcon: Icons.call_split_rounded,
                  onPressed: () => _splitStoreTransfer(t),
                ),
                const SizedBox(height: 10),
                twoButtons(
                  SplitSecondaryButton(
                    label: 'Open Activity',
                    onPressed: () => go('activity'),
                  ),
                  SplitSecondaryButton(
                    label: 'Done',
                    onPressed: () => go('home'),
                  ),
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                ),
              ] else
                twoButtons(
                  SplitSecondaryButton(
                    label: 'Open Activity',
                    onPressed: () => go('activity'),
                  ),
                  SplitPrimaryButton(
                    label: 'Done',
                    onPressed: () => go('home'),
                  ),
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                ),
            ],
          ),
        ),
      ],
    );
  }

  void _splitStoreTransfer(Map<String, dynamic> tx) {
    final totalCents = (tx['sourceAmountCents'] as num?)?.toInt() ?? 0;
    if (totalCents <= 0) return;
    final curr = fxRates.containsKey(tx['sourceCurrency'])
        ? tx['sourceCurrency'] as String
        : 'USD';
    final note = (tx['note']?.toString().trim().isNotEmpty == true)
        ? tx['note'].toString().trim()
        : (tx['recipientName']?.toString() ?? 'Store order');
    final peers = contacts.where((c) => c.id == 'maya' || c.id == 'arun').toList();
    final splitCount = peers.length + 1;
    final perShare = equalShare(totalCents, splitCount, curr);
    final drafts = [
      for (final p in peers)
        RecipientDraft(
          name: p.name,
          contactId: p.id,
          known: true,
          amountCents: perShare,
          currency: curr,
          reason: note,
        ),
    ];
    setState(() {
      _pendingStoreBuy = null;
      billRawPng = null;
      billDraft = ExtractedBillDraft(
        merchant: note,
        date: dateLabel(_now()),
        currency: curr,
        items: [BillLineItem(name: note, amountCents: totalCents)],
        totalCents: totalCents,
      );
      recipientDrafts = drafts;
      requestKind = 'store';
      requestAttemptId = null;
      deliveryChannel = 'demo';
      askSend = false;
      sendReady = false;
      receiptAttached = true;
      askMessages.add((
        user: false,
        text:
            'Ready to split $note (${currencyAmount(totalCents, curr)}) evenly with ${peers.map((e) => e.name).join(' and ')}. Review or adjust shares below.',
      ));
    });
    go('talk');
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
            const Text('Demo requests simulate staggered incoming payments with notifications.'),
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
              label: 'Create demo requests',
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
    _bannerTimer?.cancel();
    if (audioComplete != null) unawaited(audioComplete!.cancel());
    cancelBrowserRecording();
    _uiTick.dispose();
    _homeScroll.dispose();
    _activityScroll.dispose();
    _storeScroll.dispose();
    _contactScroll.dispose();
    _profileScroll.dispose();
    _elecProviderController.dispose();
    receiveAmountController.dispose();
    askInput.dispose();
    helpInput.dispose();
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

  void goBack() {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).maybePop();
    } else if (activeTab != 0) {
      go('home');
    }
  }

  Route<void> _buildSubRoute(String routeName, String token) {
    final reduce = MediaQuery.disableAnimationsOf(context);
    if (reduce) {
      return PageRouteBuilder<void>(
        settings: RouteSettings(name: routeName),
        transitionDuration: Duration.zero,
        reverseTransitionDuration: Duration.zero,
        pageBuilder: (_, _, _) => _SubScreenScaffold(state: this),
      );
    }
    return CupertinoPageRoute<void>(
      settings: RouteSettings(name: routeName),
      builder: (_) => _SubScreenScaffold(state: this),
    );
  }

  void go(String nextPage, {bool replace = false}) {
    if (nextPage != page) {
      ScaffoldMessenger.maybeOf(context)?.clearSnackBars();
    }
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
    if (nextPage != 'scan' && nextPage != 'scan-error') {
      if (scannerState == _ScannerState.scanning ||
          scannerState == _ScannerState.permission) {
        scannerState = _ScannerState.ready;
      }
    }

    final normalized = nextPage == 'shop' ? 'store' : nextPage;
    if (_tabPages.contains(normalized)) {
      if (_pushedStack.isNotEmpty) {
        Navigator.of(context).popUntil((r) => r.isFirst);
      }
      setState(() {
        _pushedStack.clear();
        activeTab = _tabPages.indexOf(normalized);
        page = normalized;
      });
      return;
    }

    if (!replace && _pushedStack.isNotEmpty && _pushedStack.last.name == normalized) {
      return;
    }

    final tok = demoId();
    if (replace && _pushedStack.isNotEmpty) {
      _pushedStack[_pushedStack.length - 1] = (token: tok, name: normalized);
      setState(() => page = normalized);
      Navigator.of(context).pushReplacement(_buildSubRoute(normalized, tok)).then((_) {
        _onRoutePopped(tok);
      });
    } else {
      _pushedStack.add((token: tok, name: normalized));
      setState(() => page = normalized);
      Navigator.of(context).push(_buildSubRoute(normalized, tok)).then((_) {
        _onRoutePopped(tok);
      });
    }
  }

  void _onRoutePopped(String token) {
    final idx = _pushedStack.indexWhere((e) => e.token == token);
    if (idx < 0) return;
    _pushedStack.removeRange(idx, _pushedStack.length);
    if (!mounted) return;
    final nextTop = _pushedStack.isNotEmpty ? _pushedStack.last.name : _tabPages[activeTab];
    if (page == 'talk' && nextTop != 'talk') {
      turnEpoch++;
      stopVoice();
      cancelAskMic();
      askBusy = false;
    }
    setState(() => page = nextTop);
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

  Future<void> restoreOrganizerConnection({bool interactive = false}) async {
    try {
      final health = await backend(
        '/api/health',
        timeout: const Duration(seconds: 4),
      );
      if (!mounted || connected || backendBusy) return;
      if (health['localOrganizerAutoLogin'] != true) {
        if (interactive) go('welcome');
        return;
      }
      await _loadFullState();
      if (!mounted || connected || backendBusy) return;
      setState(() {
        connected = true;
        merchantOpened = published;
        staticPreview = false;
      });
      if (interactive) {
        showFeedback('Connected using .env organizer session.');
      }
    } catch (_) {
      if (interactive && mounted) {
        showFeedback('Server offline or .env auto-login disabled.');
      }
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
      });
      go('home');
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
      merchantOpened = false;
      reimbursements = [];
      demoTransfers = [];
      contacts = List.of(kDefaultContacts);
    });
    go('home');
    unawaited(restoreLocalDemo());
  }

  Future<void> resetDemoSession() async {
    setState(() {
      backendBusy = true;
      _justSettledReqIds.clear();
      _notifiedSettlementIds.clear();
      _inAppBanner = null;
    });
    try {
      if (connected) {
        await backend('/api/organizer/reset-demo', body: {});
        await _loadFullState();
      } else {
        reimbursements = reimbursements.where((r) => !r.demo).toList();
        localRequests = localRequests.where((r) => r['demo'] != true).toList();
      }
      demoTransfers = [];
      localRequests.removeWhere((r) => r['demo'] == true);
      savedRentRule = null;
      savedElecRule = null;
      walletBalanceCents = 24500;
      activeWalletCardIndex = 0;
      paymentSource = 'wallet';
      helpMessages.clear();
      helpInput.clear();
      cart.clear();
      clearPaymentDraft();
      clearReceipt();
      if (!connected) await saveLocalDemo();
      showFeedback('Clean demo session ready.');
      go('home');
    } catch (e) {
      showFeedback('Could not reset demo session: $e');
    } finally {
      if (mounted) setState(() => backendBusy = false);
    }
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
    });
    go('bill-crop');
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
    });
    if (!inline) go('bill-review');
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
    final now = _now();
    final isDemo = deliveryChannel == 'demo';
    final draftId = requestAttemptId ??= demoId();
    final payload = {
      'clientRequestId': draftId,
      'kind': requestKind,
      'dueDate': rentDue == null || (requestKind != 'rent' && requestKind != 'electricity')
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
      });
      go(
        'request-detail',
        replace: const ['electricity', 'rent', 'manual-request'].contains(page),
      );
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
      });
      go(
        'request-detail',
        replace: const ['electricity', 'rent', 'manual-request'].contains(page),
      );
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
        } else {
          aiState = _AiState.clarify;
        }
      });
      go(owner != null ? 'split' : 'clarify');
      return;
    }
    if (!connected && _organizerKey.isEmpty) {
      go('welcome');
      return;
    }
    setState(() {
      aiState = _AiState.loading;
      aiError = '';
    });
    go('split');
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
        setState(() => aiState = _AiState.clarify);
        go('clarify', replace: page == 'split');
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
      });
      go('requests');
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
    double minSideBySideWidth = 280,
    CrossAxisAlignment crossAxisAlignment = CrossAxisAlignment.start,
  }) => LayoutBuilder(
    builder: (context, constraints) {
      if (constraints.maxWidth < minSideBySideWidth) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [first, const SizedBox(height: 10), second],
        );
      }
      final row = Row(
        crossAxisAlignment: crossAxisAlignment,
        children: [
          Expanded(flex: firstFlex, child: first),
          const SizedBox(width: 12),
          Expanded(flex: secondFlex, child: second),
        ],
      );
      return crossAxisAlignment == CrossAxisAlignment.stretch
          ? IntrinsicHeight(child: row)
          : row;
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
                  color: bold
                      ? SplitColors.ink(context)
                      : SplitColors.mutedInk(context),
                ),
              ),
            ),
            const SizedBox(width: 10),
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxVal),
              child: Text(
                value,
                textAlign: TextAlign.end,
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: SplitColors.ink(context),
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ),
          ],
        );
      },
    ),
  );

  Widget participantAvatar(String n) {
    final isDark = SplitColors.isDark(context);
    final (bg, fg) = switch (n) {
      'Arun' => isDark
          ? (const Color(0xFF143536), const Color(0xFF7CE0D7))
          : (SplitColors.tealBg, SplitColors.tealInk),
      'Leah' => isDark
          ? (SplitColors.darkSecondary, Colors.white)
          : (const Color(0xFFEAEFF8), SplitColors.navy),
      'Samir Patel' => isDark
          ? (const Color(0xFF332612), const Color(0xFFF6C667))
          : (SplitColors.amberBg, SplitColors.amber),
      _ => (SplitColors.tint(context), SplitColors.linkInk(context)),
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
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: SplitColors.ink(context),
                    ),
                  ),
                  Text(
                    n == lamp
                        ? '\$40.00 shared + \$30.00 lamp'
                        : '\$40.00 shared essentials',
                    style: TextStyle(
                      fontSize: 14,
                      color: SplitColors.mutedInk(context),
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
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: SplitColors.ink(context),
                    fontFeatures: const [FontFeature.tabularFigures()],
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
                  'AI',
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
              onPressed: () {
                setState(() {
                  staticPreview = true;
                  connected = false;
                });
                go('home');
              },
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
    final ink = primary ? Colors.white : SplitColors.ink(context);
    final radius = BorderRadius.circular(20);
    final iconBox = DecoratedBox(
      decoration: BoxDecoration(
        color: primary
            ? Colors.white.withValues(alpha: 0.2)
            : SplitColors.tint(context),
        borderRadius: BorderRadius.circular(11),
      ),
      child: SizedBox.square(
        dimension: 40,
        child: Icon(
          icon,
          size: 20,
          color: primary ? Colors.white : SplitColors.linkInk(context),
        ),
      ),
    );
    return Semantics(
      button: true,
      label: label,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: primary
              ? const LinearGradient(
                  colors: [Color(0xFF103693), SplitColors.primary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: primary ? null : SplitColors.card(context),
          borderRadius: radius,
          border: primary ? null : Border.all(color: SplitColors.lineColor(context)),
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: radius,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 88),
              child: Padding(
                padding: const EdgeInsets.all(13),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    iconBox,
                    const SizedBox(height: 10),
                    Text(
                      label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: ink,
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (subtitle.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: primary
                              ? const Color(0xFFDCE8FF)
                              : SplitColors.mutedInk(context),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  ({int openCount, int paidCount, int totalCount, int remainingCents, String currency, ReimbursementRequest? latest})
  _awaitingSummary() {
    final active = reimbursements.where((r) => r.owedCents > 0).toList();
    if (active.isEmpty) {
      final settled = reimbursements.where((r) => r.demo).firstOrNull;
      if (settled != null && _justSettledReqIds.contains(settled.id)) {
        return (
          openCount: 0,
          paidCount: settled.recipients.length,
          totalCount: settled.recipients.length,
          remainingCents: 0,
          currency: settled.currency,
          latest: settled,
        );
      }
      return (openCount: 0, paidCount: 0, totalCount: 0, remainingCents: 0, currency: 'USD', latest: null);
    }
    final first = active.first;
    final paid = active.expand((r) => r.recipients).where((x) => x.status == 'Paid' || x.status == 'Payment received').length;
    final total = active.expand((r) => r.recipients).length;
    final remaining = active.where((r) => r.currency == first.currency).fold(0, (s, r) => s + r.owedCents);
    return (openCount: active.length, paidCount: paid, totalCount: total, remainingCents: remaining, currency: first.currency, latest: first);
  }

  Widget homeScreen() {
    final latest = activityRows().take(3).toList();
    final awaiting = _awaitingSummary();
    final storeSample = kStoreCatalog.take(4).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: double.infinity,
          child: Wrap(
            spacing: 12,
            runSpacing: 10,
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Hello, Leah', style: Theme.of(context).textTheme.headlineMedium),
                ],
              ),
              Tooltip(
                message: 'Profile',
                child: Semantics(
                  button: true,
                  label: 'Profile',
                  child: InkWell(
                    key: const Key('profile-avatar-btn'),
                    onTap: () => go('profile'),
                    customBorder: const CircleBorder(),
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: SplitColors.primary.withValues(alpha: 0.45),
                          width: 2,
                        ),
                      ),
                      child: CircleAvatar(
                        radius: 21,
                        backgroundColor: SplitColors.tint(context),
                        child: Text(
                          'L',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                            color: SplitColors.linkInk(context),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        LayoutBuilder(
          builder: (context, constraints) {
            final fourCol = constraints.maxWidth >= 560;
            final cols = fourCol ? 4 : 2;
            const gap = 10.0;
            final itemW = (constraints.maxWidth - (cols - 1) * gap) / cols;
            final tiles = [
              homeAction(
                label: 'Scan & Pay',
                icon: Icons.qr_code_scanner_rounded,
                primary: true,
                onTap: () {
                  linkController.clear();
                  go('scan');
                },
              ),
              homeAction(
                label: 'Send Money',
                icon: Icons.north_east_rounded,
                onTap: () => openContactPayment(send: true),
              ),
              homeAction(
                label: 'Request Money',
                icon: Icons.south_west_rounded,
                onTap: () => openContactPayment(send: false),
              ),
              homeAction(
                label: 'Split a Bill',
                icon: Icons.receipt_long_outlined,
                onTap: () => go('talk'),
              ),
            ];
            return Wrap(
              spacing: gap,
              runSpacing: gap,
              children: tiles.map((t) => SizedBox(width: itemW, child: t)).toList(),
            );
          },
        ),
        const SizedBox(height: 14),
        WalletCardDeck3D(
          walletBalanceCents: walletBalanceCents,
          activeCardIndex: activeWalletCardIndex,
          onCardChanged: (idx) {
            setState(() => activeWalletCardIndex = idx);
            unawaited(saveLocalDemo());
          },
          onRecharge: openRechargeWalletSheet,
        ),
        Text(
          'Quick contacts',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final contact in contacts.where((c) => c.id != 'leah').take(5))
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Material(
                    color: SplitColors.card(context),
                    shape: StadiumBorder(side: BorderSide(color: SplitColors.lineColor(context))),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => openContactPayment(send: true, contact: contact),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(minHeight: 48),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              SplitContactAvatar(
                                name: contact.name,
                                id: contact.id,
                                currency: contact.currency,
                                size: 32,
                              ),
                              const SizedBox(width: 8),
                              Text(contact.name, style: TextStyle(fontWeight: FontWeight.w800, color: SplitColors.ink(context), fontSize: 13)),
                              const SizedBox(width: 4),
                              Text(contact.currency, style: TextStyle(color: SplitColors.mutedInk(context), fontSize: 12, fontWeight: FontWeight.w700)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (awaiting.latest != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: awaiting.openCount == 0
                  ? (SplitColors.isDark(context) ? const Color(0xFF103134) : SplitColors.tealBg)
                  : (SplitColors.isDark(context) ? const Color(0xFF2B2214) : const Color(0xFFFFF8EA)),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: awaiting.openCount == 0
                    ? (SplitColors.isDark(context) ? const Color(0xFF286E6A) : const Color(0xFFB4E5DF))
                    : (SplitColors.isDark(context) ? const Color(0xFF7D5A1C) : const Color(0xFFF4DA9C)),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        awaiting.openCount == 0 ? 'Requests settled' : 'Requests awaiting payment',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        awaiting.openCount == 0
                            ? '${awaiting.latest!.title} · ${awaiting.paidCount}/${awaiting.totalCount} received'
                            : '${currencyAmount(awaiting.remainingCents, awaiting.currency)} remaining across ${awaiting.openCount} request${awaiting.openCount == 1 ? '' : 's'}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  height: 48,
                  child: TextButton.icon(
                    onPressed: () {
                      activeRequestId = awaiting.latest!.id;
                      activeRequestQrRecId = awaiting.latest!.recipients.firstOrNull?.id;
                      go('request-detail');
                    },
                    icon: const Icon(Icons.arrow_forward_rounded, size: 17),
                    label: Text(awaiting.openCount == 0 ? 'View' : 'Track'),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 12),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Recent transactions',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  SizedBox(
                    height: 48,
                    child: TextButton(
                      onPressed: () => go('activity'),
                      child: const Text('See all'),
                    ),
                  ),
                ],
              ),
              if (latest.isEmpty)
                const Text('No activity yet. Tap a contact above, Scan & Pay, or Request Money.'),
              for (final row in latest) activityTile(row),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Text('Bills & household', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        LayoutBuilder(
          builder: (context, constraints) {
            final twoCol = constraints.maxWidth >= 520;
            const gap = 10.0;
            final itemW = twoCol ? (constraints.maxWidth - gap) / 2 : constraints.maxWidth;
            final bills = [
              _shortcutTile(Icons.bolt_rounded, 'Electricity', 'Blank bill split', () => openHouseholdBill('electricity')),
              _shortcutTile(Icons.calendar_today_outlined, 'Rent', 'Monthly split', () => openHouseholdBill('rent')),
              _shortcutTile(Icons.camera_alt_outlined, 'Scan a Bill', 'Receipt OCR', openReceiptCamera),
              _shortcutTile(Icons.auto_awesome_outlined, 'Split a Bill', 'AI assistant', () => go('talk')),
            ];
            return Wrap(
              spacing: gap,
              runSpacing: gap,
              children: bills.map((w) => SizedBox(width: itemW, child: w)).toList(),
            );
          },
        ),
        const SizedBox(height: 14),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text('Store', style: Theme.of(context).textTheme.titleLarge),
                  ),
                  SizedBox(
                    height: 44,
                    child: TextButton(
                      onPressed: () => go('store'),
                      child: const Text('Browse Store'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (storeSample.length >= 4)
                LayoutBuilder(
                  builder: (context, constraints) {
                    final totalH = constraints.maxWidth >= 520 ? 250.0 : 216.0;
                    Widget photoCard(
                      StoreProduct p, {
                      required Key cardKey,
                      double pad = 10,
                    }) {
                      return Semantics(
                        button: true,
                        label: p.name,
                        child: Tooltip(
                          message: p.name,
                          child: Material(
                            color: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                              side: BorderSide(
                                color: SplitColors.isDark(context)
                                    ? SplitColors.darkFrameBorder
                                    : SplitColors.line,
                              ),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: InkWell(
                              key: cardKey,
                              onTap: () {
                                activeProduct = p;
                                _productDetailQty = 1;
                                go('product');
                              },
                              child: Padding(
                                padding: EdgeInsets.all(pad),
                                child: Center(
                                  child: Image.asset(
                                    p.imageAsset,
                                    fit: BoxFit.contain,
                                    errorBuilder: (_, _, _) => Icon(
                                      p.icon,
                                      size: 28,
                                      color: SplitColors.primaryInk,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    }

                    return SizedBox(
                      height: totalH,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(
                            flex: 11,
                            child: photoCard(
                              storeSample[0],
                              cardKey: const Key('home-store-card-0'),
                              pad: 14,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            flex: 10,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Expanded(
                                  flex: 11,
                                  child: photoCard(
                                    storeSample[1],
                                    cardKey: const Key('home-store-card-1'),
                                    pad: 10,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Expanded(
                                  flex: 9,
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.stretch,
                                    children: [
                                      Expanded(
                                        child: photoCard(
                                          storeSample[2],
                                          cardKey: const Key('home-store-card-2'),
                                          pad: 6,
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: photoCard(
                                          storeSample[3],
                                          cardKey: const Key('home-store-card-3'),
                                          pad: 6,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
            ],
          ),
        ),
        SplitCard(
          key: const Key('home-receive-qr-card'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Receive Money QR',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: SplitColors.lineColor(context)),
                ),
                child: QrImageView(
                  data: '$_origin/#receive/leah?currency=USD',
                  size: 216,
                  backgroundColor: Colors.white,
                ),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(
                  color: SplitColors.tint(context),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: SplitColors.lineColor(context)),
                ),
                child: Text(
                  'leah@paypal',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: SplitColors.ink(context),
                  ),
                ),
              ),
            ],
          ),
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
      String direction,
      String avatarName,
      String avatarId,
      String currency,
      VoidCallback open,
    })
  >
  activityRows() {
    final rows = [
      for (final transfer in demoTransfers)
        () {
          final isStore = transfer['type'] == 'store-demo';
          final isRecharge = transfer['type'] == 'wallet-recharge';
          final recName = transfer['recipientName']?.toString() ?? 'Recipient';
          final srcCurr = transfer['sourceCurrency']?.toString() ?? 'USD';
          final tgtCurr = transfer['targetCurrency']?.toString() ?? srcCurr;
          final c = contacts.where((x) => x.id == transfer['contactId'] || x.name.toLowerCase() == recName.toLowerCase()).firstOrNull;
          return (
            title: isRecharge
                ? 'Wallet recharge'
                : (isStore ? 'Store order · $recName' : 'Sent to $recName'),
            date: transfer['createdAt']?.toString() ?? '',
            amount: currencyAmount((transfer['sourceAmountCents'] as num?)?.toInt() ?? 0, srcCurr),
            status: 'Demo transfer',
            direction: isRecharge
                ? 'Incoming · PayPal Wallet'
                : (isStore ? 'Merchant · Outgoing' : 'Outgoing · Sent'),
            avatarName: recName,
            avatarId: c?.id ?? '',
            currency: tgtCurr,
            open: () {
              activeTransfer = transfer;
              go('transfer-receipt');
            },
          );
        }(),
      for (final request in reimbursements)
        for (final r in request.recipients)
          () {
            final c = contacts.where((x) => x.name.toLowerCase() == r.name.toLowerCase()).firstOrNull;
            return (
              title: '${r.name} · ${request.title}',
              date: request.createdAt,
              amount: currencyAmount(r.amountCents, r.currency),
              status: displayRequestStatus(request, r),
              direction: 'Incoming · Receiving',
              avatarName: r.name,
              avatarId: c?.id ?? '',
              currency: r.currency,
              open: () {
                activeRequestId = request.id;
                activeRequestQrRecId = r.id;
                go('request-detail');
              },
            );
          }(),
      if (merchantOpened)
        (
          title: 'Demo Merchant · SS-001 Sandbox',
          date: '',
          amount: currencyAmount(15000, 'USD'),
          status: paidPeople == 3 ? 'Paid' : 'Awaiting payment',
          direction: 'Merchant · PayPal Sandbox',
          avatarName: 'Demo Merchant',
          avatarId: 'leah',
          currency: 'USD',
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
        color: SplitColors.tint(context),
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
      String direction,
      String avatarName,
      String avatarId,
      String currency,
      VoidCallback open,
    })
    row,
  ) => paymentTile(
    name: row.title,
    leading: SplitContactAvatar(
      name: row.avatarName,
      id: row.avatarId,
      currency: row.currency,
      size: 36,
    ),
    detail: [
      row.direction,
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
    color: SplitColors.card(context),
    borderRadius: BorderRadius.circular(14),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: SplitColors.lineColor(context)),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: SplitColors.tint(context),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: SplitColors.linkInk(context), size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: SplitColors.ink(context),
                      fontSize: 15,
                    ),
                  ),
                  Text(
                    sub,
                    style: TextStyle(
                      fontSize: 14,
                      color: SplitColors.mutedInk(context),
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
  (int inflowCents, int outflowCents) _computeCycleTotals() {
    var inflow = cycleRange == '7D' ? 18500 : 42800;
    var outflow = cycleRange == '7D' ? 9250 : 24650;
    for (final t in demoTransfers) {
      final usdCents = convertCents(
        (t['sourceAmountCents'] as num?)?.toInt() ?? 0,
        t['sourceCurrency']?.toString() ?? 'USD',
        'USD',
      );
      if (t['type'] == 'wallet-recharge') {
        inflow += usdCents;
      } else {
        outflow += usdCents;
      }
    }
    for (final req in reimbursements) {
      for (final r in req.recipients) {
        if (r.status == 'Paid' || r.status == 'Payment received') {
          inflow += convertCents(r.amountCents, r.currency, 'USD');
        }
      }
    }
    return (inflow, outflow);
  }

  Widget activityScreen() {
    const filters = [
      'All',
      'Demo transfer',
      'Waiting for payment',
      'Payment received',
      'Awaiting payment',
      'Paid',
    ];
    final query = activitySearch.text.toLowerCase().trim();
    final rows = activityRows()
        .where(
          (row) =>
              (activityFilter == 'All' || row.status == activityFilter) &&
              '${row.title} ${row.direction} ${row.amount} ${row.date}'
                  .toLowerCase()
                  .contains(query),
        )
        .toList();
    final (cycleInflow, cycleOutflow) = _computeCycleTotals();
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
        const SizedBox(height: 12),
        PaymentCycleCard(
          range: cycleRange,
          onRangeChanged: (next) => setState(() => cycleRange = next),
          inflowCents: cycleInflow,
          outflowCents: cycleOutflow,
          pointSeed: demoTransfers.length + reimbursements.length,
        ),
        SplitTextField(
          label: 'Search activity',
          controller: activitySearch,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final filter in filters)
              ChoiceChip(
                label: Text(filter),
                materialTapTargetSize: MaterialTapTargetSize.padded,
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

    final collectedCents = req.recipients
        .where((r) => r.status == 'Paid' || r.status == 'Payment received')
        .fold<int>(0, (s, r) => s + r.amountCents);
    final totalReqCents = req.totalRequestedCents;
    final waitingCnt = req.recipients
        .where((r) => r.status != 'Paid' && r.status != 'Payment received')
        .length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: req.title,
          subtitle:
              '${req.id} · ${waitingCnt == 0 ? 'All received' : '$waitingCnt waiting'}',
          onBack: goBack,
          trailing: SplitBadge(
            req.demo ? 'Demo mode Receiving' : 'Reimbursement',
            preview: true,
          ),
        ),
        if (req.demo)
          SplitCallout(
            message: waitingCnt > 0
                ? 'Demo payments arrive at short staggered intervals and trigger payment alerts automatically.'
                : 'All demo payments in this request settled.',
            kind: waitingCnt > 0 ? CalloutKind.info : CalloutKind.success,
            trailing: !kIsWeb && waitingCnt > 0
                ? TextButton(
                    onPressed: () async {
                      try {
                        await _notifChannel.invokeMethod('requestPermission');
                        if (mounted) showFeedback('Notification permission checked.');
                      } catch (_) {
                        if (mounted) showFeedback('Using in-app alert banner on this device.');
                      }
                    },
                    child: const Text('Enable OS alerts'),
                  )
                : null,
          ),
        const SizedBox(height: 10),
        twoPane(
          SplitCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  req.demo ? 'Receiving summary' : 'Receipt evidence',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                lineRow(
                  'Amount collected',
                  '${currencyAmount(collectedCents, req.currency)} / ${currencyAmount(totalReqCents, req.currency)}',
                  bold: true,
                ),
                if (req.dueDate.isNotEmpty) lineRow('Due date', req.dueDate),
                const SizedBox(height: 6),
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
                Divider(height: 18, color: SplitColors.lineColor(context)),
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
                      'Shared bill and request links use Demo settlement unless PayPal Orders v2 is used for Demo Merchant SS-001.',
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
                            ? (SplitColors.isDark(context)
                                  ? const Color(0xFF7D5A1C)
                                  : const Color(0xFFF4DA9C))
                            : SplitColors.lineColor(context),
                      ),
                      color: r.deliveryStatus == 'Failed'
                          ? (SplitColors.isDark(context)
                                ? const Color(0xFF2B2214)
                                : SplitColors.amberBg.withValues(alpha: 0.4))
                          : SplitColors.card(context),
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
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: SplitColors.mutedInk(context),
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
                              onPressed: () {
                                payerReimbRequest = req;
                                payerReimbRecipient = r;
                                go('reimbursement-payer');
                              },
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
                Divider(height: 16, color: SplitColors.lineColor(context)),
                lineRow('Bill total', centsStr(req.totalCents), bold: true),
              ],
            ),
          ),
          SplitCard(
            color: SplitColors.tint(context),
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
                if (req.demo && rec.status != 'Paid') ...[
                  const SizedBox(height: 12),
                  _paymentSourceBlock(
                    convertCents(rec.amountCents, rec.currency, 'USD'),
                  ),
                  const SizedBox(height: 12),
                  SplitPrimaryButton(
                    label: 'Pay',
                    onPressed:
                        !_canFundPayment(
                          convertCents(rec.amountCents, rec.currency, 'USD'),
                        )
                        ? null
                        : () {
                            final usd = convertCents(
                              rec.amountCents,
                              rec.currency,
                              'USD',
                            );
                            setState(() {
                              _deductWalletIfSelected(usd);
                              rec.status = 'Paid';
                              rec.demoSettled = true;
                              rec.settledAt ??= _now().toIso8601String();
                            });
                            unawaited(saveLocalDemo());
                            showFeedback(
                              'Paid ${currencyAmount(rec.amountCents, rec.currency)} (${paymentSource == 'wallet' ? 'PayPal Wallet' : 'Linked Card'}).',
                            );
                          },
                  ),
                ],
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
            final uploadBtn = homeAction(
              label: 'Upload photo',
              icon: Icons.upload_file_rounded,
              onTap: capturingReceipt
                  ? null
                  : () => captureReceipt(ImageSource.gallery, inline: false),
            );
            final manualBtn = homeAction(
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
            );
            if (constraints.maxWidth >= 240) {
              return IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(child: uploadBtn),
                    const SizedBox(width: 12),
                    Expanded(child: manualBtn),
                  ],
                ),
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [uploadBtn, const SizedBox(height: 12), manualBtn],
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
            color: SplitColors.tint(context),
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
                  color: SplitColors.tint(context),
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
    color: SplitColors.card(context),
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
    _pendingStoreBuy = null;
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
    final storeMatch = receiptAttached ? null : parseStoreBuyCommand(message);
    if (storeMatch != null) {
      final subtotal = storeMatch.product.priceCents * storeMatch.qty;
      final reply =
          'Prepared ${storeMatch.qty} × ${storeMatch.product.name} (${currencyAmount(subtotal, 'USD')}). Tap Buy now to purchase, or Add to Cart.';
      if (!mounted || page != 'talk' || epoch != turnEpoch) return;
      setState(() {
        askBusy = false;
        requestAttemptId = null;
        askSend = false;
        sendReady = false;
        recipientDrafts = [];
        editingAskRows.clear();
        groupAttemptId = null;
        _pendingStoreBuy = storeMatch;
        askMessages.add((user: false, text: reply));
      });
      if (voiceEnabled) {
        unawaited(speakAskReply(reply, advance: false));
      }
      scrollToAskDraft();
      return;
    }
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
      _pendingStoreBuy = null;
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
              'Audio unavailable. You can continue with the draft.',
        );
        if (advance && page == 'talk') {
          go('review-transfer');
        }
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
          currencyPicker('Currency', billDraft.currency, (currency) {
            if (billDraft.currency == currency) return;
            setState(() {
              billDraft.currency = currency;
              if (currency == 'JPY') {
                billDraft.totalCents =
                    (billDraft.totalCents / 100).round() * 100;
                for (final item in billDraft.items) {
                  item.amountCents = (item.amountCents / 100).round() * 100;
                }
                billDraft.taxCents = (billDraft.taxCents / 100).round() * 100;
                billDraft.tipCents = (billDraft.tipCents / 100).round() * 100;
              }
              if (billTotalController.text.isNotEmpty) {
                billTotalController.text = (billDraft.totalCents / 100)
                    .toStringAsFixed(currency == 'JPY' ? 0 : 2);
              }
            });
          }),
          firstFlex: 2,
          minSideBySideWidth: 260,
        ),
        if (billDraft.items.isNotEmpty) ...[
          const SizedBox(height: 12),
          ExpansionTile(
            key: ObjectKey(billDraft),
            tilePadding: const EdgeInsets.symmetric(horizontal: 12),
            childrenPadding: const EdgeInsets.fromLTRB(8, 4, 8, 10),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: SplitColors.lineColor(context)),
            ),
            collapsedShape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: SplitColors.lineColor(context)),
            ),
            collapsedBackgroundColor: SplitColors.tint(context),
            backgroundColor: SplitColors.tint(context),
            collapsedTextColor: SplitColors.ink(context),
            textColor: SplitColors.ink(context),
            collapsedIconColor: SplitColors.ink(context),
            iconColor: SplitColors.ink(context),
            title: Text(
              'Line items (${billDraft.items.length})',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            children: [
              for (final item in billDraft.items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: twoButtons(
                    TextFormField(
                      key: ObjectKey(item),
                      initialValue: item.name,
                      decoration: const InputDecoration(
                        labelText: 'Item name',
                        constraints: BoxConstraints(minHeight: 50),
                      ),
                      onChanged: (value) => item.name = value,
                    ),
                    TextFormField(
                      key: ValueKey((item, billDraft.currency)),
                      initialValue: (item.amountCents / 100).toStringAsFixed(
                        billDraft.currency == 'JPY' ? 0 : 2,
                      ),
                      decoration: InputDecoration(
                        labelText: 'Amount (${billDraft.currency})',
                        constraints: const BoxConstraints(minHeight: 50),
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
                    minSideBySideWidth: 260,
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
    _transferStartedWithContact = false;
    _transferEnteredSide = 'send';
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
        subtitle: 'Buy store items, send money, or split',
        onBack: goBack,
        trailing: IconButton(
          tooltip: voiceEnabled ? 'Turn voice off' : 'Turn voice on',
          icon: Icon(voiceEnabled ? Icons.volume_up : Icons.volume_off),
          onPressed: () => setState(() {
            voiceEnabled = !voiceEnabled;
            if (!voiceEnabled) stopVoice();
          }),
        ),
      ),
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final sample in const [
                'Buy 2 desk lamps',
                'Send Allen \$20 for coffee',
                'Ask Maya \$20 for dinner',
              ])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ActionChip(
                    avatar: Icon(
                      Icons.auto_awesome_rounded,
                      size: 16,
                      color: SplitColors.linkInk(context),
                    ),
                    label: Text(sample),
                    onPressed: askBusy
                        ? null
                        : () {
                            askInput.text = sample;
                            unawaited(submitAsk());
                          },
                  ),
                ),
              ActionChip(
                avatar: Icon(
                  Icons.receipt_long_rounded,
                  size: 16,
                  color: SplitColors.linkInk(context),
                ),
                label: const Text('Use sample receipt'),
                onPressed: askBusy ? null : openBundledSampleReceipt,
              ),
            ],
          ),
        ),
      ),
      SplitCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (askMessages.isEmpty) ...[
              Text(
                'Ask AI to buy, send, or split.',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 6),
              Text(
                'Tap a quick prompt above, upload a receipt, or type below.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 12),
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
                        ? SplitColors.primary
                        : SplitColors.secondaryCard(context),
                    borderRadius: BorderRadius.circular(14),
                    border: msg.user
                        ? null
                        : Border.all(color: SplitColors.lineColor(context)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (!msg.user)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 3),
                          child: Text(
                            'AI',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: SplitColors.linkInk(context),
                            ),
                          ),
                        ),
                      Text(
                        msg.text,
                        style: TextStyle(
                          color: msg.user
                              ? Colors.white
                              : SplitColors.ink(context),
                        ),
                      ),
                    ],
                  ),
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
            if (_pendingStoreBuy != null) ...[
              const SizedBox(height: 16),
              SplitCard(
                color: SplitColors.tint(context),
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        SizedBox(
                          width: 60,
                          child: _productMediaBox(
                            _pendingStoreBuy!.product,
                            height: 60,
                            radius: 10,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${_pendingStoreBuy!.qty} × ${_pendingStoreBuy!.product.name}',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${_pendingStoreBuy!.product.seller} · ${currencyAmount(_pendingStoreBuy!.product.priceCents * _pendingStoreBuy!.qty, 'USD')}',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    twoButtons(
                      SplitSecondaryButton(
                        label: 'Add to Cart',
                        onPressed: () => _addToCart(
                          _pendingStoreBuy!.product,
                          qty: _pendingStoreBuy!.qty,
                          openCart: true,
                        ),
                      ),
                      SplitPrimaryButton(
                        label: 'Buy now',
                        onPressed: () => _startDirectProductCheckout(
                          _pendingStoreBuy!.product,
                          _pendingStoreBuy!.qty,
                        ),
                      ),
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                    ),
                  ],
                ),
              ),
            ],
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
                    color: SplitColors.tint(context),
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

  Widget talkComposer() {
    final isDark = SplitColors.isDark(context);
    return Material(
      color: SplitColors.card(context),
      child: Container(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: SplitColors.lineColor(context))),
        ),
        child: SafeArea(
          top: false,
          child: Center(
            heightFactor: 1,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 680),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (micState == _MicState.listening)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Text(
                          'Recording… Tap the microphone to finish.',
                          style: TextStyle(
                            color: SplitColors.linkInk(context),
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    if (micState == _MicState.transcribing)
                      const Padding(
                        padding: EdgeInsets.only(bottom: 6),
                        child: Text('Transcribing…'),
                      ),
                    if (micError.isNotEmpty)
                      Semantics(liveRegion: true, child: Text(micError)),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: SplitColors.tint(context),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: SplitColors.lineColor(context),
                            ),
                          ),
                          child: PopupMenuButton<ImageSource>(
                            tooltip: 'Attach receipt',
                            enabled: !capturingReceipt && !askBusy,
                            icon: Icon(
                              Icons.add_photo_alternate_outlined,
                              color: SplitColors.linkInk(context),
                              size: 21,
                            ),
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
                        ),
                        const SizedBox(width: 8),
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: micState == _MicState.listening
                                ? SplitColors.coral.withValues(alpha: 0.16)
                                : SplitColors.secondaryCard(context),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: micState == _MicState.listening
                                  ? SplitColors.coral
                                  : SplitColors.lineColor(context),
                            ),
                          ),
                          child: IconButton(
                            onPressed:
                                askBusy || micState == _MicState.transcribing
                                    ? null
                                    : recordAskSpeech,
                            tooltip: micState == _MicState.listening
                                ? 'Stop recording'
                                : 'Microphone',
                            icon: Icon(
                              micState == _MicState.listening
                                  ? Icons.stop_circle_rounded
                                  : Icons.mic_rounded,
                              color: micState == _MicState.listening
                                  ? SplitColors.coral
                                  : SplitColors.ink(context),
                              size: 21,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: askInput,
                            minLines: 1,
                            maxLines: 3,
                            textInputAction: TextInputAction.send,
                            onSubmitted: (_) => submitAsk(),
                            style: TextStyle(
                              color: SplitColors.ink(context),
                              fontSize: 15,
                              fontWeight: FontWeight.w500,
                            ),
                            decoration: InputDecoration(
                              hintText: 'Ask AI…',
                              hintStyle: TextStyle(
                                color: SplitColors.mutedInk(context)
                                    .withValues(alpha: 0.7),
                              ),
                              isDense: true,
                              constraints: const BoxConstraints(minHeight: 44),
                              filled: true,
                              fillColor: isDark
                                  ? SplitColors.darkSecondary
                                  : SplitColors.surfaceSubtle,
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 11,
                              ),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide(
                                  color: SplitColors.lineColor(context),
                                  width: 1.5,
                                ),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide(
                                  color: SplitColors.lineColor(context),
                                  width: 1.5,
                                ),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(
                                  color: SplitColors.primary,
                                  width: 1.8,
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        ValueListenableBuilder<TextEditingValue>(
                          valueListenable: askInput,
                          builder: (context, value, _) {
                            final canSend =
                                !askBusy && value.text.trim().isNotEmpty;
                            return SizedBox(
                              width: 44,
                              height: 44,
                              child: FilledButton(
                                onPressed: canSend ? submitAsk : null,
                                style: FilledButton.styleFrom(
                                  backgroundColor: SplitColors.primary,
                                  disabledBackgroundColor:
                                      SplitColors.secondaryCard(context),
                                  foregroundColor: Colors.white,
                                  disabledForegroundColor: SplitColors.mutedInk(
                                    context,
                                  ).withValues(alpha: 0.5),
                                  padding: EdgeInsets.zero,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                                child: const Tooltip(
                                  message: 'Send',
                                  child: Icon(
                                    Icons.arrow_upward_rounded,
                                    size: 21,
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void openScannedLink(String rawValue) {
    final raw = rawValue.trim();
    final fragment = raw.startsWith('#')
        ? raw.substring(1)
        : Uri.tryParse(raw)?.fragment;
    if (raw == 'SS-001' || fragment == 'purchase/SS-001') {
      go('review');
      return;
    }
    if (fragment != null && fragment.startsWith('receive/')) {
      final parsed = Uri.tryParse('https://local/$fragment');
      final segs = parsed?.pathSegments ?? const [];
      if (segs.length >= 2 && segs[1].isNotEmpty) {
        final targetId = Uri.decodeComponent(segs[1]).trim().toLowerCase();
        final qp = parsed?.queryParameters ?? const <String, String>{};
        final rawCurr = (qp['currency'] ?? '').trim().toUpperCase();
        final matched = contacts
            .where(
              (c) =>
                  c.id.toLowerCase() == targetId ||
                  c.name.toLowerCase() == targetId,
            )
            .firstOrNull;
        final payCurr = fxRates.containsKey(rawCurr)
            ? rawCurr
            : (matched != null && fxRates.containsKey(matched.currency)
                  ? matched.currency
                  : 'USD');
        final target =
            matched ??
            SplitContact(
              id: targetId,
              name: targetId == 'leah'
                  ? 'Leah'
                  : (targetId[0].toUpperCase() + targetId.substring(1)),
              country: 'United States',
              currency: payCurr,
              flag: '🇺🇸',
            );
        final amtRaw = (qp['amount'] ?? '').trim();
        final cents = amtRaw.isEmpty ? 0 : inputCents(amtRaw, payCurr);
        setState(() {
          scannerState = _ScannerState.ready;
          scannerError = '';
          contactSearch.clear();
          paymentContact = target;
          _transferStartedWithContact = false;
          _transferEnteredSide = 'send';
          paymentCurrency = payCurr;
          receiveCurrency = fxRates.containsKey(target.currency)
              ? target.currency
              : 'USD';
          if (cents > 0) {
            amountController.text = formatMajorInput(cents, payCurr);
          } else {
            amountController.clear();
          }
          noteController.text = 'QR payment to ${target.name}';
          transferAttemptId = null;
          transferFromAsk = false;
        });
        go('send-money');
        return;
      }
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
          : 'Unsupported code. Use an SS-001 merchant code or an AI payment link.';
    });
  }

  Widget scannerScreen({bool forceError = false}) {
    final scanning = scannerState == _ScannerState.scanning;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: 'Scan & Pay',
          subtitle: 'Pay a supported merchant · PayPal Sandbox',
          onBack: goBack,
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
        Divider(height: 18, color: SplitColors.lineColor(context)),
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
            color: SplitColors.tint(context),
            child: Column(
              children: [
                if (activeUrl != null)
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: QrImageView(
                      data: activeUrl,
                      size: 136,
                      backgroundColor: Colors.white,
                    ),
                  ),
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

  Widget payerScreen() {
    final shareUsdCents = (share(selected) * 100).round();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: 'Your share · ${money(share(selected))} USD',
          onBack: () => go('requests'),
        ),
        SplitCard(
          color: SplitColors.tint(context),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              lineRow('Participant', selected),
              lineRow('Total due', '${money(share(selected))} USD', bold: true),
              const SizedBox(height: 12),
              _paymentSourceBlock(shareUsdCents),
              const SizedBox(height: 12),
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
  }

  // ---------- Tab 3: Store (11 Products + Honest Retail Scope + Cart + Checkout) ----------
  void _openProductDetail(StoreProduct p) {
    setState(() {
      activeProduct = p;
      _productDetailQty = 1;
    });
    go('product');
  }

  void _addToCart(StoreProduct p, {int qty = 1, bool openCart = false}) {
    setState(() {
      final row = cart.where((c) => c.product.id == p.id).firstOrNull;
      if (row != null) {
        row.qty = (row.qty + qty).clamp(1, 20);
      } else {
        cart.add(CartEntry(product: p, qty: qty.clamp(1, 20)));
      }
    });
    if (openCart) {
      go('cart');
    } else {
      showFeedback('${p.name} added to cart');
    }
  }

  void _startDirectProductCheckout(StoreProduct p, int qty) {
    setState(() {
      cart
        ..clear()
        ..add(CartEntry(product: p, qty: qty.clamp(1, 20)));
      _pendingStoreBuy = null;
    });
    go('checkout-review');
  }

  Widget _productMediaBox(StoreProduct p, {double height = 136, double radius = 12}) =>
      Container(
        height: height,
        width: double.infinity,
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(radius),
          border: Border.all(color: const Color(0xFFEEF2F7)),
        ),
        child: Image.asset(
          p.imageAsset,
          fit: BoxFit.contain,
          errorBuilder: (_, _, _) => Icon(
            p.icon,
            size: height * 0.42,
            color: SplitColors.primaryInk,
          ),
        ),
      );

  Widget storeScreen() {
    const categories = [
      'All',
      'Kitchen',
      'Lighting',
      'Appliances',
      'Storage',
      'Cleaning',
      'Electronics',
      'Home',
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
                        p.seller.toLowerCase().contains(q) ||
                        p.description.toLowerCase().contains(q)),
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
    final sponsoredProduct = kStoreCatalog
        .where((p) => p.id == kSponsoredProductId)
        .firstOrNull;

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
                        ? constraints.maxWidth - 230
                        : constraints.maxWidth,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text('Store', style: Theme.of(context).textTheme.headlineMedium),
                          const SplitBadge('Demo fixtures', preview: true),
                        ],
                      ),
                      Text(
                        interests.isEmpty
                            ? 'Household catalog · Optional split & Demo Merchant PayPal checkout'
                            : 'Preferences: ${interests.join(', ')}',
                      ),
                    ],
                  ),
                ),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    SplitSecondaryButton(
                      label: 'Preferences',
                      leadingIcon: Icons.tune_rounded,
                      expand: false,
                      onPressed: () => go('preferences'),
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
        if (_sponsoredEnabled && sponsoredProduct != null)
          Container(
            margin: const EdgeInsets.only(bottom: 14),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: SplitColors.isDark(context)
                    ? [SplitColors.darkTint, SplitColors.darkSecondary]
                    : [const Color(0xFFEDF4FF), const Color(0xFFF7FAFF)],
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: SplitColors.isDark(context)
                    ? SplitColors.darkFrameBorder
                    : const Color(0xFF9ABCFD),
              ),
            ),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.asset(
                    sponsoredProduct.imageAsset,
                    width: 64,
                    height: 64,
                    fit: BoxFit.contain,
                    errorBuilder: (_, _, _) => Icon(sponsoredProduct.icon),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SplitBadge('Sponsored · Paid placement disclosure', preview: true),
                      const SizedBox(height: 6),
                      Text(
                        sponsoredProduct.name,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text(
                        '${sponsoredProduct.seller} · ${currencyAmount(sponsoredProduct.priceCents, 'USD')} · Shown when sponsored mode is enabled in Developer Tools.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                SplitSecondaryButton(
                  label: 'View',
                  expand: false,
                  onPressed: () => _openProductDetail(sponsoredProduct),
                ),
              ],
            ),
          ),
        SplitTextField(
          label: 'Search Store',
          hintText: 'Search kettle, lamp, dinnerware, purifiers, IKEA...',
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
                      materialTapTargetSize: MaterialTapTargetSize.padded,
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
        InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => _openProductDetail(p),
          child: _productMediaBox(p),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 6,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            SplitBadge(
              p.paypalEligible ? 'Demo Merchant · PayPal' : p.seller,
              preview: !p.paypalEligible,
            ),
            Text(p.category, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          p.name,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 4),
        Text(
          p.description,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 6),
        Text(
          p.availability,
          style: TextStyle(fontSize: 12, color: SplitColors.mutedInk(context)),
        ),
        const SizedBox(height: 4),
        Text(
          currencyAmount(p.priceCents, 'USD'),
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: SplitColors.linkInk(context),
            fontSize: 16,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
        const SizedBox(height: 10),
        twoButtons(
          SplitSecondaryButton(
            label: 'View',
            onPressed: () => _openProductDetail(p),
          ),
          SplitPrimaryButton(
            label: 'Add',
            trailingIcon: Icons.add_rounded,
            onPressed: () => _addToCart(p),
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
          height: 136,
          width: double.infinity,
          decoration: BoxDecoration(
            color: SplitColors.secondaryCard(context),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            Icons.storefront_outlined,
            size: 46,
            color: SplitColors.ink(context),
          ),
        ),
        const SizedBox(height: 10),
        const SplitBadge('External retailer', preview: true),
        const SizedBox(height: 8),
        Text(r.name, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 4),
        Text(r.description, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 10),
        SplitSecondaryButton(
          label: 'Open retailer',
          leadingIcon: Icons.open_in_new_rounded,
          onPressed: () => launchUrl(Uri.parse(r.url)),
        ),
      ],
    ),
  );

  Widget _stickyProductBar(StoreProduct p) => Material(
    color: SplitColors.card(context),
    elevation: 6,
    child: SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(18, 10, 18, 12),
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: SplitColors.lineColor(context))),
        ),
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 760),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        currencyAmount(p.priceCents * _productDetailQty, 'USD'),
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                          color: SplitColors.ink(context),
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                      Text(
                        '$_productDetailQty × ${currencyAmount(p.priceCents, 'USD')}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                Expanded(
                  flex: 2,
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    alignment: WrapAlignment.end,
                    children: [
                      SplitSecondaryButton(
                        label: 'Add to Cart',
                        leadingIcon: Icons.shopping_cart_outlined,
                        expand: false,
                        onPressed: () =>
                            _addToCart(p, qty: _productDetailQty, openCart: true),
                      ),
                      SplitPrimaryButton(
                        label: 'Buy now',
                        trailingIcon: Icons.arrow_forward_rounded,
                        expand: false,
                        onPressed: () =>
                            _startDirectProductCheckout(p, _productDetailQty),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );

  Widget productScreen() {
    final p = activeProduct;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: p.name,
          subtitle: '${p.seller} · ${p.availability}',
          onBack: goBack,
          trailing: SplitBadge(
            p.paypalEligible ? 'PayPal Sandbox eligible' : 'Sample fixture',
            preview: !p.paypalEligible,
          ),
        ),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _productMediaBox(p, height: 220, radius: 14),
              const SizedBox(height: 14),
              Text(
                currencyAmount(p.priceCents, 'USD'),
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8),
              Text(p.description),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Quantity',
                          style: TextStyle(fontWeight: FontWeight.w800, color: SplitColors.ink(context)),
                        ),
                        Text(
                          'Line subtotal: ${currencyAmount(p.priceCents * _productDetailQty, 'USD')}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  Container(
                    decoration: BoxDecoration(
                      color: SplitColors.card(context),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: SplitColors.lineColor(context), width: 1.5),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: 'Decrease quantity',
                          constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
                          onPressed: () => setState(
                            () => _productDetailQty = (_productDetailQty - 1).clamp(1, 20),
                          ),
                          icon: const Icon(Icons.remove_rounded),
                        ),
                        SizedBox(
                          width: 34,
                          child: Text(
                            '$_productDetailQty',
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                          ),
                        ),
                        IconButton(
                          tooltip: 'Increase quantity',
                          constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
                          onPressed: () => setState(
                            () => _productDetailQty = (_productDetailQty + 1).clamp(1, 20),
                          ),
                          icon: const Icon(Icons.add_rounded),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (!p.paypalEligible) ...[
                const SizedBox(height: 12),
                SplitCallout(
                  message:
                      'Sample catalog item (${p.seller}). Add to Cart to build a Demo fixture order or split with roommates. PayPal Sandbox Orders v2 checkout applies only to Demo Merchant SS-001.',
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget cartScreen() {
    final totalCents = cart.fold(0, (s, c) => s + c.product.priceCents * c.qty);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: 'Cart ($cartCount)',
          subtitle: 'Adjust quantities, split, or review checkout',
          onBack: goBack,
          trailing: const SplitBadge('Demo fixtures', preview: true),
        ),
        SplitCard(
          child: cart.isEmpty
              ? Column(
                  children: [
                    const Text('Your cart is empty.'),
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
                      (c) => Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          border: Border(
                            bottom: BorderSide(
                              color: SplitColors.lineColor(context),
                            ),
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 46,
                              height: 46,
                              padding: const EdgeInsets.all(3),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Image.asset(
                                c.product.imageAsset,
                                fit: BoxFit.contain,
                                errorBuilder: (_, _, _) => Icon(
                                  c.product.icon,
                                  color: SplitColors.primaryInk,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    c.product.name,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: SplitColors.ink(context),
                                    ),
                                  ),
                                  Text(
                                    '${currencyAmount(c.product.priceCents * c.qty, 'USD')} · ${c.product.seller}',
                                    style: Theme.of(context).textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              tooltip: 'Decrease ${c.product.name}',
                              constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
                              onPressed: () => setState(() {
                                if (c.qty > 1) {
                                  c.qty--;
                                } else {
                                  cart.remove(c);
                                }
                              }),
                              icon: const Icon(Icons.remove_circle_outline_rounded),
                            ),
                            Text('${c.qty}', style: const TextStyle(fontWeight: FontWeight.w800)),
                            IconButton(
                              tooltip: 'Increase ${c.product.name}',
                              constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
                              onPressed: () => setState(() {
                                c.qty = (c.qty + 1).clamp(1, 20);
                              }),
                              icon: const Icon(Icons.add_circle_outline_rounded),
                            ),
                            IconButton(
                              tooltip: 'Remove ${c.product.name}',
                              constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
                              onPressed: () => setState(() => cart.remove(c)),
                              icon: const Icon(Icons.delete_outline_rounded, color: SplitColors.error),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    lineRow(
                      'Subtotal',
                      currencyAmount(totalCents, 'USD'),
                      bold: true,
                    ),
                    const SizedBox(height: 12),
                    twoButtons(
                      SplitSecondaryButton(
                        label: 'Clear cart',
                        onPressed: () => setState(cart.clear),
                      ),
                      SplitPrimaryButton(
                        label: 'Checkout review',
                        onPressed: () => go('checkout-review'),
                      ),
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                    ),
                    const SizedBox(height: 8),
                    SplitSecondaryButton(
                      label: 'Split this purchase',
                      leadingIcon: Icons.auto_awesome_outlined,
                      onPressed: () {
                        final each = equalShare(totalCents, 3, 'USD');
                        setState(() {
                          billRawPng = null;
                          billDraft = ExtractedBillDraft(
                            merchant: 'AI Store Shared Cart',
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
                        });
                        go('talk');
                      },
                    ),
                  ],
                ),
        ),
      ],
    );
  }

  Widget checkoutReviewScreen() {
    if (cart.isEmpty) return cartScreen();
    final totalCents = cart.fold(0, (s, c) => s + c.product.priceCents * c.qty);
    final paypalEligibleOnly = cart.every((c) => c.product.paypalEligible);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: 'Checkout review',
          subtitle: 'Verify merchant scope before paying',
          onBack: goBack,
          trailing: SplitBadge(
            paypalEligibleOnly ? 'PayPal Sandbox + Store' : 'Demo fixture',
            preview: !paypalEligibleOnly,
          ),
        ),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ...cart.map(
                (c) => lineRow(
                  '${c.product.name} × ${c.qty} (${c.product.seller})',
                  currencyAmount(c.product.priceCents * c.qty, 'USD'),
                ),
              ),
              Divider(height: 20, color: SplitColors.lineColor(context)),
              lineRow('Total', currencyAmount(totalCents, 'USD'), bold: true),
              const SizedBox(height: 12),
              _paymentSourceBlock(totalCents),
              const SizedBox(height: 10),
              SplitCallout(
                message: paypalEligibleOnly
                    ? 'Demo Merchant direct purchase records a Store receipt immediately. On the receipt screen you can tap Split cash to divide the cost, or use Scan & Pay (#purchase/SS-001) for the 3-way PayPal Sandbox checkout.'
                    : 'Sample fixture order records a Demo Store receipt in Activity. On the receipt screen you can tap Split cash to request roommates’ shares.',
              ),
              const SizedBox(height: 14),
              twoButtons(
                SplitSecondaryButton(
                  label: 'Back to Cart',
                  onPressed: _checkoutBusy ? null : goBack,
                ),
                SplitPrimaryButton(
                  label: _checkoutBusy
                      ? 'Recording purchase…'
                      : 'Complete purchase',
                  onPressed: _checkoutBusy || !_canFundPayment(totalCents)
                      ? null
                      : () => _completeDemoStoreOrder(totalCents),
                ),
                crossAxisAlignment: CrossAxisAlignment.stretch,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _completeDemoStoreOrder(int totalCents) async {
    if (_checkoutBusy || cart.isEmpty) return;
    if (!_canFundPayment(totalCents)) {
      showFeedback('PayPal Wallet balance too low. Recharge or switch card.');
      return;
    }
    final fundingLabel = paymentSource == 'wallet'
        ? 'PayPal Wallet'
        : 'PayPal Cashback •••• 9104';
    setState(() => _checkoutBusy = true);
    final clientTxId = 'store-${demoId()}';
    final desc = cart.map((c) => '${c.product.name} ×${c.qty}').join(', ');
    try {
      final tx = connected
          ? Map<String, dynamic>.from(
              (await backend(
                    '/api/organizer/demo-pay',
                    body: {
                      'type': 'store-demo',
                      'recipientName': 'AI Store (Demo)',
                      'sourceAmountCents': totalCents,
                      'sourceCurrency': 'USD',
                      'targetCurrency': 'USD',
                      'fundingSource': fundingLabel,
                      'note': desc,
                      'clientTxId': clientTxId,
                    },
                  ))['transaction']
                  as Map,
            )
          : {
              'id': 'DTX-${clientTxId.substring(6, 12).toUpperCase()}',
              'clientTxId': clientTxId,
              'type': 'store-demo',
              'direction': 'outgoing',
              'recipientName': 'AI Store (Demo)',
              'sourceAmountCents': totalCents,
              'sourceCurrency': 'USD',
              'targetAmountCents': totalCents,
              'targetCurrency': 'USD',
              'fundingSource': fundingLabel,
              'note': desc,
              'status': 'Completed',
              'demo': true,
              'createdAt': _now().toIso8601String(),
            };
      if (!mounted) return;
      setState(() {
        _deductWalletIfSelected(totalCents);
        tx['fundingSource'] ??= fundingLabel;
        demoTransfers = [tx, ...demoTransfers];
        activeTransfer = tx;
        cart.clear();
      });
      await saveLocalDemo();
      showFeedback('Demo store receipt recorded: ${currencyAmount(totalCents, 'USD')}');
      go('transfer-receipt', replace: true);
    } catch (e) {
      if (mounted) showFeedback('Could not place demo order: $e');
    } finally {
      if (mounted) setState(() => _checkoutBusy = false);
    }
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
              crossAxisAlignment: CrossAxisAlignment.stretch,
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

  void openHouseholdBill(String kind) {
    _elecProviderController.clear();
    resetRent();
    go(kind);
  }

  Widget householdBillScreen(String kind) {
    final isElec = kind == 'electricity';
    final label = isElec ? 'Electricity' : 'Rent';
    final rule = isElec ? savedElecRule : savedRentRule;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SplitScreenHeader(
          title: label,
          subtitle: 'Create and track shared ${label.toLowerCase()} requests',
          onBack: goBack,
          trailing: const SplitBadge('Demo mode', preview: true),
        ),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!rentCreating) ...[
                Text(
                  'No active ${label.toLowerCase()} bill',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 6),
                Text(
                  'Starts blank. Select household contacts, enter total ${label.toLowerCase()} amount and due date, and create requests.',
                ),
                const SizedBox(height: 12),
                SplitPrimaryButton(
                  label: 'Create ${label.toLowerCase()} request',
                  onPressed: () => setState(() => rentCreating = true),
                ),
              ] else ...[
                if (rule != null)
                  TextButton(
                    onPressed: applyRentRule,
                    child: const Text('Use saved split rule'),
                  ),
                if (isElec) ...[
                  SplitTextField(
                    label: 'Electric utility / meter note (optional)',
                    hintText: 'e.g. City Power · Apt 4B',
                    controller: _elecProviderController,
                  ),
                  const SizedBox(height: 10),
                ],
                SplitTextField(
                  label: '$label amount ($paymentCurrency)',
                  keyboardType: TextInputType.numberWithOptions(
                    decimal: paymentCurrency != 'JPY',
                  ),
                  controller: amountController,
                ),
                const SizedBox(height: 12),
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
                    secondary: SplitContactAvatar(
                      name: c.name,
                      id: c.id,
                      currency: c.currency,
                      size: 32,
                    ),
                    title: Text('${c.name} · ${c.currency}'),
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
                  label: 'Review ${label.toLowerCase()} requests',
                  onPressed: () => submitHouseholdBill(kind),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Future<void> submitHouseholdBill(String kind) async {
    final isElec = kind == 'electricity';
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
      showFeedback('Enter positive shares that do not exceed the bill total.');
      return;
    }
    final prov = _elecProviderController.text.trim();
    final title = isElec
        ? '${prov.isEmpty ? 'Electricity bill' : prov} due ${dateLabel(due)}'
        : 'Rent due ${dateLabel(due)}';
    final reason = isElec
        ? '${prov.isEmpty ? 'Electricity' : prov} (${dateLabel(due)})'
        : 'Rent due ${dateLabel(due)}';
    prepareRequests(title, kind, paymentCurrency, [
      for (final c in selected)
        RecipientDraft(
          name: c.name,
          contactId: c.id,
          known: true,
          amountCents: shares[c.id]!,
          currency: paymentCurrency,
          reason: reason,
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
      if (isElec) {
        savedElecRule = rule;
      } else {
        if (connected) await backend('/api/organizer/rent-rule', body: rule);
        savedRentRule = rule;
      }
      if (!connected) await saveLocalDemo();
    } catch (_) {
      if (mounted) {
        showFeedback(
          'Requests were created, but the ${isElec ? 'electricity' : 'rent'} rule could not be saved.',
        );
      }
    }
  }

  String get _receiveQrLink {
    final amtCents = inputCents(receiveAmountController.text, receiveQrCurrency);
    final query = <String, String>{
      'currency': receiveQrCurrency,
      if (amtCents > 0)
        'amount': formatMajorInput(amtCents, receiveQrCurrency),
    };
    final frag = Uri(path: 'receive/leah', queryParameters: query).toString();
    return '$_origin/#$frag';
  }

  Widget profileScreen() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SplitScreenHeader(
        title: 'Profile & Settings',
        subtitle: 'Receive QR, theme, quick help FAQs, and contacts.',
        onBack: goBack,
        trailing: SplitBadge(
          connected ? 'Connected Sandbox' : 'Preview mode',
          preview: !connected,
        ),
      ),
      twoPane(
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SplitCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Appearance',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Medfarm Light & Dark palette',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: SegmentedButton<ThemeMode>(
                      showSelectedIcon: false,
                      style: const ButtonStyle(
                        visualDensity: VisualDensity.compact,
                        padding: WidgetStatePropertyAll(
                          EdgeInsets.symmetric(horizontal: 6, vertical: 10),
                        ),
                      ),
                      segments: [
                        ButtonSegment(
                          value: ThemeMode.system,
                          icon: const Icon(Icons.brightness_auto_rounded, size: 15),
                          label: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: const Text('System', maxLines: 1),
                          ),
                        ),
                        ButtonSegment(
                          value: ThemeMode.light,
                          icon: const Icon(Icons.light_mode_rounded, size: 15),
                          label: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: const Text('Light', maxLines: 1),
                          ),
                        ),
                        ButtonSegment(
                          value: ThemeMode.dark,
                          icon: const Icon(Icons.dark_mode_rounded, size: 15),
                          label: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: const Text('Dark', maxLines: 1),
                          ),
                        ),
                      ],
                      selected: {widget.themeMode},
                      onSelectionChanged: (selection) =>
                          widget.onThemeModeChanged?.call(selection.first),
                    ),
                  ),
                ],
              ),
            ),
            SplitCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Organizer Sandbox Session',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  if (connected) ...[
                    Text(
                      'Linked automatically via server .env organizer session.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 10),
                    SplitSecondaryButton(
                      label: 'Sign out',
                      onPressed: signOutOrganizer,
                    ),
                  ] else
                    twoButtons(
                      SplitPrimaryButton(
                        label: 'Auto-connect .env',
                        trailingIcon: Icons.bolt_rounded,
                        onPressed: () =>
                            unawaited(restoreOrganizerConnection(interactive: true)),
                      ),
                      SplitSecondaryButton(
                        label: 'Organizer key',
                        leadingIcon: Icons.vpn_key_outlined,
                        onPressed: () => go('welcome'),
                      ),
                      minSideBySideWidth: 360,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                    ),
                  Divider(height: 22, color: SplitColors.lineColor(context)),
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
                  Divider(height: 22, color: SplitColors.lineColor(context)),
                  twoButtons(
                    SplitSecondaryButton(
                      key: const Key('lock-app-btn'),
                      label: 'Lock wallet',
                      leadingIcon: Icons.lock_outline_rounded,
                      onPressed: () {
                        Navigator.of(context).popUntil((r) => r.isFirst);
                        setState(() => _unlocked = false);
                      },
                    ),
                    SplitSecondaryButton(
                      label: 'Developer Tools',
                      leadingIcon: Icons.tune_rounded,
                      onPressed: () => go('dev'),
                    ),
                    minSideBySideWidth: 360,
                  ),
                ],
              ),
            ),
          ],
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SplitCard(
              key: const Key('profile-receive-qr-card'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Receive Money QR',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Center(
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: SplitColors.lineColor(context)),
                      ),
                      child: QrImageView(
                        data: _receiveQrLink,
                        size: 220,
                        backgroundColor: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: SplitColors.tint(context),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: SplitColors.lineColor(context)),
                    ),
                    child: Text(
                      'leah@paypal',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                        color: SplitColors.ink(context),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SplitCard(
              key: const Key('profile-help-faq-card'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Help & FAQs',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Quick answers for Wallet, QR, and splitting bills.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 8),
                  for (final faq in const [
                    (
                      q: 'How do I add funds with Recharge Wallet?',
                      a: 'Tap + Recharge on the Home PayPal Wallet card (or when prompted during payment) and pick a preset amount or enter a custom USD value.',
                    ),
                    (
                      q: 'How does Split cash work after buying from Store?',
                      a: 'Complete your direct purchase using PayPal Wallet or your linked card. On the receipt screen, tap Split cash to divide the order with friends.',
                    ),
                    (
                      q: 'How do friends pay me with leah@paypal QR?',
                      a: 'Friends scan your Receive Money QR in Scan & Pay to pre-fill Leah and open a demo FX payment.',
                    ),
                    (
                      q: 'What is the difference between Wallet and Sandbox SS-001?',
                      a: 'Wallet and contact transfers run in Demo mode for instant walkthroughs, while SS-001 uses the real PayPal Sandbox approval and capture flow.',
                    ),
                  ])
                    ExpansionTile(
                      tilePadding: EdgeInsets.zero,
                      childrenPadding: const EdgeInsets.only(bottom: 10),
                      title: Text(
                        faq.q,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: SplitColors.ink(context),
                        ),
                      ),
                      children: [
                        Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            faq.a,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                      ],
                    ),
                  const SizedBox(height: 8),
                  SplitSecondaryButton(
                    label: 'Contact PayPal AI Support',
                    leadingIcon: Icons.support_agent_rounded,
                    onPressed: () => go('contact-paypal'),
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
                      leading: SplitContactAvatar(
                        name: c.name,
                        id: c.id,
                        currency: c.currency,
                      ),
                      detail: [
                        c.country,
                        c.currency,
                      ].where((value) => value.isNotEmpty).join(' · '),
                    ),
                  ),
                  Divider(height: 18, color: SplitColors.lineColor(context)),
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
          ],
        ),
      ),
    ],
  );

  Widget devToolsScreen() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SplitScreenHeader(
        title: 'Developer Tools',
        subtitle: 'Internal Storefront preview toggles and presenter session reset',
        onBack: goBack,
        trailing: const SplitBadge('Dev', preview: true),
      ),
      twoPane(
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Storefront sponsored placement preview',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 6),
              const Text(
                'Sponsored placement is hidden on the Storefront by default. Toggle here to verify paid placement disclosure.',
              ),
              const SizedBox(height: 12),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Show sponsored card in Store'),
                subtitle: Text(_sponsoredEnabled ? 'Visible (with disclosure)' : 'Hidden (default)'),
                value: _sponsoredEnabled,
                onChanged: (v) {
                  setState(() => _sponsoredEnabled = v);
                  showFeedback(
                    v
                        ? 'Sponsored placement visible in Store with disclosure.'
                        : 'Sponsored placement hidden (default).',
                  );
                },
              ),
            ],
          ),
        ),
        SplitCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Demo session & diagnostics',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 6),
              const Text('Clear local/server demo activity, transfers, and saved rent/electricity rules cleanly.'),
              const SizedBox(height: 12),
              lineRow('Active route stack', _pushedStack.map((e) => e.name).join(' > ').isEmpty ? _tabPages[activeTab] : _pushedStack.map((e) => e.name).join(' > ')),
              const SizedBox(height: 10),
              SplitPrimaryButton(
                label: backendBusy ? 'Resetting…' : 'Reset demo session',
                leadingIcon: Icons.refresh_rounded,
                onPressed: backendBusy ? null : resetDemoSession,
              ),
            ],
          ),
        ),
      ),
    ],
  );

  // ---------- Scaffold & Responsive App Shell (IndexedStack + CupertinoPageRoute + PopScope) ----------
  Widget currentBody([String? overrideRoute]) {
    final routeName = overrideRoute ?? page;
    return switch (routeName) {
      'welcome' => welcomeScreen(),
      'home' => homeScreen(),
      'activity' => activityScreen(),
      'store' || 'shop' => storeScreen(),
      'contact-paypal' => contactPaypalScreen(),
      'profile' => profileScreen(),
      'dev' => devToolsScreen(),
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
      'rent' => householdBillScreen('rent'),
      'electricity' => householdBillScreen('electricity'),
      'product' => productScreen(),
      'cart' => cartScreen(),
      'checkout-review' => checkoutReviewScreen(),
      'preferences' => preferencesScreen(),
      _ => homeScreen(),
    };
  }

  Widget _bannerOverlay() {
    final msg = _inAppBanner;
    if (msg == null || msg.isEmpty) return const SizedBox.shrink();
    return Positioned(
      top: 8,
      left: 14,
      right: 14,
      child: SafeArea(
        bottom: false,
        child: Material(
          color: SplitColors.navy,
          elevation: 4,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              children: [
                const Icon(Icons.notifications_active_rounded, color: Color(0xFF48B3A9), size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    msg,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                ),
                IconButton(
                  tooltip: 'Dismiss alert',
                  constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
                  onPressed: () => setState(() => _inAppBanner = null),
                  icon: const Icon(Icons.close_rounded, color: Colors.white, size: 18),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSubRouteBody(BuildContext subCtx, String routeName) {
    Widget body = SafeArea(
      child: SingleChildScrollView(
        controller: routeName == 'talk' ? askScroll : null,
        padding: const EdgeInsets.all(18),
        child: Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: routeName == 'talk' ? 680 : 1020,
            ),
            child: currentBody(routeName),
          ),
        ),
      ),
    );

    if (routeName == 'talk') {
      body = Column(
        children: [
          Expanded(child: body),
          Divider(height: 1, color: SplitColors.lineColor(context)),
          talkComposer(),
        ],
      );
    }

    if (routeName == 'bill-review') {
      body = Column(
        children: [
          Expanded(child: body),
          if (billExtractState != 'loading' &&
              MediaQuery.viewInsetsOf(subCtx).bottom == 0) ...[
            Divider(height: 1, color: SplitColors.lineColor(context)),
            receiptReviewAction(),
          ],
        ],
      );
    }

    if (routeName == 'product') {
      body = Column(
        children: [
          Expanded(child: body),
          _stickyProductBar(activeProduct),
        ],
      );
    }

    return Stack(
      children: [
        body,
        _bannerOverlay(),
      ],
    );
  }

  static const _tabPages = ['home', 'activity', 'store', 'contact-paypal'];

  String _paypalHelpReply(String question) {
    final q = question.toLowerCase();
    if (q.contains('recharge') || q.contains('wallet') || q.contains('add money') || q.contains('top up')) {
      return 'PayPal Wallet (${currencyAmount(walletBalanceCents, 'USD')} available):\n'
          '• Tap Recharge on the Home PayPal Wallet card (or when prompted during checkout).\n'
          '• Pick +\$25, +\$50, +\$100, +\$250, or enter any USD amount funded from Linked Card •••• 9104.\n'
          '• Every transfer, group payment, and Store purchase can deduct directly from PayPal Wallet.';
    }
    if (q.contains('split cash') || q.contains('store') || q.contains('buy')) {
      return 'Store & Split cash:\n'
          '• Buying an item checks out directly from your PayPal Wallet or Linked Card.\n'
          '• Immediately on the receipt screen, tap Split cash to divide the total evenly or enter custom shares with roommates.';
    }
    if (q.contains('qr') || q.contains('leah@paypal') || q.contains('receive')) {
      return 'Receive Money QR (leah@paypal):\n'
          '• Your personal QR appears at the bottom of Home and inside Profile.\n'
          '• Friends can scan it in Scan & Pay to send money directly to Leah in their preferred currency.';
    }
    if (q.contains('rate') || q.contains('fx') || q.contains('sandbox') || q.contains('fee')) {
      return 'Demo rates & PayPal Sandbox:\n'
          '• International transfers show both sides before paying using Demo rates (with USD, GBP, CAD, EUR, JPY, INR).\n'
          '• Demo Merchant SS-001 uses real PayPal Sandbox Checkout approval and capture.';
    }
    if (q.contains('dispute') || q.contains('refund') || q.contains('cancel') || q.contains('problem')) {
      return 'Disputes & transaction help:\n'
          '• Open Activity to inspect any payment receipt reference (e.g. DTX-..., RCH-...).\n'
          '• PayPal Buyer Protection covers eligible Sandbox Merchant transactions, while demo transfers can be reset cleanly in Profile -> Developer Tools.';
    }
    return 'Hi Leah! I am PayPal AI Support. Ask me about:\n'
        '• Recharging & paying with PayPal Wallet\n'
        '• Splitting Store orders with Split cash\n'
        '• Receiving payments with your leah@paypal QR\n'
        '• Demo currency conversion rates & Sandbox SS-001';
  }

  Future<void> submitPaypalHelpTurn([String? overrideText]) async {
    final text = (overrideText ?? helpInput.text).trim();
    if (text.isEmpty || helpBusy) return;
    if (overrideText == null) helpInput.clear();
    setState(() {
      helpBusy = true;
      helpMessages.add((user: true, text: text));
    });
    if (!MediaQuery.disableAnimationsOf(context)) {
      await Future<void>.delayed(const Duration(milliseconds: 220));
    }
    if (!mounted) return;
    setState(() {
      helpMessages.add((user: false, text: _paypalHelpReply(text)));
      helpBusy = false;
    });
  }

  Widget contactPaypalScreen() {
    final isDark = SplitColors.isDark(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            children: [
              paypalIcon(size: 38),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Contact PayPal',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    Text(
                      'AI Support Assistant · Wallet, QR & Payments',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              TextButton.icon(
                onPressed: () => go('profile'),
                icon: const Icon(Icons.help_outline_rounded, size: 17),
                label: const Text('FAQs'),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final sample in const [
                  'How do I recharge wallet?',
                  'Explain Split cash',
                  'How does leah@paypal QR work?',
                  'Demo rates & Sandbox',
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ActionChip(
                      avatar: Icon(
                        Icons.support_agent_rounded,
                        size: 16,
                        color: SplitColors.linkInk(context),
                      ),
                      label: Text(sample),
                      onPressed: helpBusy
                          ? null
                          : () => unawaited(submitPaypalHelpTurn(sample)),
                    ),
                  ),
              ],
            ),
          ),
        ),
        SplitCard(
          key: const Key('contact-paypal-card'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (helpMessages.isEmpty) ...[
                Text(
                  'Ask PayPal AI for help.',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 6),
                Text(
                  'Tap a topic above or ask anything about PayPal Wallet, receipts, transfers, or Sandbox mode.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 12),
              ],
              for (final msg in helpMessages)
                Align(
                  alignment:
                      msg.user ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: msg.user
                          ? SplitColors.primary
                          : SplitColors.secondaryCard(context),
                      borderRadius: BorderRadius.circular(14),
                      border: msg.user
                          ? null
                          : Border.all(color: SplitColors.lineColor(context)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (!msg.user)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Text(
                              'PayPal AI',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: SplitColors.linkInk(context),
                              ),
                            ),
                          ),
                        Text(
                          msg.text,
                          style: TextStyle(
                            color: msg.user
                                ? Colors.white
                                : SplitColors.ink(context),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              if (helpBusy) const LinearProgressIndicator(),
              const SizedBox(height: 8),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: TextField(
                      key: const Key('contact-paypal-input'),
                      controller: helpInput,
                      minLines: 1,
                      maxLines: 3,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => unawaited(submitPaypalHelpTurn()),
                      style: TextStyle(
                        color: SplitColors.ink(context),
                        fontSize: 15,
                      ),
                      decoration: InputDecoration(
                        hintText: 'Ask PayPal…',
                        hintStyle: TextStyle(
                          color: SplitColors.mutedInk(
                            context,
                          ).withValues(alpha: 0.7),
                        ),
                        isDense: true,
                        constraints: const BoxConstraints(minHeight: 44),
                        filled: true,
                        fillColor: isDark
                            ? SplitColors.darkSecondary
                            : SplitColors.surfaceSubtle,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 11,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide(
                            color: SplitColors.lineColor(context),
                            width: 1.5,
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide(
                            color: SplitColors.lineColor(context),
                            width: 1.5,
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(
                            color: SplitColors.primary,
                            width: 1.8,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: helpInput,
                    builder: (context, value, _) {
                      final canSend =
                          !helpBusy && value.text.trim().isNotEmpty;
                      return SizedBox(
                        width: 44,
                        height: 44,
                        child: FilledButton(
                          onPressed:
                              canSend ? () => submitPaypalHelpTurn() : null,
                          style: FilledButton.styleFrom(
                            backgroundColor: SplitColors.primary,
                            disabledBackgroundColor:
                                SplitColors.secondaryCard(context),
                            foregroundColor: Colors.white,
                            padding: EdgeInsets.zero,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Tooltip(
                            message: 'Send question',
                            child: Icon(Icons.arrow_upward_rounded, size: 21),
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _tabScrollBody(int index) {
    final routeName = _tabPages[index];
    final controller = switch (index) {
      0 => _homeScroll,
      1 => _activityScroll,
      2 => _storeScroll,
      _ => _contactScroll,
    };
    return SafeArea(
      child: SingleChildScrollView(
        controller: controller,
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 104),
        child: Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: index == 0 ? 680 : 1020),
            child: currentBody(routeName),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_unlocked) {
      return MedfarmPinLoginScreen(
        autoPromptPhoneAuth: widget.autoPromptPhoneAuth,
        authenticateOverride: widget.authenticateOverride,
        onAuthenticated: () => setState(() => _unlocked = true),
      );
    }
    final size = MediaQuery.sizeOf(context);
    final isLandscape =
        MediaQuery.orientationOf(context) == Orientation.landscape;
    final useRail = size.width >= 720 || (isLandscape && size.width >= 540);
    final useBottomNav = !useRail;
    final tabIdx = activeTab.clamp(0, 3);

    Widget tabView = Stack(
      children: [
        IndexedStack(
          index: tabIdx,
          children: [
            _tabScrollBody(0),
            _tabScrollBody(1),
            _tabScrollBody(2),
            _tabScrollBody(3),
          ],
        ),
        _bannerOverlay(),
      ],
    );

    if (useRail) {
      tabView = Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LayoutBuilder(
            builder: (context, constraints) => SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: IntrinsicHeight(
                  child: NavigationRail(
                    selectedIndex: tabIdx,
                    backgroundColor: SplitColors.card(context),
                    labelType: NavigationRailLabelType.all,
                    onDestinationSelected: (i) => go(_tabPages[i]),
                    leading: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: _brandMarkTile(),
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
                        icon: Icon(Icons.support_agent_outlined),
                        selectedIcon: Icon(Icons.support_agent_rounded),
                        label: Text('Contact'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          VerticalDivider(width: 1, color: SplitColors.lineColor(context)),
          Expanded(child: tabView),
        ],
      );
    }

    return PopScope(
      canPop: tabIdx == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && tabIdx != 0) {
          go('home');
        }
      },
      child: Scaffold(
        body: tabView,
        floatingActionButton: tabIdx == 3
            ? null
            : FloatingActionButton.extended(
                key: const Key('fab-ask-ai'),
                onPressed: () => go('talk'),
                backgroundColor: SplitColors.primary,
                foregroundColor: Colors.white,
                elevation: 4,
                icon: const Icon(Icons.auto_awesome_rounded),
                label: const Text(
                  'Ask AI',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
        bottomNavigationBar: useBottomNav
            ? NavigationBar(
                selectedIndex: tabIdx,
                backgroundColor: SplitColors.card(context),
                indicatorColor: SplitColors.tint(context),
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
                    icon: Icon(Icons.support_agent_outlined),
                    selectedIcon: Icon(Icons.support_agent_rounded),
                    label: 'Contact',
                  ),
                ],
              )
            : null,
      ),
    );
  }
}

class _SubScreenScaffold extends StatelessWidget {
  final _DemoState state;

  const _SubScreenScaffold({required this.state});

  @override
  Widget build(BuildContext context) {
    final routeName = ModalRoute.of(context)?.settings.name ?? 'home';
    return Scaffold(
      body: AnimatedBuilder(
        animation: state._uiTick,
        builder: (_, _) => state._buildSubRouteBody(context, routeName),
      ),
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
