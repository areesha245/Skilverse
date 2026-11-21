// storage.js - the ONLY module that touches localStorage and JSON files (Data Tier)
export function read(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
  catch (e) { return fallback; }
}
export function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

export function getDailyUsage(userId) { /* TODO */ }
export function updateUsage(userId) { /* TODO */ }
export function saveSession(session) { /* TODO */ }
export async function loadQuestions(role, level) { /* TODO: fetch('data/questions.json') */ }
