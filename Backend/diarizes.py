import os
import torch
import torchaudio
from dotenv import load_dotenv
from pyannote.audio import Pipeline
from pyannote.audio.pipelines.utils.hook import ProgressHook

# Load environment variables from .env file
load_dotenv()

# Load Hugging Face token from environment variable
HF_TOKEN = os.getenv("HF_TOKEN")
if not HF_TOKEN:
    raise ValueError("HF_TOKEN environment variable is not set. Please set it in your .env file or environment.")
# Output folder
OUTPUT_DIR = r"C:\Users\THABENDRA\Desktop\output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-community-1",
    token=HF_TOKEN
)

# Move to GPU if available
if torch.cuda.is_available():
    pipeline.to(torch.device("cuda"))
    print("🚀 Using GPU")
else:
    print("⚠️ Using CPU")

pipeline.segmentation.min_duration_on = 0.1
pipeline.segmentation.min_duration_off = 0.05

# Load audio manually (bypass torchcodec)
waveform, sample_rate = torchaudio.load("audio1.wav")

file = {
    "waveform": waveform,
    "sample_rate": sample_rate
}

with ProgressHook() as hook:
    output = pipeline(file, hook=hook, max_speakers=2, duration=5.0)

# Print results
for turn, speaker in output.speaker_diarization:
    print(f"{turn.start:.1f}s - {turn.end:.1f}s speaker_{speaker}")

padding = 0.05  # 50ms

MIN_DURATION_SECONDS = 2.0  # skip if 2 sec or less
MAX_DURATION_SECONDS = 30.0  # Skip if ≥ 30 seconds

for i, (turn, speaker) in enumerate(output.speaker_diarization):

    start_sample = max(0, round(turn.start * sample_rate))
    end_sample   = min(waveform.shape[1], round((turn.end + padding) * sample_rate))

    # Calculate segment duration in seconds
    duration_seconds = (end_sample - start_sample) / sample_rate

    # Skip segments less than or equal to 1 second
    if duration_seconds <= MIN_DURATION_SECONDS:
        print(f"⏭ Skipped speaker_{speaker}_{i} (duration: {duration_seconds:.2f}s)")
        continue
    # Skip too-long segments
    if duration_seconds > MAX_DURATION_SECONDS:
        print(f"⏭ Skipped (too long) speaker_{speaker}_{i} ({duration_seconds:.2f}s)")
        continue

    # Extract segment
    segment = waveform[:, start_sample:end_sample]

    # Save
    filename = os.path.join(OUTPUT_DIR, f"speaker_{speaker}_{i}.wav")
    torchaudio.save(filename, segment, sample_rate)
    print(f"Saved {filename}")

print("Diarization complete.")
