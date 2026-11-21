// admin.js - rubrics, badges, AI limits
import { saveSettings, getReports, getUserById } from './storage.js';
import { BADGES } from './gamification.js';

export const MIN_LIMIT = 1;
export const MAX_LIMIT = 100;

// Returns an error message, or '' when the limit is acceptable
export function validateLimit(value) {
  if (!Number.isInteger(value)) return 'Please enter a whole number.';
  if (value < MIN_LIMIT || value > MAX_LIMIT) return `The limit must be between ${MIN_LIMIT} and ${MAX_LIMIT}.`;
  return '';
}

export function updateDailyLimit(value) {
  const error = validateLimit(value);
  if (error) return { ok: false, error };
  saveSettings({ dailyLimit: value });
  return { ok: true, limit: value };
}

export function getBadgeList() { return BADGES.map(b => ({ name: b.name, description: b.description })); }

// Answers that students reported as wrong, newest first
export function getReportList() {
  return getReports().slice().reverse().map(report => {
    const student = getUserById(report.userId);
    return { student: student ? student.name : 'Unknown', concept: report.concept, score: report.score, date: report.date.slice(0, 10) };
  });
}
