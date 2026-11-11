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
  final String currency;
  final String country;
  final String flag;

  const SplitContact({
    required this.id,
    required this.name,
    this.handle = '',
    this.phone = '',
    this.note = 'Contact',
    this.currency = 'USD',
    this.country = '',
    this.flag = '',
  });

  factory SplitContact.fromJson(Map<String, dynamic> j) => SplitContact(
    id: j['id']?.toString() ?? '',
    name: j['name']?.toString() ?? '',
    handle: j['handle']?.toString() ?? '',
    phone: j['phone']?.toString() ?? '',
    note: j['note']?.toString() ?? 'Contact',
    currency: j['currency']?.toString() ?? 'USD',
    country: j['country']?.toString() ?? '',
    flag: j['flag']?.toString() ?? '',
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

  factory ExtractedBillDraft.blank() =>
      ExtractedBillDraft(merchant: '', date: '', items: [], totalCents: 0);

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
  String? settledAt;
  bool demoSettled;
  final int? settleAt;

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
    this.settledAt,
    this.demoSettled = false,
    this.settleAt,
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
        settledAt: j['settledAt']?.toString(),
        demoSettled: j['demoSettled'] == true,
        settleAt: (j['settleAt'] as num?)?.toInt(),
      );
}

class ReimbursementRequest {
  final String id;
  final String title;
  final String createdAt;
  final bool demo;
  final String kind;
  final String dueDate;
  final String merchant;
  final String billDate;
  final String currency;
  final List<BillLineItem> items;
  final int taxCents;
  final int tipCents;
  final int totalCents;
  final int ownShareCents;
  final String evidenceDataUrl;
  final List<ReimbursementRecipient> recipients;

  ReimbursementRequest({
    required this.id,
    required this.title,
    this.createdAt = '',
    this.demo = false,
    this.kind = 'bill',
    this.dueDate = '',
    required this.merchant,
    required this.billDate,
    required this.currency,
    required this.items,
    required this.taxCents,
    required this.tipCents,
    required this.totalCents,
    this.ownShareCents = 0,
    required this.evidenceDataUrl,
    required this.recipients,
  });

  int get totalRequestedCents =>
      recipients.fold(0, (s, r) => s + r.amountCents);

  int get owedCents => recipients
      .where((r) => r.status != 'Paid' && r.status != 'Payment received')
      .fold(0, (s, r) => s + r.amountCents);

  String get aggregateStatus {
    if (demo) {
      return recipients.every(
            (r) => r.status == 'Paid' || r.status == 'Payment received',
          )
          ? 'Payment received'
          : 'Waiting for payment';
    }
    if (recipients.isNotEmpty && recipients.every((r) => r.status == 'Paid')) {
      return 'Paid';
    }
    if (recipients.any((r) => r.status == 'Processing')) return 'Processing';
    if (recipients.any((r) => r.status == 'Sent')) return 'Sent';
    return 'Created';
  }

  factory ReimbursementRequest.fromJson(Map<String, dynamic> j) =>
      ReimbursementRequest(
        id: j['id']?.toString() ?? '',
        title: j['title']?.toString() ?? 'Shared bill',
        createdAt: j['createdAt']?.toString() ?? '',
        demo: j['demo'] == true,
        kind: j['kind']?.toString() ?? 'bill',
        dueDate: j['dueDate']?.toString() ?? '',
        merchant: j['merchant']?.toString() ?? 'Receipt',
        billDate: j['billDate']?.toString() ?? '',
        currency: j['currency']?.toString() ?? 'USD',
        items: ((j['items'] as List?) ?? [])
            .map(
              (i) => BillLineItem(
                name: (i as Map)['name']?.toString() ?? 'Item',
                amountCents: (i['amountCents'] as num?)?.toInt() ?? 0,
              ),
            )
            .toList(),
        taxCents: (j['taxCents'] as num?)?.toInt() ?? 0,
        tipCents: (j['tipCents'] as num?)?.toInt() ?? 0,
        totalCents: (j['totalCents'] as num?)?.toInt() ?? 0,
        ownShareCents: (j['ownShareCents'] as num?)?.toInt() ?? 0,
        evidenceDataUrl: j['evidenceImageDataUrl']?.toString() ?? '',
        recipients: ((j['recipients'] as List?) ?? [])
            .map(
              (r) => ReimbursementRecipient.fromJson(
                Map<String, dynamic>.from(r as Map),
              ),
            )
            .toList(),
      );
}

