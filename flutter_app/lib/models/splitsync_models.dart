import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

class SplitContact {
  final String id;
  final String name;
  final String handle;
  final String phone;
  final String note;

  const SplitContact({
    required this.id,
    required this.name,
    this.handle = '',
    this.phone = '',
    this.note = 'Contact',
  });

  factory SplitContact.fromJson(Map<String, dynamic> j) => SplitContact(
        id: j['id']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        handle: j['handle']?.toString() ?? '',
        phone: j['phone']?.toString() ?? '',
        note: j['note']?.toString() ?? 'Contact',
      );
}

class BillLineItem {
  String name;
  int amountCents;

  BillLineItem({required this.name, required this.amountCents});

  Map<String, dynamic> toJson() => {'name': name, 'amountCents': amountCents};
}

class ExtractedBillDraft {
  String merchant;
  String date;
  String currency;
  List<BillLineItem> items;
  int taxCents;
  int tipCents;
  int totalCents;
  List<String> unreadableFields;
  String modelUsed;

  ExtractedBillDraft({
    required this.merchant,
    required this.date,
    this.currency = 'USD',
    required this.items,
    this.taxCents = 0,
    this.tipCents = 0,
    required this.totalCents,
    this.unreadableFields = const [],
    this.modelUsed = '',
  });

  int get computedTotalCents =>
      items.fold(0, (s, i) => s + i.amountCents) + taxCents + tipCents;

  bool get totalMismatch =>
      totalCents > 0 &&
      computedTotalCents > 0 &&
      (totalCents - computedTotalCents).abs() > 1;

  factory ExtractedBillDraft.oliveSample() => ExtractedBillDraft(
        merchant: 'Olive Kitchen',
        date: '2026-11-10',
        currency: 'USD',
        items: [
          BillLineItem(name: 'Pasta Dinner Bowl', amountCents: 2000),
          BillLineItem(name: 'Craft Drinks (2)', amountCents: 1500),
          BillLineItem(name: 'Shared Herb Flatbread', amountCents: 700),
        ],
        totalCents: 4200,
      );
}

class RecipientDraft {
  String name;
  String? contactId;
  bool known;
  bool ambiguous;
  int amountCents;
  String currency;
  String reason;

  RecipientDraft({
    required this.name,
    this.contactId,
    required this.known,
    this.ambiguous = false,
    required this.amountCents,
    this.currency = 'USD',
    required this.reason,
  });

  factory RecipientDraft.fromJson(Map<String, dynamic> j) => RecipientDraft(
        name: j['name']?.toString() ?? '',
        contactId: j['contactId']?.toString(),
        known: j['known'] == true,
        ambiguous: j['ambiguous'] == true,
        amountCents: (j['amountCents'] as num?)?.toInt() ?? 0,
        currency: j['currency']?.toString() ?? 'USD',
        reason: j['reason']?.toString() ?? 'Shared expense',
      );
}

class ReimbursementRecipient {
  final String id;
  final String name;
  final int amountCents;
  final String currency;
  final String reason;
  String status;
  String deliveryStatus;
  String deliveryMessage;
  final String shareToken;
  final String shareUrl;
  String? receiptRef;

  ReimbursementRecipient({
    required this.id,
    required this.name,
    required this.amountCents,
    required this.currency,
    required this.reason,
    required this.status,
    required this.deliveryStatus,
    required this.deliveryMessage,
    required this.shareToken,
    required this.shareUrl,
    this.receiptRef,
  });

  factory ReimbursementRecipient.fromJson(Map<String, dynamic> j) =>
      ReimbursementRecipient(
        id: j['id']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        amountCents: (j['amountCents'] as num?)?.toInt() ?? 0,
        currency: j['currency']?.toString() ?? 'USD',
        reason: j['reason']?.toString() ?? 'Shared expense',
        status: j['status']?.toString() ?? 'Created',
        deliveryStatus: j['deliveryStatus']?.toString() ?? 'Created',
        deliveryMessage: j['deliveryMessage']?.toString() ?? '',
        shareToken: j['shareToken']?.toString() ?? '',
        shareUrl: j['shareUrl']?.toString() ?? '',
        receiptRef: j['receiptRef']?.toString(),
      );
}

class ReimbursementRequest {
  final String id;
  final String title;
  final String merchant;
  final String billDate;
  final String currency;
  final List<BillLineItem> items;
  final int taxCents;
  final int tipCents;
  final int totalCents;
  final String evidenceDataUrl;
  final List<ReimbursementRecipient> recipients;

  ReimbursementRequest({
    required this.id,
    required this.title,
    required this.merchant,
    required this.billDate,
    required this.currency,
    required this.items,
    required this.taxCents,
    required this.tipCents,
    required this.totalCents,
    required this.evidenceDataUrl,
    required this.recipients,
  });

  int get totalRequestedCents =>
      recipients.fold(0, (s, r) => s + r.amountCents);

