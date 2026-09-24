import React from 'react';
import { ArrowLeft, BookOpen, Braces, CheckCircle2, Code2, KeyRound, Newspaper, ShieldCheck } from 'lucide-react';
import { QLogo } from './QLogo';
import { LegalFooter } from './LegalFooter';

const endpoints = [
  { method: 'GET', path: '/api/content', auth: 'Public', description: 'List published news and update posts. Supports limit, type and q query parameters.' },
  { method: 'GET', path: '/api/content/:slug', auth: 'Public', description: 'Read one published post by URL-safe slug.' },
  { method: 'POST', path: '/api/content/publish', auth: 'CRM token', description: 'Create a draft or published content post from an authorised external publisher.' },
  { method: 'GET', path: '/api/life-guides', auth: 'Public', description: 'List CRM-published Life Guides for the app catalogue.' },
  { method: 'GET', path: '/api/peer-knowledge', auth: 'Public', description: 'List approved Peer Knowledge entries.' },
  { method: 'POST', path: '/api/peer-knowledge', auth: 'Optional user session', description: 'Submit a reflection for staff moderation.' }
];

const requestBody = `{
  "title": "Q launch partner update",
  "slug": "q-launch-partner-update",
  "summary": "Short summary shown in News & Updates.",
  "body": "Full post body. Use paragraphs separated by blank lines.",
  "contentType": "update",
  "tags": ["launch", "partner"],
  "heroImageUrl": "/images/news/launch.png",
  "publish": true
}`;

const curlExample = `curl -X POST https://q-ai.online/api/content/publish \\
  -H "Authorization: Bearer q_content_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '${requestBody.replace(/\n/g, '').replace(/\s{2,}/g, ' ')}'`;

export const DeveloperPage: React.FC = () => (
  <main className="min-h-screen bg-slate-950 text-white">
    <header className="border-b border-white/10 bg-slate-950/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Home
        </a>
        <QLogo size="sm" />
      </div>
    </header>

    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="grid gap-8 lg:grid-cols-[1fr_18rem] lg:items-start">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-100">
            <Code2 className="h-3.5 w-3.5" />
            External developer documentation
          </div>
          <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">Q API Documentation</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Use Q's public APIs to read published content, Life Guides and Peer Knowledge. Approved publishing partners can also create News & Updates posts with a CRM-authorised API token.
          </p>
        </div>

        <aside className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p className="font-bold text-white">Base URL</p>
          <code className="mt-2 block overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-purple-100">https://q-ai.online</code>
          <p className="mt-4 font-bold text-white">Support</p>
          <p className="mt-2 text-xs leading-5">Request publishing access from the Q CRM administrator. Tokens are shown once and can be revoked.</p>
        </aside>
      </div>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          { icon: Newspaper, title: 'Content APIs', text: 'Read published News & Updates or create posts as an approved publisher.' },
          { icon: ShieldCheck, title: 'CRM-authorised', text: 'Publishing uses admin-created tokens stored as hashes, not shared app secrets.' },
          { icon: CheckCircle2, title: 'Moderated surfaces', text: 'Peer Knowledge submissions enter moderation before appearing publicly.' }
        ].map(({ icon: Icon, title, text }) => (
          <article key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <Icon className="h-5 w-5 text-purple-300" />
            <h2 className="mt-3 font-bold text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-purple-300" />
          <h2 className="text-xl font-black">Endpoints</h2>
        </div>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
              <tr><th className="p-3">Method</th><th className="p-3">Path</th><th className="p-3">Auth</th><th className="p-3">Use</th></tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {endpoints.map((endpoint) => (
                <tr key={`${endpoint.method}-${endpoint.path}`}>
                  <td className="p-3"><span className="rounded-lg bg-purple-500/15 px-2 py-1 text-xs font-black text-purple-100">{endpoint.method}</span></td>
                  <td className="p-3"><code className="text-purple-100">{endpoint.path}</code></td>
                  <td className="p-3 text-slate-300">{endpoint.auth}</td>
                  <td className="p-3 text-slate-300">{endpoint.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-purple-300" />
            <h2 className="text-xl font-black">Authentication</h2>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Public read endpoints do not require authentication. Publishing requires a CRM-authorised content API token sent as either:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li><code className="block overflow-x-auto text-purple-100">Authorization: Bearer &lt;token&gt;</code></li>
            <li><code className="block overflow-x-auto text-purple-100">x-q-content-api-key: &lt;token&gt;</code></li>
          </ul>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Admins create and revoke publishing tokens in the CRM. Q stores only token hashes and prefixes; copy the token when it is created.
          </p>
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-2">
            <Braces className="h-5 w-5 text-purple-300" />
            <h2 className="text-xl font-black">Publish Request</h2>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-900 p-4 text-xs leading-6 text-slate-100"><code>{requestBody}</code></pre>
        </article>
      </section>

      <section className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-xl font-black">Example</h2>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-900 p-4 text-xs leading-6 text-slate-100"><code>{curlExample}</code></pre>
      </section>

      <section className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-xl font-black">Responses And Errors</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            ['201', 'Published content created. Response body contains post.'],
            ['400', 'Validation error such as an invalid slug, body, title, tags or unexpected field.'],
            ['401', 'Missing content API token.'],
            ['403', 'Unknown, revoked or unauthorised content API token.'],
            ['409', 'A post with the same slug already exists.'],
            ['503', 'Publishing schema or service configuration is unavailable.']
          ].map(([code, text]) => (
            <div key={code} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <p className="font-black text-purple-100">{code}</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </section>

    <LegalFooter />
  </main>
);
