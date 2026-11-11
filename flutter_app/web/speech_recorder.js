(() => {
  let active;

  function finish(session, value, error) {
    clearTimeout(session.timer);
    session.stream?.getTracks().forEach(track => track.stop());
    if (active === session) active = undefined;
    if (error) session.reject(error);
    else session.resolve(value);
  }

  window.paypalStartSpeechRecording = () => new Promise((resolve, reject) => {
    if (active) {
      reject(new Error('A recording is already in progress.'));
      return;
    }
    const session = active = { resolve, reject };
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (active !== session) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        session.stream = stream;
        const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']
          .find(type => MediaRecorder.isTypeSupported(type));
        const recorder = session.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
        const chunks = [];
        recorder.ondataavailable = event => {
          if (event.data.size) chunks.push(event.data);
        };
        recorder.onerror = () => finish(session, '', new Error('Recording failed.'));
        recorder.onstop = () => {
          stream.getTracks().forEach(track => track.stop());
          if (active !== session) return;
          if (!chunks.length) {
            finish(session, '');
            return;
          }
          const reader = new FileReader();
          reader.onload = () => finish(session, JSON.stringify({
            mimeType: recorder.mimeType,
            audioBase64: String(reader.result).split(',')[1],
          }));
          reader.onerror = () => finish(session, '', new Error('Could not read the recording.'));
          reader.readAsDataURL(new Blob(chunks, { type: recorder.mimeType }));
        };
        recorder.start();
        session.timer = setTimeout(window.paypalStopSpeechRecording, 20000);
      } catch (error) {
        if (active === session) finish(session, '', error);
      }
    })();
  });

  window.paypalStopSpeechRecording = () => {
    const session = active;
    if (!session) return;
    if (!session.recorder) finish(session, '');
    else if (session.recorder.state === 'recording') session.recorder.stop();
  };

  window.paypalCancelSpeechRecording = () => {
    if (active) finish(active, '');
  };
})();
