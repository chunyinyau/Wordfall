import test from 'node:test';
import assert from 'node:assert/strict';

import { formatTime, getAccuracy, getWpm } from '../src/metrics.js';

test('wpm handles zero elapsed and normal values', () => {
    assert.equal(getWpm(0, 0), 0);
    assert.equal(getWpm(30, 60000), 30);
    assert.equal(getWpm(45, 90000), 30);
});

test('accuracy handles zero keystrokes and rounds percentage', () => {
    assert.equal(getAccuracy(0, 0), 100);
    assert.equal(getAccuracy(9, 10), 90);
    assert.equal(getAccuracy(1, 3), 33);
});

test('formatTime returns mm:ss', () => {
    assert.equal(formatTime(0), '00:00');
    assert.equal(formatTime(59000), '00:59');
    assert.equal(formatTime(61000), '01:01');
});
