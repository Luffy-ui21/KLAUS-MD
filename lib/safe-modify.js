let regularSynced = false;
let syncAttempts = 0;
const MAX_SYNC_ATTEMPTS = 3;

async function ensureRegularSync(sock) {
  if (regularSynced || syncAttempts >= MAX_SYNC_ATTEMPTS) return regularSynced;
  syncAttempts++;

  try {
    await sock.resyncAppState(['regular_low'], true);
    await new Promise(r => setTimeout(r, 2000));
    regularSynced = true;
    return true;
  } catch (e1) {
    try {
      await sock.resyncAppState(['critical_block', 'critical_unblock_to_single'], true);
      await new Promise(r => setTimeout(r, 1500));
      await sock.resyncAppState(['regular_low'], true);
      await new Promise(r => setTimeout(r, 2000));
      regularSynced = true;
      return true;
    } catch {
      return false;
    }
  }
}

export async function safeModify(sock, mod, jid) {
  await ensureRegularSync(sock);

  try {
    return await sock.chatModify(mod, jid);
  } catch (e) {
    const errMsg = (e.message || '').toLowerCase();
    const isKeyError = errMsg.includes('app state key') || errMsg.includes('could not find') || errMsg.includes('bad-request') || errMsg.includes('lthashmismatch');

    if (!isKeyError) throw e;

    regularSynced = false;
    syncAttempts = Math.max(0, syncAttempts - 1);
    const synced = await ensureRegularSync(sock);

    if (synced) {
      try {
        return await sock.chatModify(mod, jid);
      } catch (e2) {
        throw new Error('App state sync incomplete — try again after reconnecting the bot. If this persists, clear the session and re-pair.');
      }
    }

    throw new Error('App state sync not available — reconnect the bot or clear the session and re-pair to enable this feature.');
  }
}

export function resetAppStateSync() {
  regularSynced = false;
  syncAttempts = 0;
}
