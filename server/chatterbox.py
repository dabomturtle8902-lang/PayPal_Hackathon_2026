import io
import os
import sys
import wave

import riva.client

auth = riva.client.Auth(
    uri="grpc.nvcf.nvidia.com:443",
    use_ssl=True,
    metadata_args=[
        ["function-id", "ddacc747-1269-4fab-bfd9-8f593dead106"],
        ["authorization", "Bearer " + os.environ["NVIDIA_API_KEY"]],
    ],
)
service = riva.client.SpeechSynthesisService(auth)
sample_rate = 22050
response = service.synthesize(
    sys.argv[1], "Chatterbox-Multilingual.en-US.Male", "en-US",
    sample_rate_hz=sample_rate,
)
buffer = io.BytesIO()
with wave.open(buffer, "wb") as audio:
    audio.setnchannels(1)
    audio.setsampwidth(2)
    audio.setframerate(sample_rate)
    audio.writeframes(response.audio)
sys.stdout.buffer.write(buffer.getvalue())
