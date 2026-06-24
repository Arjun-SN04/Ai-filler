// ─────────────────────────────────────────────────────────────────────────────
// GROQ API KEYS — add as many as you want
// Keys are tried left-to-right. On rate-limit (429) the next key is used.
// After all keys are exhausted it rotates back to the first one.
// ─────────────────────────────────────────────────────────────────────────────

export const GROQ_KEYS = [
  'gsk_YOUR_FIRST_KEY_HERE',
  'gsk_YOUR_SECOND_KEY_HERE',
  // 'gsk_YOUR_THIRD_KEY_HERE',
  // add more as needed…
];

// Which key index to start from (persisted in memory across calls within the worker lifetime)
export let currentKeyIndex = 0;
export function advanceKey() {
  currentKeyIndex = (currentKeyIndex + 1) % GROQ_KEYS.length;
  return GROQ_KEYS[currentKeyIndex];
}
export function currentKey() {
  return GROQ_KEYS[currentKeyIndex];
}
