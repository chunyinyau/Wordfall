const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let words = [];
let isRunning = false;
let isGameOver = false;
let spawnTimer = 0;
let spawnInterval = 2000;
let lastTime = 0;
let dangerLineY = 0;
let score = 0;
let wordsTyped = 0;
let elapsedMs = 0;
let activeWord = null;
let totalKeystrokes = 0;
let correctKeystrokes = 0;
let gateWord = createPrompt('start');
let settingsOpen = false;
let settingsIndex = 0;
let laneWidth = 140;
let loopStarted = false;
let escPressedAt = 0;
let escAbortTriggered = false;
const ESC_RESET_HOLD_MS = 1000;
const SETTINGS_KEY = 'wordfall-settings';
const SETTINGS_OPTIONS = {
    spawnRate: ['slow', 'normal', 'fast'],
    fallSpeed: ['slow', 'normal', 'fast'],
    wordLength: ['short', 'mixed', 'long'],
    targeting: ['lowest', 'first typed']
};
const SETTINGS_DEFS = [
    { key: 'spawnRate', label: 'spawn rate' },
    { key: 'fallSpeed', label: 'fall speed' },
    { key: 'wordLength', label: 'word length' },
    { key: 'targeting', label: 'targeting' }
];
const DEFAULT_SETTINGS = {
    spawnRate: 1,
    fallSpeed: 1,
    wordLength: 1,
    targeting: 0
};
let settings = loadSettings();

const WORD_CORPUS_URL = 'data/words.json';
const FALLBACK_WORDS = [
    'keyboard', 'javascript', 'typing', 'monkey', 'falling', 'danger', 'speed', 'focus', 'random', 'canvas',
    'developer', 'coffee', 'function', 'variable', 'object', 'array', 'string', 'window', 'document'
];
let wordCorpus = createWordCorpus(FALLBACK_WORDS);

function resize() {
    const width = Math.min(window.innerWidth - 48, 960);
    canvas.width = Math.max(320, width);
    canvas.height = window.innerHeight;
    dangerLineY = canvas.height - Math.round(canvas.height * 0.12);
    measureLaneWidth();
}

function createPrompt(text) {
    return {
        text,
        typedIndex: 0,
        flash: 0
    };
}

function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings() {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        // ignore storage failures
    }
}

function setGateWord(text) {
    gateWord = createPrompt(text);
}

function getSetting(definitionKey) {
    return SETTINGS_OPTIONS[definitionKey][settings[definitionKey]];
}

function cycleSetting(definitionKey, delta) {
    const options = SETTINGS_OPTIONS[definitionKey];
    settings[definitionKey] = (settings[definitionKey] + delta + options.length) % options.length;
    saveSettings();
}

function getSpawnRateMultiplier() {
    return [1.25, 1, 0.82][settings.spawnRate];
}

function getFallSpeedMultiplier() {
    return [0.86, 1, 1.12][settings.fallSpeed];
}

function getWordLengthLabel() {
    return getSetting('wordLength');
}

function normalizeWordEntry(word) {
    return String(word).trim().toLowerCase();
}

function createWordCorpus(sourceWords) {
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

function parseWordCorpus(rawText) {
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
            // fall through to line-based parsing
        }
    }

    return text.split(/\r?\n+/).map(line => line.trim()).filter(Boolean);
}

async function loadWordCorpus() {
    try {
        const response = await fetch(WORD_CORPUS_URL, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`failed to load corpus: ${response.status}`);
        const loadedWords = parseWordCorpus(await response.text());
        const loadedCorpus = createWordCorpus(loadedWords);
        if (loadedCorpus.all.length > 0) {
            wordCorpus = loadedCorpus;
            measureLaneWidth();
        }
    } catch {
        // keep the fallback corpus when the file cannot be loaded locally
    }
}

function pickWord() {
    const bucketName = ['short', 'mixed', 'long'][settings.wordLength] ?? 'mixed';
    const bucket = wordCorpus[bucketName] ?? [];
    const source = bucket.length > 0 ? bucket : wordCorpus.all;
    return source[Math.floor(Math.random() * source.length)];
}

