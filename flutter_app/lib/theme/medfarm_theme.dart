import 'package:flutter/material.dart';

/// Medfarm-inspired color palette translated for SplitSync AI.
abstract final class SplitColors {
  static const primary = Color(0xFF1457D9);
  static const primaryInk = Color(0xFF0A4EC4);
  static const primaryBorder = Color.fromRGBO(15, 103, 254, 0.20);
  static const navy = Color(0xFF172846);
  static const navyDeep = Color(0xFF182035);
  static const teal = Color(0xFF48B3A9);
  static const tealInk = Color(0xFF136B63);
  static const tealBg = Color(0xFFE3F5F3);
  static const coral = Color(0xFFFA4D5E);
  static const error = Color(0xFFB00020);
  static const errorBg = Color(0xFFFFF2F4);
  static const amber = Color(0xFF9E6200);
  static const amberBg = Color(0xFFFFF4DE);
  static const bg = Color(0xFFF1F5FC);
  static const surface = Colors.white;
  static const surfaceTint = Color(0xFFEDF5FF);
  static const surfaceSubtle = Color(0xFFFAFAFA);
  static const muted = Color(0xFF4C5C77);
  static const line = Color(0xFFDCE1E8);
  static const borderStrong = Color(0xFF9EA7B8);
  static const paypalBg = Color(0xFFFFC439);
  static const paypalInk = Color(0xFF003087);
  static const darkBg = Color(0xFF090E1D);
  static const darkSurface = Color(0xFF141B31);
  static const darkSecondary = Color(0xFF242E49);
  static const darkFrameBorder = Color(0xFF3D4966);
  static const darkLine = Color(0xFF2B3758);
  static const darkTint = Color(0xFF1B2746);
  static const darkMuted = Color(0xFFDCE1E8);
  static const darkPrimaryInk = Color(0xFF6EA8FF);