  int get owedCents => recipients
      .where((r) => r.status != 'Paid')
      .fold(0, (s, r) => s + r.amountCents);

  String get aggregateStatus {
    if (recipients.every((r) => r.status == 'Paid')) return 'Paid';
    if (recipients.any((r) => r.status == 'Processing')) return 'Processing';
    if (recipients.any((r) => r.status == 'Sent')) return 'Sent';
    return 'Created';
  }

  factory ReimbursementRequest.fromJson(Map<String, dynamic> j) =>
      ReimbursementRequest(
        id: j['id']?.toString() ?? '',
        title: j['title']?.toString() ?? 'Shared bill',
        merchant: j['merchant']?.toString() ?? 'Receipt',
        billDate: j['billDate']?.toString() ?? '',
        currency: j['currency']?.toString() ?? 'USD',
        items: ((j['items'] as List?) ?? [])
            .map((i) => BillLineItem(
                  name: (i as Map)['name']?.toString() ?? 'Item',
                  amountCents: (i['amountCents'] as num?)?.toInt() ?? 0,
                ))
            .toList(),
        taxCents: (j['taxCents'] as num?)?.toInt() ?? 0,
        tipCents: (j['tipCents'] as num?)?.toInt() ?? 0,
        totalCents: (j['totalCents'] as num?)?.toInt() ?? 0,
        evidenceDataUrl: j['evidenceImageDataUrl']?.toString() ?? '',
        recipients: ((j['recipients'] as List?) ?? [])
            .map((r) =>
                ReimbursementRecipient.fromJson(Map<String, dynamic>.from(r as Map)))
            .toList(),
      );
}

class StoreProduct {
  final String id;
  final String name;
  final int priceCents;
  final String seller;
  final String category;
  final bool demoLinked;
  final IconData icon;
  final String description;

  const StoreProduct({
    required this.id,
    required this.name,
    required this.priceCents,
    required this.seller,
    required this.category,
    required this.demoLinked,
    required this.icon,
    required this.description,
  });
}

class ExternalRetailer {
  final String name;
  final String category;
  final String url;
  final String description;

  const ExternalRetailer({
    required this.name,
    required this.category,
    required this.url,
    required this.description,
  });
}

class CartEntry {
  final StoreProduct product;
  int qty;

  CartEntry({required this.product, this.qty = 1});
}

const kDefaultContacts = [
  SplitContact(id: 'maya', name: 'Maya', handle: 'maya@house.local', phone: '+1-555-0141', note: 'Roommate'),
  SplitContact(id: 'arun', name: 'Arun', handle: 'arun@house.local', phone: '+1-555-0142', note: 'Roommate'),
  SplitContact(id: 'leah', name: 'Leah', handle: 'leah@house.local', phone: '+1-555-0143', note: 'Organizer'),
  SplitContact(id: 'samir', name: 'Samir Patel', handle: 'samir@house.local', phone: '+1-555-0144', note: 'Friend'),
];

const kStoreCatalog = [
  StoreProduct(
    id: 'kit-essentials',
    name: 'Kitchen essentials bundle',
    priceCents: 12000,
    seller: 'Demo Merchant',
    category: 'Kitchen',
    demoLinked: true,
    icon: Icons.kitchen_outlined,
    description: 'Cookware, storage containers, and cleaning basics. Pairs with Desk lamp for SS-001.',
  ),
  StoreProduct(
    id: 'desk-lamp',
    name: 'Matte task desk lamp',
    priceCents: 3000,
    seller: 'Demo Merchant',
    category: 'Lighting',
    demoLinked: true,
    icon: Icons.light_outlined,
    description: 'Warm LED desk lamp with weighted base for shared study spaces.',
  ),
  StoreProduct(
    id: 'bamboo-tray',
    name: 'Modular bamboo organizer',
    priceCents: 2800,
    seller: 'Studio Living Demo',
    category: 'Kitchen',
    demoLinked: false,
    icon: Icons.grid_view_rounded,
    description: 'Expandable drawer divider set for shared kitchen flatware and utensils.',
  ),
  StoreProduct(
    id: 'hepa-purifier',
    name: 'Compact HEPA air purifier',
    priceCents: 8400,
    seller: 'PureHome Demo',
    category: 'Furniture',
    demoLinked: false,
    icon: Icons.air_rounded,
    description: 'Quiet apartment air cleaner with washable pre-filter.',
  ),
  StoreProduct(
    id: 'microfiber-kit',
    name: 'Move-in cleaning kit',
    priceCents: 2400,
    seller: 'Demo Merchant',
    category: 'Cleaning',
    demoLinked: false,
    icon: Icons.cleaning_services_outlined,
    description: 'Surface spray, scrub sponges, and 8 microfiber cloths.',
  ),
  StoreProduct(
    id: 'pantry-bins',
    name: 'Stackable pantry bins (6 pack)',
    priceCents: 3600,
    seller: 'TidyNest Demo',
    category: 'Kitchen',
    demoLinked: false,
    icon: Icons.inventory_2_outlined,
    description: 'Clear BPA-free fridge and dry-pantry bins with grip handles.',
  ),
];

