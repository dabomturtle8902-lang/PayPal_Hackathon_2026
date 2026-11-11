import 'dart:js_interop';

@JS('paypalStartSpeechRecording')
external JSPromise<JSString> _start();

@JS('paypalStopSpeechRecording')
external void stopBrowserRecording();

@JS('paypalCancelSpeechRecording')
external void cancelBrowserRecording();

Future<String> startBrowserRecording() async => (await _start().toDart).toDart;
