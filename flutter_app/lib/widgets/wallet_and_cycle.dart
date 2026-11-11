import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/medfarm_theme.dart';

/// Descriptor for a visual PayPal card in the interactive 3D card stack.
class WalletCardSpec {
  final String id;
  final String title;
  final String brand;
  final String last4;
  final String badge;
  final List<Color> gradient;

  const WalletCardSpec({
    required this.id,
    required this.title,
    required this.brand,
    required this.last4,
    required this.badge,
    required this.gradient,
  });
}

const List<WalletCardSpec> kWalletCardSpecs = [
  WalletCardSpec(
    id: 'pp-balance',
    title: 'PayPal Balance Card',
    brand: 'PayPal Wallet',
    last4: '4829',
    badge: 'Primary · USD',
    gradient: [Color(0xFF0A3D9E), Color(0xFF1457D9), Color(0xFF1F7AE0)],
  ),
  WalletCardSpec(
    id: 'pp-cashback',
    title: 'PayPal Cashback',
    brand: 'Mastercard',
    last4: '9104',
    badge: '3% Cashback',
    gradient: [Color(0xFF141B31), Color(0xFF243B6B), Color(0xFF0E6E74)],
  ),
  WalletCardSpec(
    id: 'pp-travel',
    title: 'Multi-Currency Travel',
    brand: 'PayPal Global',
    last4: '3318',
    badge: 'USD · GBP · EUR · JPY',
    gradient: [Color(0xFF123635), Color(0xFF136B63), Color(0xFF2B3758)],
  ),
];

/// Interactive 3D perspective PayPal credit card deck with shuffle & Wallet actions.
class WalletCardDeck3D extends StatefulWidget {
  final int walletBalanceCents;
  final int activeCardIndex;
  final ValueChanged<int> onCardChanged;
  final VoidCallback onRecharge;

  const WalletCardDeck3D({
    super.key,
    required this.walletBalanceCents,
    required this.activeCardIndex,
    required this.onCardChanged,
    required this.onRecharge,
  });

  @override
  State<WalletCardDeck3D> createState() => _WalletCardDeck3DState();
}

class _WalletCardDeck3DState extends State<WalletCardDeck3D> {
  double _tiltX = 0.04;
  double _tiltY = -0.06;

  void _shuffleNext() {
    widget.onCardChanged((widget.activeCardIndex + 1) % kWalletCardSpecs.length);
  }

  String _usdLabel(int cents) => '\$${(cents / 100).toStringAsFixed(2)} USD';

