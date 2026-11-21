// storyRealm.js - Story Realm zone
import { getCurrentUser } from './auth.js';
import { requestStory } from './aiManager.js';
import { saveSession } from './storage.js';
import { awardXP, recordStat } from './gamification.js';

export const MIN_NOTE_WORDS = 30;
export const MAX_NOTE_CHARS = 3000;
export const MAX_TOPIC_CHARS = 60;

let state = null; // the story that is currently being played

// Returns an error message, or '' when the topic and notes are acceptable
export function validateStoryInput(topic, notes) {
  if (!topic.trim()) return 'Please enter a topic.';
  if (topic.trim().length > MAX_TOPIC_CHARS) return `Please keep the topic under ${MAX_TOPIC_CHARS} characters.`;
  const words = notes.trim().split(/\s+/).filter(Boolean).length;
  if (words < MIN_NOTE_WORDS) return `Please paste at least ${MIN_NOTE_WORDS} words of notes.`;
  if (notes.trim().length > MAX_NOTE_CHARS) return `Please keep your notes under ${MAX_NOTE_CHARS} characters.`;
  return '';
}

function sceneInfo() {
  return { scene: state.story.scenes[state.index], number: state.index + 1, total: state.story.scenes.length };
}

export function generateStory(topic, notes) {
  const user = getCurrentUser();
  if (!user) return { ok: false, error: 'Please log in again.' };
  const error = validateStoryInput(topic, notes);
  if (error) return { ok: false, error };

  const story = requestStory(user.id, topic.trim(), notes);
  if (!story.ok) return story;
  state = { userId: user.id, story, index: 0, correct: 0, missed: [] };
  return { ok: true, ...sceneInfo() };
}

// choice is the index of the selected option
export function answerScene(choice) {
  if (!state) return { ok: false, error: 'Please generate a story first.' };
  const scene = state.story.scenes[state.index];
  if (!Number.isInteger(choice) || choice < 0 || choice >= scene.options.length) {
    return { ok: false, error: 'Please choose an answer.' };
  }

  const correct = choice === scene.answerIndex;
  if (correct) state.correct++;
  else state.missed.push({ term: scene.term, sentence: scene.explanation }); // recovery scene shows the sentence
  state.index++;

  const feedback = { correct, explanation: scene.explanation, answer: scene.options[scene.answerIndex] };
  if (state.index < state.story.scenes.length) return { ok: true, finished: false, feedback, next: sceneInfo() };
  return { ok: true, finished: true, feedback, summary: finishStory() };
}

function finishStory() {
  const total = state.story.scenes.length;
  const score = state.correct;
  const xpEarned = score * 8 + 10; // 10 XP for finishing, 8 XP per correct answer
  const xp = awardXP(state.userId, xpEarned);
  const stat = recordStat(state.userId, 'storiesCompleted', 1);
  saveSession({
    userId: state.userId, zone: 'story', score,
    title: `Story Realm: ${state.story.topic}`, result: `${score}/${total}`,
    weakTopics: state.missed.map(m => m.term),
    date: new Date().toLocaleDateString('en-GB')
  });
  const summary = {
    score, total, xpEarned, weak: state.missed.map(m => m.sentence),
    leveledUp: xp.leveledUp, newBadges: [...xp.newBadges, ...stat.newBadges]
  };
  state = null;
  return summary;
}
