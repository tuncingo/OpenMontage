"""Kokoro local text-to-speech provider tool (ONNX build of Kokoro-82M v1.0)."""

from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path
from typing import Any

from tools.base_tool import (
    BaseTool,
    Determinism,
    ExecutionMode,
    ResourceProfile,
    RetryPolicy,
    ToolResult,
    ToolRuntime,
    ToolStability,
    ToolStatus,
    ToolTier,
)

_MODEL_DIR = Path(os.environ.get("KOKORO_DIR", "/home/user/kokoro-models"))
_MODEL = Path(os.environ.get("KOKORO_MODEL", _MODEL_DIR / "kokoro-v1.0.onnx"))
_VOICES = Path(os.environ.get("KOKORO_VOICES", _MODEL_DIR / "voices-v1.0.bin"))

# Light documentary voice treatment: high-pass, low-end warmth, gentle 2.5:1
# compression, ~10% small-room reverb, loudness normalised to -16 LUFS.
_DOC_TREATMENT = (
    "[0:a]aresample=48000,highpass=f=75,bass=g=2.5:f=140:w=0.8,equalizer=f=320:t=q:w=1.2:g=-1.2,"
    "acompressor=threshold=-20dB:ratio=2.5:attack=12:release=200:makeup=2,asplit[d][w];"
    "[w][1:a]afir=dry=0:wet=1[r];[d][r]amix=inputs=2:weights='1 0.1':normalize=0,"
    "loudnorm=I=-16:TP=-1.5:LRA=11[o]"
)


def _room_ir(path: Path) -> Path:
    """Write a short synthetic small-room impulse response (deterministic)."""
    if path.exists():
        return path
    import numpy as np
    import soundfile as sf

    sr = 48000
    n = int(0.45 * sr)
    t = np.arange(n) / sr
    ir = np.random.default_rng(7).standard_normal(n) * np.exp(-t / 0.08)
    ir = np.convolve(ir, np.ones(24) / 24, mode="same")
    ir[: int(0.012 * sr)] = 0
    ir /= np.max(np.abs(ir))
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(path, ir.astype(np.float32), sr)
    return path


class KokoroTTS(BaseTool):
    name = "kokoro_tts"
    version = "0.1.0"
    tier = ToolTier.VOICE
    capability = "tts"
    provider = "kokoro"
    stability = ToolStability.EXPERIMENTAL
    execution_mode = ExecutionMode.SYNC
    determinism = Determinism.DETERMINISTIC
    runtime = ToolRuntime.LOCAL

    dependencies = ["python:kokoro_onnx", "python:soundfile"]
    install_instructions = (
        "Install Kokoro TTS (ONNX):\n"
        "  python -m pip install kokoro-onnx soundfile\n"
        "Then download the model files into /home/user/kokoro-models (or set KOKORO_MODEL / KOKORO_VOICES):\n"
        "  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx\n"
        "  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"
    )
    agent_skills = ["text-to-speech"]

    capabilities = [
        "text_to_speech",
        "offline_generation",
    ]
    supports = {
        "voice_cloning": False,
        "multilingual": True,
        "offline": True,
        "native_audio": True,
    }
    best_for = [
        "free local documentary narration with a natural, full voice",
        "consistent channel narrator across episodes (default am_michael)",
    ]
    not_good_for = [
        "voice clone matching",
        "SSML-level prosody control",
    ]

    input_schema = {
        "type": "object",
        "required": ["text"],
        "properties": {
            "text": {"type": "string"},
            "voice": {"type": "string", "default": "am_michael"},
            "speed": {"type": "number", "default": 0.97},
            "lang": {"type": "string", "default": "en-us", "description": "en-us for a*/am_* voices, en-gb for b*_ voices"},
            "post_treatment": {"type": "string", "enum": ["none", "documentary"], "default": "none"},
            "output_path": {"type": "string"},
        },
    }

    resource_profile = ResourceProfile(
        cpu_cores=4, ram_mb=1500, vram_mb=0, disk_mb=400, network_required=False
    )
    retry_policy = RetryPolicy(max_retries=1, retryable_errors=[])
    idempotency_key_fields = ["text", "voice", "speed", "lang", "post_treatment"]
    side_effects = ["writes audio file to output_path"]
    user_visible_verification = ["Listen to generated audio for intelligibility"]

    def get_status(self) -> ToolStatus:
        try:
            import kokoro_onnx  # noqa: F401
            import soundfile  # noqa: F401
        except ImportError:
            return ToolStatus.UNAVAILABLE
        if _MODEL.exists() and _VOICES.exists():
            return ToolStatus.AVAILABLE
        return ToolStatus.UNAVAILABLE

    def estimate_cost(self, inputs: dict[str, Any]) -> float:
        return 0.0

    def execute(self, inputs: dict[str, Any]) -> ToolResult:
        if self.get_status() != ToolStatus.AVAILABLE:
            return ToolResult(success=False, error="Kokoro TTS not available. " + self.install_instructions)

        start = time.time()
        try:
            result = self._generate(inputs)
        except Exception as exc:
            return ToolResult(success=False, error=f"Local TTS generation failed: {exc}")

        result.duration_seconds = round(time.time() - start, 2)
        return result

    def _generate(self, inputs: dict[str, Any]) -> ToolResult:
        import soundfile as sf
        from kokoro_onnx import Kokoro

        voice = inputs.get("voice", "am_michael")
        speed = float(inputs.get("speed", 0.97))
        lang = inputs.get("lang") or ("en-gb" if voice.startswith("b") else "en-us")
        treatment = inputs.get("post_treatment", "none")
        output_path = Path(inputs.get("output_path", "tts_output.wav"))
        output_path.parent.mkdir(parents=True, exist_ok=True)

        audio, sr = Kokoro(str(_MODEL), str(_VOICES)).create(inputs["text"], voice=voice, speed=speed, lang=lang)

        if treatment == "documentary":
            raw = output_path.with_suffix(".raw.wav")
            sf.write(raw, audio, sr)
            ir = _room_ir(_MODEL_DIR / "room_ir.wav")
            proc = subprocess.run(
                ["ffmpeg", "-loglevel", "error", "-y", "-i", str(raw), "-i", str(ir),
                 "-filter_complex", _DOC_TREATMENT, "-map", "[o]", "-ac", "1", "-ar", "48000", str(output_path)],
                capture_output=True, text=True, timeout=300,
            )
            raw.unlink(missing_ok=True)
            if proc.returncode != 0:
                return ToolResult(success=False, error=f"Voice treatment failed: {proc.stderr}")
        else:
            sf.write(output_path, audio, sr)

        if not output_path.exists():
            return ToolResult(success=False, error=f"Kokoro output file missing: {output_path}")

        return ToolResult(
            success=True,
            data={
                "provider": self.provider,
                "model": "kokoro-v1.0",
                "voice": voice,
                "speed": speed,
                "lang": lang,
                "post_treatment": treatment,
                "text_length": len(inputs["text"]),
                "output": str(output_path),
                "format": output_path.suffix.lstrip("."),
            },
            artifacts=[str(output_path)],
            model="kokoro-v1.0",
        )
