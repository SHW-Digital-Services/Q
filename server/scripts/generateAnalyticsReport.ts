import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { buildAnalyticsExport, AnalyticsExport } from '../analyticsEngine';

// server/scripts/generateAnalyticsReport.ts
// Usage (node compiled or ts-node):
//   START_DATE=2026-01-01 node dist/server/scripts/generateAnalyticsReport.js --out=analytics_report.json
// or using ts-node:
//   START_DATE=2026-01-01 ts-node server/scripts/generateAnalyticsReport.ts --out=analytics_report.json
// Defaults: START_DATE env or --start to 180 days ago, OUT to ./analytics_report.json

function parseArgs() {
  const args = process.argv.slice(2);
  const outArg = args.find((a) => a.startsWith('--out='));
  const startArg = args.find((a) => a.startsWith('--start='));
  const endArg = args.find((a) => a.startsWith('--end='));
  const limitArg = args.find((a) => a.startsWith('--limit='));
  return {
    out: outArg ? outArg.split('=')[1] : process.env.OUT || 'analytics_report.json',
    start: startArg ? startArg.split('=')[1] : process.env.START_DATE || null,
    end: endArg ? endArg.split('=')[1] : process.env.END_DATE || null,
    limit: limitArg ? Number(limitArg.split('=')[1]) : undefined,
  };
}

const MESSAGE_TABLE_CANDIDATES = ['messages', 'interactions', 'user_messages', 'chat_messages', 'message'];
const FEEDBACK_TABLE_CANDIDATES = ['sentiment_feedback', 'sentiments', 'feedback', 'sentiment', 'message_sentiments'];

async function findUsableTable(client: Client, candidates: string[]) {
  for (const t of candidates) {
    const q = `SELECT to_regclass($1) IS NOT NULL as exists`;
    try {
      const res = await client.query(q, [t]);
      if (res.rows?.[0]?.exists) return t;
    } catch (e) {
      // ignore and try next
    }
  }
  return null;
}

async function tryQueryMessages(client: Client, table: string | null, startDate: string | null, limit?: number) {
  if (!table) return [];
  const where: string[] = [];
  const params: any[] = [];
  if (startDate) {
    params.push(startDate);
    where.push(`created_at >= $${params.length}`);
  }
  const limitClause = limit ? `LIMIT ${Number(limit)}` : '';
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const q = `SELECT user_id::text AS user_id, content::text AS content, created_at::text AS created_at FROM ${table} ${whereClause} ORDER BY created_at ASC ${limitClause}`;
  const res = await client.query(q, params);
  return res.rows.map((r: any) => ({ user_id: String(r.user_id), content: r.content ?? null, created_at: new Date(r.created_at).toISOString() }));
}

async function tryQueryFeedback(client: Client, table: string | null, startDate: string | null, limit?: number) {
  if (!table) return [];
  const where: string[] = [];
  const params: any[] = [];
  if (startDate) {
    params.push(startDate);
    where.push(`created_at >= $${params.length}`);
  }
  const limitClause = limit ? `LIMIT ${Number(limit)}` : '';
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  // Attempt to select common column names; fall back to generic selects where possible
  const q = `SELECT (CASE WHEN (pg_column_size((SELECT 1)) IS NOT NULL) THEN coalesce(flagged_unsafe,false) END) as flagged_unsafe, score::numeric as score FROM ${table} ${whereClause} ORDER BY COALESCE(created_at, now()) ASC ${limitClause}`;
  try {
    const res = await client.query(q, params);
    return res.rows.map((r: any) => ({ flagged_unsafe: !!r.flagged_unsafe, score: r.score === null ? null : Number(r.score) }));
  } catch (e) {
    // Last resort: try selecting boolean-like and numeric-like columns if names differ
    const fallbackQ = `SELECT * FROM ${table} ${whereClause} ${limitClause}`;
    const res = await client.query(fallbackQ, params);
    // Try to map
    return res.rows.map((r: any) => {
      const keys = Object.keys(r);
      const flagged = keys.find((k) => /flagged|unsafe|is_unsafe|unsafe_flag/i.test(k));
      const score = keys.find((k) => /score|sentiment|rating|value/i.test(k));
      return { flagged_unsafe: flagged ? !!r[flagged] : false, score: score ? (r[score] === null ? null : Number(r[score])) : null };
    });
  }
}

function defaultStartDateDays(days = 180) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function main() {
  const args = parseArgs();
  const outPath = path.resolve(process.cwd(), args.out);
  const startDate = args.start ?? defaultStartDateDays(180);

  const connectionString = process.env.DATABASE_URL || process.env.PG_CONNECTION || process.env.PGHOST ? undefined : undefined;
  // Use default pg client environment vars if DATABASE_URL not set: pg reads PGHOST/PGUSER/PGPASSWORD/PGDATABASE
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();

    const msgTable = await findUsableTable(client, MESSAGE_TABLE_CANDIDATES);
    const fbTable = await findUsableTable(client, FEEDBACK_TABLE_CANDIDATES);

    if (!msgTable) console.warn('No messages table detected from candidates:', MESSAGE_TABLE_CANDIDATES.join(', '));
    if (!fbTable) console.warn('No sentiment/feedback table detected from candidates:', FEEDBACK_TABLE_CANDIDATES.join(', '));

    const interactions = await tryQueryMessages(client, msgTable, startDate, args.limit);
    const feedback = await tryQueryFeedback(client, fbTable, startDate, args.limit);

    // Build analytics report using existing engine. The engine anonymizes user ids and validates PII patterns.
    const report: AnalyticsExport = buildAnalyticsExport(interactions, feedback as any);

    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), { encoding: 'utf8' });
    console.log(`Wrote analytics export to ${outPath}`);
  } catch (err) {
    console.error('Failed to generate analytics report:', err);
    process.exitCode = 2;
  } finally {
    await client.end().catch(() => {});
  }
}

if (require.main === module) {
  main();
}
