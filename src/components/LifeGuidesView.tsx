import React, { useState, useEffect } from 'react';
import {
  Compass,
  CheckCircle2,
  Circle,
  Sparkles,
  Search,
  Plus,
  Heart,
  Scale,
  Users,
  Briefcase,
  Home,
  Brain,
  ExternalLink,
  Save,
  Trash2,
  WifiOff,
  Bookmark,
  BookmarkCheck,
  Pin,
  Clock,
  BookOpen,
  Award,
  RotateCcw,
  Check
} from 'lucide-react';
import { LifeGuide } from '../types';
import {
  getLifeGuides,
  saveLifeGuide,
  deleteGeneratedLifeGuide,
  toggleGuideStep,
  bookmarkGuideProgress,
  toggleGuideBookmark
} from '../services/storage';
import { CategoryScroller } from './CategoryScroller';
import { usePremium } from '../contexts/PremiumContext';
import { getSupabaseClient } from '../services/supabase';

const guideCategories = ['healthcare', 'rights', 'social', 'mental_health', 'career', 'housing'] as const;
type GuideCategory = LifeGuide['category'];

function isGuideCategory(value: unknown): value is GuideCategory {
  return typeof value === 'string' && (guideCategories as readonly string[]).includes(value);
}

const categoryLabels: Record<GuideCategory, string> = {
  healthcare: 'Healthcare',
  rights: 'Rights',
  social: 'Social support',
  mental_health: 'Mental wellbeing',
  career: 'Workplace',
  housing: 'Housing and travel'
};

const offlineCategoryPlans: Record<GuideCategory, { steps: string[]; links: { name: string; detail: string }[] }> = {
  healthcare: {
    steps: [
      'List the care outcome you want, your current provider or service, key dates, and any access needs',
      'Gather relevant records, referral notes, prescriptions, names used, and questions you want answered',
      'Check official local guidance or a qualified clinician before changing treatment, medication, or appointments',
      'Choose one next contact to make, such as a GP, clinic, patient advice service, or trusted advocate',
      'Keep a private note of what was agreed, who said it, and when to follow up'
    ],
    links: [
      { name: 'Official health guidance', detail: 'Look for your local NHS, public health, insurer, or clinic information' },
      { name: 'Patient support', detail: 'Find a patient advice, complaints, or advocacy service for the provider involved' }
    ]
  },
  rights: {
    steps: [
      'Write down the decision, document, or right you need help with, including dates and people involved',
      'Collect copies of letters, forms, policies, emails, IDs, or evidence that may matter',
      'Check an official government, regulator, union, or legal-advice source before relying on legal conclusions',
      'Draft the next message or request in plain language, asking for the outcome you need and a response date',
      'Save a dated record of each action so you can explain the timeline later'
    ],
    links: [
      { name: 'Official rights source', detail: 'Use government, regulator, ombudsman, union, or recognised advice pages' },
      { name: 'Legal advice route', detail: 'Look for a qualified adviser before making high-stakes legal decisions' }
    ]
  },
  social: {
    steps: [
      'Name the relationship, conversation, or social situation you want to handle more safely',
      'Decide what you want to share, what stays private, and what boundary you need respected',
      'Write a short script using calm, direct language and one clear request',
      'Choose a support person or exit plan before the conversation if there is any risk of pressure or conflict',
      'Afterwards, note what felt okay, what did not, and what support you want next'
    ],
    links: [
      { name: 'Trusted support person', detail: 'Choose someone who respects your privacy and can help you debrief' },
      { name: 'Community support', detail: 'Look for moderated LGBTQ+ peer groups or local community organisations' }
    ]
  },
  mental_health: {
    steps: [
      'Describe what you are feeling, what triggered it, and what would make the next hour easier',
      'Pick one grounding action you can do now, such as breathing, a drink, fresh air, or moving to a calmer space',
      'Contact a trusted person, support line, GP, therapist, or community service if the feeling is hard to carry alone',
      'Reduce immediate pressure by postponing non-urgent decisions and limiting messages or tasks',
      'If there is any risk of immediate harm, use emergency or crisis support now instead of waiting'
    ],
    links: [
      { name: 'Crisis support', detail: 'Use Q crisis resources or local emergency services for immediate danger' },
      { name: 'Ongoing support', detail: 'Look for GP, therapist, counselling, or community mental-health routes' }
    ]
  },
  career: {
    steps: [
      'Define the workplace issue, outcome you want, and whether this is about safety, inclusion, pay, or progression',
      'Collect relevant policies, contracts, messages, dates, and examples while keeping copies somewhere private',
      'Plan a concise request for your manager, HR, union, mentor, or another trusted workplace contact',
      'Check official employment guidance or qualified advice before making major employment decisions',
      'Set a follow-up date and decide what you will do if the first route does not respond'
    ],
    links: [
      { name: 'Workplace policy', detail: 'Review HR, equality, absence, dress-code, grievance, or transition policies' },
      { name: 'Employment support', detail: 'Consider union, adviser, mentor, ACAS-style, or regulator guidance' }
    ]
  },
  housing: {
    steps: [
      'Clarify the housing, travel, or safety problem and what decision or deadline is coming up',
      'Gather tenancy, booking, ID, address, travel, payment, or incident records that relate to the issue',
      'Check official local housing, travel, or consumer guidance before relying on informal advice',
      'Contact the safest practical support route, such as a landlord, provider, council, advice service, or trusted person',
      'Make a backup plan for documents, transport, accommodation, money, and emergency contacts if needed'
    ],
    links: [
      { name: 'Official local guidance', detail: 'Use council, housing, transport, government, or consumer-rights sources' },
      { name: 'Practical support', detail: 'Look for tenant, travel, shelter, LGBTQ+ safety, or advice organisations' }
    ]
  }
};

