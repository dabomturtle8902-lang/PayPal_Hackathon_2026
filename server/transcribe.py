import json
import os
import sys

os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
from faster_whisper import WhisperModel

audio_path = sys.argv[1]
hint = sys.argv[2] if len(sys.argv) > 2 else ""
model = WhisperModel("tiny.en", device="cpu", compute_type="int8")
segments, _info = model.transcribe(audio_path, vad_filter=False, initial_prompt=hint or None)
text = " ".join(seg.text.strip() for seg in segments if seg.text and seg.text.strip()).strip()
print(json.dumps({"transcript": text, "engine": "faster-whisper"}))