  static bool isDark(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark;
  static Color canvas(BuildContext context) => isDark(context) ? darkBg : bg;
  static Color card(BuildContext context) =>
      isDark(context) ? darkSurface : surface;
  static Color secondaryCard(BuildContext context) =>
      isDark(context) ? darkSecondary : surfaceSubtle;
  static Color tint(BuildContext context) =>
      isDark(context) ? darkTint : surfaceTint;
  static Color ink(BuildContext context) =>
      isDark(context) ? Colors.white : navy;
  static Color mutedInk(BuildContext context) =>
      isDark(context) ? darkMuted : muted;
  static Color lineColor(BuildContext context) =>
      isDark(context) ? darkFrameBorder : line;
  static Color linkInk(BuildContext context) =>
      isDark(context) ? darkPrimaryInk : primaryInk;
}

ThemeData buildSplitSyncTheme({Brightness brightness = Brightness.light}) {
  final isDark = brightness == Brightness.dark;
  final scaffoldBg = isDark ? SplitColors.darkBg : SplitColors.bg;
  final cardBg = isDark ? SplitColors.darkSurface : SplitColors.surface;
  final headingColor = isDark ? Colors.white : SplitColors.navy;
  final bodyColor = isDark ? SplitColors.darkMuted : SplitColors.muted;
  final borderCol = isDark ? SplitColors.darkFrameBorder : SplitColors.borderStrong;
  final dividerCol = isDark ? SplitColors.darkLine : SplitColors.line;

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    fontFamily: 'PlusJakartaSans',
    scaffoldBackgroundColor: scaffoldBg,
    cardColor: cardBg,
    dividerColor: dividerCol,
    colorScheme: ColorScheme.fromSeed(
      seedColor: SplitColors.primary,
      primary: SplitColors.primary,
      secondary: isDark ? SplitColors.darkSecondary : SplitColors.navy,
      error: isDark ? const Color(0xFFFF7B8A) : SplitColors.error,
      brightness: brightness,
      surface: cardBg,
      onSurface: headingColor,
    ),
    textTheme: TextTheme(
      headlineMedium: TextStyle(
        fontFamily: 'PlusJakartaSans',
        fontSize: 32,
        fontWeight: FontWeight.w800,
        color: headingColor,
        letterSpacing: -0.7,
        height: 1.2,
      ),
      headlineSmall: TextStyle(
        fontSize: 25,
        fontWeight: FontWeight.w800,
        color: headingColor,
        letterSpacing: -0.5,
        height: 1.2,
      ),
      titleLarge: TextStyle(
        fontFamily: 'PlusJakartaSans',
        fontSize: 22,
        fontWeight: FontWeight.w800,
        color: headingColor,
        letterSpacing: -0.3,
      ),
      titleMedium: TextStyle(
        fontFamily: 'PlusJakartaSans',
        fontSize: 17,
        fontWeight: FontWeight.w700,
        color: headingColor,
      ),
      bodyLarge: TextStyle(fontSize: 17, color: bodyColor, height: 1.5),
      bodySmall: TextStyle(fontSize: 14, color: bodyColor, height: 1.45),
      bodyMedium: TextStyle(
        fontFamily: 'PlusJakartaSans',
        fontSize: 16,
        color: bodyColor,
        height: 1.5,
      ),
      labelLarge: const TextStyle(
        fontFamily: 'PlusJakartaSans',
        fontSize: 16,
        fontWeight: FontWeight.w700,
      ),
    ),
    dividerTheme: DividerThemeData(color: dividerCol, thickness: 1),
    dialogTheme: DialogThemeData(
      backgroundColor: cardBg,
      surfaceTintColor: Colors.transparent,
      titleTextStyle: TextStyle(
        fontFamily: 'PlusJakartaSans',
        fontSize: 20,
        fontWeight: FontWeight.w800,
        color: headingColor,
      ),
      contentTextStyle: TextStyle(
        fontFamily: 'PlusJakartaSans',
        fontSize: 15,
        color: bodyColor,
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: cardBg,
      surfaceTintColor: Colors.transparent,
    ),
    chipTheme: ChipThemeData(
      backgroundColor: isDark ? SplitColors.darkSecondary : SplitColors.surface,
      selectedColor: isDark ? SplitColors.darkTint : SplitColors.surfaceTint,
      side: BorderSide(color: isDark ? SplitColors.darkFrameBorder : SplitColors.line),
      labelStyle: TextStyle(
        fontFamily: 'PlusJakartaSans',
        fontWeight: FontWeight.w700,
        color: headingColor,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: cardBg,
      labelStyle: TextStyle(color: bodyColor, fontWeight: FontWeight.w700),
      hintStyle: TextStyle(color: bodyColor.withValues(alpha: 0.7)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: borderCol),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: SplitColors.primary, width: 2),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: cardBg,
      indicatorColor: isDark ? SplitColors.darkSecondary : SplitColors.surfaceTint,
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(
          color: selected
              ? (isDark ? SplitColors.darkPrimaryInk : SplitColors.primaryInk)
              : bodyColor,
        );
      }),
      labelTextStyle: WidgetStatePropertyAll(
        TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: headingColor,
        ),
      ),
    ),
    navigationRailTheme: NavigationRailThemeData(
      backgroundColor: cardBg,
      indicatorColor: isDark ? SplitColors.darkSecondary : SplitColors.surfaceTint,
      selectedIconTheme: IconThemeData(
        color: isDark ? SplitColors.darkPrimaryInk : SplitColors.primaryInk,
      ),
      unselectedIconTheme: IconThemeData(color: bodyColor),
      selectedLabelTextStyle: TextStyle(
        fontFamily: 'PlusJakartaSans',
        fontSize: 13,
        fontWeight: FontWeight.w800,
        color: isDark ? Colors.white : SplitColors.primaryInk,
      ),
      unselectedLabelTextStyle: TextStyle(
        fontFamily: 'PlusJakartaSans',
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: bodyColor,
      ),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: cardBg,
      foregroundColor: headingColor,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
    ),
  );
}

class SplitPrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? trailingIcon;
  final IconData? leadingIcon;
  final bool expand;
  final Color? backgroundColor;
  final Color? foregroundColor;

  const SplitPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.trailingIcon = Icons.arrow_forward_rounded,
    this.leadingIcon,
    this.expand = true,
    this.backgroundColor,
    this.foregroundColor,
  });

  @override
  Widget build(BuildContext context) {
    final bg = backgroundColor ?? SplitColors.primary;
    final fg = foregroundColor ?? Colors.white;
    final child = FilledButton(
      onPressed: onPressed,
      style: FilledButton.styleFrom(
        backgroundColor: bg,
        foregroundColor: fg,
        minimumSize: const Size(48, 52),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(
          fontFamily: 'PlusJakartaSans',
          fontSize: 15,
          fontWeight: FontWeight.w800,
        ),
      ),
      child: Row(
        mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (leadingIcon != null) ...[
            Icon(leadingIcon, size: 18),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (trailingIcon != null) ...[
            const SizedBox(width: 8),
            Icon(trailingIcon, size: 18),
          ],
        ],
      ),
    );
    return expand ? SizedBox(width: double.infinity, child: child) : child;
  }
}

class SplitSecondaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? leadingIcon;
  final bool expand;
  final Color? borderColor;
  final Color? textColor;

  const SplitSecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.leadingIcon,
    this.expand = true,
    this.borderColor,
    this.textColor,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final child = OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        backgroundColor: isDark ? SplitColors.darkSecondary : Colors.white,
        foregroundColor:
            textColor ?? (isDark ? Colors.white : SplitColors.primaryInk),
        minimumSize: const Size(48, 52),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        side: BorderSide(
          color:
              borderColor ??
              (isDark ? SplitColors.darkFrameBorder : const Color(0xFFBDD4FE)),
          width: 1.5,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(
          fontFamily: 'PlusJakartaSans',
          fontSize: 15,
          fontWeight: FontWeight.w700,
        ),
      ),
      child: Row(
        mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (leadingIcon != null) ...[
            Icon(leadingIcon, size: 18),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
    return expand ? SizedBox(width: double.infinity, child: child) : child;
  }
}

/// Medfarm CustomBackButton translation: 48x48 bordered square control.
class SplitBackButton extends StatelessWidget {
  final VoidCallback onPressed;
  final String tooltip;

  const SplitBackButton({
    super.key,
    required this.onPressed,
    this.tooltip = 'Back',
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final border = isDark ? Colors.white : SplitColors.navy;
    return Tooltip(
      message: tooltip,
      child: Material(
        color: isDark ? SplitColors.darkSurface : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: border, width: 2),
        ),
        clipBehavior: Clip.hardEdge,
        child: InkWell(
          onTap: onPressed,
          child: SizedBox(
            width: 48,
            height: 48,
            child: Icon(Icons.arrow_back_rounded, color: border, size: 20),
          ),
        ),
      ),
    );
  }
}

/// Medfarm CustomTextField translation: bold label above + 4px focus halo.
class SplitTextField extends StatefulWidget {
  final String label;
  final String hintText;
  final TextEditingController controller;
  final IconData? prefixIcon;
  final bool obscureText;
  final VoidCallback? onToggleObscure;
  final int maxLines;
  final bool hasError;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;
  final ValueChanged<String>? onChanged;

  const SplitTextField({
    super.key,
    required this.label,
    this.hintText = '',
    required this.controller,
    this.prefixIcon,
    this.obscureText = false,
    this.onToggleObscure,
    this.maxLines = 1,
    this.hasError = false,
    this.keyboardType,
    this.textInputAction,
    this.onSubmitted,
    this.onChanged,
  });

  @override
  State<SplitTextField> createState() => _SplitTextFieldState();
}

