/**
 * JSON file-based session store — no external DB needed
 */
const fs = require('fs');
const path = require('path');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'sessions.json');

let sessions = [];
try { sessions = JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '[]'); } catch { sessions = []; }

function save() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(sessions, null, 2)); } catch (e) {}
}

const prisma = {
  botSession: {
    findUnique: async ({ where }) => {
      return sessions.find(s => s.phoneNumber === where.phoneNumber || s.id === where.id) || null;
    },
    findFirst: async ({ where }) => {
      if (!where) return sessions[0] || null;
      if (where.status) return sessions.find(s => s.status === where.status) || null;
      return sessions[0] || null;
    },
    findMany: async ({ where }) => {
      let r = [...sessions];
      if (where?.status) r = r.filter(s => s.status === where.status);
      return r;
    },
    create: async ({ data }) => {
      const s = {
        id: 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        messagesReceived: 0,
        messagesSent: 0,
        commandsExecuted: 0,
        ...data,
      };
      sessions.push(s);
      save();
      return s;
    },
    update: async ({ where, data }) => {
      const i = sessions.findIndex(s => s.phoneNumber === where.phoneNumber || s.id === where.id);
      if (i >= 0) {
        sessions[i] = { ...sessions[i], ...data, updatedAt: new Date().toISOString() };
        save();
        return sessions[i];
      }
      return null;
    },
    count: async () => sessions.length,
  },
};

async function ensureDB() {
  console.log('[DB] JSON store ready:', sessions.length, 'sessions');
}

module.exports = { prisma, ensureDB };
