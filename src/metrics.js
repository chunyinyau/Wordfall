export function getWpm(wordsTyped, elapsedMs) {
    if (elapsedMs <= 0) return 0;
    return Math.round(wordsTyped / (elapsedMs / 60000));
}

export function getAccuracy(correctKeystrokes, totalKeystrokes) {
    if (totalKeystrokes <= 0) return 100;
    return Math.round((correctKeystrokes / totalKeystrokes) * 100);
}

export function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
}