class _SplitTextFieldState extends State<SplitTextField> {
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(_onFocusChange);
  }

  void _onFocusChange() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _focusNode.removeListener(_onFocusChange);
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final labelColor = isDark ? Colors.white : SplitColors.navy;
    final fillColor = isDark ? SplitColors.darkSurface : Colors.white;
    final haloColor = widget.hasError
        ? const Color.fromRGBO(176, 0, 32, 0.16)
        : (_focusNode.hasFocus
              ? SplitColors.primaryBorder
              : Colors.transparent);
    final activeBorderColor = widget.hasError
        ? SplitColors.error
        : (_focusNode.hasFocus
              ? SplitColors.primary
              : (isDark ? SplitColors.darkFrameBorder : SplitColors.line));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          widget.label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontFamily: 'PlusJakartaSans',
            fontSize: 14,
            fontWeight: FontWeight.w800,
            color: labelColor,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(15),
            border: Border.all(color: haloColor, width: 4),
          ),
          child: TextField(
            focusNode: _focusNode,
            controller: widget.controller,
            obscureText: widget.obscureText,
            maxLines: widget.obscureText ? 1 : widget.maxLines,
            keyboardType: widget.keyboardType,
            textInputAction: widget.textInputAction,
            onSubmitted: widget.onSubmitted,
            onChanged: widget.onChanged,
            style: TextStyle(
              fontFamily: 'PlusJakartaSans',
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white : SplitColors.navy,
            ),
            decoration: InputDecoration(
              hintText: widget.hintText,
              hintStyle: TextStyle(
                color: (isDark ? SplitColors.darkMuted : SplitColors.muted)
                    .withValues(alpha: 0.78),
              ),
              prefixIcon: widget.prefixIcon != null
                  ? Icon(widget.prefixIcon, color: labelColor, size: 20)
                  : null,
              suffixIcon: widget.onToggleObscure != null
                  ? IconButton(
                      onPressed: widget.onToggleObscure,
                      tooltip: widget.obscureText ? 'Show key' : 'Hide key',
                      icon: Icon(
                        widget.obscureText
                            ? Icons.visibility_rounded
                            : Icons.visibility_off_rounded,
                        color: SplitColors.muted,
                      ),
                    )
                  : null,
              filled: true,
              fillColor: fillColor,
              constraints: const BoxConstraints(minHeight: 50),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: activeBorderColor, width: 1.5),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: activeBorderColor, width: 1.5),
              ),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 14,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Medfarm-styled dropdown matching [SplitTextField] height and label baseline.
class SplitDropdownField<T> extends StatelessWidget {
  final String label;
  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?>? onChanged;

  const SplitDropdownField({
    super.key,
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final labelColor = isDark ? Colors.white : SplitColors.navy;
    final fillColor = isDark ? SplitColors.darkSurface : Colors.white;
    final borderColor = isDark ? SplitColors.darkFrameBorder : SplitColors.line;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontFamily: 'PlusJakartaSans',
            fontSize: 14,
            fontWeight: FontWeight.w800,
            color: labelColor,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(15),
            border: Border.all(color: Colors.transparent, width: 4),
          ),
          child: DropdownButtonFormField<T>(
            key: ValueKey(value),
            initialValue: value,
            isExpanded: true,
            items: items,
            onChanged: onChanged,
            dropdownColor: fillColor,
            style: TextStyle(
              fontFamily: 'PlusJakartaSans',
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: labelColor,
            ),
            decoration: InputDecoration(
              filled: true,
              fillColor: fillColor,
              constraints: const BoxConstraints(minHeight: 50),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: borderColor, width: 1.5),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: SplitColors.primary, width: 1.5),
              ),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 13,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Medfarm CustomLayout step header: back button + capsule progress bar.
class SplitStepHeader extends StatelessWidget {
  final int step;
  final int total;
  final String label;
  final VoidCallback onBack;