function measureLaneWidth() {
    ctx.font = "28px 'Inter', sans-serif";
    let widest = 0;
    for (const word of wordCorpus.all) {
        widest = Math.max(widest, ctx.measureText(word).width);
    }
    laneWidth = Math.max(140, Math.ceil(widest + 32));
}

function getLaneCount() {
    return Math.max(2, Math.floor(canvas.width / laneWidth));
}

function getWordBounds(word) {
    ctx.font = "28px 'Inter', sans-serif";
    return {
        left: word.x - 8,
        right: word.x + ctx.measureText(word.text).width + 8,
        top: word.y - 4,
        bottom: word.y + 34
    };
}

function isLaneOccupied(laneIndex) {
    return words.some(word => word.lane === laneIndex);
}

function chooseLaneForWord(text) {
    const laneCount = getLaneCount();
    const available = [];
    for (let lane = 0; lane < laneCount; lane++) {
        if (!isLaneOccupied(lane)) available.push(lane);
    }
    if (available.length === 0) return -1;
    return available[Math.floor(Math.random() * available.length)];
}

function laneX(laneIndex, textWidth) {
    const start = laneIndex * laneWidth;
    const centered = start + (laneWidth - textWidth) / 2;
    const maxX = (laneIndex + 1) * laneWidth - textWidth - 8;
    return Math.max(start + 8, Math.min(centered, maxX));
}

function computeSpawnInterval() {
    const timePressure = Math.min(820, elapsedMs / 1000 * 1.8);
    const scorePressure = Math.min(520, score * 0.7);
    return Math.max(620, Math.round((1550 - timePressure - scorePressure) * getSpawnRateMultiplier()));
}

function computeFallSpeed() {
    const base = 32 + Math.min(34, score * 0.03) + Math.min(22, elapsedMs / 1000 * 0.02);
    return base * getFallSpeedMultiplier();
}

window.addEventListener('resize', resize);
resize();
measureLaneWidth();

function startGame() {
    words = [];
    isRunning = true;
    isGameOver = false;
    spawnInterval = computeSpawnInterval();
    spawnTimer = 0;
    score = 0;
    wordsTyped = 0;
    elapsedMs = 0;
    totalKeystrokes = 0;
    correctKeystrokes = 0;
    activeWord = null;
    setGateWord('start');
    lastTime = performance.now();
}

function abortToStart() {
    words = [];
    isRunning = false;
    isGameOver = false;
    spawnTimer = 0;
    score = 0;
    wordsTyped = 0;
    elapsedMs = 0;
    totalKeystrokes = 0;
    correctKeystrokes = 0;
    activeWord = null;
    settingsOpen = false;
    setGateWord('start');
    escAbortTriggered = true;
    escPressedAt = 0;
    lastTime = performance.now();
}

function getEscHoldProgress(now = performance.now()) {
    if (!escPressedAt) return 0;
    return Math.min(1, (now - escPressedAt) / ESC_RESET_HOLD_MS);
}

function drawEscHoldIndicator() {
    if (!escPressedAt) return;

    const progress = getEscHoldProgress();
    const radius = 26;
    const centerX = canvas.width - 44;
    const centerY = canvas.height - 44;

    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0,240,192,0.95)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();

    ctx.fillStyle = 'rgba(11,13,15,0.9)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = '11px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('esc', centerX, centerY - 4);
    ctx.fillStyle = 'rgba(154,160,166,0.95)';
    ctx.fillText('reset', centerX, centerY + 8);
    ctx.restore();
}

function endGame() {
    isRunning = false;
    isGameOver = true;
    activeWord = null;
    setGateWord('retry');
}

function spawnWord() {
    const text = pickWord();
    ctx.font = "28px 'Inter', sans-serif";
    const textWidth = ctx.measureText(text).width;
    const lane = chooseLaneForWord(text);
    if (lane < 0) return false;
    const x = laneX(lane, textWidth);
    const y = -20;
    const baseSpeed = computeFallSpeed(); // pixels per second
    words.push({ text, x, y, speed: baseSpeed + Math.random() * 6, typedIndex: 0, flash: 0, lane });
    return true;
}

