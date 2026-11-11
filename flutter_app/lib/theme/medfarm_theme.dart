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
}

ThemeData buildSplitSyncTheme({Brightness brightness = Brightness.light}) {
  final isDark = brightness == Brightness.dark;
  final scaffoldBg = isDark ? SplitColors.darkBg : SplitColors.bg;
  final cardBg = isDark ? SplitColors.darkSurface : SplitColors.surface;
  final headingColor = isDark ? Colors.white : SplitColors.navy;
  final bodyColor = isDark ? const Color(0xFFDCE1E8) : SplitColors.muted;

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    fontFamily: 'PlusJakartaSans',
    scaffoldBackgroundColor: scaffoldBg,
    colorScheme: ColorScheme.fromSeed(
      seedColor: SplitColors.primary,
      primary: SplitColors.primary,
      secondary: SplitColors.navy,
      error: SplitColors.error,
      brightness: brightness,
      surface: cardBg,
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
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: cardBg,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: SplitColors.borderStrong),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: SplitColors.primary, width: 2),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      labelTextStyle: WidgetStatePropertyAll(
        TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: headingColor,
        ),
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
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(
          fontFamily: 'PlusJakartaSans',
          fontSize: 16,
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
          Flexible(child: Text(label, textAlign: TextAlign.center)),
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
        backgroundColor: isDark ? SplitColors.darkSurface : Colors.white,
        foregroundColor: textColor ?? SplitColors.primaryInk,
        minimumSize: const Size(48, 52),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        side: BorderSide(
          color: borderColor ?? const Color(0xFFBDD4FE),
          width: 1.5,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(
          fontFamily: 'PlusJakartaSans',
          fontSize: 16,
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
          Flexible(child: Text(label, textAlign: TextAlign.center)),
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
        : (_focusNode.hasFocus ? SplitColors.primary : SplitColors.line);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.label,
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
                color: SplitColors.muted.withValues(alpha: 0.78),
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
        color: isDark ? SplitColors.navy : SplitColors.line,
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
          side: BorderSide(color: borderColor ?? SplitColors.line),
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
    final bg = navy
        ? Colors.white.withValues(alpha: 0.14)
        : preview
        ? const Color(0xFFEEF2F7)
        : SplitColors.surfaceTint;
    final fg = navy
        ? Colors.white
        : preview
        ? SplitColors.navy
        : SplitColors.primaryInk;
    final border = navy
        ? Colors.white.withValues(alpha: 0.24)
        : preview
        ? SplitColors.line
        : const Color(0xFFD3E4FF);
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
    final (bg, fg) = switch (status) {
      'Paid' || 'Reviewed' => (SplitColors.tealBg, SplitColors.tealInk),
      'Sent' => (SplitColors.surfaceTint, SplitColors.primaryInk),
      'Processing' => (SplitColors.amberBg, SplitColors.amber),
      'Cancelled' ||
      'Error' ||
      'Failed' => (SplitColors.errorBg, SplitColors.error),
      _ => (const Color(0xFFEEF2F7), const Color(0xFF4A5670)),
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
    final (bg, border, fg, icon) = switch (kind) {
      CalloutKind.error => (
        SplitColors.errorBg,
        const Color(0xFFF4C7CE),
        SplitColors.error,
        Icons.error_outline_rounded,
      ),
      CalloutKind.warning => (
        SplitColors.amberBg,
        const Color(0xFFF4DA9C),
        const Color(0xFF6B4300),
        Icons.warning_amber_rounded,
      ),
      CalloutKind.success => (
        SplitColors.tealBg,
        const Color(0xFFB4E5DF),
        SplitColors.tealInk,
        Icons.check_circle_outline_rounded,
      ),
      CalloutKind.info => (
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
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SplitBackButton(onPressed: onBack),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.headlineMedium),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
                ],
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 10), trailing!],
        ],
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