  const SplitStepHeader({
    super.key,
    required this.step,
    required this.total,
    required this.label,
    required this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fraction = (step / total).clamp(0.0, 1.0);
    final bar = ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: Container(
        height: 10,
        color: isDark ? SplitColors.darkSecondary : SplitColors.line,
        alignment: Alignment.centerLeft,
        child: FractionallySizedBox(
          widthFactor: fraction,
          child: Container(
            decoration: BoxDecoration(
              color: isDark ? Colors.white : SplitColors.navy,
              borderRadius: BorderRadius.circular(999),
            ),
          ),
        ),
      ),
    );
    final labelText = Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w800,
        color: SplitColors.muted,
      ),
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth < 460) {
            return Row(
              children: [
                SplitBackButton(onPressed: onBack),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [labelText, const SizedBox(height: 6), bar],
                  ),
                ),
              ],
            );
          }
          return Row(
            children: [
              SplitBackButton(onPressed: onBack),
              const SizedBox(width: 14),
              Expanded(child: bar),
              const SizedBox(width: 14),
              Flexible(fit: FlexFit.loose, child: labelText),
            ],
          );
        },
      ),
    );
  }
}

class SplitCard extends StatelessWidget {
  final Widget child;
  final Color? color;
  final Color? borderColor;
  final EdgeInsetsGeometry? padding;

  const SplitCard({
    super.key,
    required this.child,
    this.color,
    this.borderColor,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Material(
        color:
            color ?? (isDark ? SplitColors.darkSurface : SplitColors.surface),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color:
                borderColor ??
                (isDark ? SplitColors.darkFrameBorder : SplitColors.line),
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: SizedBox(
          width: double.infinity,
          child: Padding(
            padding: padding ?? const EdgeInsets.all(20),
            child: child,
          ),
        ),
      ),
    );
  }
}

class SplitBadge extends StatelessWidget {
  final String text;
  final bool preview;
  final bool navy;

  const SplitBadge(
    this.text, {
    super.key,
    this.preview = false,
    this.navy = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = navy
        ? Colors.white.withValues(alpha: 0.14)
        : preview
        ? (isDark ? SplitColors.darkSecondary : const Color(0xFFEEF2F7))
        : (isDark ? SplitColors.darkTint : SplitColors.surfaceTint);
    final fg = navy
        ? Colors.white
        : preview
        ? (isDark ? SplitColors.darkMuted : SplitColors.navy)
        : (isDark ? SplitColors.darkPrimaryInk : SplitColors.primaryInk);
    final border = navy
        ? Colors.white.withValues(alpha: 0.24)
        : preview
        ? (isDark ? SplitColors.darkFrameBorder : SplitColors.line)
        : (isDark ? SplitColors.darkFrameBorder : const Color(0xFFD3E4FF));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: border),
      ),
      child: Text(
        text,
        style: TextStyle(color: fg, fontSize: 13, fontWeight: FontWeight.w800),
      ),
    );
  }
}

class SplitStatusPill extends StatelessWidget {
  final String status;

  const SplitStatusPill(this.status, {super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final (bg, fg) = switch (status) {
      'Paid' ||
      'Payment received' ||
      'Completed' ||
      'Reviewed' ||
      'Demo transfer' => isDark
          ? (const Color(0xFF123635), const Color(0xFF5CE0D4))
          : (SplitColors.tealBg, SplitColors.tealInk),
      'Sent' || 'Practice transfer' => isDark
          ? (SplitColors.darkTint, SplitColors.darkPrimaryInk)
          : (SplitColors.surfaceTint, SplitColors.primaryInk),
      'Waiting for payment' || 'Processing' => isDark
          ? (const Color(0xFF362A12), const Color(0xFFFFD166))
          : (SplitColors.amberBg, SplitColors.amber),
      'Cancelled' || 'Error' || 'Failed' => isDark
          ? (const Color(0xFF3A1620), const Color(0xFFFF7B8A))
          : (SplitColors.errorBg, SplitColors.error),
      _ => isDark
          ? (SplitColors.darkSecondary, SplitColors.darkMuted)
          : (const Color(0xFFEEF2F7), const Color(0xFF4A5670)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        status,
        style: TextStyle(color: fg, fontSize: 13, fontWeight: FontWeight.w800),
      ),
    );
  }
}

enum CalloutKind { info, warning, error, success }

class SplitCallout extends StatelessWidget {
  final String message;
  final String? title;
  final CalloutKind kind;
  final Widget? trailing;