function updateWords(dt) {
    for (const w of words) {
        w.y += w.speed * dt / 1000;
        if (w.flash > 0) w.flash = Math.max(0, w.flash - dt);
    }
    // remove any completed words flagged by typedIndex === text.length elsewhere
}

function draw() {
    // background
    ctx.fillStyle = '#0b0d0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!isGameOver) {
        // words
        ctx.textBaseline = 'top';
        ctx.font = "28px 'Inter', sans-serif";
        for (const w of words) {
            drawSegmentedWord(w, w.x, Math.round(w.y));

            if (w.flash > 0) {
                ctx.fillStyle = `rgba(255,107,107,${Math.min(0.6, w.flash / 200)})`;
                ctx.fillRect(w.x - 6, Math.round(w.y) - 4, ctx.measureText(w.text).width + 12, 34);
                ctx.fillStyle = '#fff';
                ctx.fillText(w.text, w.x, Math.round(w.y));
            }
        }

        // danger line
        ctx.beginPath();
        ctx.moveTo(0, dangerLineY);
        ctx.lineTo(canvas.width, dangerLineY);
        ctx.strokeStyle = 'rgba(255,107,107,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // bottom hud
        ctx.save();
        ctx.fillStyle = 'rgba(154,160,166,0.95)';
        ctx.font = '16px "Inter", sans-serif';
        ctx.textAlign = 'center';
        const bottomHud = `score ${score}   time ${formatTime(elapsedMs)}   wpm ${getWpm()}   accuracy ${getAccuracy()}%   ${getWordLengthLabel()}`;
        ctx.fillText(bottomHud, canvas.width / 2, dangerLineY + 14);
        ctx.restore();
    }

    if (!isRunning && !isGameOver) {
        drawPrompt(gateWord, canvas.height / 2, 'type start to begin');
        ctx.save();
        ctx.fillStyle = 'rgba(154,160,166,0.95)';
        ctx.font = '14px "Inter", sans-serif';
        ctx.textAlign = 'center';
        const settingsHint = 'press esc for settings';
        ctx.fillText(settingsHint, canvas.width / 2, canvas.height / 2 + 46);
        ctx.restore();
    }

    if (isGameOver) {
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.textBaseline = 'top';
        ctx.font = "28px 'Inter', sans-serif";
        for (const w of words) {
            drawSegmentedWord(w, w.x, Math.round(w.y));
        }
        ctx.restore();

        ctx.fillStyle = 'rgba(0,0,0,0.42)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = '40px "Inter", sans-serif';
        const msg = 'game over';
        const w = ctx.measureText(msg).width;
        ctx.fillText(msg, (canvas.width - w) / 2, (canvas.height / 2) - 40);
        ctx.font = '20px "Inter", sans-serif';
        const sub = `score ${score}   time ${formatTime(elapsedMs)}   wpm ${getWpm()}   accuracy ${getAccuracy()}%`;
        const sw = ctx.measureText(sub).width;
        ctx.fillText(sub, (canvas.width - sw) / 2, (canvas.height / 2) + 6);
        drawPrompt(gateWord, canvas.height / 2 + 76, 'type retry to play again');
        ctx.font = '14px "Inter", sans-serif';
        const settingsHint = 'press esc for settings';
        const sh = ctx.measureText(settingsHint).width;
        ctx.fillStyle = 'rgba(154,160,166,0.95)';
        ctx.fillText(settingsHint, (canvas.width - sh) / 2, (canvas.height / 2) + 118);
    }

    if (settingsOpen) {
        drawSettingsPanel();
    }

    drawEscHoldIndicator();
}

function drawSegmentedWord(word, x, y) {
    const before = word.text.slice(0, word.typedIndex);
    const current = word.text[word.typedIndex] ?? '';
    const after = word.text.slice(word.typedIndex + 1);

    let offsetX = x;
    if (before.length > 0) {
        ctx.fillStyle = 'rgba(0,240,192,0.95)';
        ctx.fillText(before, offsetX, y);
        offsetX += ctx.measureText(before).width;
    }

    if (current) {
        ctx.fillStyle = '#ffffff';
        ctx.fillText(current, offsetX, y);
        offsetX += ctx.measureText(current).width;
    }

    if (after.length > 0) {
        ctx.fillStyle = 'rgba(138,146,151,0.9)';
        ctx.fillText(after, offsetX, y);
    }
}

