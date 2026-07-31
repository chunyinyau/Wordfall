import {
    BALANCE,
    ESC_RESET_HOLD_MS,
    FONT_FAMILY,
    HUD_FONT_SIZE,
    SETTINGS_DEFS,
    WORD_CORPUS_URL,
    WORD_FONT_SIZE
} from './config.js';
import { computeFallSpeed, computeSpawnInterval } from './difficulty.js';
import { formatTime, getAccuracy, getWpm } from './metrics.js';
import { cycleSetting, getSetting, loadSettings, saveSettings } from './settings.js';
import { createWordCorpus, parseWordCorpus, pickWord } from './wordCorpus.js';

export function initGame() {
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
    let settings = loadSettings();
    let wordCorpus = createWordCorpus([]);

    const occupiedLanes = new Set();
    const nextCharBuckets = new Map();
    const widthCache = new Map();

    function setFont(size) {
        ctx.font = `${size}px ${FONT_FAMILY}`;
    }

    function getTextWidth(text, size = WORD_FONT_SIZE) {
        const key = `${size}:${text}`;
        if (widthCache.has(key)) return widthCache.get(key);
        setFont(size);
        const width = ctx.measureText(text).width;
        widthCache.set(key, width);
        return width;
    }

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

    function setGateWord(text) {
        gateWord = createPrompt(text);
    }

    function getWordLengthLabel() {
        return getSetting(settings, 'wordLength');
    }

    function measureLaneWidth() {
        let widest = 0;
        for (const word of wordCorpus.all) {
            widest = Math.max(widest, getTextWidth(word));
        }
        laneWidth = Math.max(140, Math.ceil(widest + 32));
    }

    function getLaneCount() {
        return Math.max(2, Math.floor(canvas.width / laneWidth));
    }

    function isLaneOccupied(laneIndex) {
        return occupiedLanes.has(laneIndex);
    }

    function chooseLaneForWord() {
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

    function clearLiveIndexes() {
        occupiedLanes.clear();
        nextCharBuckets.clear();
    }

    function addToNextCharBucket(word) {
        const char = word.text[word.typedIndex];
        if (!char) return;
        let bucket = nextCharBuckets.get(char);
        if (!bucket) {
            bucket = new Set();
            nextCharBuckets.set(char, bucket);
        }
        bucket.add(word);
    }

    function removeFromNextCharBucket(word) {
        const char = word.text[word.typedIndex];
        if (!char) return;
        const bucket = nextCharBuckets.get(char);
        if (!bucket) return;
        bucket.delete(word);
        if (bucket.size === 0) {
            nextCharBuckets.delete(char);
        }
    }

    function registerLiveWord(word) {
        occupiedLanes.add(word.lane);
        addToNextCharBucket(word);
    }

    function unregisterLiveWord(word) {
        occupiedLanes.delete(word.lane);
        removeFromNextCharBucket(word);
    }

    function resetRound({ running }) {
        words = [];
        clearLiveIndexes();
        isRunning = running;
        isGameOver = false;
        spawnTimer = 0;
        score = 0;
        wordsTyped = 0;
        elapsedMs = 0;
        totalKeystrokes = 0;
        correctKeystrokes = 0;
        activeWord = null;
        spawnInterval = computeSpawnInterval(elapsedMs, score, settings.spawnRate);
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
            throw new Error('unable to load data/words.json');
        }
    }

    function startGame() {
        resetRound({ running: true });
        setGateWord('start');
        lastTime = performance.now();
    }

    function abortToStart() {
        resetRound({ running: false });
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
        setFont(11);
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
        const text = pickWord(wordCorpus, settings.wordLength);
        const textWidth = getTextWidth(text);
        const lane = chooseLaneForWord();
        if (lane < 0) return false;

        const x = laneX(lane, textWidth);
        const y = -20;
        const baseSpeed = computeFallSpeed(elapsedMs, score, settings.fallSpeed);
        const word = {
            text,
            width: textWidth,
            x,
            y,
            speed: baseSpeed + Math.random() * BALANCE.fall.jitterMax,
            typedIndex: 0,
            flash: 0,
            lane
        };

        words.push(word);
        registerLiveWord(word);
        return true;
    }

    function updateWords(dt) {
        for (const word of words) {
            word.y += word.speed * dt / 1000;
            if (word.flash > 0) {
                word.flash = Math.max(0, word.flash - dt);
            }
        }
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

        setFont(WORD_FONT_SIZE);
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';

        if (hint) {
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            setFont(16);
            const hintWidth = ctx.measureText(hint).width;
            ctx.fillText(hint, (canvas.width - hintWidth) / 2, centerY - 36);
            setFont(WORD_FONT_SIZE);
        }

        const promptWidth = getTextWidth(prompt.text);
        const x = (canvas.width - promptWidth) / 2;

        if (prompt.flash > 0) {
            ctx.fillStyle = `rgba(255,107,107,${Math.min(0.5, prompt.flash / 300)})`;
            ctx.fillRect(x - 6, centerY - 6, promptWidth + 12, 34);
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
        setFont(WORD_FONT_SIZE);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('settings', x + 20, y + 16);

        ctx.fillStyle = 'rgba(154,160,166,0.95)';
        setFont(15);
        ctx.fillText('up/down move   left/right or enter change   esc close', x + 20, y + 48);

        SETTINGS_DEFS.forEach((definition, index) => {
            const rowY = y + 76 + index * 42;
            if (index === settingsIndex) {
                ctx.fillStyle = 'rgba(0,240,192,0.12)';
                ctx.fillRect(x + 12, rowY - 6, panelWidth - 24, 34);
            }
            ctx.fillStyle = '#fff';
            setFont(18);
            ctx.fillText(definition.label, x + 20, rowY);
            ctx.fillStyle = index === settingsIndex ? 'rgba(0,240,192,0.95)' : 'rgba(154,160,166,0.95)';
            ctx.textAlign = 'right';
            ctx.fillText(getSetting(settings, definition.key), x + panelWidth - 20, rowY);
            ctx.textAlign = 'left';
        });

        ctx.textAlign = 'left';
    }

    function draw() {
        ctx.fillStyle = '#0b0d0f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!isGameOver) {
            ctx.textBaseline = 'top';
            setFont(WORD_FONT_SIZE);
            for (const word of words) {
                drawSegmentedWord(word, word.x, Math.round(word.y));

                if (word.flash > 0) {
                    ctx.fillStyle = `rgba(255,107,107,${Math.min(0.6, word.flash / 200)})`;
                    ctx.fillRect(word.x - 6, Math.round(word.y) - 4, word.width + 12, 34);
                    ctx.fillStyle = '#fff';
                    ctx.fillText(word.text, word.x, Math.round(word.y));
                }
            }

            ctx.beginPath();
            ctx.moveTo(0, dangerLineY);
            ctx.lineTo(canvas.width, dangerLineY);
            ctx.strokeStyle = 'rgba(255,107,107,0.6)';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.save();
            ctx.fillStyle = 'rgba(154,160,166,0.95)';
            setFont(HUD_FONT_SIZE);
            ctx.textAlign = 'center';

            const bottomHud =
                `score ${score}   time ${formatTime(elapsedMs)}   wpm ${getWpm(wordsTyped, elapsedMs)}   ` +
                `accuracy ${getAccuracy(correctKeystrokes, totalKeystrokes)}%   ${getWordLengthLabel()}`;
            ctx.fillText(bottomHud, canvas.width / 2, dangerLineY + 14);
            ctx.restore();
        }

        if (!isRunning && !isGameOver) {
            drawPrompt(gateWord, canvas.height / 2, 'type start to begin');
            ctx.save();
            ctx.fillStyle = 'rgba(154,160,166,0.95)';
            setFont(14);
            ctx.textAlign = 'center';
            ctx.fillText('press esc for settings', canvas.width / 2, canvas.height / 2 + 46);
            ctx.restore();
        }

        if (isGameOver) {
            ctx.save();
            ctx.globalAlpha = 0.22;
            ctx.textBaseline = 'top';
            setFont(WORD_FONT_SIZE);
            for (const word of words) {
                drawSegmentedWord(word, word.x, Math.round(word.y));
            }
            ctx.restore();

            ctx.fillStyle = 'rgba(0,0,0,0.42)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            setFont(40);
            const msg = 'game over';
            const msgWidth = ctx.measureText(msg).width;
            ctx.fillText(msg, (canvas.width - msgWidth) / 2, (canvas.height / 2) - 40);

            setFont(20);
            const sub =
                `score ${score}   time ${formatTime(elapsedMs)}   wpm ${getWpm(wordsTyped, elapsedMs)}   ` +
                `accuracy ${getAccuracy(correctKeystrokes, totalKeystrokes)}%`;
            const subWidth = ctx.measureText(sub).width;
            ctx.fillText(sub, (canvas.width - subWidth) / 2, (canvas.height / 2) + 6);

            drawPrompt(gateWord, canvas.height / 2 + 76, 'type retry to play again');
            setFont(14);
            const settingsHint = 'press esc for settings';
            const hintWidth = ctx.measureText(settingsHint).width;
            ctx.fillStyle = 'rgba(154,160,166,0.95)';
            ctx.fillText(settingsHint, (canvas.width - hintWidth) / 2, (canvas.height / 2) + 118);
        }

        if (settingsOpen) {
            drawSettingsPanel();
        }

        drawEscHoldIndicator();
    }

    function checkGameOver() {
        for (const word of words) {
            if (word.y + 24 > dangerLineY) {
                endGame();
                return;
            }
        }
    }

    function removeWord(target) {
        unregisterLiveWord(target);
        const index = words.indexOf(target);
        if (index >= 0) {
            words.splice(index, 1);
        }
        if (activeWord === target) {
            activeWord = null;
        }
    }

    function advanceWordTypedIndex(word) {
        removeFromNextCharBucket(word);
        word.typedIndex += 1;
        addToNextCharBucket(word);
    }

    function handleStartPrompt(key) {
        if (!gateWord) return;

        const expected = gateWord.text[gateWord.typedIndex].toLowerCase();
        if (key === expected) {
            gateWord.typedIndex += 1;
            gateWord.flash = 0;
            if (gateWord.typedIndex >= gateWord.text.length) {
                startGame();
            }
            return;
        }

        gateWord.flash = 300;
        if (key === gateWord.text[0]) {
            gateWord.typedIndex = 1;
            gateWord.flash = 0;
        } else {
            gateWord.typedIndex = 0;
        }
    }

    function handleSettingsKey(event) {
        if (event.key === 'Escape') {
            settingsOpen = false;
            return;
        }
        if (event.key === 'ArrowUp') {
            settingsIndex = (settingsIndex - 1 + SETTINGS_DEFS.length) % SETTINGS_DEFS.length;
            event.preventDefault();
            return;
        }
        if (event.key === 'ArrowDown') {
            settingsIndex = (settingsIndex + 1) % SETTINGS_DEFS.length;
            event.preventDefault();
            return;
        }
        if (event.key === 'ArrowLeft') {
            cycleSetting(settings, SETTINGS_DEFS[settingsIndex].key, -1);
            saveSettings(settings);
            event.preventDefault();
            return;
        }
        if (event.key === 'ArrowRight' || event.key === 'Enter') {
            cycleSetting(settings, SETTINGS_DEFS[settingsIndex].key, 1);
            saveSettings(settings);
            event.preventDefault();
        }
    }

    function pickTargetWordForKey(key) {
        const candidates = nextCharBuckets.get(key);
        if (!candidates || candidates.size === 0) return null;

        if (settings.targeting === 0) {
            let nearest = null;
            for (const candidate of candidates) {
                if (!nearest || candidate.y > nearest.y) {
                    nearest = candidate;
                }
            }
            return nearest;
        }

        for (const candidate of candidates) {
            return candidate;
        }

        return null;
    }

    function handleKey(event) {
        if (event.key === 'Escape') {
            if (!escPressedAt) {
                escPressedAt = performance.now();
                escAbortTriggered = false;
            }
            event.preventDefault();
            return;
        }

        if (settingsOpen) {
            handleSettingsKey(event);
            return;
        }

        const key = event.key.length === 1 ? event.key.toLowerCase() : null;

        if (!isRunning || isGameOver) {
            if (!key) return;
            handleStartPrompt(key);
            return;
        }

        if (!key) return;
        totalKeystrokes += 1;

        if (!activeWord) {
            activeWord = pickTargetWordForKey(key);
            if (!activeWord) return;
        }

        const expected = activeWord.text[activeWord.typedIndex];
        if (key === expected) {
            correctKeystrokes += 1;
            advanceWordTypedIndex(activeWord);
            if (activeWord.typedIndex >= activeWord.text.length) {
                score += activeWord.text.length;
                wordsTyped += 1;
                removeWord(activeWord);
            }
            return;
        }

        activeWord.flash = 300;
    }

    function handleKeyUp(event) {
        if (event.key !== 'Escape') return;

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
        event.preventDefault();
    }

    function gameLoop(timestamp) {
        const dt = timestamp - lastTime;
        lastTime = timestamp;

        if (escPressedAt && !escAbortTriggered && (performance.now() - escPressedAt) >= ESC_RESET_HOLD_MS) {
            abortToStart();
        } else if (isRunning && !settingsOpen) {
            elapsedMs += dt;
            spawnTimer += dt;
            spawnInterval = computeSpawnInterval(elapsedMs, score, settings.spawnRate);

            if (spawnTimer > spawnInterval && spawnWord()) {
                spawnTimer = 0;
            }

            updateWords(dt);
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

    window.addEventListener('resize', resize);
    document.addEventListener('keydown', handleKey);
    document.addEventListener('keyup', handleKeyUp);

    resize();
    measureLaneWidth();

    if (document.fonts && document.fonts.load) {
        const corpusReady = loadWordCorpus();
        Promise.all([
            document.fonts.load(`28px ${FONT_FAMILY}`),
            document.fonts.ready,
            corpusReady
        ]).then(startLoopWhenFontsReady).catch(startLoopWhenFontsReady);
    } else {
        loadWordCorpus().then(startLoopWhenFontsReady).catch(startLoopWhenFontsReady);
    }
}