  const SplitCallout({
    super.key,
    required this.message,
    this.title,
    this.kind = CalloutKind.info,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final (bg, border, fg, icon) = switch (kind) {
      CalloutKind.error => isDark
          ? (
              const Color(0xFF3A1620),
              const Color(0xFF7D2E42),
              const Color(0xFFFF8F9C),
              Icons.error_outline_rounded,
            )
          : (
              SplitColors.errorBg,
              const Color(0xFFF4C7CE),
              SplitColors.error,
              Icons.error_outline_rounded,
            ),
      CalloutKind.warning => isDark
          ? (
              const Color(0xFF362A12),
              const Color(0xFF6B5220),
              const Color(0xFFFFD166),
              Icons.warning_amber_rounded,
            )
          : (
              SplitColors.amberBg,
              const Color(0xFFF4DA9C),
              const Color(0xFF6B4300),
              Icons.warning_amber_rounded,
            ),
      CalloutKind.success => isDark
          ? (
              const Color(0xFF123635),
              const Color(0xFF21625E),
              const Color(0xFF5CE0D4),
              Icons.check_circle_outline_rounded,
            )
          : (
              SplitColors.tealBg,
              const Color(0xFFB4E5DF),
              SplitColors.tealInk,
              Icons.check_circle_outline_rounded,
            ),
      CalloutKind.info => isDark
          ? (
              SplitColors.darkTint,
              SplitColors.darkFrameBorder,
              Colors.white,
              Icons.info_outline_rounded,
            )
          : (
              SplitColors.surfaceTint,
              const Color(0xFFCFE0FF),
              SplitColors.navy,
              Icons.info_outline_rounded,
            ),
    };

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 18, color: fg),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (title != null) ...[
                      Text(
                        title!,
                        style: TextStyle(
                          color: fg,
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 2),
                    ],
                    Text(
                      message,
                      style: TextStyle(color: fg, fontSize: 15, height: 1.45),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (trailing != null) ...[const SizedBox(height: 10), trailing!],
        ],
      ),
    );
  }
}

/// Focused in-screen header replacing generic website top chrome.
class SplitScreenHeader extends StatelessWidget {
  final String title;
  final String subtitle;
  final VoidCallback onBack;
  final Widget? trailing;

  const SplitScreenHeader({
    super.key,
    required this.title,
    this.subtitle = '',
    required this.onBack,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    final titleBlock = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.headlineMedium),
        if (subtitle.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ],
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (trailing != null && constraints.maxWidth < 520) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: double.infinity,
                  child: Wrap(
                    spacing: 10,
                    runSpacing: 8,
                    alignment: WrapAlignment.spaceBetween,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [SplitBackButton(onPressed: onBack), trailing!],
                  ),
                ),
                const SizedBox(height: 12),
                titleBlock,
              ],
            );
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SplitBackButton(onPressed: onBack),
              const SizedBox(width: 12),
              Expanded(child: titleBlock),
              if (trailing != null) ...[const SizedBox(width: 10), trailing!],
            ],
          );
        },
      ),
    );
  }
}

