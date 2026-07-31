# Wordfall

A falling-words typing game.

## Run

1. Open this folder in your editor.
2. Start a local static server in the project root.
3. Open [index.html](index.html) in your browser.

## Controls

- Type start on the title screen to begin.
- Type retry after game over to restart.
- Press Escape briefly to open settings.
- Hold Escape for one second to reset back to the title screen.

## Settings

- Spawn rate: slow, normal, fast
- Fall speed: slow, normal, fast
- Word length: short, mixed, long
- Targeting: lowest, first typed

## Project Structure

- [index.html](index.html): app shell and asset loading
- [style.css](style.css): canvas layout and responsive sizing
- [game.js](game.js): minimal browser entrypoint
- [src/main.js](src/main.js): canvas runtime, rendering, input, and loop orchestration
- [src/config.js](src/config.js): constants and balance tuning values
- [src/difficulty.js](src/difficulty.js): spawn/fall progression logic
- [src/settings.js](src/settings.js): settings persistence and option cycling
- [src/metrics.js](src/metrics.js): WPM, accuracy, and time formatting helpers
- [src/wordCorpus.js](src/wordCorpus.js): corpus normalization, parsing, and word selection
- [tests/difficulty.test.js](tests/difficulty.test.js): progression and pacing tests
- [tests/metrics.test.js](tests/metrics.test.js): HUD metric tests
- [tests/wordCorpus.test.js](tests/wordCorpus.test.js): corpus parser and bucketing tests
- [data/words.json](data/words.json): source word corpus

## Balance Tuning

Core difficulty tuning values live in [src/config.js](src/config.js) under `BALANCE`, plus setting multipliers:

- `SPAWN_RATE_MULTIPLIERS`
- `FALL_SPEED_MULTIPLIERS`
- `BALANCE.spawn`
- `BALANCE.fall`
