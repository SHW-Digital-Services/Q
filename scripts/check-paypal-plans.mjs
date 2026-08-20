import 'dotenv/config';

const environment = process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox';
const baseUrl = environment === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const plans = [
  ['monthly', process.env.PAYPAL_PLAN_ID_MONTHLY],
  ['yearly', process.env.PAYPAL_PLAN_ID_YEARLY]
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET.');
  }

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const data = await readJson(response);
    throw new Error(`PayPal auth failed (${response.status}): ${data.error_description || data.error || 'unknown error'}`);
  }

  const data = await response.json();
  if (!data.access_token) throw new Error('PayPal returned no access token.');
  return data.access_token;
}

async function checkPlan(accessToken, name, planId) {
  if (!planId) {
    fail(`${name}: missing PAYPAL_PLAN_ID_${name.toUpperCase()}`);
    return;
  }

  const response = await fetch(`${baseUrl}/v1/billing/plans/${encodeURIComponent(planId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await readJson(response);

  if (!response.ok) {
    const details = Array.isArray(data.details)
      ? data.details.map((detail) => detail.issue || detail.description).filter(Boolean).join('; ')
      : '';
    fail(`${name}: ${planId} was not found in ${environment} (${response.status}${details ? `, ${details}` : ''})`);
    return;
  }

  console.log(`${name}: ${planId} found in ${environment}; status=${data.status || 'unknown'}; product_id=${data.product_id || 'unknown'}`);
}

try {
  console.log(`Checking PayPal plans against ${environment}...`);
  const accessToken = await getAccessToken();
  for (const [name, planId] of plans) {
    await checkPlan(accessToken, name, planId);
  }
} catch (error) {
  fail(error.message || String(error));
}
