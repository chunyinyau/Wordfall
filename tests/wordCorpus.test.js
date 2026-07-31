import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createWordCorpus,
    normalizeWordEntry,
    parseWordCorpus,
    pickWord
} from '../src/wordCorpus.js';

test('normalizeWordEntry lowercases and trims', () => {
    assert.equal(normalizeWordEntry('  HeLLo  '), 'hello');
});

test('createWordCorpus deduplicates and buckets by length', () => {
    const corpus = createWordCorpus(['A', 'alpha', 'alphabetic', 'middle', 'middle']);

    assert.deepEqual(corpus.all, ['a', 'alpha', 'alphabetic', 'middle']);
    assert.ok(corpus.short.includes('a'));
    assert.ok(corpus.long.includes('alphabetic'));
    assert.ok(corpus.mixed.includes('middle'));
});

test('parseWordCorpus supports json and newline formats', () => {
    const fromArray = parseWordCorpus('["one", "two"]');
    const fromObject = parseWordCorpus('{"words": ["three", "four"]}');
    const fromLines = parseWordCorpus('five\nsix\n\nseven');

    assert.deepEqual(fromArray, ['one', 'two']);
    assert.deepEqual(fromObject, ['three', 'four']);
    assert.deepEqual(fromLines, ['five', 'six', 'seven']);
});

test('pickWord chooses from selected bucket and falls back to all', () => {
    const corpus = createWordCorpus(['tiny', 'medium', 'lengthyword']);
    const rngZero = () => 0;

    assert.equal(pickWord(corpus, 0, rngZero), 'tiny');
    assert.equal(pickWord(corpus, 1, rngZero), 'medium');
    assert.equal(pickWord(corpus, 2, rngZero), 'lengthyword');
});
