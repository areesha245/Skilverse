// interviewRoom.js - Interview Escape Room zone
import { getCurrentUser } from './auth.js';
import { evaluateAnswer } from './aiManager.js';
import { loadQuestions, saveSession } from './storage.js';
import { awardXP, unlockNextRoom, getClearedRooms } from './gamification.js';

// Pass mark (average score out of 10) for each difficulty
export const THRESHOLDS = { easy: 5, medium: 6, hard: 7 };
export const ROOM_XP = 40;

let state = null; // the room that is currently being played

function currentQuestion() { return state.room.questions[state.index]; }

// Starts the first room of the role that the student has not cleared yet
export async function startRoom(roleId, difficulty) {
  const user = getCurrentUser();
  if (!user) return { ok: false, error: 'Please log in again.' };
  if (!THRESHOLDS[difficulty]) return { ok: false, error: 'Please choose a difficulty.' };

  const role = await loadQuestions(roleId);
  if (!role) return { ok: false, error: 'Role not found.' };
  const cleared = getClearedRooms(user, roleId);
  const room = role.rooms.find(r => !cleared.includes(r.id));
  if (!room) return { ok: false, error: 'You have cleared every room for this role. Great job!' };

  state = { userId: user.id, role, room, difficulty, index: 0, scores: [], hintUsed: false };
  return { ok: true, room, question: currentQuestion(), number: 1, total: room.questions.length };
}

// Reveals the hint of the current question; it costs 1 point
export function useHint() {
  if (!state) return '';
  state.hintUsed = true;
  return currentQuestion().hint;
}

export function submitAnswer(answer) {
  if (!state) return { ok: false, error: 'Please start a room first.' };
  if (!answer.trim()) return { ok: false, error: 'Please type an answer first.' };

  const evaluation = evaluateAnswer(currentQuestion(), answer.trim());
  const score = Math.max(0, evaluation.score - (state.hintUsed ? 1 : 0));
  state.scores.push(score);
  state.hintUsed = false;
  state.index++;

  const feedback = { score, tips: evaluation.tips };
  const total = state.room.questions.length;
  if (state.index < total) {
    return { ok: true, finished: false, feedback, room: state.room, question: currentQuestion(), number: state.index + 1, total };
  }
  return { ok: true, finished: true, feedback, result: finishRoom() };
}

// Compares the average score with the pass mark, then rewards or asks to retry
function finishRoom() {
  const sum = state.scores.reduce((a, b) => a + b, 0);
  const average = Math.round((sum / state.scores.length) * 10) / 10;
  const threshold = THRESHOLDS[state.difficulty];
  const passed = average >= threshold;

  let xpEarned = 0, leveledUp = false, newBadges = [];
  if (passed) {
    const xp = awardXP(state.userId, ROOM_XP);
    const unlock = unlockNextRoom(state.userId, state.role.id, state.room.id);
    xpEarned = ROOM_XP;
    leveledUp = xp.leveledUp;
    newBadges = [...xp.newBadges, ...unlock.newBadges];
  }
  saveSession({
    userId: state.userId, zone: 'interview', score: average,
    title: `Interview: ${state.role.name} - ${state.room.name}`,
    result: passed ? 'Room cleared' : 'Retry',
    date: new Date().toLocaleDateString('en-GB')
  });
  const result = { passed, average, threshold, xpEarned, leveledUp, newBadges, roomName: state.room.name };
  state = null;
  return result;
}