class StoreProduct {
  final String id;
  final String name;
  final int priceCents;
  final String seller;
  final String category;
  final bool paypalEligible;
  final String imageAsset;
  final String availability;
  final IconData icon;
  final String description;

  bool get demoLinked => paypalEligible;

  const StoreProduct({
    required this.id,
    required this.name,
    required this.priceCents,
    required this.seller,
    required this.category,
    required this.paypalEligible,
    required this.imageAsset,
    this.availability = 'Demo price · Fixture item',
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
  SplitContact(
    id: 'allen',
    name: 'Allen',
    country: 'United Kingdom',
    flag: '🇬🇧',
    currency: 'GBP',
  ),
  SplitContact(
    id: 'maya',
    name: 'Maya',
    country: 'United States',
    flag: '🇺🇸',
  ),
  SplitContact(
    id: 'arun',
    name: 'Arun',
    country: 'Canada',
    flag: '🇨🇦',
    currency: 'CAD',
  ),
  SplitContact(
    id: 'sofia',
    name: 'Sofia',
    country: 'Germany',
    flag: '🇩🇪',
    currency: 'EUR',
  ),
  SplitContact(
    id: 'yuki',
    name: 'Yuki',
    country: 'Japan',
    flag: '🇯🇵',
    currency: 'JPY',
  ),
  SplitContact(
    id: 'leah',
    name: 'Leah',
    country: 'United States',
    flag: '🇺🇸',
    note: 'Organizer',
  ),
];

const kStoreCatalog = [
  StoreProduct(
    id: 'kit-essentials',
    name: 'Move-In Kitchen Essentials Bundle',
    priceCents: 12000,
    seller: 'Demo Merchant',
    category: 'Kitchen',
    paypalEligible: true,
    imageAsset: 'assets/products/kit-essentials.jpg',
    availability: 'Demo price · In stock (fixture)',
    icon: Icons.kitchen_outlined,
    description:
        'Multi-piece stainless steel cookware set for shared kitchens. Pairs with Matte LED Task Desk Lamp for the SS-001 \$150 PayPal Sandbox split.',
  ),
  StoreProduct(
    id: 'desk-lamp',
    name: 'Matte LED Task Desk Lamp',
    priceCents: 3000,
    seller: 'Demo Merchant',
    category: 'Lighting',
    paypalEligible: true,
    imageAsset: 'assets/products/desk-lamp.jpg',
    availability: 'Demo price · In stock (fixture)',
    icon: Icons.light_outlined,
    description:
        'Articulated aluminum and matte navy study lamp with weighted base. Eligible for Demo Merchant SS-001 PayPal Sandbox checkout.',
  ),
  StoreProduct(
    id: 'electric-kettle',
    name: 'Glass & Steel Electric Kettle (1.7L)',
    priceCents: 3800,
    seller: 'Demo Merchant',
    category: 'Kitchen',
    paypalEligible: true,
    imageAsset: 'assets/products/electric-kettle.jpg',
    availability: 'Demo price · Ships in 2 days (fixture)',
    icon: Icons.coffee_maker_outlined,
    description:
        'Borosilicate glass and brushed stainless 1.7L fast-boil kettle with auto shutoff for shared mornings.',
  ),
  StoreProduct(
    id: 'ceramic-dinnerware',
    name: 'Stoneware Dinnerware Set (12-Piece)',
    priceCents: 5400,
    seller: 'Kiln & Table Demo',
    category: 'Kitchen',
    paypalEligible: false,
    imageAsset: 'assets/products/ceramic-dinnerware.jpg',
    availability: 'Demo price · Sample catalog fixture',
    icon: Icons.dinner_dining_outlined,
    description:
        'Dishwasher-safe speckled ceramic service for four: dinner plates, salad plates, and deep soup bowls.',
  ),
  StoreProduct(
    id: 'french-press',
    name: 'Double-Wall Insulated French Press',
    priceCents: 3400,
    seller: 'RoastCraft Demo',
    category: 'Kitchen',
    paypalEligible: false,
    imageAsset: 'assets/products/french-press.jpg',
    availability: 'Demo price · Sample catalog fixture',
    icon: Icons.coffee_outlined,
    description:
        '34 oz thermal stainless steel coffee carafe with dual mesh filtration for roommates.',
  ),
  StoreProduct(
    id: 'hepa-purifier',
    name: 'Compact HEPA Room Air Purifier',
    priceCents: 8400,
    seller: 'PureAir Demo',
    category: 'Appliances',
    paypalEligible: false,
    imageAsset: 'assets/products/hepa-purifier.jpg',
    availability: 'Demo price · Sample catalog fixture',
    icon: Icons.air_rounded,
    description:
        'Cylindrical H13 HEPA tabletop purifier for living rooms and bedrooms up to 240 sq ft with quiet night mode.',
  ),
  StoreProduct(
    id: 'bamboo-organizer',
    name: 'Expandable Bamboo Drawer Organizer',
    priceCents: 2800,
    seller: 'TidyNest Demo',
    category: 'Storage',
    paypalEligible: false,
    imageAsset: 'assets/products/bamboo-organizer.jpg',
    availability: 'Demo price · Sample catalog fixture',
    icon: Icons.grid_view_rounded,
    description:
        'Adjustable natural bamboo utensil tray that expands from 13 to 22 inches for shared kitchen drawers.',
  ),
  StoreProduct(
    id: 'pantry-containers',
    name: 'Glass Dry Pantry Containers (5-Pack)',
    priceCents: 3600,
    seller: 'TidyNest Demo',
    category: 'Storage',
    paypalEligible: false,
    imageAsset: 'assets/products/pantry-containers.jpg',
    availability: 'Demo price · Sample catalog fixture',
    icon: Icons.inventory_2_outlined,
    description:
        'Sealed clear glass canister set for pasta, muesli, oats, nuts, and coffee on shared pantry shelves.',
  ),
  StoreProduct(
    id: 'microfiber-kit',
    name: 'Reusable Microfiber Cleaning Cloths (8-Pack)',
    priceCents: 2400,
    seller: 'Demo Merchant',
    category: 'Cleaning',
    paypalEligible: true,
    imageAsset: 'assets/products/microfiber-kit.jpg',
    availability: 'Demo price · In stock (fixture)',
    icon: Icons.cleaning_services_outlined,
    description:
        'Washable textured microfiber cloths designed for streak-free counter, glass, and stove cleanup.',
  ),
  StoreProduct(
    id: 'usb-c-strip',
    name: 'Wall Surge Protector with Dual USB',
    priceCents: 3200,
    seller: 'VoltDock Demo',
    category: 'Electronics',
    paypalEligible: false,
    imageAsset: 'assets/products/usb-c-strip.jpg',
    availability: 'Demo price · Sample catalog fixture',
    icon: Icons.power_outlined,
    description:
        '900-joule compact 3-outlet surge block with dual integrated USB charging ports for shared desks.',
  ),
  StoreProduct(
    id: 'bath-towels',
    name: 'Combed Cotton Bath Towel Set (4-Pack)',
    priceCents: 4200,
    seller: 'LoomWorks Demo',
    category: 'Home',
    paypalEligible: false,
    imageAsset: 'assets/products/bath-towels.jpg',
    availability: 'Demo price · Sample catalog fixture',
    icon: Icons.dry_cleaning_outlined,
    description:
        'Quick-dry 600 GSM long-staple cotton towels in slate teal and crisp white for shared guest baths.',
  ),
];

const kSponsoredProductId = 'usb-c-strip';

const kExternalRetailers = [
  ExternalRetailer(
    name: 'IKEA Home Furnishings',
    category: 'Storage',
    url: 'https://www.ikea.com/',
    description:
        'Browse sofas, desks, lighting, and modular storage directly on ikea.com.',
  ),
  ExternalRetailer(
    name: 'Target Apartment Basics',
    category: 'Cleaning',
    url: 'https://www.target.com/',
    description:
        'Compare household essentials, pickup inventory, and bedding on target.com.',
  ),
  ExternalRetailer(
    name: 'Best Buy Small Appliances',
    category: 'Appliances',
    url: 'https://www.bestbuy.com/',
    description:
        'Shop air purifiers, surge protectors, and kettles directly on bestbuy.com.',
  ),
];

const kCurrencySymbols = {
  'USD': r'$',
  'GBP': '£',
  'CAD': r'CA$',
  'EUR': '€',
  'JPY': '¥',
  'INR': '₹',
};

int decimalsForCurrency(String currency) =>
    currency.toUpperCase() == 'JPY' ? 0 : 2;

String formatMajorInput(int amountCents, String currency) {
  final dec = decimalsForCurrency(currency);
  return (amountCents / 100).toStringAsFixed(dec);
}

String formatCurrencyWithCode(int amountCents, String currency) {
  final c = currency.toUpperCase();
  final sym = kCurrencySymbols[c] ?? r'$';
  final dec = decimalsForCurrency(c);
  final major = amountCents / 100;
  final raw = dec == 0
      ? major.round().toString().replaceAllMapped(
          RegExp(r'\B(?=(\d{3})+(?!\d))'),
          (_) => ',',
        )
      : major
            .toStringAsFixed(2)
            .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
  return '$sym$raw $c';
}

int convertFxCents(
  int amountCents,
  String fromCurr,
  String toCurr,
  Map<String, double> rates,
) {
  final from = rates.containsKey(fromCurr) ? fromCurr : 'USD';
  final to = rates.containsKey(toCurr) ? toCurr : 'USD';
  if (amountCents <= 0) return 0;
  if (from == to) {
    return to == 'JPY' ? ((amountCents / 100).round()) * 100 : amountCents;
  }
  final usdMajor = (amountCents / 100) / (rates[from] ?? 1.0);
  final targetMajor = usdMajor * (rates[to] ?? 1.0);
  return to == 'JPY' ? targetMajor.round() * 100 : (targetMajor * 100).round();
}

class FxQuote {
  final String enteredSide;
  final int sourceAmountCents;
  final String sourceCurrency;
  final int targetAmountCents;
  final String targetCurrency;
  final int inrEquivalentCents;
  final double rate;

  const FxQuote({
    required this.enteredSide,
    required this.sourceAmountCents,
    required this.sourceCurrency,
    required this.targetAmountCents,
    required this.targetCurrency,
    required this.inrEquivalentCents,
    required this.rate,
  });
}

FxQuote computeFxQuote(
  int amountCents,
  String fromCurr,
  String toCurr,
  Map<String, double> rates, {
  String enteredSide = 'send',
}) {
  final sourceCurr = rates.containsKey(fromCurr) ? fromCurr : 'USD';
  final targetCurr = rates.containsKey(toCurr) ? toCurr : sourceCurr;
  final rate = (rates[targetCurr] ?? 1.0) / (rates[sourceCurr] ?? 1.0);
  int norm(int val, String c) => val <= 0
      ? 0
      : (c == 'JPY' ? ((val / 100).round()) * 100 : val);
  if (enteredSide == 'receive') {
    final targetCents = norm(amountCents, targetCurr);
    final sourceCents = convertFxCents(targetCents, targetCurr, sourceCurr, rates);
    final inrCents = convertFxCents(sourceCents, sourceCurr, 'INR', rates);
    return FxQuote(
      enteredSide: 'receive',
      sourceAmountCents: sourceCents,
      sourceCurrency: sourceCurr,
      targetAmountCents: targetCents,
      targetCurrency: targetCurr,
      inrEquivalentCents: inrCents,
      rate: rate,
    );
  }
  final sourceCents = norm(amountCents, sourceCurr);
  final targetCents = convertFxCents(sourceCents, sourceCurr, targetCurr, rates);
  final inrCents = convertFxCents(sourceCents, sourceCurr, 'INR', rates);
  return FxQuote(
    enteredSide: 'send',
    sourceAmountCents: sourceCents,
    sourceCurrency: sourceCurr,
    targetAmountCents: targetCents,
    targetCurrency: targetCurr,
    inrEquivalentCents: inrCents,
    rate: rate,
  );
}

List<RecipientDraft> mergeRecipientDrafts(
  List<RecipientDraft> previous,
  List<RecipientDraft> updates,
) {
  final merged = [...previous];
  for (final row in updates) {
    final index = merged.indexWhere(
      (prior) => prior.contactId != null && row.contactId != null
          ? prior.contactId == row.contactId
          : prior.name.trim().toLowerCase() == row.name.trim().toLowerCase(),
    );
    if (index == -1) {
      merged.add(row);
    } else {
      merged[index] = row;
    }
  }
  return merged;
}

List<RecipientDraft>? equalReceiptDraft(
  String message,
  ExtractedBillDraft bill,
  List<SplitContact> contacts,
) {
  if (bill.totalCents <= 0) return null;
  final match = RegExp(
    r'^split\b[^0-9]*?\b(?:between|among|with)\s+(.+?)[.!?]?$',
    caseSensitive: false,
  ).firstMatch(message);
  if (match == null) return null;
  final people = match
      .group(1)!
      .split(RegExp(r'\band\b|,', caseSensitive: false));
  final selected = <SplitContact>{};
  for (final person in people) {
    final name = person.trim().toLowerCase();
    if (name.isEmpty) continue;
    final contact = contacts
        .where(
          (c) =>
              c.name.toLowerCase() == name || (name == 'me' && c.id == 'leah'),
        )
        .firstOrNull;
    if (contact == null) return null;
    selected.add(contact);
  }
  if (selected.length < 2) return null;
  final unit = bill.currency == 'JPY' ? 100 : 1;
  final share = (bill.totalCents ~/ unit ~/ selected.length) * unit;
  return [
    for (final contact in selected)
      RecipientDraft(
        name: contact.name,
        contactId: contact.id,
        known: true,
        amountCents: contact.id == 'leah'
            ? bill.totalCents - share * (selected.length - 1)
            : share,
        currency: bill.currency,
        reason: bill.merchant.isEmpty ? 'Receipt split' : bill.merchant,
      ),
  ];
}

List<RecipientDraft> parseStaticTranscript(
  String text,
  List<SplitContact> contacts,
) {
  final segments = text.split(
    RegExp(r'\band\s+(?!say(?:ing)?\b|note\b)|;', caseSensitive: false),
  );
  const wordNums = {
    'ten': 10,
    'fifteen': 15,
    'twenty': 20,
    'twentyfive': 25,
    'thirty': 30,
    'forty': 40,
    'fifty': 50,
  };
  final amountPattern = RegExp(
    r'-?[$¥£€₹]?(-?\d+(?:,\d{3})*(?:\.\d{1,2})?)|\b(ten|fifteen|twenty|thirty|forty|fifty)\b',
    caseSensitive: false,
  );
  final amounts = amountPattern.allMatches(text).toList();
  if (amounts.isEmpty) return [];
  final sharedAmount =
      amounts.length == 1 &&
          RegExp(r'\b(each|apiece)\b', caseSensitive: false).hasMatch(text)
      ? amounts.single
      : null;
  final rows = <RecipientDraft>[];
  for (final seg in segments) {
    final localAmount = amountPattern.firstMatch(seg);
    final amtMatch = localAmount ?? sharedAmount;
    final amountContext = localAmount == null ? text : seg;
    final before = amtMatch == null
        ? ''
        : amountContext.substring(0, amtMatch.start);
    final after = amtMatch == null ? '' : amountContext.substring(amtMatch.end);
    final prefix =
        RegExp(
          r'(?:\b(?:USD|GBP|CAD|EUR|JPY|INR)|CA|US)\s*$',
          caseSensitive: false,
        ).firstMatch(before)?.group(0) ??
        '';
    final suffix =
        RegExp(
          r'^\s*(?:USD|GBP|CAD|EUR|JPY|INR|yen|pounds?|euros?|rupees?|dollars?)\b',
          caseSensitive: false,
        ).firstMatch(after)?.group(0) ??
        '';
    final currencyText = '$prefix${amtMatch?.group(0) ?? ''}$suffix';
    final rawNum = amtMatch?.group(1);
    final rawWord = amtMatch?.group(2)?.toLowerCase();
    final cents = amtMatch?.group(0)?.startsWith('-') == true
        ? 0
        : rawNum != null
        ? ((double.tryParse(rawNum.replaceAll(',', '')) ?? 0) * 100).round()
        : (wordNums[rawWord] ?? 0) * 100;

    final matches = contacts.where((c) {
      final first = c.name.split(' ').first;
      return RegExp(
        '\\b${RegExp.escape(first)}\\b',
        caseSensitive: false,
      ).hasMatch(seg);
    }).toList();
    if (amtMatch == null && matches.isEmpty) continue;
    final contact = matches.length == 1 ? matches.single : null;

    final askMatch = RegExp(
      r'\b(?:ask|to|from|pay|give|request)\s+([A-Z][a-z]+)\b',
    ).firstMatch(seg);
    final rawName = contact?.name ?? askMatch?.group(1) ?? 'Unknown contact';
    final reasonMatch = RegExp(
      r'(?:\b(?:for|saying|note)\s+|and\s+say\s+)([^.;]{2,100})[.!]?$',
      caseSensitive: false,
    ).firstMatch(seg.trim());
    var cleanedReason = reasonMatch?.group(1)?.trim() ?? 'Shared expense';
    cleanedReason = cleanedReason.replaceFirst(
      RegExp(r'^thanks\s+for\s+', caseSensitive: false),
      'Thanks for ',
    );

    rows.add(
      RecipientDraft(
        name: rawName,
        contactId: contact?.id,
        known: contact != null,
        ambiguous: contact == null || cents <= 0,
        amountCents: cents,
        currency:
            RegExp(
              r'\b(?:USD|GBP|CAD|EUR|JPY|INR)\b',
              caseSensitive: false,
            ).firstMatch(currencyText)?.group(0)?.toUpperCase() ??
            (RegExp(r'¥|\byen\b', caseSensitive: false).hasMatch(currencyText)
                ? 'JPY'
                : RegExp(
                    r'£|\bpounds?\b',
                    caseSensitive: false,
                  ).hasMatch(currencyText)
                ? 'GBP'
                : RegExp(
                    r'€|\beuros?\b',
                    caseSensitive: false,
                  ).hasMatch(currencyText)
                ? 'EUR'
                : RegExp(
                    r'₹|\brupees?\b',
                    caseSensitive: false,
                  ).hasMatch(currencyText)
                ? 'INR'
                : currencyText.contains(r'CA$')
                ? 'CAD'
                : RegExp(
                    r'\$|\bdollars?\b',
                    caseSensitive: false,
                  ).hasMatch(currencyText)
                ? 'USD'
                : contact?.currency ?? 'USD'),
        reason: cleanedReason,
      ),
    );
  }
  return rows;
}

/// Renders a crisp sample restaurant receipt PNG bytes offline for preview & Vision AI extraction.
Future<Uint8List> buildSampleReceiptPng() async {
  const width = 420.0;
  const height = 520.0;
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  canvas.drawRect(
    const Rect.fromLTWH(0, 0, width, height),
    Paint()..color = Colors.white,
  );
  canvas.drawRect(
    const Rect.fromLTWH(14, 14, width - 28, height - 28),
    Paint()
      ..color = const Color(0xFFDCE1E8)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3,
  );
  void drawText(
    String text,
    double x,
    double y, {
    double size = 18,
    bool bold = false,
    Color color = const Color(0xFF242E49),
  }) {
    final pb = ui.ParagraphBuilder(ui.ParagraphStyle(textAlign: TextAlign.left))
      ..pushStyle(
        ui.TextStyle(
          color: color,
          fontSize: size,
          fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
        ),
      )
      ..addText(text);
    final p = pb.build()..layout(const ui.ParagraphConstraints(width: 340));
    canvas.drawParagraph(p, Offset(x, y));
  }

  drawText('OLIVE KITCHEN', 36, 44, size: 24, bold: true);
  drawText(
    'Date: 2026-11-10 · USD',
    36,
    84,
    size: 15,
    color: const Color(0xFF5D6A85),
  );
  drawText('Pasta Dinner Bowl        \$20.00', 36, 150, bold: true);
  drawText('Craft Drinks (2)         \$15.00', 36, 198, bold: true);
  drawText('Shared Herb Flatbread     \$7.00', 36, 246, bold: true);
  drawText(
    'Tax: \$0.00   Tip: \$0.00',
    36,
    320,
    size: 15,
    color: const Color(0xFF5D6A85),
  );
  drawText(
    'TOTAL USD               \$42.00',
    36,
    380,
    size: 22,
    bold: true,
    color: const Color(0xFF0A4EC4),
  );
  final picture = recorder.endRecording();
  return picture.toImage(width.toInt(), height.toInt()).then((image) async {
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    return byteData?.buffer.asUint8List() ?? Uint8List(0);
  });
}

class StoreBuyMatch {
  final StoreProduct product;
  final int qty;

  const StoreBuyMatch({required this.product, required this.qty});
}

/// Parses natural-language AI store purchase commands (e.g. "Buy 2 desk lamps", "Buy electric kettle").
StoreBuyMatch? parseStoreBuyCommand(
  String raw, {
  List<StoreProduct> catalog = kStoreCatalog,
}) {
  final text = raw.trim().toLowerCase();
  if (text.isEmpty ||
      !RegExp(r'\b(buy|order|purchase|shop|get)\b').hasMatch(text)) {
    return null;
  }
  final keywords = <String, List<String>>{
    'kit-essentials': ['kitchen', 'essentials', 'cookware', 'bundle', 'pots', 'pans'],
    'desk-lamp': ['lamp', 'desk lamp', 'light'],
    'electric-kettle': ['kettle', 'electric kettle', 'boiler'],
    'ceramic-dinnerware': ['dinnerware', 'plates', 'bowls', 'stoneware', 'dishes'],
    'french-press': ['french press', 'coffee carafe', 'carafe', 'coffee press'],
    'hepa-purifier': ['purifier', 'hepa', 'air filter'],
    'bamboo-organizer': ['bamboo', 'organizer', 'drawer', 'tray'],
    'pantry-containers': ['pantry', 'containers', 'canister', 'jars'],
    'microfiber-kit': ['microfiber', 'cloths', 'cleaning cloths', 'towels cleaning'],
    'usb-c-strip': ['surge', 'usb', 'power strip', 'outlet'],
    'bath-towels': ['bath towel', 'bath towels', 'towel', 'towels'],
  };
  StoreProduct? matched;
  var bestScore = 0;
  for (final product in catalog) {
    var score = 0;
    if (text.contains(product.name.toLowerCase())) score += 10;
    if (text.contains(product.id.toLowerCase())) score += 8;
    for (final kw in keywords[product.id] ?? const <String>[]) {
      if (text.contains(kw)) score += kw.contains(' ') ? 5 : 3;
    }
    if (score > bestScore) {
      bestScore = score;
      matched = product;
    }
  }
  if (matched == null || bestScore <= 0) return null;
  final wordQty = {'two': 2, 'three': 3, 'four': 4, 'five': 5};
  final numMatch = RegExp(
    r'\b(?:buy|order|purchase|get)\s+(?:(\d{1,2})|(two|three|four|five))\b',
  ).firstMatch(text);
  final qty = numMatch == null
      ? 1
      : (int.tryParse(numMatch.group(1) ?? '') ??
                wordQty[numMatch.group(2) ?? ''] ??
                1)
            .clamp(1, 20);
  return StoreBuyMatch(product: matched, qty: qty);
}

String pngBytesToDataUrl(Uint8List bytes) =>
    bytes.isEmpty ? '' : 'data:image/png;base64,${base64Encode(bytes)}';
