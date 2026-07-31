export function normalizeWordEntry(word) {
    return String(word).trim().toLowerCase();
}

export function createWordCorpus(sourceWords) {
    const all = [];
    const short = [];
    const mixed = [];
    const long = [];
    const seen = new Set();

    for (const rawWord of sourceWords) {
        const word = normalizeWordEntry(rawWord);
        if (!word || seen.has(word)) continue;
        seen.add(word);
        all.push(word);

        if (word.length <= 5) {
            short.push(word);
        } else if (word.length >= 9) {
            long.push(word);
        } else {
            mixed.push(word);
        }
    }

    return { all, short, mixed, long };
}

export function parseWordCorpus(rawText) {
    const text = String(rawText).trim();
    if (!text) return [];

    if (text.startsWith('{') || text.startsWith('[')) {
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) return parsed;
            if (Array.isArray(parsed.words)) return parsed.words;

            if (parsed && typeof parsed === 'object') {
                const groups = parsed.groups && typeof parsed.groups === 'object' ? parsed.groups : null;
                if (groups) {
                    return Object.values(groups).flatMap(group => Array.isArray(group) ? group : []);
                }
            }
        } catch {
            // Fallback to line-based parsing.
        }
    }

    return text
        .split(/\r?\n+/)
        .map(line => line.trim())
        .filter(Boolean);
}

export function pickWord(corpus, wordLengthIndex, rng = Math.random) {
    const bucketName = ['short', 'mixed', 'long'][wordLengthIndex] ?? 'mixed';
    const bucket = corpus[bucketName] ?? [];
    const source = bucket.length > 0 ? bucket : corpus.all;
    return source[Math.floor(rng() * source.length)];
}
