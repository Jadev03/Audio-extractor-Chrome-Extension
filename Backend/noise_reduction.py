#!/usr/bin/env python
"""
Noise reduction using noisereduce library with librosa and soundfile.
This script applies ML-based noise reduction to audio files.
"""
import argparse
import json
import os
from pathlib import Path

import librosa
import noisereduce as nr
import numpy as np
import soundfile as sf


def load_audio(file_path: str, target_sample_rate: int = 16000):
    """Load audio file and resample if needed."""
    audio, sr = sf.read(file_path)
    
    # Convert to mono if stereo
    if len(audio.shape) > 1:
        audio = np.mean(audio, axis=1)
    
    # Resample if needed
    if sr != target_sample_rate:
        audio = librosa.resample(audio, orig_sr=sr, target_sr=target_sample_rate)
        sr = target_sample_rate
    
    return audio.astype(np.float32), sr


def save_audio(file_path: Path, audio: np.ndarray, sample_rate: int):
    """Save audio file."""
    sf.write(file_path, audio, sample_rate)


def main():
    parser = argparse.ArgumentParser(description="Apply ML-based noise reduction to audio.")
    parser.add_argument("--input", required=True, help="Path to input WAV file.")
    parser.add_argument("--output", required=True, help="Path to output WAV file.")
    parser.add_argument(
        "--method",
        type=str,
        default=os.getenv("NOISE_REDUCTION_METHOD", "spectral_gating"),
        choices=["spectral_gating", "spectral_subtraction", "wiener"],
        help="Noise reduction method (default: spectral_gating)."
    )
    parser.add_argument(
        "--stationary",
        action="store_true",
        default=os.getenv("NOISE_REDUCTION_STATIONARY", "false").lower() == "true",
        help="Use stationary noise reduction (better for constant noise)."
    )
    parser.add_argument(
        "--prop-decrease",
        type=float,
        default=float(os.getenv("NOISE_REDUCTION_PROP_DECREASE", "0.8")),
        help="Proportion of noise to reduce (0.0-1.0, default: 0.8)."
    )
    parser.add_argument(
        "--n-fft",
        type=int,
        default=int(os.getenv("NOISE_REDUCTION_N_FFT", "2048")),
        help="FFT window size (default: 2048)."
    )
    parser.add_argument(
        "--win-length",
        type=int,
        default=int(os.getenv("NOISE_REDUCTION_WIN_LENGTH", "2048")),
        help="Window length (default: 2048)."
    )
    parser.add_argument(
        "--hop-length",
        type=int,
        default=int(os.getenv("NOISE_REDUCTION_HOP_LENGTH", "512")),
        help="Hop length (default: 512)."
    )
    parser.add_argument(
        "--n-jobs",
        type=int,
        default=int(os.getenv("NOISE_REDUCTION_N_JOBS", "1")),
        help="Number of parallel jobs (default: 1)."
    )
    args = parser.parse_args()

    if not os.path.exists(args.input):
        raise SystemExit(f"Input file not found: {args.input}")

    # Load audio
    audio, sample_rate = load_audio(args.input, target_sample_rate=16000)

    # Apply noise reduction
    try:
        if args.method == "spectral_gating":
            # Spectral gating - best for general noise reduction
            reduced_noise = nr.reduce_noise(
                y=audio,
                sr=sample_rate,
                stationary=args.stationary,
                prop_decrease=args.prop_decrease,
                n_fft=args.n_fft,
                win_length=args.win_length,
                hop_length=args.hop_length,
                n_jobs=args.n_jobs
            )
        elif args.method == "spectral_subtraction":
            # Spectral subtraction - good for speech
            reduced_noise = nr.reduce_noise(
                y=audio,
                sr=sample_rate,
                stationary=args.stationary,
                prop_decrease=args.prop_decrease,
                n_fft=args.n_fft,
                win_length=args.win_length,
                hop_length=args.hop_length,
                n_jobs=args.n_jobs,
                use_torch=True  # Use PyTorch backend for better performance
            )
        elif args.method == "wiener":
            # Wiener filter - good for stationary noise
            reduced_noise = nr.reduce_noise(
                y=audio,
                sr=sample_rate,
                stationary=True,  # Wiener works best with stationary noise
                prop_decrease=args.prop_decrease,
                n_fft=args.n_fft,
                win_length=args.win_length,
                hop_length=args.hop_length,
                n_jobs=args.n_jobs
            )
        else:
            # Default to spectral_gating
            reduced_noise = nr.reduce_noise(
                y=audio,
                sr=sample_rate,
                stationary=args.stationary,
                prop_decrease=args.prop_decrease,
                n_fft=args.n_fft,
                win_length=args.win_length,
                hop_length=args.hop_length,
                n_jobs=args.n_jobs
            )

        # Ensure output is float32 and normalized
        reduced_noise = reduced_noise.astype(np.float32)
        
        # Normalize to prevent clipping
        max_val = np.max(np.abs(reduced_noise))
        if max_val > 1.0:
            reduced_noise = reduced_noise / max_val * 0.95  # Leave some headroom

        # Save denoised audio
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        save_audio(output_path, reduced_noise, sample_rate)

        # Return success info
        result = {
            "success": True,
            "inputFile": args.input,
            "outputFile": str(output_path),
            "method": args.method,
            "sampleRate": sample_rate,
            "duration": len(reduced_noise) / sample_rate,
            "originalMax": float(np.max(np.abs(audio))),
            "denoisedMax": float(np.max(np.abs(reduced_noise)))
        }
        print(json.dumps(result))

    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "inputFile": args.input
        }
        print(json.dumps(error_result))
        raise SystemExit(f"Noise reduction failed: {e}")


if __name__ == "__main__":
    main()

