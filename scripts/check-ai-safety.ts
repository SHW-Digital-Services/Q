import assert from 'node:assert/strict';
import { buildChatPrompt } from '../server/routes/ai.js';
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
