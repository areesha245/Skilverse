// aiManager.js - SIMULATED AI: rubric-based scoring and follow-up questions, daily limit
import { getDailyUsage, updateUsage } from './storage.js';

export const DAILY_LIMIT = 25;

// Rubric: Accuracy 40 + Completeness 20 + Clarity 40 = 100
export function scoreExplanation(concept, text) {
  const lower = text.toLowerCase();
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim()).length;

  // Which key points of the concept did the student mention?
  const covered = [];
  const missing = [];
  concept.keyPoints.forEach(point => {
    const found = point.keywords.some(keyword => lower.includes(keyword));
    (found ? covered : missing).push(point);
  });
  const total = concept.keyPoints.length;

  const accuracy = Math.round(40 * covered.length / total);
  const completeness = Math.round(20 * Math.min(1, covered.length / (total * 0.75)));
  const usesExample = /for example|such as|for instance|like a|imagine/.test(lower);
  const clarity = Math.round(25 * Math.min(1, words / 50) + 10 * Math.min(1, sentences / 3) + (usesExample ? 5 : 0));

  // Follow-ups: weak (missing) points first, always 3 questions
  const followUps = [...missing, ...covered].map(point => point.followUp).slice(0, 3);
  return {
    score: accuracy + completeness + clarity,
    breakdown: { accuracy, completeness, clarity },
    gaps: missing.map(point => point.label),
    followUps
  };
}

// Checks the daily limit, scores the answer, then counts the request
export function requestFeedback(userId, concept, text) {
  if (getDailyUsage(userId) >= DAILY_LIMIT) {
    return { ok: false, limitReached: true, error: `Daily AI limit reached (${DAILY_LIMIT}). Please come back tomorrow.` };
  }
  const result = scoreExplanation(concept, text);
  updateUsage(userId);
  return { ok: true, ...result };
}

export function evaluateAnswer(question, answer) { /* TODO (Interview Room) */ }
