#!/usr/bin/env python
import argparse
import json
import os
from pathlib import Path
from typing import List, Tuple
import sys
import contextlib
import io

import numpy as np
import torch


def load_audio(file_path: str, target_sample_rate: int = 16000) -> Tuple[np.ndarray, int]:
    import librosa
    import soundfile as sf

    audio, sr = sf.read(file_path)
    if audio.ndim > 1:
        audio = np.mean(audio, axis=1)
    if sr != target_sample_rate:
        audio = librosa.resample(audio, orig_sr=sr, target_sr=target_sample_rate)
        sr = target_sample_rate
    return audio.astype(np.float32), sr


def save_audio(file_path: Path, audio: np.ndarray, sample_rate: int) -> None:
    import soundfile as sf

    sf.write(file_path, audio, sample_rate)


def merge_timestamps(speech_ts: List[dict], sample_rate: int, sentence_pause_ms: int) -> List[dict]:
    merged: List[dict] = []
    for ts in speech_ts:
        if not merged:
            merged.append(ts.copy())
            continue

        gap_ms = (ts["start"] - merged[-1]["end"]) * 1000 / sample_rate
        if gap_ms <= sentence_pause_ms:
            merged[-1]["end"] = ts["end"]
        else:
            merged.append(ts.copy())
    return merged


def find_pause_index(
    audio: np.ndarray,
    sample_rate: int,
    seg_start: int,
    seg_end: int,
    target_idx: int,
    min_pause_samples: int,
    silence_threshold: float,
    search_ms: float = 1500.0,
) -> int:
    search_samples = int((search_ms / 1000) * sample_rate)
    best_idx = -1
    best_energy = float("inf")
    left = max(seg_start + min_pause_samples, target_idx - search_samples)
    right = min(seg_end - min_pause_samples, target_idx + search_samples)

    if left >= right:
        return -1

    step = max(1, min_pause_samples // 4)
    for idx in range(left, right, step):
        window = audio[idx : idx + min_pause_samples]
        energy = float(np.sqrt(np.mean(window ** 2)))
        if energy < silence_threshold and energy < best_energy:
            best_energy = energy
            best_idx = idx + (min_pause_samples // 2)

    return best_idx


def split_segment(
    audio: np.ndarray,
    sample_rate: int,
    start: int,
    end: int,
    max_samples: int,
    min_pause_samples: int,
    silence_threshold: float,
) -> List[Tuple[int, int]]:
    segments: List[Tuple[int, int]] = []
    queue: List[Tuple[int, int]] = [(start, end)]

    while queue:
        seg_start, seg_end = queue.pop(0)
        seg_len = seg_end - seg_start
        if seg_len <= max_samples or max_samples <= 0:
            segments.append((seg_start, seg_end))
            continue

        target_idx = seg_start + max_samples
        split_idx = find_pause_index(
            audio,
            sample_rate,
            seg_start,
            seg_end,
            target_idx,
            min_pause_samples,
            silence_threshold,
        )
        if split_idx == -1 or split_idx <= seg_start + min_pause_samples:
            split_idx = min(seg_start + max_samples, seg_end - 1)
            split_idx = max(split_idx - int(0.12 * sample_rate), seg_start + min_pause_samples)


        queue.insert(0, (split_idx, seg_end))
        queue.insert(0, (seg_start, split_idx))

    return segments


def main():
    parser = argparse.ArgumentParser(description="Split audio using Silero VAD without breaking sentences.")
    parser.add_argument("--input", required=True, help="Path to input WAV file (16kHz mono).")
    parser.add_argument("--output", required=True, help="Directory to store speech segments.")
    parser.add_argument("--prefix", type=str, default="segment", help="Prefix for segment filenames (default: 'segment').")
    parser.add_argument("--min-silence", type=int, default=int(os.getenv("VAD_MIN_SILENCE_MS", 650)))
    parser.add_argument("--min-speech", type=int, default=int(os.getenv("VAD_MIN_SPEECH_MS", 900)))
    parser.add_argument("--sentence-pause", type=int, default=int(os.getenv("VAD_SENTENCE_PAUSE_MS", 1100)))
    parser.add_argument("--padding", type=float, default=float(os.getenv("VAD_PADDING_SEC", 0.35)))
    parser.add_argument("--max-segment-seconds", type=float, default=float(os.getenv("VAD_MAX_SEGMENT_SECONDS", 28)))
    parser.add_argument("--silence-threshold", type=float, default=float(os.getenv("VAD_SILENCE_THRESHOLD", 0.004)))

    args = parser.parse_args()

    if not os.path.exists(args.input):
        raise SystemExit(f"Input file not found: {args.input}")

    Path(args.output).mkdir(parents=True, exist_ok=True)

    device = "cuda" if torch.cuda.is_available() else "cpu"

    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        model, utils = torch.hub.load(
            repo_or_dir="snakers4/silero-vad",
            model="silero_vad",
            trust_repo=True
        )

    (get_speech_timestamps,
     save_audio_fn,
     read_audio_fn,
     VADIterator,
     collect_chunks) = utils

    model.to(device)


    wav, sample_rate = load_audio(args.input)
    wav_tensor = torch.tensor(wav, dtype=torch.float32, device=device)

    speech_timestamps = get_speech_timestamps(
        wav_tensor,
        model,
        sampling_rate=sample_rate,
        min_silence_duration_ms=args.min_silence,
        min_speech_duration_ms=args.min_speech,
    )

    merged = merge_timestamps(speech_timestamps, sample_rate, args.sentence_pause)

    padding_samples = int(args.padding * sample_rate)
    effective_max_seconds = max(0.5, args.max_segment_seconds - (2 * args.padding))
    max_samples = int(effective_max_seconds * sample_rate)
    min_pause_samples = max(1, int(0.2 * sample_rate))

    segments_meta = []
    total_speech_ms = 0
    segment_counter = 0

    for ts in merged:
        sub_segments = split_segment(
            wav,
            sample_rate,
            ts["start"],
            ts["end"],
            max_samples,
            min_pause_samples,
            args.silence_threshold,
        )

        for seg_start, seg_end in sub_segments:
            segment_counter += 1
            start_idx = max(seg_start - padding_samples, 0)
            start_idx = max(start_idx - int(0.05 * sample_rate), 0)

            end_idx = min(seg_end + padding_samples, wav.shape[0])
            chunk = wav[start_idx:end_idx]
            out_path = Path(args.output) / f"{args.prefix}_{segment_counter:03d}.wav"
            save_audio(out_path, chunk, sample_rate)

            start_time = start_idx / sample_rate
            end_time = end_idx / sample_rate
            duration_ms = (end_time - start_time) * 1000
            total_speech_ms += duration_ms

            segments_meta.append(
                {
                    "file": str(out_path),
                    "start": round(start_time, 3),
                    "end": round(end_time, 3),
                    "durationMs": round(duration_ms, 2),
                }
            )

    result = {
        "segmentsCount": len(segments_meta),
        "segments": segments_meta,
        "totalSpeechMs": round(total_speech_ms, 2),
        "segmentsDir": str(Path(args.output).resolve()),
        "maxSegmentSeconds": args.max_segment_seconds,
    }

    print(json.dumps(result))


if __name__ == "__main__":
    main()

