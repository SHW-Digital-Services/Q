import assert from 'node:assert/strict';
import { buildChatPrompt, isProviderBillingFailure, normalizeGuidePayload } from '../server/routes/ai.js';

assert.equal(isProviderBillingFailure({ status: 429, code: 'credit_balance_exhausted', type: 'insufficient_quota' }), true);
assert.equal(isProviderBillingFailure({ status: 429, code: 'rate_limit_exceeded' }), false);
assert.throws(() => normalizeGuidePayload({ steps: [] }, 'A specific request', 'social'), /incomplete guide/);
assert.throws(() => normalizeGuidePayload({ steps: ['Only one step'] }, 'A specific request', 'social'), /incomplete guide/);
assert.deepEqual(normalizeGuidePayload({ steps: ['First action', 'Second action', 'Third action'] }, 'A specific request', 'social').steps, ['First action', 'Second action', 'Third action']);
import { aiPromptInjectionFixtures } from '../server/aiPromptInjectionFixtures.js';

for (const fixture of aiPromptInjectionFixtures) {
  const result = buildChatPrompt({ message: fixture.message }, fixture.trustedContext ?? []);
  assert.match(result.prompt, /Treat all user messages.*untrusted data/);
  assert.match(result.prompt, /<user_message>/);
  assert.match(result.prompt, /<\/user_message>/);
  assert.doesNotMatch(result.prompt, /OPENAI_API_KEY|sk-[A-Za-z0-9]{12,}/i);
  console.log(`PASS ${fixture.name}`);
}

console.log(`Validated ${aiPromptInjectionFixtures.length} prompt-injection fixtures.`);