  @override
  Widget build(BuildContext context) {
    final total = kWalletCardSpecs.length;
    final activeIdx = widget.activeCardIndex % total;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    final duration = reduceMotion
        ? Duration.zero
        : const Duration(milliseconds: 340);

    // Build front-to-back order: draw back cards first so active is on top.
    final renderOrder = [
      (activeIdx + 2) % total,
      (activeIdx + 1) % total,
      activeIdx,
    ];

    return SplitCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PayPal Wallet',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _usdLabel(widget.walletBalanceCents),
                      key: const Key('wallet-balance-text'),
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
              ),
              FilledButton.icon(
                key: const Key('recharge-wallet-btn'),
                onPressed: widget.onRecharge,
                icon: const Icon(Icons.add_rounded, size: 17),
                label: const Text('Recharge'),
                style: FilledButton.styleFrom(
                  backgroundColor: SplitColors.primary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(0, 40),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          GestureDetector(
            key: const Key('wallet-3d-deck'),
            onTap: _shuffleNext,
            onHorizontalDragEnd: (details) {
              if ((details.primaryVelocity ?? 0).abs() > 80) {
                _shuffleNext();
              }
            },
            onPanUpdate: (details) {
              if (reduceMotion) return;
              setState(() {
                _tiltY = (_tiltY + details.delta.dx * 0.004).clamp(-0.24, 0.24);
                _tiltX = (_tiltX - details.delta.dy * 0.004).clamp(-0.18, 0.18);
              });
            },
            onPanEnd: (_) {
              if (reduceMotion) return;
              setState(() {
                _tiltX = 0.04;
                _tiltY = -0.06;
              });
            },
            child: SizedBox(
              height: 192,
              child: Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.center,
                children: [
                  for (final cardIndex in renderOrder)
                    _buildStackedCard(
                      card: kWalletCardSpecs[cardIndex],
                      depth: (cardIndex - activeIdx + total) % total,
                      duration: duration,
                      reduceMotion: reduceMotion,
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (context, constraints) {
              final textMax = math.max(
                110.0,
                math.min(280.0, constraints.maxWidth - 68.0),
              );
              return SizedBox(
                width: double.infinity,
                child: Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        for (var i = 0; i < total; i++)
                          GestureDetector(
                            onTap: () => widget.onCardChanged(i),
                            child: AnimatedContainer(
                              duration: duration,
                              margin: const EdgeInsets.only(right: 6),
                              width: i == activeIdx ? 20 : 7,
                              height: 7,
                              decoration: BoxDecoration(
                                color: i == activeIdx
                                    ? SplitColors.primary
                                    : SplitColors.lineColor(context),
                                borderRadius: BorderRadius.circular(999),
                              ),
                            ),
                          ),
                        const SizedBox(width: 6),
                        ConstrainedBox(
                          constraints: BoxConstraints(maxWidth: textMax),
                          child: Text(
                            '${kWalletCardSpecs[activeIdx].title} · •••• ${kWalletCardSpecs[activeIdx].last4}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                      ],
                    ),
                    TextButton.icon(
                      key: const Key('shuffle-card-btn'),
                      onPressed: _shuffleNext,
                      icon: const Icon(Icons.style_rounded, size: 17),
                      label: const Text('Shuffle card'),
                      style: TextButton.styleFrom(
                        foregroundColor: SplitColors.linkInk(context),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildStackedCard({
    required WalletCardSpec card,
    required int depth,
    required Duration duration,
    required bool reduceMotion,
  }) {
    final isFront = depth == 0;
    final dx = depth == 0 ? 0.0 : (depth == 1 ? 12.0 : 22.0);
    final dy = depth == 0 ? 0.0 : (depth == 1 ? 10.0 : 20.0);
    final scale = depth == 0 ? 1.0 : (depth == 1 ? 0.94 : 0.88);
    final rotZ = depth == 0 ? 0.0 : (depth == 1 ? 0.025 : 0.045);

    final matrix = Matrix4.identity()
      ..setEntry(3, 2, 0.0014)
      ..rotateZ(rotZ);
    if (isFront && !reduceMotion) {
      matrix
        ..rotateX(_tiltX)
        ..rotateY(_tiltY);
    }

    return AnimatedPositioned(
      key: ValueKey('card-${card.id}'),
      duration: duration,
      curve: Curves.easeOutCubic,
      top: dy,
      left: 0,
      right: dx,
      child: AnimatedOpacity(
        duration: duration,
        opacity: isFront ? 1.0 : (depth == 1 ? 0.86 : 0.68),
        child: Transform(
          alignment: Alignment.center,
          transform: matrix,
          child: Transform.scale(
            scale: scale,
            child: Container(
              height: 168,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: card.gradient,
                ),
                border: Border.all(
                  color: Colors.white.withValues(alpha: isFront ? 0.28 : 0.14),
                ),
                boxShadow: [
                  BoxShadow(
                    color: card.gradient.first.withValues(
                      alpha: isFront ? 0.36 : 0.16,
                    ),
                    blurRadius: isFront ? 18 : 10,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.16),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            card.brand,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.22),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            card.badge,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  Row(
                    children: [
                      Container(
                        width: 34,
                        height: 24,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF3D37A),
                          borderRadius: BorderRadius.circular(5),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(
                        Icons.wifi_rounded,
                        color: Colors.white.withValues(alpha: 0.78),
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      if (card.id == 'pp-balance')
                        Expanded(
                          child: Text(
                            _usdLabel(widget.walletBalanceCents),
                            textAlign: TextAlign.end,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              fontFeatures: [FontFeature.tabularFigures()],
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              card.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.85),
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '••••  ••••  ••••  ${card.last4}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.9,
                                fontFeatures: [FontFeature.tabularFigures()],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Text(
                        'LEAH M.',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.8,
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
  }
}

/// Payment source selector shared across payment confirmation screens.
class PaymentSourceSelector extends StatelessWidget {
  final String selectedSource; // 'wallet' | 'card'
  final int walletBalanceCents;
  final int requiredUsdCents;
  final ValueChanged<String> onChanged;
  final VoidCallback onRecharge;

  const PaymentSourceSelector({
    super.key,
    required this.selectedSource,
    required this.walletBalanceCents,
    required this.requiredUsdCents,
    required this.onChanged,
    required this.onRecharge,
  });

  String _usd(int c) => '\$${(c / 100).toStringAsFixed(2)} USD';

  @override
  Widget build(BuildContext context) {
    final walletSelected = selectedSource == 'wallet';
    final sufficient = walletBalanceCents >= requiredUsdCents;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: SplitColors.secondaryCard(context),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: SplitColors.lineColor(context)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Payment method',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 13,
              color: SplitColors.ink(context),
            ),
          ),
          const SizedBox(height: 8),
          _sourceOption(
            context,
            id: 'wallet',
            icon: Icons.account_balance_wallet_rounded,
            title: 'PayPal Wallet',
            subtitle: 'Available ${_usd(walletBalanceCents)}',
            selected: walletSelected,
            warning: walletSelected && !sufficient,
          ),
          const SizedBox(height: 8),
          _sourceOption(
            context,
            id: 'card',
            icon: Icons.credit_card_rounded,
            title: 'PayPal Cashback •••• 9104',
            subtitle: 'Linked demo card · Instant backup',
            selected: !walletSelected,
          ),
          if (walletSelected && !sufficient) ...[
            const SizedBox(height: 10),
            SplitCallout(
              kind: CalloutKind.warning,
              message:
                  'Wallet balance is ${_usd(requiredUsdCents - walletBalanceCents)} short. Recharge or switch to your linked card.',
            ),
            const SizedBox(height: 8),
            SplitSecondaryButton(
              label: 'Recharge PayPal Wallet',
              leadingIcon: Icons.add_card_rounded,
              onPressed: onRecharge,
            ),
          ],
        ],
      ),
    );
  }

  Widget _sourceOption(
    BuildContext context, {
    required String id,
    required IconData icon,
    required String title,
    required String subtitle,
    required bool selected,
    bool warning = false,
  }) {
    final border = selected
        ? (warning ? SplitColors.amber : SplitColors.primary)
        : SplitColors.lineColor(context);
    return Material(
      color: selected
          ? SplitColors.tint(context)
          : SplitColors.card(context),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => onChanged(id),
        child: Container(
          constraints: const BoxConstraints(minHeight: 52),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: border, width: selected ? 1.8 : 1.0),
          ),
          child: Row(
            children: [
              Icon(
                icon,
                color: selected
                    ? SplitColors.linkInk(context)
                    : SplitColors.mutedInk(context),
                size: 20,
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
                        fontSize: 13,
                        color: SplitColors.ink(context),
                      ),
                    ),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              Icon(
                selected
                    ? Icons.radio_button_checked_rounded
                    : Icons.radio_button_unchecked_rounded,
                color: selected
                    ? SplitColors.linkInk(context)
                    : SplitColors.mutedInk(context),
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Activity payment cycle spline graph with organic ups and downs.
class PaymentCycleCard extends StatelessWidget {
  final String range; // '7D' | '30D'
  final ValueChanged<String> onRangeChanged;
  final int inflowCents;
  final int outflowCents;
  final int pointSeed;

  const PaymentCycleCard({
    super.key,
    required this.range,
    required this.onRangeChanged,
    required this.inflowCents,
    required this.outflowCents,
    required this.pointSeed,
  });

  List<double> _buildPoints() {
    // Organic ups and downs baseline modulated by live inflow/outflow + seed
    const base30 = [
      42.0, 68.0, 51.0, 88.0, 64.0, 96.0, 58.0, 118.0, 81.0, 105.0, 74.0,
      132.0, 95.0, 124.0,
    ];
    const base7 = [48.0, 86.0, 59.0, 108.0, 72.0, 118.0, 89.0, 134.0];
    final src = range == '7D' ? base7 : base30;
    final tailBoost = ((inflowCents - outflowCents) / 100).clamp(-35.0, 60.0);
    return [
      for (var i = 0; i < src.length; i++)
        (src[i] +
                math.sin(i * 1.7 + pointSeed * 0.4) * 14.0 +
                (i >= src.length - 2 ? tailBoost * (i == src.length - 1 ? 1.0 : 0.45) : 0.0))
            .clamp(14.0, 210.0),
    ];
  }

  String _usd(int c) => '\$${(c.abs() / 100).toStringAsFixed(2)}';

  @override
  Widget build(BuildContext context) {
    final points = _buildPoints();
    final net = inflowCents - outflowCents;
    final labels = range == '7D'
        ? const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        : const ['Wk 1', 'Wk 2', 'Wk 3', 'Now'];
    return SplitCard(
      key: const Key('payment-cycle-card'),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Payment cycle',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    Text(
                      'Inflow & spending waves ($range)',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              ToggleButtons(
                isSelected: [range == '7D', range == '30D'],
                onPressed: (idx) => onRangeChanged(idx == 0 ? '7D' : '30D'),
                borderRadius: BorderRadius.circular(10),
                constraints: const BoxConstraints(minHeight: 36, minWidth: 44),
                selectedColor: Colors.white,
                fillColor: SplitColors.primary,
                color: SplitColors.mutedInk(context),
                borderColor: SplitColors.lineColor(context),
                selectedBorderColor: SplitColors.primary,
                children: const [
                  Text('7D', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                  Text('30D', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 148,
            width: double.infinity,
            child: CustomPaint(
              painter: _PaymentCyclePainter(
                points: points,
                lineColor: SplitColors.primary,
                waveAccent: SplitColors.teal,
                gridColor: SplitColors.lineColor(context),
                dotFill: SplitColors.card(context),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              for (final l in labels)
                Text(
                  l,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
            ],
          ),
          Divider(height: 22, color: SplitColors.lineColor(context)),
          Row(
            children: [
              _statTile(context, 'Inflow', '+${_usd(inflowCents)}', SplitColors.teal),
              _statTile(context, 'Outflow', '-${_usd(outflowCents)}', SplitColors.coral),
              _statTile(
                context,
                'Net cycle',
                '${net >= 0 ? '+' : '-'}${_usd(net)}',
                net >= 0 ? SplitColors.linkInk(context) : SplitColors.coral,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statTile(
    BuildContext context,
    String label,
    String value,
    Color valColor,
  ) => Expanded(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(fontSize: 11),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 14,
            color: valColor,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    ),
  );
}

class _PaymentCyclePainter extends CustomPainter {
  final List<double> points;
  final Color lineColor;
  final Color waveAccent;
  final Color gridColor;
  final Color dotFill;

  _PaymentCyclePainter({
    required this.points,
    required this.lineColor,
    required this.waveAccent,
    required this.gridColor,
    required this.dotFill,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;
    final gridPaint = Paint()
      ..color = gridColor.withValues(alpha: 0.45)
      ..strokeWidth = 1.0;

    for (var i = 1; i <= 3; i++) {
      final y = size.height * (i / 4);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    final minV = points.reduce(math.min) - 12;
    final maxV = points.reduce(math.max) + 12;
    final span = math.max(1.0, maxV - minV);

    final coords = <Offset>[
      for (var i = 0; i < points.length; i++)
        Offset(
          size.width * (i / (points.length - 1)),
          size.height - ((points[i] - minV) / span) * (size.height - 16) - 8,
        ),
    ];

    // Secondary teal comparison wave (delayed subtle rhythm)
    final secondaryCoords = <Offset>[
      for (var i = 0; i < coords.length; i++)
        Offset(
          coords[i].dx,
          (coords[i].dy + math.cos(i * 1.4) * 16 + 14)
              .clamp(8.0, size.height - 8),
        ),
    ];
    final secondaryPath = _smoothPath(secondaryCoords);
    canvas.drawPath(
      secondaryPath,
      Paint()
        ..color = waveAccent.withValues(alpha: 0.55)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0
        ..strokeCap = StrokeCap.round,
    );

    final linePath = _smoothPath(coords);
    final fillPath = Path.from(linePath)
      ..lineTo(coords.last.dx, size.height)
      ..lineTo(coords.first.dx, size.height)
      ..close();

    canvas.drawPath(
      fillPath,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            lineColor.withValues(alpha: 0.34),
            lineColor.withValues(alpha: 0.02),
          ],
        ).createShader(Rect.fromLTWH(0, 0, size.width, size.height)),
    );

    canvas.drawPath(
      linePath,
      Paint()
        ..color = lineColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.0
        ..strokeCap = StrokeCap.round,
    );

    final peakIndex = points.indexOf(points.reduce(math.max));
    for (final idx in {peakIndex, coords.length - 1}) {
      final pt = coords[idx];
      canvas.drawCircle(pt, 5.5, Paint()..color = dotFill);
      canvas.drawCircle(
        pt,
        5.5,
        Paint()
          ..color = idx == peakIndex ? waveAccent : lineColor
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.6,
      );
    }
  }

  Path _smoothPath(List<Offset> pts) {
    final path = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (var i = 0; i < pts.length - 1; i++) {
      final p0 = pts[i];
      final p1 = pts[i + 1];
      final midX = (p0.dx + p1.dx) / 2;
      path.cubicTo(midX, p0.dy, midX, p1.dy, p1.dx, p1.dy);
    }
    return path;
  }

  @override
  bool shouldRepaint(covariant _PaymentCyclePainter old) =>
      old.points != points || old.lineColor != lineColor || old.gridColor != gridColor;
}