function drawPrompt(prompt, centerY, hint) {
    if (!prompt) return;
    ctx.font = '28px "Inter", sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    if (hint) {
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = '16px "Inter", sans-serif';
        const hintWidth = ctx.measureText(hint).width;
        ctx.fillText(hint, (canvas.width - hintWidth) / 2, centerY - 36);
        ctx.font = '28px "Inter", sans-serif';
    }

    let x = (canvas.width - ctx.measureText(prompt.text).width) / 2;
    if (prompt.flash > 0) {
        ctx.fillStyle = `rgba(255,107,107,${Math.min(0.5, prompt.flash / 300)})`;
        ctx.fillRect(x - 6, centerY - 6, ctx.measureText(prompt.text).width + 12, 34);
    }
    drawSegmentedWord(prompt, x, centerY - 2);
}

function drawSettingsPanel() {
    const panelWidth = Math.min(560, canvas.width - 48);
    const panelHeight = 64 + SETTINGS_DEFS.length * 42;
    const x = (canvas.width - panelWidth) / 2;
    const y = (canvas.height - panelHeight) / 2;

    ctx.fillStyle = 'rgba(11,13,15,0.96)';
    ctx.fillRect(x, y, panelWidth, panelHeight);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeRect(x, y, panelWidth, panelHeight);

    ctx.fillStyle = '#fff';
    ctx.font = '28px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('settings', x + 20, y + 16);

    ctx.fillStyle = 'rgba(154,160,166,0.95)';
    ctx.font = '15px "Inter", sans-serif';
    ctx.fillText('up/down move   left/right or enter change   esc close', x + 20, y + 48);

    SETTINGS_DEFS.forEach((definition, index) => {
        const rowY = y + 76 + index * 42;
        if (index === settingsIndex) {
            ctx.fillStyle = 'rgba(0,240,192,0.12)';
            ctx.fillRect(x + 12, rowY - 6, panelWidth - 24, 34);
        }
        ctx.fillStyle = '#fff';
        ctx.font = '18px "Inter", sans-serif';
        ctx.fillText(definition.label, x + 20, rowY);
        ctx.fillStyle = index === settingsIndex ? 'rgba(0,240,192,0.95)' : 'rgba(154,160,166,0.95)';
        ctx.textAlign = 'right';
        ctx.fillText(getSetting(definition.key), x + panelWidth - 20, rowY);
        ctx.textAlign = 'left';
    });

    ctx.textAlign = 'left';
}

function getWpm() {
    if (elapsedMs <= 0) return 0;
    return Math.round((wordsTyped / (elapsedMs / 60000)));
}

function getAccuracy() {
    if (totalKeystrokes <= 0) return 100;
    return Math.round((correctKeystrokes / totalKeystrokes) * 100);
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
}

function checkGameOver() {
    for (const w of words) {
        if (w.y + 24 > dangerLineY) {
            endGame();
            return;
        }
    }
}

function removeWord(target) {
    const i = words.indexOf(target);
    if (i >= 0) words.splice(i, 1);
}

function handleStartPrompt(k) {
    if (!gateWord) return;
    const expected = gateWord.text[gateWord.typedIndex].toLowerCase();
    if (k === expected) {
        gateWord.typedIndex += 1;
        gateWord.flash = 0;
        if (gateWord.typedIndex >= gateWord.text.length) {
            startGame();
        }
    } else {
        gateWord.flash = 300;
        if (k === gateWord.text[0]) {
            gateWord.typedIndex = 1;
            gateWord.flash = 0;
        } else {
            gateWord.typedIndex = 0;
        }
    }
}

