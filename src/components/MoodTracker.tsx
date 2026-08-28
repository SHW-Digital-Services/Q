import React, { useState, useEffect } from 'react';
import {
  Smile,
  Frown,
  Meh,
  Sun,
  CloudRain,
  Sparkles,
  TrendingUp,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  MessageSquareHeart,
  Tag
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { DailyMoodLog } from '../types';
import { getPastWeekMoodLogs, saveDailyMoodLog } from '../services/storage';
import { CategoryScroller } from './CategoryScroller';

interface MoodTrackerProps {
  onAskQSupport?: (prompt: string) => void;
  userId: string;
}

const MOOD_OPTIONS = [
  {
    rating: 5,
    emoji: '🌟',
    label: 'Empowered',
    subtext: 'Inspired, confident, vibrant',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100',
    activeColor: 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-300'
  },
  {
    rating: 4,
    emoji: '😊',
    label: 'Good',
    subtext: 'Grounded, hopeful, calm',
    color: 'bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100',
    activeColor: 'bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-300'
  },
  {
    rating: 3,
    emoji: '😐',
    label: 'Okay',
    subtext: 'Neutral, steady, coping',
    color: 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200',
    activeColor: 'bg-slate-700 text-white border-slate-800 shadow-md ring-2 ring-slate-400'
  },
  {
    rating: 2,
    emoji: '🌧️',
    label: 'Low',
    subtext: 'Tired, anxious, drained',
    color: 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100',
    activeColor: 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-300'
  },
  {
    rating: 1,
    emoji: '🌩️',
    label: 'Struggling',
    subtext: 'Overwhelmed, hurt, heavy',
    color: 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100',
    activeColor: 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-300'
  }
];

const PRESET_TAGS = ['Self-Care', 'Workplace', 'Healthcare', 'Boundaries', 'Family', 'Social', 'Identity'];

export const MoodTracker: React.FC<MoodTrackerProps> = ({ onAskQSupport, userId }) => {
  const [pastWeekLogs, setPastWeekLogs] = useState<DailyMoodLog[]>([]);
  const [todayLog, setTodayLog] = useState<DailyMoodLog | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    loadMoodData();
  }, [userId]);

  const loadMoodData = () => {
    const logs = getPastWeekMoodLogs(userId);
    setPastWeekLogs(logs);

    const todayStr = new Date().toISOString().split('T')[0];
    const existingToday = logs.find((l) => l.date === todayStr);

    if (existingToday) {
      setTodayLog(existingToday);
      setSelectedRating(existingToday.rating);
      setNoteText(existingToday.note || '');
      setSelectedTags(existingToday.tags || []);
    } else {
      // Default selection to 4 if none recorded today
      setSelectedRating(4);
    }
  };

  const handleSelectMood = (rating: number) => {
    setSelectedRating(rating);
    const option = MOOD_OPTIONS.find((m) => m.rating === rating);
    const todayStr = new Date().toISOString().split('T')[0];

    const updatedLog: DailyMoodLog = {
      id: todayLog?.id || `mood-${Date.now()}`,
      date: todayStr,
      rating,
      moodLabel: option?.label || 'Good',
      note: noteText,
      tags: selectedTags,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    saveDailyMoodLog(updatedLog, userId);
    setTodayLog(updatedLog);

    // Refresh weekly dataset for graph
    const logs = getPastWeekMoodLogs(userId);
    setPastWeekLogs(logs);

    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleSaveNoteAndTags = () => {
    if (!selectedRating) return;
    handleSelectMood(selectedRating);
  };

  const toggleTag = (tag: string) => {
    const updated = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(updated);
  };

  const handleSupportClick = () => {
    if (!onAskQSupport) return;
    const moodObj = MOOD_OPTIONS.find((m) => m.rating === selectedRating);
    const prompt = `I recorded my mood today as "${moodObj?.label || 'Good'}" (${selectedRating}/5). ${
      noteText ? `My thoughts: "${noteText}". ` : ''
    }Can you share a tailored, gentle LGBTQ+-affirming reflection and 2 actionable self-care tips for my day?`;
    onAskQSupport(prompt);
  };

  // Format chart data for recharts
  const chartData = pastWeekLogs.map((log) => {
    const d = new Date(log.date + 'T00:00:00');
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return {
      date: log.date,
      dayName: `${dayName}`,
      fullLabel: `${dayName}, ${formattedDate}`,
      rating: log.rating,
      label: log.moodLabel,
      note: log.note || ''
    };
  });

  // Calculate 7-day average rating
  const avgRating = pastWeekLogs.length > 0
    ? (pastWeekLogs.reduce((acc, curr) => acc + curr.rating, 0) / pastWeekLogs.length).toFixed(1)
    : null;

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const moodItem = MOOD_OPTIONS.find((m) => m.rating === data.rating);
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700 max-w-xs">
          <div className="font-bold text-slate-200 border-b border-slate-800 pb-1 flex items-center justify-between gap-2">
            <span>{data.fullLabel}</span>
            <span className="text-purple-300 font-semibold">{moodItem?.emoji} {data.label}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300 pt-0.5">
            <span>Score:</span>
            <span className="font-bold text-emerald-400">{data.rating} / 5</span>
          </div>
          {data.note && (
            <div className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-800/80">
              "{data.note}"
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden transition-all">
      {/* Header Bar */}
      <div
        className="flex items-center justify-between p-3.5 sm:p-4 bg-gradient-to-r from-purple-50/80 via-white to-purple-50/40 border-b border-slate-100 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-600 text-white shadow-sm">
            <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900">Daily Mood Tracker</h2>
              {savedNotice && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 animate-fade-in flex items-center gap-1">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              7-Day Trend: <strong className="text-purple-700">{avgRating ? `${avgRating} / 5.0 avg` : 'No check-ins logged yet'}</strong> • Track emotional balance offline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-purple-700 font-semibold hidden sm:inline-block bg-purple-100/60 px-2.5 py-1 rounded-lg border border-purple-200">
            {todayLog ? `Today: ${todayLog.moodLabel}` : 'Check-in Today'}
          </span>
          <button
            type="button"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-3.5 sm:p-5 space-y-4">
          {/* 1. Mood Selection Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              How are you feeling right now?
            </label>
            <CategoryScroller ariaLabel="Journal mood categories">
              {MOOD_OPTIONS.map((opt) => {
                const isSelected = selectedRating === opt.rating;
                return (
                  <button
                    key={opt.rating}
                    type="button"
                    onClick={() => handleSelectMood(opt.rating)}
                    className={`flex min-w-24 shrink-0 snap-start flex-col items-center justify-center rounded-xl border p-2 text-center transition-all active:scale-95 sm:min-w-28 sm:p-3 ${
                      isSelected ? opt.activeColor : opt.color
                    }`}
                  >
                    <span className="text-xl sm:text-2xl mb-1">{opt.emoji}</span>
                    <span className="text-[11px] sm:text-xs font-bold leading-tight">{opt.label}</span>
                    <span className="text-[9px] hidden md:block opacity-80 mt-0.5">{opt.rating}/5</span>
                  </button>
                );
              })}
            </CategoryScroller>
          </div>

          {/* 2. Recharts 7-Day Trend Visualization */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/90 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span>Past 7 Days Emotional Trend</span>
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                Score 1 (Struggling) to 5 (Empowered)
              </span>
            </div>

            <div className="w-full h-36 sm:h-44 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9333ea" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#9333ea" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="dayName"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
                  />
                  <YAxis
                    domain={[1, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="rating"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#moodGradient)"
                    activeDot={{ r: 6, fill: '#7c3aed', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. Notes, Tags, & AI Support Button */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onBlur={handleSaveNoteAndTags}
                placeholder="Add a quick daily note (e.g. Grounding walk, doctor appointment)..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 font-medium"
              />
              {onAskQSupport && (
                <button
                  type="button"
                  onClick={handleSupportClick}
                  className="px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shrink-0 active:scale-95 shadow-sm"
                >
                  <MessageSquareHeart className="w-3.5 h-3.5 text-purple-600" />
                  <span>Ask Q for Support</span>
                </button>
              )}
            </div>

            {/* Tags selection */}
            <CategoryScroller ariaLabel="Journal context categories">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                <Tag className="w-3 h-3 text-slate-400" /> Context:
              </span>
              {PRESET_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      toggleTag(tag);
                      setTimeout(handleSaveNoteAndTags, 50);
                    }}
                    className={`shrink-0 snap-start rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition-all ${
                      active
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </CategoryScroller>
          </div>
        </div>
      )}
    </div>
  );
};