const kExternalRetailers = [
  ExternalRetailer(
    name: 'IKEA home furnishings',
    category: 'Furniture',
    url: 'https://www.ikea.com/',
    description: 'Browse sofas, desks, lighting, and flat-pack storage directly on ikea.com.',
  ),
  ExternalRetailer(
    name: 'Target apartment basics',
    category: 'Cleaning',
    url: 'https://www.target.com/',
    description: 'Compare apartment essentials and store pickup on target.com.',
  ),
];

List<RecipientDraft> parseStaticTranscript(String text, List<SplitContact> contacts) {
  final segments = text.split(RegExp(r'\band\b|,|;', caseSensitive: false));
  const wordNums = {
    'ten': 10,
    'fifteen': 15,
    'twenty': 20,
    'twentyfive': 25,
    'thirty': 30,
    'forty': 40,
    'fifty': 50,
  };
  final rows = <RecipientDraft>[];
  for (final seg in segments) {
    final amtMatch = RegExp(
      r'\$?(\d+(?:\.\d{1,2})?)|\b(ten|fifteen|twenty|thirty|forty|fifty)\b',
      caseSensitive: false,
    ).firstMatch(seg);
    if (amtMatch == null) continue;
    final rawNum = amtMatch.group(1);
    final rawWord = amtMatch.group(2)?.toLowerCase();
    final cents = rawNum != null
        ? ((double.tryParse(rawNum) ?? 0) * 100).round()
        : (wordNums[rawWord] ?? 0) * 100;

    final contact = contacts.where((c) {
      final first = c.name.split(' ').first;
      return RegExp('\\b$first\\b', caseSensitive: false).hasMatch(seg);
    }).firstOrNull;

    final askMatch = RegExp(r'\b(?:ask|for|from)\s+([A-Z][a-z]+)\b').firstMatch(seg);
    final rawName = contact?.name ?? askMatch?.group(1) ?? 'Unknown contact';
    final reasonMatch = RegExp(r'\bfor\s+([a-z\s]{2,40})$', caseSensitive: false).firstMatch(seg.trim());

    rows.add(RecipientDraft(
      name: rawName,
      contactId: contact?.id,
      known: contact != null,
      ambiguous: contact == null || cents <= 0,
      amountCents: cents,
      reason: reasonMatch?.group(1)?.trim() ?? 'Shared expense',
    ));
  }
  return rows;
}

/// Renders a crisp sample restaurant receipt PNG bytes offline for preview & Vision AI extraction.
Future<Uint8List> buildSampleReceiptPng() async {
  const width = 420.0;
  const height = 520.0;
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  canvas.drawRect(const Rect.fromLTWH(0, 0, width, height), Paint()..color = Colors.white);
  canvas.drawRect(
    const Rect.fromLTWH(14, 14, width - 28, height - 28),
    Paint()
      ..color = const Color(0xFFDCE1E8)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3,
  );
  void drawText(String text, double x, double y, {double size = 18, bool bold = false, Color color = const Color(0xFF242E49)}) {
    final pb = ui.ParagraphBuilder(ui.ParagraphStyle(textAlign: TextAlign.left))
      ..pushStyle(ui.TextStyle(color: color, fontSize: size, fontWeight: bold ? FontWeight.w800 : FontWeight.w500))
      ..addText(text);
    final p = pb.build()..layout(const ui.ParagraphConstraints(width: 340));
    canvas.drawParagraph(p, Offset(x, y));
  }
  drawText('OLIVE KITCHEN', 36, 44, size: 24, bold: true);
  drawText('Date: 2026-11-10 · USD', 36, 84, size: 15, color: const Color(0xFF5D6A85));
  drawText('Pasta Dinner Bowl        \$20.00', 36, 150, bold: true);
  drawText('Craft Drinks (2)         \$15.00', 36, 198, bold: true);
  drawText('Shared Herb Flatbread     \$7.00', 36, 246, bold: true);
  drawText('Tax: \$0.00   Tip: \$0.00', 36, 320, size: 15, color: const Color(0xFF5D6A85));
  drawText('TOTAL USD               \$42.00', 36, 380, size: 22, bold: true, color: const Color(0xFF0A4EC4));
  final picture = recorder.endRecording();
  final image = await picture.toImage(width.toInt(), height.toInt());
  final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
  return byteData?.buffer.asUint8List() ?? Uint8List(0);
}

String pngBytesToDataUrl(Uint8List bytes) =>
    bytes.isEmpty ? '' : 'data:image/png;base64,${base64Encode(bytes)}';
