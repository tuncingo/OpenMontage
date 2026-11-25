# Rebel Minds: Cosmos — Style Guide

## Voice
Curious, slightly rebellious, evidence-driven. We question the consensus but never overclaim. We make the viewer feel smart, not lectured. No hype words ("scientists are shocked", "this changes everything", "proves").

## Script
- Language: English. Pace: ~140 words per minute. Default length: 10 minutes.
- First 15 seconds: a hook built on genuine tension or a question — no false promises.
- Short-to-medium sentences written for text-to-speech; no parentheses; numbers written the way they should be spoken.
- Cite every factual sentence with [S1], [S2]… mapped to a `## Sources` list.
- Put `[EVIDENCE: short label]` on its own line right before a NEW piece of evidence is introduced (drives the evidence tracker).
- Open curiosity loops and pay them off. Reflective close, one natural call to action.

## Look
The channel's look is quiet and precise: a near-black ground, hairline line graphics, thin numerals, small restrained colour. Think scientific figure, not poster.
- Ground: `#05070C` (near-black), with a light drifting star/dust layer. No bright gradients behind graphics.
- Strokes: hairlines (1.5–3 px) in teal, with a muted amber for the thing being highlighted. Grey for axes and context.
- Constantly moving, never a static frame: slow push-in, pull-out, pan, parallax, slow drift of lines and dust.
- Never the same visual treatment twice in a row; never the same image twice in an episode.
- Prefer real imagery (NASA/ESA/ESO) when the narration refers to a real mission, object or instrument. Where no honest image exists, use a generic cosmic cutaway (below) instead of a look-alike photo of a different vehicle or mission; never present a stand-in as the real thing.
- Anything drawn rather than photographed that stands in for a real mission carries a small "Illustration" label.

## Cosmic cutaways
Şematik çizgi grafikler yalnızca veri, rakam ve karşılaştırma için. Genel cümlelerde renkli, hareketli kozmik ara planlar (nebula, yıldız kümesi, gezegen) kullanılmaya devam eder; bunlar ilgisiz sayılmaz.
(English: line schematics are only for data, numbers and comparisons. General sentences keep using colourful, moving cosmic backgrounds — nebulae, star clusters, planets — and a reviewer must not count them as irrelevant.)
- Cutaways are real NASA/ESA/ESO images with slow Ken Burns, parallax and the drifting star/dust layer; credit them in the source line.

## Moving footage
Her sahne için Yönetmen "photo" ya da "video" seçer. Genel cümleler ve kozmik ara planlar için video tercih edilir; belirli bir nesnenin, donanımın ya da kanıt anının fotoğrafı için photo.
(English: every scene is planned as `photo` or `video`. Video is preferred for general sentences and cosmic cutaways; photo is for a specific named object, hardware or evidence moment.)
- Video comes from the NASA Image Library (media type video) and NASA's Scientific Visualization Studio (svs.gsfc.nasa.gov). Both are credited in the source line ("Video: NASA/GSFC", "Video: NASA's Scientific Visualization Studio").
- Clips are cut to the scene, muted (the narration and the music are the only sound), at most 1080p. A clip shorter than its scene loops; prefer calm, repeating motion for those.
- The image selector looks at the preview frame and the clip's length and resolution; clips with baked-in captions or logos are rejected.

## Music
The channel's default music is `kanal/muzik/long_voyage_to_outer_space.mp3` (YouTube Audio Library). If an episode has its own `bolumler/<kod>/muzik/` folder, the first track in it is used instead.
- The music bed sits about **20 dB under the narration** (≈ -34 LUFS against narration at **-14 LUFS**); the narration level is never changed by the music.
- A soft fade in at the start and a soft fade out at the end (2 s / 3 s for episodes, 0.4 s / 1.5 s for Shorts).
- A track shorter than the video loops: its end is cross-faded (equal power, 4 s) into its start so the seam is not noticeable.
- The credit line "Music: Sir Cubworth - The Long Voyage to Outer Space (YouTube Audio Library)" goes into `credits.txt` and the description.

