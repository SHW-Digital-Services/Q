import { randomInt } from 'node:crypto';
import { getServiceSupabase } from './routes/admin.js';

type Post = { id: string; user_id: string | null; title: string; author_alias: string; upvotes: number; published_at: string; };

function monthBounds(month?: string) {
  const value = month && /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : new Date(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1).toISOString().slice(0, 10);
  const start = new Date(`${value}T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { month: value, start: start.toISOString(), end: end.toISOString() };
}

function websiteUrl(id: string) { return `${(process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/peer-knowledge/${id}`; }

async function getExisting(db: any, month: string) {
  return db.from('community_newsletters').select('*').eq('award_month', month).maybeSingle();
}

export async function buildCommunityNewsletter(month?: string, options: { award?: boolean } = {}) {
  const db = getServiceSupabase();
  if (!db) throw new Error('Supabase service credentials are not configured.');
  const bounds = monthBounds(month);
  const existing = await getExisting(db, bounds.month);
  if (existing.error) throw existing.error;
  if (existing.data?.status === 'delivered' || (existing.data?.status === 'awarded' && options.award === false)) return existing.data.payload;

  const postsResult = await db.from('peer_knowledge_posts')
    .select('id,user_id,title,author_alias,upvotes,published_at')
    .eq('status', 'approved').gte('published_at', bounds.start).lt('published_at', bounds.end)
    .order('upvotes', { ascending: false }).order('published_at', { ascending: true }).limit(100);
  if (postsResult.error) throw postsResult.error;
  const posts = (postsResult.data ?? []) as Post[];
  const cutoff = new Date(`${bounds.month}T00:00:00.000Z`); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  const recent = await db.from('community_competition_winners').select('user_id').gte('created_at', cutoff.toISOString()).not('user_id', 'is', null);
  if (recent.error) throw recent.error;
  const excluded = new Set((recent.data ?? []).map((row: any) => row.user_id));
  const eligible = posts.filter(post => !post.user_id || !excluded.has(post.user_id));
  const topFive = eligible.slice(0, 5);
  if (!topFive.length) throw new Error(`No eligible approved community posts found for ${bounds.month}.`);
  const randomWinner = topFive[randomInt(topFive.length)];
  const mostLiked = topFive[0];
  const payload = {
    event: 'monthly_newsletter.ready', month: bounds.month,
    topContributions: topFive.map(post => ({ title: post.title, authorAlias: post.author_alias, likes: post.upvotes, url: websiteUrl(post.id) })),
    randomTopFiveWinner: { title: randomWinner.title, authorAlias: randomWinner.author_alias, url: websiteUrl(randomWinner.id) },
    mostLikedWinner: { title: mostLiked.title, authorAlias: mostLiked.author_alias, likes: mostLiked.upvotes, premiumMonths: 6, url: websiteUrl(mostLiked.id) },
    upcomingEvents: []
  };
  let newsletterId = existing.data?.id;
  if (!newsletterId) {
    const inserted = await db.from('community_newsletters').insert({ award_month: bounds.month, payload, status: 'preview' }).select('id').single();
    if (inserted.error && inserted.error.code !== '23505') throw inserted.error;
    newsletterId = inserted.data?.id || (await getExisting(db, bounds.month)).data?.id;
  } else {
    const updated = await db.from('community_newsletters').update({ payload, updated_at: new Date().toISOString() }).eq('id', newsletterId);
    if (updated.error) throw updated.error;
  }
  if (options.award) await awardNewsletter(db, newsletterId, bounds.month, randomWinner, mostLiked, payload);
  return payload;
}

async function awardNewsletter(db: any, newsletterId: string, month: string, randomWinner: Post, mostLiked: Post, payload: any) {
  const existingWinners = await db.from('community_competition_winners').select('winner_type').eq('newsletter_id', newsletterId);
  if (existingWinners.error) throw existingWinners.error;
  if (!(existingWinners.data ?? []).length) {
    const now = new Date(); const eligibleAgain = new Date(now); eligibleAgain.setUTCFullYear(eligibleAgain.getUTCFullYear() + 1);
    const inserted = await db.from('community_competition_winners').insert([
      { newsletter_id: newsletterId, user_id: randomWinner.user_id, post_id: randomWinner.id, winner_type: 'random_top_five', likes: randomWinner.upvotes, prize_months: 0 },
      { newsletter_id: newsletterId, user_id: mostLiked.user_id, post_id: mostLiked.id, winner_type: 'most_liked', likes: mostLiked.upvotes, prize_months: 6, eligible_again_at: eligibleAgain.toISOString() }
    ]);
    if (inserted.error) throw inserted.error;
    const productId = process.env.COMMUNITY_PREMIUM_PRODUCT_ID;
    if (!productId || !mostLiked.user_id) throw new Error('COMMUNITY_PREMIUM_PRODUCT_ID and a linked winner account are required to award Premium.');
    const ends = new Date(now); ends.setUTCMonth(ends.getUTCMonth() + 6);
    const entitlement = await db.from('crm_entitlements').insert({ user_id: mostLiked.user_id, product_id: productId, source: 'community_competition', ends_at: ends.toISOString(), reason: `Monthly Q Community competition winner (${month})` });
    if (entitlement.error) throw entitlement.error;
    const marked = await db.from('community_newsletters').update({ status: 'awarded', awarded_at: now.toISOString(), payload, updated_at: now.toISOString() }).eq('id', newsletterId);
    if (marked.error) throw marked.error;
  }
}

export function slackBlocks(payload: any) {
  const list = (payload.topContributions ?? []).map((item: any, index: number) => `${index + 1}. <${item.url}|${item.title}> — ${item.authorAlias} (${item.likes} likes)`).join('\n');
  return { text: `Q Community newsletter — ${payload.month}`, blocks: [
    { type: 'header', text: { type: 'plain_text', text: `Q Community newsletter — ${payload.month}` } },
    { type: 'section', text: { type: 'mrkdwn', text: `*Top contributions of the month*\n${list}` } },
    { type: 'section', text: { type: 'mrkdwn', text: `🎉 *Random top-five winner*\n<${payload.randomTopFiveWinner.url}|${payload.randomTopFiveWinner.title}> — ${payload.randomTopFiveWinner.authorAlias}` } },
    { type: 'section', text: { type: 'mrkdwn', text: `🏆 *Most-liked post*\n<${payload.mostLikedWinner.url}|${payload.mostLikedWinner.title}> — ${payload.mostLikedWinner.authorAlias}\nPrize: *six months of Q Premium free*. Winners cannot win this competition again for 12 months.` } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: 'Thanks for contributing, connecting and helping the Q Community grow 💛' }] }
  ] };
}

export async function deliverCommunityNewsletter(payload: any) {
  const url = process.env.SLACK_Q_COMMUNITY_NEWSLETTER_WEBHOOK_URL;
  if (!url) throw new Error('SLACK_Q_COMMUNITY_NEWSLETTER_WEBHOOK_URL is not configured.');
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(slackBlocks(payload)), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Slack delivery failed with HTTP ${response.status}.`);
}
