import React, { useState, useEffect } from 'react';
import {
  Users,
  ThumbsUp,
  Bookmark,
  BookmarkCheck,
  Plus,
  Search,
  MessageCircle,
  Tag,
  Share2,
  Check
} from 'lucide-react';
import { LivedExperienceStory } from '../types';
import { getLivedExperiences, addLivedExperience, toggleSaveLivedExperience } from '../services/storage';

export const LivedExperiencesView: React.FC = () => {
  const [stories, setStories] = useState<LivedExperienceStory[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);

  // New story form
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newCategory, setNewCategory] = useState('Social & Family');
  const [newContent, setNewContent] = useState('');
  const [newTakeaway, setNewTakeaway] = useState('');

  useEffect(() => {
    setStories(getLivedExperiences());
  }, []);

  const handleToggleSave = (id: string) => {
    const updated = toggleSaveLivedExperience(id);
    setStories(updated);
  };

  const handleUpvote = (id: string) => {
    setStories((prev) =>
      prev.map((s) => (s.id === id ? { ...s, upvotes: s.upvotes + 1 } : s))
    );
  };

  const handleCreateStory = () => {
    if (!newTitle.trim() || !newContent.trim()) return;

    const story: LivedExperienceStory = {
      id: `exp-${Date.now()}`,
      title: newTitle,
      authorAlias: newAuthor.trim() || 'Community Peer',
      tags: [newCategory, 'Lived Experience'],
      category: newCategory,
      content: newContent,
      adviceKeyTakeaways: newTakeaway.trim() ? [newTakeaway] : ['Share advice respectfully', 'Prioritize physical & emotional safety'],
      upvotes: 1,
      savedOffline: true
    };

    const updated = addLivedExperience(story);
    setStories(updated);
    setNewTitle('');
    setNewContent('');
    setNewTakeaway('');
    setShowShareModal(false);
  };

  const tagsList = ['all', 'Family', 'Housing', 'Workplace', 'Boundaries', 'Safety'];

  const filteredStories = stories.filter((s) => {
    const matchesTag = selectedTag === 'all' || s.tags.includes(selectedTag) || s.category.includes(selectedTag);
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTag && matchesSearch;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" /> Peer Lived Experiences
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real advice, strategies, and lessons learned directly from LGBTQ+ peers navigating life milestones.
          </p>
        </div>

        <button
          onClick={() => setShowShareModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-sm transition-all shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4 text-purple-200" />
          <span>Share Reflection</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-none">
          {tagsList.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all border shrink-0 active:scale-95 ${
                selectedTag === tag
                  ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 shadow-sm'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search experiences..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 shadow-sm font-medium"
          />
        </div>
      </div>

      {/* Stories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredStories.map((story) => (
          <div
            key={story.id}
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 transition-all space-y-3 shadow-sm hover:shadow-md flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-purple-600">{story.authorAlias}</span>
                <span className="text-[10px] font-semibold text-purple-700 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200">{story.category}</span>
              </div>

              <h3 className="text-sm sm:text-base font-bold text-slate-900">{story.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed mt-1">{story.content}</p>

              {/* Key Takeaways Box */}
              {story.adviceKeyTakeaways && story.adviceKeyTakeaways.length > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-purple-50/60 border border-purple-100 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                    Peer Key Takeaways:
                  </span>
                  <ul className="space-y-1 text-xs text-slate-700 font-medium">
                    {story.adviceKeyTakeaways.map((takeaway, idx) => (
                      <li key={idx} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer controls */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleUpvote(story.id)}
                  className="flex items-center gap-1.5 text-slate-700 hover:text-purple-600 transition-colors font-medium p-1 active:scale-95"
                >
                  <ThumbsUp className="w-3.5 h-3.5 text-purple-600" />
                  <span>{story.upvotes}</span>
                </button>
              </div>

              <button
                onClick={() => handleToggleSave(story.id)}
                className={`flex items-center gap-1 text-xs font-semibold p-1 active:scale-95 ${
                  story.savedOffline ? 'text-purple-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {story.savedOffline ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                <span>{story.savedOffline ? 'Saved Offline' : 'Save'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Share Story Modal */}
      {showShareModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="share-reflection-title" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
              <h3 id="share-reflection-title" className="font-bold text-base flex items-center gap-2 text-slate-900">
                <Users className="w-5 h-5 text-purple-600" /> Share Anonymous Advice / Reflection
              </h3>
              <button type="button" aria-label="Close share reflection form" onClick={() => setShowShareModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-xs sm:px-6">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Title</label>
                <input
                  autoFocus
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Navigating roommates when updating my display name"
                  className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Author Alias & Pronouns (Optional)</label>
                <input
                  type="text"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  placeholder="e.g. Robin, 24 (They/Them)"
                  className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-purple-500 font-medium"
                >
                  <option value="Social & Family">Social & Family</option>
                  <option value="Workplace & Identity">Workplace & Identity</option>
                  <option value="Housing & Rights">Housing & Rights</option>
                  <option value="Healthcare & Wellness">Healthcare & Wellness</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Your Story / Practical Experience</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Share what worked for you, what you learned, and how it helped..."
                  rows={4}
                  className="w-full p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Single Key Takeaway for Others</label>
                <input
                  type="text"
                  value={newTakeaway}
                  onChange={(e) => setNewTakeaway(e.target.value)}
                  placeholder="e.g. Scope out housing groups vetted by LGBTQ center"
                  className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateStory}
                disabled={!newTitle.trim() || !newContent.trim()}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs disabled:opacity-50 shadow-sm"
              >
                Publish Anonymous Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
