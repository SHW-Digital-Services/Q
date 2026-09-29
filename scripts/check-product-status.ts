import assert from 'node:assert/strict';
import { syncPayPalProductStatus } from '../server/paypalProductStatus';

for (const active of [true, false]) {
  for (const status of ['ACTIVE', 'INACTIVE', 'CREATED']) {
    const calls: { path: string; method: string }[] = [];
    await syncPayPalProductStatus({ active, paypal_plan_id: 'P-TEST', paypal_founder_plan_id: 'P-TEST' }, async (path, init) => {
      calls.push({ path, method: init?.method || 'GET' }); return { status };
    });
    const change = active ? status !== 'ACTIVE' : status === 'ACTIVE';
    assert.deepEqual(calls, [{ path: '/v1/billing/plans/P-TEST', method: 'GET' }, ...(change ? [{ path: `/v1/billing/plans/P-TEST/${active ? 'activate' : 'deactivate'}`, method: 'POST' }] : [])]);
  }
}
await syncPayPalProductStatus({ active: false }, async () => { throw new Error('Unlinked products must not create remote records'); });
await assert.rejects(syncPayPalProductStatus({ active: false, paypal_plan_id: 'P-TEST' }, async () => ({ status: 'UNKNOWN' })), /unsupported/);
await assert.rejects(syncPayPalProductStatus({ active: false, paypal_plan_id: 'P-TEST' }, async () => { throw new Error('Provider unavailable'); }), /Provider unavailable/);
const multiple: string[] = [];
await syncPayPalProductStatus({ active: false, paypal_plan_id: 'P-REGULAR', paypal_founder_plan_id: 'P-FOUNDER' }, async path => { multiple.push(path); return { status: 'ACTIVE' }; });
assert.equal(multiple.length, 4);
assert(multiple.includes('/v1/billing/plans/P-FOUNDER/deactivate'));
console.log('PASS: product status sync handles existing plan states, both plans, duplicates, unlinked products and provider failures without creating plans or updating prices. No PayPal account was changed.');
