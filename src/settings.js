import {
    DEFAULT_SETTINGS,
    SETTINGS_KEY,
    SETTINGS_OPTIONS
} from './config.js';

export function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

export function saveSettings(settings) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        // Ignore storage failures and keep the game playable.
    }
}

export function cycleSetting(settings, definitionKey, delta) {
    const options = SETTINGS_OPTIONS[definitionKey];
    settings[definitionKey] = (settings[definitionKey] + delta + options.length) % options.length;
}

export function getSetting(settings, definitionKey) {
    return SETTINGS_OPTIONS[definitionKey][settings[definitionKey]];
}