/// PhonePe action-hub square tile translated to Medfarm surface geometry.
class SplitHubTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color iconBg;
  final Color iconFg;

  const SplitHubTile({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.iconBg = SplitColors.primary,
    this.iconFg = Colors.white,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          constraints: const BoxConstraints(minHeight: 104),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(icon, color: iconFg, size: 22),
              ),
              const SizedBox(height: 10),
              Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Crisp vector-painted country flag badge so country identifiers render consistently across all platforms.
class SplitCountryFlagBadge extends StatelessWidget {
  final String currency;
  final double size;
  final bool circular;

  const SplitCountryFlagBadge({
    super.key,
    required this.currency,
    this.size = 18,
    this.circular = true,
  });

  @override
  Widget build(BuildContext context) {
    final w = circular ? size : size * 1.35;
    final h = size;
    return Container(
      width: w,
      height: h,
      decoration: BoxDecoration(
        shape: circular ? BoxShape.circle : BoxShape.rectangle,
        borderRadius: circular ? null : BorderRadius.circular(3),
        border: Border.all(
          color: circular ? Colors.white : SplitColors.line,
          width: circular ? 1.5 : 1,
        ),
        boxShadow: circular
            ? const [
                BoxShadow(
                  color: Color.fromRGBO(24, 32, 53, 0.16),
                  blurRadius: 3,
                  offset: Offset(0, 1),
                ),
              ]
            : null,
      ),
      clipBehavior: Clip.antiAlias,
      child: CustomPaint(painter: _CountryFlagPainter(currency)),
    );
  }
}

class _CountryFlagPainter extends CustomPainter {
  final String currency;

  const _CountryFlagPainter(this.currency);

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final rect = Rect.fromLTWH(0, 0, w, h);
    switch (currency.toUpperCase()) {
      case 'GBP':
        canvas.drawRect(rect, Paint()..color = const Color(0xFF012169));
        final whiteDiag = Paint()
          ..color = Colors.white
          ..strokeWidth = h * 0.22;
        final redDiag = Paint()
          ..color = const Color(0xFFC8102E)
          ..strokeWidth = h * 0.10;
        canvas.drawLine(Offset.zero, Offset(w, h), whiteDiag);
        canvas.drawLine(Offset(w, 0), Offset(0, h), whiteDiag);
        canvas.drawLine(Offset.zero, Offset(w, h), redDiag);
        canvas.drawLine(Offset(w, 0), Offset(0, h), redDiag);
        canvas.drawRect(
          Rect.fromLTWH(w * 0.36, 0, w * 0.28, h),
          Paint()..color = Colors.white,
        );
        canvas.drawRect(
          Rect.fromLTWH(0, h * 0.34, w, h * 0.32),
          Paint()..color = Colors.white,
        );
        canvas.drawRect(
          Rect.fromLTWH(w * 0.41, 0, w * 0.18, h),
          Paint()..color = const Color(0xFFC8102E),
        );
        canvas.drawRect(
          Rect.fromLTWH(0, h * 0.40, w, h * 0.20),
          Paint()..color = const Color(0xFFC8102E),
        );
        break;
      case 'CAD':
        canvas.drawRect(rect, Paint()..color = Colors.white);
        canvas.drawRect(
          Rect.fromLTWH(0, 0, w * 0.25, h),
          Paint()..color = const Color(0xFFD80621),
        );
        canvas.drawRect(
          Rect.fromLTWH(w * 0.75, 0, w * 0.25, h),
          Paint()..color = const Color(0xFFD80621),
        );
        final leaf = Path()
          ..moveTo(w * 0.5, h * 0.22)
          ..lineTo(w * 0.63, h * 0.52)
          ..lineTo(w * 0.54, h * 0.52)
          ..lineTo(w * 0.54, h * 0.78)
          ..lineTo(w * 0.46, h * 0.78)
          ..lineTo(w * 0.46, h * 0.52)
          ..lineTo(w * 0.37, h * 0.52)
          ..close();
        canvas.drawPath(leaf, Paint()..color = const Color(0xFFD80621));
        break;
      case 'EUR':
        canvas.drawRect(
          Rect.fromLTWH(0, 0, w, h / 3),
          Paint()..color = const Color(0xFF111111),
        );
        canvas.drawRect(
          Rect.fromLTWH(0, h / 3, w, h / 3),
          Paint()..color = const Color(0xFFDD0000),
        );
        canvas.drawRect(
          Rect.fromLTWH(0, 2 * h / 3, w, h / 3),
          Paint()..color = const Color(0xFFFFCE00),
        );
        break;
      case 'JPY':
        canvas.drawRect(rect, Paint()..color = Colors.white);
        canvas.drawCircle(
          Offset(w * 0.5, h * 0.5),
          h * 0.28,
          Paint()..color = const Color(0xFFBC002D),
        );
        break;
      case 'INR':
        canvas.drawRect(
          Rect.fromLTWH(0, 0, w, h / 3),
          Paint()..color = const Color(0xFFFF9933),
        );
        canvas.drawRect(
          Rect.fromLTWH(0, h / 3, w, h / 3),
          Paint()..color = Colors.white,
        );
        canvas.drawRect(
          Rect.fromLTWH(0, 2 * h / 3, w, h / 3),
          Paint()..color = const Color(0xFF138808),
        );
        canvas.drawCircle(
          Offset(w * 0.5, h * 0.5),
          h * 0.13,
          Paint()
            ..color = const Color(0xFF000080)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.2,
        );
        break;
      case 'USD':
      default:
        canvas.drawRect(rect, Paint()..color = Colors.white);
        final stripe = Paint()..color = const Color(0xFFB22234);
        for (int i = 0; i < 4; i++) {
          canvas.drawRect(Rect.fromLTWH(0, (i * 2) * (h / 7), w, h / 7), stripe);
        }
        canvas.drawRect(
          Rect.fromLTWH(0, 0, w * 0.46, h * 0.54),
          Paint()..color = const Color(0xFF3C3B6E),
        );
        break;
    }
  }

  @override
  bool shouldRepaint(covariant _CountryFlagPainter old) =>
      old.currency != currency;
}

