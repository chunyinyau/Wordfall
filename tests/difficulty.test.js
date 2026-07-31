import test from 'node:test';
import assert from 'node:assert/strict';

import { computeFallSpeed, computeSpawnInterval, getDifficultyScale } from '../src/difficulty.js';

test('difficulty scale rises over time and is capped', () => {
    const start = getDifficultyScale(0);
    const mid = getDifficultyScale(60000);
    const end = getDifficultyScale(360000);

    assert.equal(start, 1);
    assert.ok(mid > start);
    assert.ok(end > mid);
    assert.ok(end <= 1.72);
});

test('spawn interval respects pacing and minimum clamp', () => {
    const earlySlow = computeSpawnInterval(0, 0, 0);
    const earlyFast = computeSpawnInterval(0, 0, 2);
    const lateFast = computeSpawnInterval(240000, 1000, 2);

    assert.ok(earlySlow > earlyFast);
    assert.ok(lateFast <= earlyFast);
    assert.ok(lateFast >= 380);
});

test('fall speed scales with score, time, and setting', () => {
    const baseline = computeFallSpeed(0, 0, 1);
    const highTime = computeFallSpeed(120000, 0, 1);
    const highScore = computeFallSpeed(120000, 500, 1);
    const highSetting = computeFallSpeed(120000, 500, 2);

    assert.ok(highTime > baseline);
    assert.ok(highScore >= highTime);
    assert.ok(highSetting > highScore);
});
