import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Newspaper, RefreshCw, Sparkles } from 'lucide-react';
import { ContentPost } from '../types';
import { QLogo } from './QLogo';
import { LegalFooter } from './LegalFooter';

type Filter = 'all' | 'news' | 'update';

function formatDate(value: string | null) {
  if (!value) return 'Draft';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

function renderBody(body: string) {
  return body.split(/\n{2,}/).map((paragraph, index) => (
    <p key={`${paragraph.slice(0, 18)}-${index}`} className="mt-4 text-sm leading-7 text-slate-700">
      {paragraph}
    </p>
  ));
}

export const NewsUpdatesPage: React.FC = () => {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const loadPosts = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/content?limit=50', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load news and updates.');
      setPosts(payload.posts ?? []);
    } catch (error: any) {
      setMessage(error.message || 'Unable to load news and updates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPosts();
  }, []);

  const visiblePosts = useMemo(() => (
    filter === 'all' ? posts : posts.filter((post) => post.content_type === filter)
  ), [filter, posts]);

  const selectedPost = posts.find((post) => post.slug === selectedSlug) ?? visiblePosts[0] ?? null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-sky-50 text-slate-950">
      <header className="pride-topline border-b border-violet-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <a href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-violet-700">
            <ArrowLeft className="h-4 w-4" />
            Home
          </a>
          <QLogo size="sm" />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-bold text-violet-800 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Q updates
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">News & Updates</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700">
              Product notes, launch news, privacy improvements, and operational updates from Q.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadPosts()}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-violet-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {[
            ['all', 'All'],
            ['news', 'News'],
            ['update', 'Updates']
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => { setFilter(id as Filter); setSelectedSlug(null); }}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${filter === id ? 'bg-slate-950 text-white' : 'border border-violet-200 bg-white text-slate-700 hover:bg-violet-50'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {message && <p className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{message}</p>}

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="space-y-3">
            {loading && posts.length === 0 ? (
              <div className="rounded-lg border border-violet-100 bg-white p-5 text-sm text-slate-600 shadow-sm">Loading updates...</div>
            ) : visiblePosts.length === 0 ? (
              <div className="rounded-lg border border-violet-100 bg-white p-5 shadow-sm">
                <Newspaper className="h-5 w-5 text-violet-600" />
                <p className="mt-3 text-sm font-bold text-slate-900">No published posts yet</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">Published Q news and updates will appear here automatically.</p>
              </div>
            ) : visiblePosts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => setSelectedSlug(post.slug)}
                className={`w-full rounded-lg border p-4 text-left shadow-sm transition ${selectedPost?.id === post.id ? 'border-violet-400 bg-violet-50' : 'border-violet-100 bg-white hover:border-violet-300'}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-950 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white">{post.content_type}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <CalendarDays className="h-3 w-3" />
                    {formatDate(post.published_at)}
                  </span>
                </div>
                <h2 className="mt-3 text-base font-black leading-snug text-slate-950">{post.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{post.summary}</p>
              </button>
            ))}
          </aside>

          <article className="min-h-[28rem] rounded-lg border border-violet-100 bg-white p-5 shadow-sm sm:p-7">
            {selectedPost ? (
              <>
                {selectedPost.hero_image_url && (
                  <img src={selectedPost.hero_image_url} alt="" className="mb-6 aspect-[16/8] w-full rounded-lg object-cover" />
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-violet-800">{selectedPost.content_type}</span>
                  <span className="text-xs font-semibold text-slate-500">{formatDate(selectedPost.published_at)}</span>
                </div>
                <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{selectedPost.title}</h2>
                <p className="mt-3 text-base font-semibold leading-7 text-slate-700">{selectedPost.summary}</p>
                <div className="mt-6 border-t border-slate-200 pt-2">{renderBody(selectedPost.body)}</div>
                {selectedPost.tags.length > 0 && (
                  <div className="mt-8 flex flex-wrap gap-2">
                    {selectedPost.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{tag}</span>)}
                  </div>
                )}
              </>
            ) : (
              <div className="flex min-h-[24rem] items-center justify-center text-center">
                <div>
                  <Newspaper className="mx-auto h-8 w-8 text-violet-600" />
                  <p className="mt-4 text-lg font-black text-slate-950">Updates are coming soon</p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">The page is ready. Publish the first post from the admin content API to populate it.</p>
                </div>
              </div>
            )}
          </article>
        </div>
      </section>
      <LegalFooter />
    </main>
  );
};
