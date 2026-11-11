import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';

import '../theme/medfarm_theme.dart';

/// Medfarm-styled PayPal welcome gate using a 4-digit PIN (1234) and the OS phone authenticator.
class MedfarmPinLoginScreen extends StatefulWidget {
  final VoidCallback onAuthenticated;
  final String accountName;
  final String accountHandle;
  final bool autoPromptPhoneAuth;
  final Future<bool> Function()? authenticateOverride;

  const MedfarmPinLoginScreen({
    super.key,
    required this.onAuthenticated,
    this.accountName = 'Leah',
    this.accountHandle = 'leah@paypal',
    this.autoPromptPhoneAuth = true,
    this.authenticateOverride,
  });

  @override
  State<MedfarmPinLoginScreen> createState() => _MedfarmPinLoginScreenState();
}

class _MedfarmPinLoginScreenState extends State<MedfarmPinLoginScreen> {
  static const _validPin = '1234';
  String _pin = '';
  bool _obscurePin = true;
  bool _authInProgress = false;
  bool _didAutoPrompt = false;
  String _error = '';
  final FocusNode _keyboardFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _didAutoPrompt || !widget.autoPromptPhoneAuth) return;
      _didAutoPrompt = true;
      final isMobileNative =
          !kIsWeb &&
          (defaultTargetPlatform == TargetPlatform.android ||
              defaultTargetPlatform == TargetPlatform.iOS);
      if (isMobileNative || widget.authenticateOverride != null) {
        unawaited(_triggerPhoneAuthenticator(userInitiated: false));
      }
    });
  }

  @override
  void dispose() {
    _keyboardFocus.dispose();
    super.dispose();
  }

  Future<void> _triggerPhoneAuthenticator({bool userInitiated = true}) async {
    if (_authInProgress || !mounted) return;
    setState(() {
      _authInProgress = true;
      if (userInitiated) _error = '';
    });
    var ok = false;
    var unavailable = false;
    try {
      if (widget.authenticateOverride != null) {
        ok = await widget.authenticateOverride!();
      } else {
        final auth = LocalAuthentication();
        final supported = await auth.isDeviceSupported();
        if (!supported) {
          unavailable = true;
        } else {
          ok = await auth.authenticate(
            localizedReason: 'Welcome Leah — verify to unlock PayPal wallet',
            biometricOnly: false,
            persistAcrossBackgrounding: true,
          );
        }
      }
    } on LocalAuthException catch (e) {
      if (e.code == LocalAuthExceptionCode.noBiometricsEnrolled ||
          e.code == LocalAuthExceptionCode.noCredentialsSet ||
          e.code == LocalAuthExceptionCode.noBiometricHardware) {
        unavailable = true;
      }
    } catch (_) {
      unavailable = true;
    }
    if (!mounted) return;
    setState(() => _authInProgress = false);
    if (ok) {
      HapticFeedback.mediumImpact();
      widget.onAuthenticated();
      return;
    }
    if (userInitiated && unavailable) {
      setState(() {
        _error =
            'Phone authenticator unavailable here — enter 4-digit PIN (1234).';
      });
    }
  }

  void _appendDigit(String digit) {
    if (_pin.length >= 4 || _authInProgress) return;
    HapticFeedback.selectionClick();
    setState(() {
      _error = '';
      _pin += digit;
    });
    if (_pin.length == 4) {
      if (_pin == _validPin) {
        HapticFeedback.mediumImpact();
        widget.onAuthenticated();
      } else {
        HapticFeedback.heavyImpact();
        setState(() {
          _error = 'Incorrect PIN. Enter 1234 or use phone authenticator.';
          _pin = '';
        });
      }
    }
  }

  void _backspace() {
    if (_pin.isEmpty || _authInProgress) return;
    HapticFeedback.selectionClick();
    setState(() {
      _error = '';
      _pin = _pin.substring(0, _pin.length - 1);
    });
  }

  KeyEventResult _handleKeyEvent(FocusNode _, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;
    final ch = event.character;
    if (ch != null &&
        ch.length == 1 &&
        ch.codeUnitAt(0) >= 48 &&
        ch.codeUnitAt(0) <= 57) {
      _appendDigit(ch);
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.backspace) {
      _backspace();
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  Widget _pinBox(BuildContext context, int index) {
    final isDark = SplitColors.isDark(context);
    final filled = index < _pin.length;
    final active = index == _pin.length;
    final hasError = _error.isNotEmpty;
    final haloColor = hasError
        ? const Color.fromRGBO(176, 0, 32, 0.16)
        : (active ? SplitColors.primaryBorder : Colors.transparent);
    final borderColor = hasError
        ? SplitColors.error
        : (active
              ? SplitColors.primary
              : (isDark ? SplitColors.darkFrameBorder : SplitColors.line));
    return Container(
      width: 50,
      height: 54,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: haloColor, width: 3.5),
      ),
      child: Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: isDark ? SplitColors.darkSurface : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: borderColor, width: 1.5),
        ),
        child: filled
            ? (_obscurePin
                  ? Container(
                      width: 11,
                      height: 11,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isDark ? Colors.white : SplitColors.navy,
                      ),
                    )
                  : Text(
                      _pin[index],
                      style: TextStyle(
                        fontSize: 21,
                        fontWeight: FontWeight.w800,
                        color: isDark ? Colors.white : SplitColors.navy,
                      ),
                    ))
            : const SizedBox.shrink(),
      ),
    );
  }

  Widget _keypadButton(
    BuildContext context, {
    required Key buttonKey,
    String? digit,
    IconData? icon,
    String? tooltip,
    VoidCallback? onTap,
  }) {
    final isDark = SplitColors.isDark(context);
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.all(5),
        child: Material(
          color: isDark ? SplitColors.darkSurface : Colors.white,
          borderRadius: BorderRadius.circular(14),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            key: buttonKey,
            onTap: onTap,
            child: Container(
              height: 54,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: SplitColors.lineColor(context)),
              ),
              child: Tooltip(
                message: tooltip ?? digit ?? '',
                child: icon != null
                    ? Icon(icon, size: 22, color: SplitColors.ink(context))
                    : Text(
                        digit ?? '',
                        style: TextStyle(
                          fontSize: 21,
                          fontWeight: FontWeight.w800,
                          color: isDark ? Colors.white : SplitColors.navy,
                        ),
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final domeHeight = (size.height * 0.27).clamp(168.0, 224.0);

    return Scaffold(
      key: const Key('medfarm-login-screen'),
      backgroundColor: SplitColors.canvas(context),
      body: Focus(
        focusNode: _keyboardFocus,
        autofocus: true,
        onKeyEvent: _handleKeyEvent,
        child: GestureDetector(
          onTap: () => _keyboardFocus.requestFocus(),
          child: Column(
            children: [
              // Curved Medfarm + PayPal dome header
              Container(
                width: double.infinity,
                height: domeHeight,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF283558), Color(0xFF1A2238)],
                  ),
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
                ),
                child: SafeArea(
                  bottom: false,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 60,
                        height: 60,
                        padding: const EdgeInsets.all(11),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(18),
                          boxShadow: [
                            BoxShadow(
                              color: SplitColors.primary.withValues(alpha: 0.35),
                              blurRadius: 20,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Image.asset(
                          'assets/paypal.png',
                          key: const Key('login-paypal-icon'),
                          fit: BoxFit.contain,
                          errorBuilder: (_, _, _) => const Icon(
                            Icons.account_balance_wallet_rounded,
                            color: SplitColors.primary,
                            size: 32,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Welcome, ${widget.accountName}',
                        style: const TextStyle(
                          fontFamily: 'PlusJakartaSans',
                          fontSize: 27,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.16),
                          ),
                        ),
                        child: Text(
                          '${widget.accountHandle} · PIN 1234',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFFE6ECF7),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 340),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  'Enter passcode',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w800,
                                    color: SplitColors.ink(context),
                                  ),
                                ),
                              ),
                              TextButton.icon(
                                style: TextButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  tapTargetSize:
                                      MaterialTapTargetSize.shrinkWrap,
                                ),
                                onPressed: () =>
                                    setState(() => _obscurePin = !_obscurePin),
                                icon: Icon(
                                  _obscurePin
                                      ? Icons.visibility_rounded
                                      : Icons.visibility_off_rounded,
                                  size: 16,
                                ),
                                label: Text(_obscurePin ? 'Show' : 'Hide'),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          // Tightly grouped centered 4-digit PIN boxes
                          Center(
                            child: Wrap(
                              spacing: 10,
                              runSpacing: 8,
                              alignment: WrapAlignment.center,
                              children: [
                                for (int i = 0; i < 4; i++)
                                  KeyedSubtree(
                                    key: Key('pin-box-$i'),
                                    child: _pinBox(context, i),
                                  ),
                              ],
                            ),
                          ),
                          if (_error.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            SplitCallout(
                              kind: CalloutKind.error,
                              message: _error,
                            ),
                          ],
                          const SizedBox(height: 18),
                          for (final row in const [
                            ['1', '2', '3'],
                            ['4', '5', '6'],
                            ['7', '8', '9'],
                          ])
                            Row(
                              children: [
                                for (final d in row)
                                  _keypadButton(
                                    context,
                                    buttonKey: Key('pin-key-$d'),
                                    digit: d,
                                    onTap: () => _appendDigit(d),
                                  ),
                              ],
                            ),
                          Row(
                            children: [
                              const Expanded(child: SizedBox.shrink()),
                              _keypadButton(
                                context,
                                buttonKey: const Key('pin-key-0'),
                                digit: '0',
                                onTap: () => _appendDigit('0'),
                              ),
                              _keypadButton(
                                context,
                                buttonKey: const Key('pin-key-backspace'),
                                icon: Icons.backspace_outlined,
                                tooltip: 'Delete digit',
                                onTap: _backspace,
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Center(
                            child: TextButton.icon(
                              key: const Key('phone-auth-btn'),
                              onPressed: _authInProgress
                                  ? null
                                  : () => _triggerPhoneAuthenticator(
                                      userInitiated: true,
                                    ),
                              icon: const Icon(
                                Icons.phonelink_lock_rounded,
                                size: 18,
                              ),
                              label: Text(
                                _authInProgress
                                    ? 'Verifying with phone…'
                                    : 'Use phone authenticator',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