/// Circular contact monogram avatar with crisp painted country flag badge.
class SplitContactAvatar extends StatelessWidget {
  final String name;
  final String id;
  final String currency;
  final double size;

  const SplitContactAvatar({
    super.key,
    required this.name,
    this.id = '',
    this.currency = 'USD',
    this.size = 40,
  });

  static (Color bg, Color fg) _paletteFor(String id, String name) {
    final key = (id.isNotEmpty ? id : name).toLowerCase();
    return switch (key) {
      'allen' => (const Color(0xFFE9F0FF), const Color(0xFF0A4EC4)),
      'maya' => (const Color(0xFFE3F5F3), const Color(0xFF136B63)),
      'arun' => (const Color(0xFFFFF2E0), const Color(0xFF8A4F00)),
      'sofia' => (const Color(0xFFF4ECFF), const Color(0xFF5B2E91)),
      'yuki' => (const Color(0xFFFFEFF2), const Color(0xFFA61C34)),
      'leah' => (const Color(0xFFEAEFF8), const Color(0xFF172846)),
      _ => (SplitColors.surfaceTint, SplitColors.primaryInk),
    };
  }

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = _paletteFor(id, name);
    final initial = name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
    final badgeSize = (size * 0.44).clamp(14.0, 20.0);
    return SizedBox(
      width: size + 4,
      height: size + 3,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: size,
            height: size,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: bg,
              shape: BoxShape.circle,
              border: Border.all(
                color: fg.withValues(alpha: 0.16),
                width: 1,
              ),
            ),
            child: Text(
              initial,
              style: TextStyle(
                color: fg,
                fontSize: size * 0.36,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          Positioned(
            right: 0,
            bottom: 0,
            child: SplitCountryFlagBadge(currency: currency, size: badgeSize),
          ),
        ],
      ),
    );
  }
}
