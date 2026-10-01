import assert from 'node:assert/strict';
import express from 'express';
import { readFile } from 'node:fs/promises';
import { publicTrustRouter } from '../server/routes/publicTrust';
import { legalRouter } from '../server/routes/legal';
import { publicLegalPages, businessIdentity } from '../src/shared/businessIdentity';

const app = express(); app.use(publicTrustRouter); app.use('/legal',legalRouter);
const server=app.listen(0,'127.0.0.1'); await new Promise<void>(resolve=>server.once('listening',resolve));
const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
try {
  for (const page of ['about','contact']) {
    const response=await fetch(`${origin}/${page}`); assert.equal(response.status,200);
    const html=await response.text(); assert.match(html,/<h1>/); assert.ok(html.includes(businessIdentity.operator));
    assert.ok(html.includes(`href="${businessIdentity.website}/${page}"`));
    assert.ok(html.includes('office@q-ai.online')); assert.doesNotMatch(html,/<iframe|script src=/);
    assert.doesNotMatch(html,/AggregateRating|ReviewAction|ratingValue|MedicalOrganization/);
    const schema=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1]);
    assert.equal(schema.url,`${businessIdentity.website}/${page}`);
  }
  for (const page of publicLegalPages) {
    const response=await fetch(`${origin}/legal/${page}`); assert.equal(response.status,200,`Missing public policy: ${page}`);
    assert.match(await response.text(),/<h1>/);
  }
  for (const page of ['threat-model','admin-checklist','scamadviser-review-request','support-inbox-archive']) assert.equal((await fetch(`${origin}/legal/${page}`)).status,404);
  const robots=await(await fetch(`${origin}/robots.txt`)).text(); assert.ok(robots.includes('Allow: /')); assert.ok(robots.includes(`Sitemap: ${businessIdentity.website}/sitemap.xml`));
  const sitemap=await(await fetch(`${origin}/sitemap.xml`)).text(); assert.ok(sitemap.includes('/about</loc>')); assert.ok(sitemap.includes('/legal/refund</loc>')); assert.doesNotMatch(sitemap,/<loc>[^<]*\/(crm|app|api)/);
  const html=await readFile('index.html','utf8'); assert.match(html,/<h1>Q Intelligence<\/h1>/); assert.doesNotMatch(html,/BrevoConversationsID|conversations-widget\.brevo\.com/);
  assert.match(await(await fetch(`${origin}/legal/accessibility`)).text(),/<h1>Accessibility<\/h1>/);
  assert.match(await(await fetch(`${origin}/legal/subscription_terms`)).text(),/<h1>Subscription Terms<\/h1>/);
  console.log('PASS: Server-rendered identity/contact, all public policies, canonical URLs, sitemap/robots, public-document allowlist, and readable initial HTML.');
} finally { server.close(); }
