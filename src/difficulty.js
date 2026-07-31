import {
    BALANCE,
    FALL_SPEED_MULTIPLIERS,
    SPAWN_RATE_MULTIPLIERS
} from './config.js';

export function getDifficultyScale(elapsedMs, difficultyConfig = BALANCE.difficulty) {
    const elapsedSeconds = elapsedMs / 1000;
    const progression = Math.min(1, elapsedSeconds / difficultyConfig.secondsToMax);
    return 1 + progression * difficultyConfig.maxScaleGain;
}

export function computeSpawnInterval(elapsedMs, score, spawnRateIndex, balance = BALANCE) {
    const elapsedSeconds = elapsedMs / 1000;
    const difficultyScale = getDifficultyScale(elapsedMs, balance.difficulty);
    const timePressure = Math.min(balance.spawn.maxTimePressure, elapsedSeconds * balance.spawn.timePressurePerSec);
    const scorePressure = Math.min(balance.spawn.maxScorePressure, score * balance.spawn.scorePressurePerPoint);
    const baseMs = Math.round((balance.spawn.baseMs - timePressure - scorePressure) / difficultyScale);
    const withSetting = baseMs * SPAWN_RATE_MULTIPLIERS[spawnRateIndex];
    return Math.max(balance.spawn.minMs, Math.round(withSetting));
}

export function computeFallSpeed(elapsedMs, score, fallSpeedIndex, balance = BALANCE) {
    const elapsedSeconds = elapsedMs / 1000;
    const difficultyScale = getDifficultyScale(elapsedMs, balance.difficulty);
    const scoreContribution = Math.min(
        balance.fall.maxScoreContribution,
        score * balance.fall.scoreContributionPerPoint
    );
    const timeContribution = Math.min(
        balance.fall.maxTimeContribution,
        elapsedSeconds * balance.fall.timeContributionPerSec
    );
    const base = balance.fall.basePxPerSec + scoreContribution + timeContribution;
    return base * difficultyScale * FALL_SPEED_MULTIPLIERS[fallSpeedIndex];
}
