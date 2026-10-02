import axios from 'axios';
import { mcowDownloadAudio } from './giftedApi.js';
import { sigLog } from './sigLog.js';

// ── Only mcow is active. Other providers are disabled. ───────────────────────

// ── Main export ───────────────────────────────────────────────────────────────
export async function downloadAudioWithFallback(ytUrl) {
    sigLog('🔁', 'audioDownloader', 'Trying mcow (gifted)…');
    try {
        const buf = await mcowDownloadAudio(ytUrl);
        if (!buf) throw new Error('mcow returned null');
        sigLog('✅', 'audioDownloader', 'mcow succeeded', {
            Size: `${(buf.length / 1024 / 1024).toFixed(1)}MB`,
        });
        return buf;
    } catch (e) {
        sigLog('❌', 'audioDownloader', 'mcow failed', { Error: e.message }, 'red');
        return null;
    }
}
