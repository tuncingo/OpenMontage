"""Channel narration pipeline: settings come from kanal/ayarlar.json, paragraph/sentence silence, loudness."""
import json
import shutil

import numpy as np
import pytest
import soundfile as sf

from tools.audio import narration

SR = 24000


def _tone(text: str):
    """Fake synth: 0.4 s of a 220 Hz tone per sentence."""
    t = np.arange(int(0.4 * SR)) / SR
    return (0.3 * np.sin(2 * np.pi * 220 * t)).astype(np.float32), SR


def _longest_zero_run_s(x, sr, thresh=1e-5):
    best = run = 0
    for v in np.abs(x) < thresh:
        run = run + 1 if v else 0
        best = max(best, run)
    return best / sr


def test_settings_are_read_from_ayarlar_json(tmp_path):
    p = tmp_path / "ayarlar.json"
    p.write_text(json.dumps({"narration_voice": "bm_george", "narration_sentence_gap_s": 0.5,
                             "narration_paragraph_gap_s": 1.25, "narration_lufs": -16}), encoding="utf-8")
    cfg = narration.load_settings(p)
    assert cfg["narration_voice"] == "bm_george"
    assert cfg["narration_sentence_gap_s"] == 0.5
    assert cfg["narration_paragraph_gap_s"] == 1.25
    assert cfg["narration_lufs"] == -16
    assert cfg["narration_speed"] == 0.9  # missing key -> channel default


def test_channel_settings_file_has_the_narration_keys():
    cfg = narration.load_settings()
    assert cfg["narration_voice"] == "bm_lewis" and cfg["narration_speed"] == 0.9
    assert cfg["narration_sentence_gap_s"] == pytest.approx(0.35)
    assert cfg["narration_paragraph_gap_s"] == pytest.approx(0.7)
    assert cfg["narration_lufs"] == -14 and cfg["narration_true_peak_db"] <= -1.0


def test_paragraph_gap_is_at_least_0_6_s_and_sentence_gap_is_shorter():
    cfg = narration.load_settings()
    text = "First sentence here. Second sentence here.\n\nThird sentence starts a new paragraph."
    audio, sr = narration.assemble(narration.split_paragraphs(text), _tone,
                                   cfg["narration_sentence_gap_s"], cfg["narration_paragraph_gap_s"])
    assert _longest_zero_run_s(audio, sr) >= 0.6
    # 3 tones + one sentence gap + one paragraph gap
    expect = 3 * 0.4 + cfg["narration_sentence_gap_s"] + cfg["narration_paragraph_gap_s"]
    assert len(audio) / sr == pytest.approx(expect, abs=0.02)


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg needed")
def test_loudness_target_and_true_peak(tmp_path):
    rng = np.random.default_rng(1)
    n = SR * 6
    env = np.abs(np.sin(np.linspace(0, 40, n))) ** 3  # speech-like bursts, high crest factor
    x = (rng.standard_normal(n) * 0.05 * env).astype(np.float32)
    x[::5000] = 0.6  # peaks
    src, dst = tmp_path / "in.wav", tmp_path / "out.wav"
    sf.write(src, x, SR)
    lufs, tp = narration.normalize_loudness(str(src), str(dst), -14.0, -1.0)
    assert abs(lufs - (-14.0)) <= 0.5
    assert tp <= -1.0


def _kokoro_ready():
    try:
        from tools.audio.kokoro_tts import KokoroTTS
        from tools.base_tool import ToolStatus
        return KokoroTTS().get_status() == ToolStatus.AVAILABLE and shutil.which("ffmpeg") is not None
    except Exception:
        return False


@pytest.mark.skipif(not _kokoro_ready(), reason="Kokoro model files not installed")
def test_real_kokoro_two_paragraphs_have_paragraph_silence(tmp_path):
    from tools.audio.kokoro_tts import KokoroTTS

    out = tmp_path / "n.wav"
    text = "Mercury is small. It is close to the Sun.\n\nIt may not be dead."
    res = KokoroTTS().execute({"text": text, "post_treatment": "narration", "output_path": str(out)})
    assert res.success, res.error
    audio, sr = sf.read(out)
    assert _longest_zero_run_s(audio, sr, thresh=1e-4) >= 0.6
    assert res.data["voice"] == "bm_lewis" and res.data["speed"] == 0.9
    assert abs(res.data["measured_lufs"] - (-14.0)) <= 0.6 and res.data["measured_true_peak_db"] <= -1.0
