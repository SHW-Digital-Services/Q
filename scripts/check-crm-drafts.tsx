import assert from 'node:assert/strict';
import React, { type Dispatch, type SetStateAction } from 'react';
import { renderToString } from 'react-dom/server';
import { CrmDraftProvider, clearCrmDrafts, CRM_DRAFT_PREFIX } from '../src/contexts/CrmDraftContext';
import { useCrmDraftState } from '../src/hooks/useCrmDraftState';

const records: Record<string, string> = {};
let quotaFailure = false;
const storage = Object.defineProperties(records, {
  getItem: { value: (key: string) => records[key] ?? null },
  setItem: { value: (key: string, value: string) => { if (quotaFailure) throw new Error('quota'); records[key] = value; } },
  removeItem: { value: (key: string) => { delete records[key]; } },
});
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });
const events = new EventTarget();
Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
let failures = 0;
events.addEventListener('q-crm-draft-error', () => failures++);
const empty = { subject: '', body: '' };
let change!: Dispatch<SetStateAction<typeof empty>>;
let recovered = empty;
function Draft({ name }: { name: string }) {
  [recovered, change] = useCrmDraftState(name, empty);
  return <p>{recovered.subject}:{recovered.body}</p>;
}
function mount(user = 'staff-a', name = 'mail:office:account-1') {
  renderToString(<CrmDraftProvider userId={user}><Draft name={name} /></CrmDraftProvider>);
}
mount();
change({ subject: 'Unsent message', body: 'First sentence' });
change(current => ({ ...current, body: `${current.body}. Last keystroke` }));
// The stored copy must already contain the last change, without any effect/timer.
assert.equal(JSON.parse(records[`${CRM_DRAFT_PREFIX}staff-a:mail:office:account-1`]).body, 'First sentence. Last keystroke');
mount();
assert.deepEqual(recovered, { subject: 'Unsent message', body: 'First sentence. Last keystroke' });
mount('staff-b'); assert.deepEqual(recovered, empty);
mount('staff-a', 'mail:personal:account-1'); assert.deepEqual(recovered, empty);
mount('staff-a', 'customer:other:note'); assert.deepEqual(recovered, empty);
mount(); change(empty); mount(); assert.deepEqual(recovered, empty);
assert.equal(records[`${CRM_DRAFT_PREFIX}staff-a:mail:office:account-1`], undefined);
records[`${CRM_DRAFT_PREFIX}staff-a:mail:office:account-1`] = '{broken'; mount(); assert.deepEqual(recovered, empty);
records[`${CRM_DRAFT_PREFIX}staff-a:mail:office:account-1`] = JSON.stringify({ subject: 12, body: '' }); mount(); assert.deepEqual(recovered, empty);
quotaFailure = true; change({ subject: 'Still editable', body: 'Keep this tab open' }); assert.equal(failures, 1); quotaFailure = false;
mount('staff-b'); change({ subject: 'Another account', body: 'Retained' });
clearCrmDrafts('staff-a');
assert.equal(Object.keys(records).filter(key => key.startsWith(`${CRM_DRAFT_PREFIX}staff-a:`)).length, 0);
mount('staff-b'); assert.equal(recovered.subject, 'Another account');
// Template drafts must survive switching templates and remounting the section.
let templateValues: Record<string, string> = {};
let changeTemplate!: Dispatch<SetStateAction<Record<string, string>>>;
let searchText = '';
let changeSearch!: Dispatch<SetStateAction<string>>;
function CommunicationsInputs({ template, mailbox }: { template: string; mailbox: string }) {
  [templateValues, changeTemplate] = useCrmDraftState(`template:${template}:values`, {});
  [searchText, changeSearch] = useCrmDraftState(`mail:${mailbox}:account-1:searchText`, '');
  return <p>{searchText}</p>;
}
function mountInputs(template = 'welcome', mailbox = 'office') {
  renderToString(<CrmDraftProvider userId="staff-a"><CommunicationsInputs template={template} mailbox={mailbox} /></CrmDraftProvider>);
}
mountInputs();
changeTemplate({ name: 'Alex', details: 'Unfinished personalised reply' });
changeSearch('sender:alex@example.test');
mountInputs('follow-up');
assert.deepEqual(templateValues, {});
assert.equal(searchText, 'sender:alex@example.test');
changeTemplate({ name: 'Sam' });
mountInputs();
assert.deepEqual(templateValues, { name: 'Alex', details: 'Unfinished personalised reply' });
mountInputs('follow-up', 'personal');
assert.deepEqual(templateValues, { name: 'Sam' });
assert.equal(searchText, '');
mountInputs();
assert.equal(searchText, 'sender:alex@example.test');
clearCrmDrafts('staff-a');
mountInputs();
assert.deepEqual(templateValues, {});
assert.equal(searchText, '');
console.log('PASS: immediate last-keystroke persistence, reload recovery, account/mailbox/customer isolation, successful reset, corrupt data, storage failure warning, scoped logout cleanup, per-template recovery, and mailbox search recovery.');
