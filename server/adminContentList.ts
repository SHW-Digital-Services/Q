export const ADMIN_CONTENT_COLUMNS = 'id,slug,title,summary,body,content_type,parent_news_id,status,tags,hero_image_url,published_at,updated_at,created_at';
const LEGACY_COLUMNS = ADMIN_CONTENT_COLUMNS.replace(',parent_news_id', '');

export async function listAdminContent(db: any, options: { archived: boolean; limit: number; offset: number }) {
  const query = (columns: string) => {
    let request = db.from('content_posts').select(columns);
    request = options.archived ? request.eq('status', 'archived') : request.in('status', ['draft', 'published']);
    return request.order('updated_at', { ascending: false }).order('id', { ascending: false })
      .range(options.offset, options.offset + options.limit - 1);
  };
  let result = await query(ADMIN_CONTENT_COLUMNS);
  let relationshipsAvailable = true;
  // Older deployments must still display existing posts before the relationship
  // migration is applied. Do not mask table, permission or other column errors.
  if (['42703', 'PGRST204'].includes(result.error?.code) && String(result.error?.message).includes('parent_news_id')) {
    relationshipsAvailable = false;
    result = await query(LEGACY_COLUMNS);
    if (!result.error) result.data = (result.data ?? []).map((post: any) => ({ ...post, parent_news_id: null }));
  }
  return { ...result, relationshipsAvailable };
}
