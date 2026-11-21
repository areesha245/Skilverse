// aiManager.js - SIMULATED AI: rubric-based scoring and follow-up questions, daily limit
import { getDailyUsage, updateUsage } from './storage.js';

export const DAILY_LIMIT = 25;
const LIMIT_ERROR = `Daily AI limit reached (${DAILY_LIMIT}). Please come back tomorrow.`;

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
    return { ok: false, limitReached: true, error: LIMIT_ERROR };
  }
  const result = scoreExplanation(concept, text);
  updateUsage(userId);
  return { ok: true, ...result };
}

// Scores one interview answer out of 10: content 6 + length 3 + structure 1
export function evaluateAnswer(question, answer) {
  const lower = answer.toLowerCase();
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const sentences = answer.split(/[.!?]+/).filter(s => s.trim()).length;
  const matched = question.keywords.filter(keyword => lower.includes(keyword));
  const missing = question.keywords.filter(keyword => !lower.includes(keyword));

  const needed = Math.min(question.keywords.length, 3); // 3 key words give full content marks
  const content = Math.round(6 * Math.min(1, matched.length / needed));
  const length = Math.round(3 * Math.min(1, words / 25));
  const structure = sentences >= 2 ? 1 : 0;

  const tips = [];
  if (content < 6 && missing.length > 0) tips.push(`Try mentioning: ${missing.slice(0, 2).join(', ')}.`);
  if (words < 25) tips.push('Add more detail and a real example.');
  return { score: content + length + structure, tips };
}

// ---------- Story Realm (simulated AI story builder) ----------
const STOP_WORDS = new Set(['about', 'after', 'again', 'also', 'always', 'because', 'before', 'being', 'between', 'called',
  'could', 'during', 'every', 'first', 'known', 'often', 'other', 'their', 'there', 'these', 'those', 'through',
  'under', 'using', 'which', 'while', 'where', 'would', 'should', 'usually', 'another', 'around']);
const PLACES = ['Whispering Library', 'Crystal Bridge', 'Clockwork Garden', 'Echoing Cave', 'Tower of Trials'];
const MAX_SCENES = 5;

function shuffle(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Turns study notes into scenes: each scene hides one key word of a sentence
export function buildStory(topic, notes, random = Math.random) {
  const sentences = (notes.match(/[^.!?]+[.!?]*/g) || []).map(s => s.trim()).filter(s => s.split(/\s+/).length >= 6);
  const candidates = sentence => (sentence.match(/[A-Za-z]{5,}/g) || []).filter(w => !STOP_WORDS.has(w.toLowerCase()));
  const pool = [...new Set(sentences.flatMap(candidates).map(w => w.toLowerCase()))];
  if (sentences.length < 3 || pool.length < 4) {
    return { ok: false, error: 'Your notes need more detail. Write at least 3 full sentences.' };
  }

  const used = new Set();
  const scenes = sentences.slice(0, MAX_SCENES).map((sentence, index) => {
    const words = candidates(sentence).sort((a, b) => b.length - a.length);
    const target = (words.find(w => !used.has(w.toLowerCase())) || words[0] || pool[0]).toLowerCase();
    used.add(target);
    const wrong = shuffle(pool.filter(w => w !== target), random).slice(0, 3);
    const options = shuffle([target, ...wrong], random);
    return {
      narrative: `${PLACES[index]}: a glowing scroll about ${topic} has lost one word. Pick the word that restores it.`,
      question: sentence.replace(new RegExp(`\\b${target}\\b`, 'i'), '_____'),
      options,
      answerIndex: options.indexOf(target),
      term: target,
      explanation: sentence
    };
  });
  return { ok: true, topic, scenes };
}

// Checks the daily limit, builds the story, then counts the request
export function requestStory(userId, topic, notes) {
  if (getDailyUsage(userId) >= DAILY_LIMIT) return { ok: false, limitReached: true, error: LIMIT_ERROR };
  const story = buildStory(topic, notes);
  if (!story.ok) return story; // a failed build does not use up a request
  updateUsage(userId);
  return story;
}
