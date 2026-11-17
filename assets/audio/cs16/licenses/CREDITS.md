# CS16 local sound recordings

These assets are bundled with the app. No third-party server is contacted while playing.

## Gunfire

Real firearm recordings from **The Free Firearm Sound Library**, created by **Ben Jaszczak, Brian Nelson, Kevin Heras and Matthew Nanney**, released under **CC0 1.0**.

- Primary publication and licence: https://opengameart.org/content/the-free-firearm-sound-library
- Original prepared library archive: https://opengameart.org/sites/default/files/Prepared%20SFX%20Library.7z
- Original publisher archive linked by the publication: https://web.archive.org/web/20141217041948/http://freefirearmsfx.com/
- Download mirror for the five original WAV recordings used here: https://github.com/petroulacl/fps-asset-kit/tree/main/sfx/firearm_sfx/Prepared%20SFX%20Library
- CC0 terms: https://creativecommons.org/publicdomain/zero/1.0/

The publication names the recording team and explicitly licenses the library CC0. This was checked on 2026-11-17. The publisher's old website no longer operates; the publication preserves its licence statement and distributes the prepared library. The mirror supplies individual original WAV files, avoiding a download of the complete 194 MB archive. Each original file and each resulting clip has a SHA-256 entry in `firearms-manifest.json`.

| Bundled clips | Original recording | Recorded firearm |
| --- | --- | --- |
| rifle-ak-0/1.wav | C_28P.wav | AK-47 |
| rifle-ar-0/1.wav | D_32P.wav | AR-15 |
| smg-0/1/2.wav | G_31P.wav | Carl Gustav M45 |
| sniper-0/1/2.wav | M_21P.wav | Mosin Nagant |
| pistol-0/1/2.wav | X_39P.wav | Walther PPQ |

Processing: independent shots cut from the source takes; stereo averaged to mono; 45 Hz DC/rumble high-pass; 63-tap Hann-windowed low-pass before 96-to-48 kHz decimation; 0.5 ms leading and 40 ms trailing fades; peak set to 0.82; saved as 48 kHz, 16-bit mono PCM. Start offsets, durations and hashes are recorded in the manifest. Clips are representative of weapon classes, not exact recordings of every weapon named in the game. AK-family weapons always use AK recordings; other unsuppressed assault rifles use AR-15 recordings. Suppressed rifle/pistol weapons use quieter, low-pass-filtered AR-15/PPQ recordings respectively; these are **not actual suppressor recordings**.

## Footsteps and impacts

**Impact Sounds 1.0** by **Kenney**, released under **CC0 1.0**.

- Primary publication and licence: https://kenney.nl/assets/impact-sounds
- Licence supplied with the downloaded archive: `KENNEY-CC0.txt`
- CC0 terms: https://creativecommons.org/publicdomain/zero/1.0/

The primary page and the archive's licence were checked on 2026-11-17. The bundled OGG files are unmodified selections 000–003 from `footstep_concrete`, `footstep_grass`, `footstep_wood`, `impactGeneric_light`, `impactMetal_heavy`, `impactWood_heavy` and `impactGlass_medium`.

Stone uses recorded concrete steps; grass uses recorded grass steps; earth uses the grass recording with a darker runtime filter. Metal flooring combines the recorded concrete sole contact with a quiet recorded metal impact. These two surfaces are Foley adaptations rather than separate earth/metal footstep recordings. Step gain normalisation and the metal mixture are calculated once during preparation.

## Runtime and fallback

41 files, approximately 1.19 MB total (13 PCM gunfire clips and 28 OGG Foley clips). Both banks load and decode during the loading screen, share an AudioContext cache and stop waiting after 5 seconds if a read or decoder hangs. Playback performs no fetches. Missing or unsupported recordings retain the procedural fallback. Bullet whizzes remain procedural. Gunfire/impact spatial channels are capped at 28; footsteps reuse 8 channels. A shared output soft limiter preserves unity gain below its knee and prevents overlapping volleys and footsteps from clipping.
