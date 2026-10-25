# Supplied audio

These are the user's recordings, copied locally on 2026-10-25. Runtime never reads Downloads.

| Game file           | Supplied file                                     | Use                                                                                 |
| ------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| run_once.wav        | run_once.wav                                      | One intro per page load, gesture fallback when autoplay is blocked                  |
| home_screen_bgm.wav | home_screen_bgm.wav                               | Home, How to Play and lobby loop after intro; returns on draw/lobby                 |
| victory.mp3         | Pacific Rim (feat. Tom Morello)\_spotdown.org.mp3 | Winner-only result music, plays once                                                |
| defeat.mp3          | Heather_spotdown.org.mp3                          | Loser-only result music, plays once                                                 |
| gameplay_bg.mp3     | gameplay_bg.mp3                                   | One continuous loop across the full three-round match                               |
| boots.mp3           | boots.mpeg                                        | Individual recorded footstep impacts, processed differently for hunter/hider        |
| cat.mp3             | cat.mp3                                           | Nearby positional cat escape, once per round                                        |
| pistol.mp3          | pistol sound.mp3                                  | Regular revolver firing; own centered, opponent positional                          |
| special-shot.mp3    | spl_feature sound.mp3                             | Special gun firing only, not ability activation                                     |
| damage_received.wav | damage_received.m4a                               | Compatible PCM copy, loud on BOTH clients whenever the hider takes a hit |
| damage_received.m4a | damage_received.m4a                               | Preserved original recording                                                        |

`boots.mpeg` contains MPEG Layer III audio frames. It was renamed to `.mp3` without re-encoding; all ten original recordings retain their supplied bytes. Music streams through native media elements; small effects decode through Web Audio. MP3/WAV/M4A are served with their audio media types. The existing Sound slider controls both.

Bundled Chromium could not decode the supplied M4A through Web Audio. `damage_received.wav` is a derived 44.1 kHz, mono, 16-bit PCM playback copy (3.093 seconds); the original M4A is kept unchanged. Conversion used a temporary FFmpeg utility under ignored `test-results/audio-tools/`; it is not a runtime dependency.

Hider damage cues are broadcast once per authoritative hit to both players. Effect gain is 2.4 (previously 0.9), centered without distance attenuation and still governed by the Sound slider. The source file is unchanged.
