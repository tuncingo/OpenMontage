"""tools/kurul_voice.py helpers (paragraph detection) and tools/kurul_srt.py (cue layout and timing)."""
import importlib.util
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools"))


def _load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "tools" / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


voice = _load("kurul_voice")
srt = _load("kurul_srt")


def test_script_paragraphs_drop_tags_evidence_and_sources(tmp_path):
    p = tmp_path / "script.md"
    p.write_text("# T\n## Script\nFirst line. [S1]\n\n[EVIDENCE: x]\n\nSecond para here. [S2] [S3]\n\n## Sources\nS1. http://x\n", encoding="utf-8")
    assert voice.script_paragraphs(str(p)) == ["First line.", "Second para here."]


def test_ends_sentence():
    assert voice.ends_sentence("It ends here.") and voice.ends_sentence("Is it?")
    assert not voice.ends_sentence("They sit on sun facing slopes of young craters,")


def test_srt_cues_have_at_most_two_short_lines_and_monotonic_times():
    text = "In early 2026, a team at the University of Bern trained a machine learning tool on about one hundred thousand MESSENGER images."
    out = srt.build([(10.0, [{"text": text, "start": 0.0, "end": 6.0}]), (17.0, [{"text": "Short one.", "start": 0.0, "end": 1.5}])])
    blocks = [b.split("\n") for b in out.strip().split("\n\n")]
    last_end = -1.0
    for b in blocks:
        assert 1 <= len(b[2:]) <= 2 and all(len(line) <= 42 for line in b[2:])
        a, _, e = b[1].partition(" --> ")

        def sec(t):
            h, m, s = t.replace(",", ".").split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)

        assert sec(a) >= last_end - 1e-6 and sec(e) > sec(a)
        last_end = sec(e)
    assert blocks[0][0] == "1" and blocks[-1][0] == str(len(blocks))