function cleanGuideTopic(topic: string): string {
  return topic.replace(/\s+/g, ' ').trim().slice(0, 140);
}

function buildOfflineLifeGuide(topic: string, category: GuideCategory): Omit<LifeGuide, 'id' | 'updatedAt'> {
  const cleanTopic = cleanGuideTopic(topic) || 'this situation';
  const categoryPlan = offlineCategoryPlans[category];
  const readableCategory = categoryLabels[category];
  const firstStep = `For "${cleanTopic}", write down the specific outcome you want, what feels urgent, and what would feel safe enough as a first step`;
  const steps = [firstStep, ...categoryPlan.steps.slice(1)];

  return {
    title: `${readableCategory}: ${cleanTopic}`,
    category,
    summary: `Offline starter plan for "${cleanTopic}" with practical next steps, privacy-aware notes, and verified support routes.`,
    steps: steps.map((text, index) => ({
      id: `st-${index + 1}`,
      text,
      completed: false
    })),
    keyContactsOrLinks: categoryPlan.links,
    aiGenerated: true,
    savedOffline: true,
    readProgressPct: 0,
    isBookmarked: false
  };
}

export const LifeGuidesView: React.FC = () => {
  const { userId } = usePremium();
  const [guides, setGuides] = useState<LifeGuide[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // AI Generator Modal state
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [genTopic, setGenTopic] = useState('');
  const [genCategory, setGenCategory] = useState<GuideCategory>('healthcare');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [guideProvider, setGuideProvider] = useState<'local' | 'hosted'>('local');
  const [hasHostedGuideAccess, setHasHostedGuideAccess] = useState(false);
  const [hostedGuideAccessLoading, setHostedGuideAccessLoading] = useState(true);

  useEffect(() => {
    const mergePublishedGuides = async () => {
      const localGuides = getLifeGuides(userId);
      setGuides(localGuides);
      try {
        const response = await fetch('/api/life-guides', { cache: 'no-store' });
        if (!response.ok) return;
        const published = await response.json();
        if (!Array.isArray(published) || published.length === 0) return;
        const localById = new Map(localGuides.map((guide) => [guide.id, guide]));
        const merged = [...localGuides];
        for (const guide of published) {
          if (!localById.has(guide.id)) merged.push(guide);
        }
        setGuides(merged);
      } catch (error) {
        console.warn('[Life Guides] CRM-published guides unavailable:', error);
      }
    };
    void mergePublishedGuides();
    const refresh = () => { void mergePublishedGuides(); };
    window.addEventListener('q-cloud-applied', refresh);
    return () => window.removeEventListener('q-cloud-applied', refresh);
  }, [userId]);

  useEffect(() => {
    let active = true;
    const loadHostedGuideAccess = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
        if (!data.session?.access_token) throw new Error('No active session');
        const response = await fetch('/api/billing/paypal/status', { headers: { Authorization: `Bearer ${data.session.access_token}` } });
        const result = await response.json();
        if (!active) return;
        const entitled = response.ok && result.status === 'ACTIVE';
        setHasHostedGuideAccess(entitled);
        if (!entitled) setGuideProvider('local');
      } catch {
        if (!active) return;
        setHasHostedGuideAccess(false);
        setGuideProvider('local');
      } finally {
        if (active) setHostedGuideAccessLoading(false);
      }
    };
    void loadHostedGuideAccess();
    return () => { active = false; };
  }, [userId]);

  const handleStepToggle = (guideId: string, stepId: string) => {
    const updated = toggleGuideStep(guideId, stepId, userId);
    setGuides(updated);
  };

  const handleToggleBookmark = (guideId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = toggleGuideBookmark(guideId, userId);
    setGuides(updated);
  };

  const handleBookmarkStep = (guideId: string, stepId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = bookmarkGuideProgress(guideId, stepId, userId);
    setGuides(updated);
  };

  const handleMarkAllCompleted = (guideId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentGuide = guides.find((g) => g.id === guideId);
    if (!currentGuide) return;
    const allCompleted = currentGuide.steps.every((s) => s.completed);
    const updatedSteps = currentGuide.steps.map((s) => ({ ...s, completed: !allCompleted }));
    const updatedGuide: LifeGuide = {
      ...currentGuide,
      steps: updatedSteps,
      readProgressPct: !allCompleted ? 100 : 0,
      lastReadAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const updated = saveLifeGuide(updatedGuide, userId);
    setGuides(updated);
  };

  const handleDeleteGeneratedGuide = (guideId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentGuide = guides.find((g) => g.id === guideId);
    if (!currentGuide?.aiGenerated) return;
    if (!window.confirm(`Delete "${currentGuide.title}" from your Life Guides?`)) return;
    const updated = deleteGeneratedLifeGuide(guideId, userId);
    setGuides(updated);
  };

  const handleGenerateCustomGuide = async () => {
    const topic = cleanGuideTopic(genTopic);
    if (!topic || isGenerating) return;

    setIsGenerating(true);
    setGenerationError('');
    try {
      if (guideProvider !== 'hosted' || !hasHostedGuideAccess) {
        const localGuide: LifeGuide = {
          id: `guide-local-${Date.now()}`,
          ...buildOfflineLifeGuide(topic, genCategory),
          updatedAt: new Date().toISOString(),
        };
        const updated = saveLifeGuide(localGuide, userId);
        setGuides(updated);
        setSelectedCategory('all');
        setSearchQuery('');
        setGenerationError('Q created and saved a prompt-specific local guide.');
        setGenTopic('');
        setShowGeneratorModal(false);
        return;
      }

      const supabase = getSupabaseClient();
      const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionData.session?.access_token) headers.Authorization = `Bearer ${sessionData.session.access_token}`;

      const res = await fetch('/api/q-ai/generate-guide', {
        method: 'POST',
        headers,
        body: JSON.stringify({ topic, category: genCategory })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Q guide generation is unavailable.');
      const steps = Array.isArray(data.steps) && data.steps.length > 0
        ? data.steps.map((step: unknown) => (typeof step === 'string' ? step.trim() : '')).filter(Boolean)
        : ['Clarify the goal and what would feel safe enough to do next', 'Gather verified local information before making decisions', 'Choose one small action and note who can support you'];

      const newGuide: LifeGuide = {
        id: `guide-gen-${Date.now()}`,
        title: data.title || topic,
        category: isGuideCategory(data.category) ? data.category : genCategory,
        summary: data.summary || `AI-generated step-by-step toolkit for ${topic}`,
        steps: steps.map((stepText: string, idx: number) => ({
          id: `st-${idx + 1}`,
          text: stepText,
          completed: false
        })),
        keyContactsOrLinks: Array.isArray(data.keyContactsOrLinks) ? data.keyContactsOrLinks : undefined,
        aiGenerated: true,
        savedOffline: true,
        updatedAt: new Date().toISOString(),
        readProgressPct: 0,
        isBookmarked: false
      };

      const updated = saveLifeGuide(newGuide, userId);
      setGuides(updated);
      setSelectedCategory('all');
      setSearchQuery('');
      setGenTopic('');
      setShowGeneratorModal(false);
    } catch (err: any) {
      const reason = err?.message || 'Q guide generation is unavailable.';
      console.warn('[Q Guides] AI Guide generation failed, using local offline generator:', reason);
      const fallbackGuide: LifeGuide = {
        id: `guide-off-${Date.now()}`,
        ...buildOfflineLifeGuide(topic, genCategory),
        updatedAt: new Date().toISOString(),
      };
      const updated = saveLifeGuide(fallbackGuide, userId);
      setGuides(updated);
      setSelectedCategory('all');
      setSearchQuery('');
      setGenerationError('Hosted AI was unavailable, so Q created and saved a prompt-specific offline guide instead.');
      setGenTopic('');
      setShowGeneratorModal(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const categories = [
    { id: 'all', label: 'All Guides', icon: Compass },
    { id: 'bookmarked', label: 'Bookmarked', icon: Bookmark },
    { id: 'in_progress', label: 'In Progress', icon: Clock },
    { id: 'healthcare', label: 'Healthcare & Care', icon: Heart },
    { id: 'rights', label: 'Rights & Legal', icon: Scale },
    { id: 'social', label: 'Social & Family', icon: Users },
    { id: 'mental_health', label: 'Mental Wellbeing', icon: Brain },
    { id: 'career', label: 'Workplace & Career', icon: Briefcase },
    { id: 'housing', label: 'Housing & Travel', icon: Home }
  ];

  const filteredGuides = guides.filter((g) => {
    let matchesCategory = true;
    if (selectedCategory === 'bookmarked') {
      matchesCategory = !!g.isBookmarked || !!g.bookmarkedStepId;
    } else if (selectedCategory === 'in_progress') {
      const completedCount = g.steps.filter((s) => s.completed).length;
      matchesCategory = completedCount > 0 && completedCount < g.steps.length;
    } else if (selectedCategory !== 'all') {
      matchesCategory = g.category === selectedCategory;
    }

    const matchesSearch =
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Calculate overall reading metrics across all guides
  const totalGuides = guides.length;
  const totalStepsCount = guides.reduce((acc, g) => acc + g.steps.length, 0);
  const totalCompletedSteps = guides.reduce((acc, g) => acc + g.steps.filter((s) => s.completed).length, 0);
  const overallReadPct = totalStepsCount > 0 ? Math.round((totalCompletedSteps / totalStepsCount) * 100) : 0;
  const bookmarkedCount = guides.filter((g) => g.isBookmarked || g.bookmarkedStepId).length;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header & Generate Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Compass className="w-5 h-5 text-purple-600" /> Q Life Navigators
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Step-by-step toolkits for healthcare, legal rights, workplace transition, and social safety.
          </p>
        </div>

        <button
          onClick={() => setShowGeneratorModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-sm transition-all shrink-0 active:scale-95"
        >
          <Sparkles className="w-4 h-4 text-purple-200" />
          <span>Generate AI Guide</span>
        </button>
      </div>

      {/* Reading Progress Summary Dashboard Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900 via-purple-800 to-slate-900 text-white space-y-3 shadow-md border border-purple-800/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                Overall Reading & Action Progress
              </div>
              <div className="text-xs text-purple-200/80">
                Track saved life guide completion across all domains.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <span className="text-purple-300 block text-[10px] uppercase tracking-wider font-semibold">Total Guides</span>
              <span className="font-bold text-white">{totalGuides}</span>
            </div>
            <div className="text-right border-l border-purple-700/60 pl-4">
              <span className="text-purple-300 block text-[10px] uppercase tracking-wider font-semibold">Bookmarked</span>
              <span className="font-bold text-purple-300">{bookmarkedCount}</span>
            </div>
            <div className="text-right border-l border-purple-700/60 pl-4">
              <span className="text-purple-300 block text-[10px] uppercase tracking-wider font-semibold">Overall Read</span>
              <span className="font-bold text-emerald-400">{overallReadPct}%</span>
            </div>
          </div>
        </div>

        {/* Global Progress Line */}
        <div className="space-y-1">
          <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-400 to-emerald-400 transition-all duration-500 rounded-full"
              style={{ width: `${overallReadPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Category Filter Pills */}
        <CategoryScroller ariaLabel="Life Guide categories" className="w-full sm:flex-1">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold transition-all active:scale-95 ${
                  isActive
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 shadow-sm'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </CategoryScroller>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guides or topics..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 shadow-sm font-medium"
          />
        </div>
      </div>

      {generationError && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          {generationError}
        </div>
      )}

      {/* Guides Grid */}
      {filteredGuides.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Life Guides found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Try adjusting your search query or selecting a different filter domain above, or click "Generate Custom AI Guide" to create a new guide.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGuides.map((guide) => {
            const completedCount = guide.steps.filter((s) => s.completed).length;
            const progressPct = guide.steps.length > 0 ? Math.round((completedCount / guide.steps.length) * 100) : 0;
            const isCompleted = progressPct === 100;

            return (
              <div
                key={guide.id}
                className={`p-4 rounded-2xl bg-white border transition-all space-y-3 shadow-sm hover:shadow-md flex flex-col justify-between ${
                  guide.isBookmarked || guide.bookmarkedStepId
                    ? 'border-purple-300 ring-1 ring-purple-100'
                    : 'border-slate-200 hover:border-purple-300'
                }`}
              >
                <div>
                  {/* Badge & Bookmark Header */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                        {guide.category}
                      </span>
                      {isCompleted ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Completed
                        </span>
                      ) : progressPct > 0 ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" /> In Progress
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                          Unread
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <WifiOff className="w-3 h-3 text-emerald-600" />
                        <span className="font-medium hidden sm:inline">Offline</span>
                      </div>

                      {guide.aiGenerated && (
                        <button
                          onClick={(e) => handleDeleteGeneratedGuide(guide.id, e)}
                          title="Delete generated guide"
                          aria-label={`Delete generated guide ${guide.title}`}
                          className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition-all hover:bg-rose-100 hover:text-rose-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Bookmark Guide Toggle */}
                      <button
                        onClick={(e) => handleToggleBookmark(guide.id, e)}
                        title={guide.isBookmarked ? 'Unbookmark Guide' : 'Bookmark Guide for Later'}
                        className={`p-1.5 rounded-lg border transition-all ${
                          guide.isBookmarked
                            ? 'bg-purple-50 text-purple-600 border-purple-200 shadow-sm'
                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-700'
                        }`}
                      >
                        {guide.isBookmarked ? (
                          <BookmarkCheck className="w-4 h-4 text-purple-600" />
                        ) : (
                          <Bookmark className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Title & Summary */}
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center justify-between">
                    <span>{guide.title}</span>
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">{guide.summary}</p>

                  {/* Reading Progress Tracker Bar */}
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                        <span>Read Progress ({completedCount} of {guide.steps.length} sections)</span>
                      </span>
                      <span className="text-purple-600 font-bold">{progressPct}%</span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          isCompleted ? 'bg-emerald-500' : 'bg-purple-600'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                      <span>{isCompleted ? 'Finished reading guide' : `${guide.steps.length - completedCount} sections remaining`}</span>
                      <button
                        onClick={(e) => handleMarkAllCompleted(guide.id, e)}
                        className="text-purple-700 hover:text-purple-900 font-semibold underline"
                      >
                        {isCompleted ? 'Reset Progress' : 'Mark All Read'}
                      </button>
                    </div>
                  </div>

                  {/* Bookmarked Reading Checkpoint Indicator */}
                  {guide.bookmarkedStepId && (
                    <div className="mt-2 p-2 px-3 rounded-lg bg-purple-50 border border-purple-200 text-xs font-semibold text-purple-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Pin className="w-3.5 h-3.5 text-purple-600 fill-purple-600" />
                        <span>Bookmarked Checkpoint: Section saved</span>
                      </span>
                      <span className="text-[10px] text-purple-600 font-bold uppercase">Saved</span>
                    </div>
                  )}

                  {/* Steps / Sections Checklist */}
                  <div className="mt-3 space-y-2">
                    {guide.steps.map((step, idx) => {
                      const isStepBookmarked = guide.bookmarkedStepId === step.id;

                      return (
                        <div
                          key={step.id}
                          className={`p-2.5 rounded-xl border transition-all text-xs flex items-start justify-between gap-2.5 ${
                            isStepBookmarked
                              ? 'bg-purple-50/80 border-purple-300 ring-1 ring-purple-200 shadow-sm'
                              : step.completed
                              ? 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800 font-medium'
                          }`}
                        >
                          <div
                            onClick={() => handleStepToggle(guide.id, step.id)}
                            className="flex items-start gap-2.5 flex-1 cursor-pointer select-none"
                          >
                            {step.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-[10px] text-slate-400">Section {idx + 1}:</span>
                                <span>{step.text}</span>
                              </div>
                            </div>
                          </div>

                          {/* Bookmark specific step position */}
                          <button
                            onClick={(e) => handleBookmarkStep(guide.id, step.id, e)}
                            title={isStepBookmarked ? 'Remove Bookmark Position' : 'Bookmark this Section Position'}
                            className={`p-1 rounded transition-colors shrink-0 ${
                              isStepBookmarked
                                ? 'text-purple-600 bg-purple-100 hover:bg-purple-200'
                                : 'text-slate-400 hover:text-purple-600 hover:bg-slate-200/50'
                            }`}
                          >
                            <Pin className={`w-3.5 h-3.5 ${isStepBookmarked ? 'fill-purple-600' : ''}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Key Contacts / Resources */}
                {guide.keyContactsOrLinks && guide.keyContactsOrLinks.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 text-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Trusted Directory Links</span>
                    {guide.keyContactsOrLinks.map((link, idx) => (
                      <div key={idx} className="flex items-center justify-between text-slate-700">
                        <span className="font-semibold text-purple-700">{link.name}</span>
                        <span className="text-slate-500 text-[11px]">{link.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* AI Guide Generator Modal */}
      {showGeneratorModal && (
        <div className="q-modal-backdrop fixed inset-0 z-50 flex justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 rounded-2xl bg-white border border-slate-200 shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2 text-slate-900">
                <Sparkles className="w-5 h-5 text-purple-600" /> Generate AI Life Navigator
              </h3>
              <button onClick={() => setShowGeneratorModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Select Domain</label>
                <select
                  value={genCategory}
                  onChange={(e: any) => setGenCategory(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-purple-500 font-medium"
                >
                  <option value="healthcare">Healthcare & Gender-Affirming Care</option>
                  <option value="rights">Legal Rights & Name Changes</option>
                  <option value="social">Social & Family Navigation</option>
                  <option value="career">Workplace & Career Inclusion</option>
                  <option value="housing">Housing & Travel Safety</option>
                  <option value="mental_health">Mental Wellbeing</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Generation Mode</label>
                <select
                  value={guideProvider}
                  onChange={(e) => {
                    const provider = e.target.value as 'local' | 'hosted';
                    setGuideProvider(provider === 'hosted' && !hasHostedGuideAccess ? 'local' : provider);
                  }}
                  className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-purple-500 font-medium"
                >
                  <option value="local">Private local guide</option>
                  <option value="hosted" disabled={!hasHostedGuideAccess}>
                    {hasHostedGuideAccess ? 'Hosted AI guide' : 'Hosted AI guide - subscribers'}
                  </option>
                </select>
                {!hostedGuideAccessLoading && !hasHostedGuideAccess && (
                  <p className="mt-1 text-[11px] font-medium text-slate-500">Hosted guide generation is available to active subscribers. Local guide creation stays available.</p>
                )}
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">What life challenge or task do you need a step-by-step guide for?</label>
                <textarea
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                  placeholder="e.g. Navigating insurance pre-authorization for gender care, or explaining my identity to my landlord..."
                  rows={4}
                  className="w-full p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowGeneratorModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateCustomGuide}
                disabled={!genTopic.trim() || isGenerating}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {isGenerating ? 'Generating Toolkit...' : 'Generate & Save Offline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
