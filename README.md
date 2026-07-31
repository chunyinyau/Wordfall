# Wordfall

A falling-words typing game built with HTML canvas.

## Run

1. Open this folder in your editor.
2. Start a local static server in the project root.
3. Open [index.html](index.html) in your browser.

Using a local server is recommended so [data/words.json](data/words.json) can be fetched reliably.

## Test

Run the lightweight logic tests from the project root:

1. `node --test tests/*.test.js`

Or use the package script:

1. `npm test`

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

Settings are persisted in local storage.

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

## Refactor Notes

Recent refactor and optimization work includes:

- Character-bucket indexing for faster key-to-word lookup
- Lane occupancy indexing for cheaper spawn lane selection
- Text-width caching to reduce repeated canvas measure calls
- Consolidated round reset logic to reduce duplicated state-reset code
- Separated pure logic modules to make balancing and testing safer

## Balance Tuning

Core difficulty tuning values live in [src/config.js](src/config.js) under `BALANCE`, plus setting multipliers:

- `SPAWN_RATE_MULTIPLIERS`
- `FALL_SPEED_MULTIPLIERS`
- `BALANCE.spawn`
- `BALANCE.fall`
