import 'dotenv/config';
import OpenAI from 'openai';

const model = process.env.AI_FREE_MODEL || 'gpt-5-nano';

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!process.env.OPENAI_API_KEY) {
  fail('Missing OPENAI_API_KEY.');
} else {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    console.log(`Checking OpenAI chat model: ${model}`);
    const response = await client.responses.create({
      model,
      input: 'Reply with only: ok',
      max_output_tokens: 20
    });

    const text = response.output_text?.trim();
    if (!text) {
      fail(`${model}: OpenAI returned an empty response.`);
    } else {
      console.log(`${model}: ok (${text})`);
    }
  } catch (error) {
    const status = typeof error?.status === 'number' ? `status=${error.status}` : 'status=unknown';
    const code = error?.code ? ` code=${error.code}` : '';
    const type = error?.type ? ` type=${error.type}` : '';
    const message = error?.message || String(error);
    fail(`${model}: failed (${status}${code}${type}) ${message}`);
  }
}