function handleSettingsKey(e) {
    if (e.key === 'Escape') {
        settingsOpen = false;
        return;
    }
    if (e.key === 'ArrowUp') {
        settingsIndex = (settingsIndex - 1 + SETTINGS_DEFS.length) % SETTINGS_DEFS.length;
        e.preventDefault();
        return;
    }
    if (e.key === 'ArrowDown') {
        settingsIndex = (settingsIndex + 1) % SETTINGS_DEFS.length;
        e.preventDefault();
        return;
    }
    if (e.key === 'ArrowLeft') {
        cycleSetting(SETTINGS_DEFS[settingsIndex].key, -1);
        e.preventDefault();
        return;
    }
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
        cycleSetting(SETTINGS_DEFS[settingsIndex].key, 1);
        e.preventDefault();
    }
}

function handleKey(e) {
    if (e.key === 'Escape') {
        if (!escPressedAt) {
            escPressedAt = performance.now();
            escAbortTriggered = false;
        }
        e.preventDefault();
        return;
    }

    if (settingsOpen) {
        handleSettingsKey(e);
        return;
    }

    const k = e.key.length === 1 ? e.key.toLowerCase() : null;

    if (!isRunning || isGameOver) {
        if (!k) return;
        handleStartPrompt(k);
        return;
    }

    if (!k) return;
    totalKeystrokes += 1;

    // if no active word, choose one whose next char matches, prioritise closest to danger
    if (!activeWord) {
        const candidates = words.filter(w => w.text[w.typedIndex] === k);
        if (candidates.length === 0) return;
        if (settings.targeting === 0) {
            candidates.sort((a, b) => b.y - a.y);
            activeWord = candidates[0];
        } else {
            activeWord = candidates[0];
        }
    }

    if (activeWord) {
        const expected = activeWord.text[activeWord.typedIndex];
        if (k === expected) {
            correctKeystrokes += 1;
            activeWord.typedIndex++;
            if (activeWord.typedIndex >= activeWord.text.length) {
                score += activeWord.text.length;
                wordsTyped += 1;
                removeWord(activeWord);
                activeWord = null;
            }
        } else {
            // wrong key: small flash
            activeWord.flash = 300;
        }
    }
}

function handleKeyUp(e) {
    if (e.key !== 'Escape') return;

    const heldFor = escPressedAt ? performance.now() - escPressedAt : 0;
    if (heldFor >= ESC_RESET_HOLD_MS && !escAbortTriggered) {
        abortToStart();
    } else if (settingsOpen) {
        settingsOpen = false;
    } else if (heldFor < ESC_RESET_HOLD_MS && !escAbortTriggered) {
        settingsOpen = true;
        settingsIndex = 0;
    }

    escPressedAt = 0;
    escAbortTriggered = false;
    e.preventDefault();
}

document.addEventListener('keydown', handleKey);
document.addEventListener('keyup', handleKeyUp);

function gameLoop(ts) {
    const dt = ts - lastTime; lastTime = ts;
    if (escPressedAt && !escAbortTriggered && (performance.now() - escPressedAt) >= ESC_RESET_HOLD_MS) {
        abortToStart();
    } else if (isRunning && !settingsOpen) {
        elapsedMs += dt;
        spawnTimer += dt;
        spawnInterval = computeSpawnInterval();
        if (spawnTimer > spawnInterval) {
            if (spawnWord()) {
                spawnTimer = 0;
            }
        }
        updateWords(dt);
        // check completed words (in case typed elsewhere)
        for (let i = words.length - 1; i >= 0; i--) { if (words[i].typedIndex >= words[i].text.length) { removeWord(words[i]); } }
        checkGameOver();
    } else if (gateWord && gateWord.flash > 0) {
        gateWord.flash = Math.max(0, gateWord.flash - dt);
    }
    draw();
    requestAnimationFrame(gameLoop);
}

function startLoopWhenFontsReady() {
    if (loopStarted) return;
    loopStarted = true;
    measureLaneWidth();
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

if (document.fonts && document.fonts.load) {
    Promise.all([
        document.fonts.load('28px "Inter", sans-serif'),
        document.fonts.ready
    ]).then(startLoopWhenFontsReady).catch(startLoopWhenFontsReady);
} else {
    startLoopWhenFontsReady();
}

loadWordCorpus();