## Shorts
Vertical 1080x1920, 4-5 per episode, made by `/shorts <kod>`. Cut points are chosen by the YouTube strategist; **every Short starts at the beginning of a sentence and ends at the end of a sentence**, 20-55 seconds.
- **Layout:** the 16:9 picture sits in the middle (1080x608, y 656-1264). The space above and below it is the SAME picture, blurred and scaled to fill the frame (dimmed). Source credit is a small grey line just above the picture, right-aligned.
- **Captions (safe area):** centred on **y ≈ 1250**; **600 px stay empty at the bottom** (nothing below y 1320) and **180 px stay empty on the right** (nothing right of x 900); **at most 2 lines**, about 20 characters per line, Inter Medium 48 px on a soft dark pill. Captions follow the narration (timing from `subtitles_en.srt`).
- **Hook (first 2 seconds):** a big visual hook in the upper blurred area: one number (Inter Light, very large) or a short claim of at most 6 words, with an amber hairline and an optional small caps line in teal. It must come from the script and be supported by its sources.
- **End card (last 2 seconds):** "Full episode on the channel" (Inter Medium, 84 px) over a dimmed picture, with "Rebel Minds: Cosmos" in grey capitals beneath.
- **Sound:** narration at **-14 LUFS**, music as in the Music section (about 20 dB under the narration).
- **Packaging:** each Short has a vertical cover brief (1080x1920, key content away from the bottom 600 px and the right 180 px), an English title (max 70 characters), description and pinned comment, all in `yayin_paketi.md`. Sober and scientifically accurate, like everything else.

## Schematic graphics
Key facts are shown as drawn line graphics that build themselves on screen (lines draw, markers slide, numerals count up):
- Timelines for plans and schedule slips (planned vs. now), scales for comparisons (e.g. temperature), orbits and lattices for physical ideas.
- Axes and ticks in grey, the subject in teal, the change or the warning in muted amber.
- Every graphic names its source in the bottom-right source line.
- Draw only numbers that are in the script and its sources. Do not invent positions or dates; if an exact value is unknown, use a bracket or range, not a point.

## On-screen text (must be legible on a phone)
- Big numbers: Inter Light, very large, with a hairline rule underneath and a one-line explanation in Inter Regular. They enter with a rise and un-blur (counting up where it makes sense) and leave the same way.
- Labels, kickers and captions: Inter Medium, letter-spaced capitals, **at least 36 px on a 1080p frame**. Nothing smaller except the source line.
- Headlines and lower thirds: Inter Medium, at least 60 px, a thin teal bar at the left; max 6 words.
- Everything stays inside 10% safe margins; use a soft dark scrim only when the background is a photograph.
- Few overlays rather than many — only where they help understanding or land a key number.

## Source line
Every scene with a photo or a graphic shows a small, pale-grey source or image credit at the bottom right (for example "Image: NASA/JSC" or "Source: SpacePolicyOnline, Nov 2026"). It fades in a moment after the scene starts and out before it ends.

## Evidence tracker
A recurring graphic at the top left that appears ONLY when a new piece of evidence is introduced, then disappears: an outlined counter circle (the number rolls up), a hairline that draws out, "EVIDENCE" and a short label (36 px) typed in. It folds away after a few seconds. Never permanent clutter.

## Palette & type
- Ground `#05070C`, ice white `#F2F5FF`, teal `#62C2CF` (accent), muted amber `#D9A25B` (highlight), grey `#8A93A6` (axes, context), dim grey `#5E6678`.
- Inter only: Light for big numerals, Regular for explanations, Medium for labels, headlines and tracker.
- Fonts are bundled in the renderer (SIL OFL); do not depend on a network font service.

## Thumbnail
Max 4 words, one focal subject, readable at phone size, built from the palette above (near-black ground, teal and amber accents).

### Cover concepts (3 per episode)
Every episode gets three cover concepts for the main video — **number** (one figure that is in the script), **mystery** (an open question, never a fake threat) and **clean** (one subject, lots of dark space, hairline detail). Each has an English headline of at most 4 words and an English visual brief to paste into Canva. Headlines are sober and scientifically accurate: no "shocking", "proves", "secret", "impossible"; nothing the video does not show. Where a real mission is meant, the brief names the real NASA/ESA/ESO image to upload instead of generating a look-alike. All of it lives, ready to paste, in `bolumler/<kod>/yayin_paketi.md`.
