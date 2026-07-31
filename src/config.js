export const FONT_FAMILY = "'Inter', sans-serif";
export const WORD_FONT_SIZE = 28;
export const HUD_FONT_SIZE = 16;

export const ESC_RESET_HOLD_MS = 1000;
export const WORD_CORPUS_URL = 'data/words.json';
export const SETTINGS_KEY = 'wordfall-settings';

export const SETTINGS_OPTIONS = {
    spawnRate: ['slow', 'normal', 'fast'],
    fallSpeed: ['slow', 'normal', 'fast'],
    wordLength: ['short', 'mixed', 'long'],
    targeting: ['lowest', 'first typed']
};

export const SETTINGS_DEFS = [
    { key: 'spawnRate', label: 'spawn rate' },
    { key: 'fallSpeed', label: 'fall speed' },
    { key: 'wordLength', label: 'word length' },
    { key: 'targeting', label: 'targeting' }
];

export const DEFAULT_SETTINGS = {
    spawnRate: 1,
    fallSpeed: 1,
    wordLength: 1,
    targeting: 0
};

export const SPAWN_RATE_MULTIPLIERS = [1.24, 1, 0.8];
export const FALL_SPEED_MULTIPLIERS = [0.82, 1, 1.18];

export const BALANCE = {
    difficulty: {
        secondsToMax: 120,
        maxScaleGain: 0.72
    },
    spawn: {
        baseMs: 1640,
        minMs: 380,
        timePressurePerSec: 13,
        maxTimePressure: 620,
        scorePressurePerPoint: 0.62,
        maxScorePressure: 460
    },
    fall: {
        basePxPerSec: 28,
        scoreContributionPerPoint: 0.032,
        maxScoreContribution: 34,
        timeContributionPerSec: 0.62,
        maxTimeContribution: 22,
        jitterMax: 6
    }
};
