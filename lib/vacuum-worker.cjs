// Worker thread that runs SQLite VACUUM off the main event loop.
// Spawned by database.js — receives dbPath via workerData, posts result back.
const { workerData, parentPort } = require('worker_threads');
try {
    const Database = require('better-sqlite3');
    const db = new Database(workerData.dbPath);
    db.pragma('journal_mode = WAL');
    db.exec('PRAGMA wal_checkpoint(PASSIVE)');
    db.exec('VACUUM');
    db.close();
    parentPort.postMessage({ ok: true });
} catch (e) {
    parentPort.postMessage({ ok: false, err: e.message });
}
