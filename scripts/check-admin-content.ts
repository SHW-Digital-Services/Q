import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { listAdminContent } from '../server/adminContentList';

// Exercise the same list builder against Postgres both before and after the
// relationship column exists, including archives that previously filled a page.
const db = new PGlite();
const selectedColumns: string[] = [];
class Request {
  columns = '*';
  predicates: string[] = [];
  values: unknown[] = [];
  ordering: string[] = [];
  first = 0;
  last = 99;
  constructor(private table: string) {}
  select(columns: string) { this.columns = columns; selectedColumns.push(columns); return this; }
  eq(field: string, value: unknown) { this.values.push(value); this.predicates.push(`${field} = $${this.values.length}`); return this; }
  in(field: string, values: string[]) { this.values.push(values); this.predicates.push(`${field} = any($${this.values.length}::text[])`); return this; }
  order(field: string, options: { ascending: boolean }) { this.ordering.push(`${field} ${options.ascending ? 'asc' : 'desc'}`); return this; }
  range(first: number, last: number) { this.first = first; this.last = last; return this; }
  async execute() {
    try {
      const { rows } = await db.query(`select ${this.columns} from ${this.table} where ${this.predicates.join(' and ')} order by ${this.ordering.join(', ')} limit ${this.last - this.first + 1} offset ${this.first}`, this.values);
      return { data: rows, error: null };
    } catch (error: any) { return { data: null, error: { code: error.code, message: error.message } }; }
  }
  then(resolve: (value: any) => unknown, reject: (error: unknown) => unknown) { return this.execute().then(resolve, reject); }
}
const service = { from: (table: string) => new Request(table) };
try {
  await db.exec(`create table content_posts (
    id text primary key,slug text,title text,summary text,body text,content_type text,status text,
    tags text[],hero_image_url text,published_at timestamptz,updated_at timestamptz,created_at timestamptz
  );
  insert into content_posts(id,title,status,content_type,updated_at)
    select 'archive-' || n, 'Archived news ' || n, 'archived', 'news', '2026-09-29'::timestamptz from generate_series(1,150) n;
  insert into content_posts(id,title,status,content_type,updated_at) values
    ('old-news','Previous news','published','news','2026-09-24'),
    ('draft-update','Draft update','draft','update','2026-09-25');`);
  const oldList = await db.query<{ status: string }>('select status from content_posts order by updated_at desc limit 100');
  assert.ok(oldList.rows.every((post) => post.status === 'archived'), 'Fixture reproduces archives crowding out old news');
  const legacy = await listAdminContent(service, { archived: false, limit: 100, offset: 0 });
  assert.equal(legacy.error, null);
  assert.equal(legacy.relationshipsAvailable, false);
  assert.deepEqual(legacy.data.map((post: any) => post.id), ['draft-update', 'old-news']);
  assert.ok(legacy.data.every((post: any) => post.parent_news_id === null));
  assert.equal(selectedColumns.length, 2, 'Missing relationship column must retry once with original columns');
  const archives = await listAdminContent(service, { archived: true, limit: 100, offset: 0 });
  const olderArchives = await listAdminContent(service, { archived: true, limit: 100, offset: 100 });
  assert.equal(archives.data.length, 100);
  assert.equal(olderArchives.data.length, 50);
  assert.ok(archives.data.every((post: any) => post.status === 'archived'));
  assert.equal(new Set([...archives.data, ...olderArchives.data].map((post: any) => post.id)).size, 150);
  await db.exec('alter table content_posts add column parent_news_id text');
  selectedColumns.length = 0;
  const migrated = await listAdminContent(service, { archived: false, limit: 100, offset: 0 });
  assert.equal(migrated.error, null);
  assert.equal(migrated.relationshipsAvailable, true);
  assert.equal(migrated.data.length, 2);
  assert.equal(selectedColumns.length, 1);
  await db.exec('drop table content_posts');
  selectedColumns.length = 0;
  const missingTable = await listAdminContent(service, { archived: false, limit: 100, offset: 0 });
  assert.equal(missingTable.error.code, '42P01');
  assert.equal(selectedColumns.length, 1, 'Other database errors must not be hidden by the compatibility retry');
  console.log('PASS: existing news loads on both schemas; drafts/published and archives are separated before pagination; unrelated errors remain visible.');
} finally { await db.close(); }
