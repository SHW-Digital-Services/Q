import assert from 'node:assert/strict';
import { generateLocalGuide, generateLocalReply, parseLocalGuide } from '../src/services/webLlm';

const guide = parseLocalGuide(JSON.stringify({ title: 'Coffee with Maya', summary: 'A private conversation on Saturday', steps: ['Invite Maya to coffee on Saturday.', 'Ask her to keep the conversation private.', 'Share what support you want from her.'] }), 'social');
assert.equal(guide.steps.length, 3);
assert.match(guide.steps[0].text, /Maya.*Saturday/);
assert.equal(guide.steps[0].completed, false);
assert.equal(guide.category, 'social');
for (const invalid of ['null', '{}', '{"title":"A","summary":"B","steps":["one"]}', '{"title":"A","summary":"B","steps":["one","two",""]}']) {
  assert.throws(() => parseLocalGuide(invalid, 'social'), /incomplete guide/);
}
await assert.rejects(generateLocalGuide('I want to kill myself', 'mental_health'), /crisis resources/);
// An unavailable runtime must fail honestly, never manufacture a template response.
await assert.rejects(generateLocalReply('Write an email to HR', []), /WebGPU/);
await assert.rejects(generateLocalReply('Retry after a load failure', []), /WebGPU/);
console.log('PASS: guide content preserved, malformed guides rejected, crisis intercepted, unavailable runtime and retry handled honestly.');
