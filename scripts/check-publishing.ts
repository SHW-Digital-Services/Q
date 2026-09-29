import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
    create table auth.users (id uuid primary key);
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create function public.is_staff() returns boolean language sql as $$ select false $$;
    create function public.is_admin() returns boolean language sql as $$ select false $$;`);
  await db.exec(await readFile('supabase/migrations/20260921083000_content_publishing.sql', 'utf8'));
  const news = '00000000-0000-4000-8000-000000000001';
  const legacy = '00000000-0000-4000-8000-000000000002';
  const insert = `insert into public.content_posts (id,slug,title,summary,body,content_type,status,published_at) values
    ('${news}','first-news','First news','A news summary','This is a complete news body.','news','published',now()),
    ('${legacy}','old-update','Old update','An update summary','This is an older update body.','update','published',now());`;
  await db.exec(insert);
  await db.exec(await readFile('supabase/migrations/20260929204319_news_item_updates.sql', 'utf8'));
  await assert.rejects(db.exec(`update public.content_posts set title='Changed old update' where id='${legacy}'`), /check constraint/);
  await assert.rejects(db.exec(`insert into public.content_posts(slug,title,summary,body,content_type) values ('unlinked','Unlinked update','A long summary','A complete update body here.','update')`), /check constraint/);
  await db.exec(`update public.content_posts set parent_news_id='${news}' where id='${legacy}'`);
  await assert.rejects(db.exec(`update public.content_posts set parent_news_id='${legacy}' where id='${legacy}'`), /foreign key/);
  await assert.rejects(db.exec(`update public.content_posts set content_type='update',parent_news_id='${news}' where id='${news}'`), /foreign key/);
  await db.exec('set role anon');
  assert.equal((await db.query('select id from public.content_posts')).rows.length, 1, 'Anonymous reads must not expose standalone updates');
  await db.exec('reset role');
  await db.exec(await readFile('supabase/migrations/20260929204822_help_videos.sql', 'utf8'));
  await assert.rejects(db.exec(`insert into public.help_videos(title,steps,video_url,video_path) values ('Invalid video',array['Step'],'https://example.org','videos/a.mp4')`), /check constraint/);
  await assert.rejects(db.exec(`insert into public.help_videos(title,steps,video_url) values ('No steps',array[]::text[],'https://example.org')`), /check constraint/);
  await db.exec(`insert into public.help_videos(title,steps,video_url,status) values ('Draft video',array['First step'],'https://example.org','draft'),('Published video',array['First step'],'https://example.org','published')`);
  await db.exec('set role anon');
  assert.equal((await db.query('select title from public.help_videos')).rows.length, 1, 'Anonymous users see published videos only');
  await assert.rejects(db.exec(`insert into public.help_videos(title,steps,video_url) values ('Forbidden',array['Step'],'https://example.org')`), /permission denied/);
  await db.exec('reset role');
  const bucket = (await db.query<{ public: boolean; file_size_limit: number }>('select public,file_size_limit from storage.buckets')).rows[0];
  assert.equal(bucket.public, false);
  assert.equal(Number(bucket.file_size_limit), 104857600);
  console.log('Publishing migrations: parent constraints, legacy linking, public RLS and private video storage passed.');
} finally { await db.close(); }

const output = join(tmpdir(), `q-markdown-check-${process.pid}.cjs`);
try {
  const result = await build({ stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {AssistantMarkdown} from './src/components/AssistantMarkdown'; export const render = (text) => renderToStaticMarkup(React.createElement(AssistantMarkdown,{text}));`, resolveDir: resolve('.'), loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.css': 'empty' } });
  await writeFile(output, result.outputFiles[0].contents);
  const { render } = createRequire(import.meta.url)(output);
  const html = render('# Heading\n\n**Bold** and *italic*.\n\n- First\n- Second\n\n```js\nconst answer = 42;\n```\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n[Unsafe](javascript:alert%281%29)\n\n<img src="https://example.org/tracker" onerror="alert(1)">\n\n![Remote image](https://example.org/tracker)');
  for (const tag of ['<h1>', '<strong>', '<em>', '<ul>', '<pre>', '<table>']) assert.ok(html.includes(tag), `Expected ${tag}`);
  assert.ok(!html.includes('javascript:') && !html.includes('<img') && !html.includes('onerror='), 'Unsafe markup and remote images must not render');
  console.log('AI Markdown: semantic formatting, tables/code and unsafe-content checks passed.');
} finally { await unlink(output).catch(() => {}); }
