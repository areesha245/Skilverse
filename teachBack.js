// teachBack.js - Teach-Back Arena zone
import { getCurrentUser } from './auth.js';
import { requestFeedback } from './aiManager.js';
import { saveSession } from './storage.js';
import { awardXP, recordStat } from './gamification.js';

export const MIN_WORDS = 10;
export const MAX_CHARS = 2000;

// Returns an error message, or '' when the explanation is acceptable
export function validateExplanation(text) {
  const trimmed = text.trim();
  if (!trimmed) return 'Please write your explanation first.';
  if (trimmed.split(/\s+/).length < MIN_WORDS) return `Please write at least ${MIN_WORDS} words.`;
  if (trimmed.length > MAX_CHARS) return `Please keep it under ${MAX_CHARS} characters.`;
  return '';
}

export function submitExplanation(concept, text) {
  const user = getCurrentUser();
  if (!user) return { ok: false, error: 'Please log in again.' };
  const error = validateExplanation(text);
  if (error) return { ok: false, error };

  const feedback = requestFeedback(user.id, concept, text);
  if (!feedback.ok) return feedback;

  saveSession({
    userId: user.id, zone: 'teachBack', score: feedback.score,
    title: `Teach-Back: ${concept.name}`, result: `Score ${feedback.score}%`,
    date: new Date().toLocaleDateString('en-GB')
  });

  const xpEarned = Math.max(10, Math.round(feedback.score / 2)); // 10 to 50 XP
  const xp = awardXP(user.id, xpEarned);
  const stat = recordStat(user.id, 'bestClarity', feedback.score, true);
  return { ...feedback, ok: true, xpEarned, leveledUp: xp.leveledUp, newBadges: [...xp.newBadges, ...stat.newBadges] };
}
