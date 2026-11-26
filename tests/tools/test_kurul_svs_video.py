"""tools/kurul.py svs_video: SVS API'sinin yanlış main_video'sunu (başka sayfanın ortak klibi) reddeder."""
import importlib.util
import pathlib

_spec = importlib.util.spec_from_file_location("kurul", pathlib.Path(__file__).resolve().parents[2] / "tools" / "kurul.py")
kurul = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(kurul)

KEPLER = "http://svs.gsfc.nasa.gov/vis/a000000/a001700/a001703/4559_Kepler_Neptune_Twitter_720.mp4"


def test_wrong_shared_main_video_without_own_video_is_skipped():
    d = {"id": 4289, "main_video": {"url": KEPLER, "pixels": 921600},
         "media_groups": [{"items": [{"instance": {"url": "http://svs.gsfc.nasa.gov/vis/a000000/a004200/a004289/x.jpg"}}]}]}
    assert kurul.svs_video(d) is None


def test_wrong_main_video_falls_back_to_largest_own_mp4():
    own_small = {"url": "http://svs.gsfc.nasa.gov/vis/a000000/a004200/a004289/a_720.mp4", "pixels": 921600}
    own_big = {"url": "http://svs.gsfc.nasa.gov/vis/a000000/a004200/a004289/a_1080.mp4", "pixels": 2073600}
    d = {"id": 4289, "main_video": {"url": KEPLER},
         "media_groups": [{"items": [{"instance": own_small}, {"instance": own_big}]}]}
    assert kurul.svs_video(d) is own_big


def test_correct_main_video_is_kept():
    mv = {"url": "http://svs.gsfc.nasa.gov/vis/a000000/a005600/a005609/helio_fleet_2026_1080p60.mp4"}
    assert kurul.svs_video({"id": 5609, "main_video": mv, "media_groups": []}) is mv


def test_non_mp4_main_video_is_rejected():
    assert kurul.svs_video({"id": 5609, "main_video": {"url": "http://x/a005609/y.mov"}, "media_groups": []}) is None
