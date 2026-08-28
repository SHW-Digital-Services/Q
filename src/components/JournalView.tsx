import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Plus,
  Smile,
  Frown,
  Meh,
  Heart,
  Lock,
  Trash2,
  Calendar,
  Sparkles,
  Tag,
  Download,
  FileDown,
  Mic,
  MicOff,
  Radio,
  Volume2,
  AlertCircle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { JournalEntry } from '../types';
import { getJournalEntries, saveJournalEntry, deleteJournalEntry } from '../services/storage';
import { deleteMemoryBlob, getMemoryBlobs, MemoryBlob } from '../services/memory';
import { MoodTracker } from './MoodTracker';
import { useLanguage } from '../contexts/LanguageContext';

interface JournalViewProps {
  onAskQSupport?: (prompt: string) => void;
  userId: string;
}

export const JournalView: React.FC<JournalViewProps> = ({ onAskQSupport, userId }) => {
  const { locale } = useLanguage();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [memoryBlobs, setMemoryBlobs] = useState<MemoryBlob[]>([]);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  // New Entry Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [moodRating, setMoodRating] = useState<number>(4);
  const [moodTags, setMoodTags] = useState<string>('Hopeful, Grounded');

  // Speech Recognition Voice Dictation State
  const [isListening, setIsListening] = useState(false);
  const [dictationTarget, setDictationTarget] = useState<'content' | 'title'>('content');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setEntries(getJournalEntries(userId));
    getMemoryBlobs(userId)
      .then(setMemoryBlobs)
      .catch(() => setMemoryError('Cloud memories are not available right now.'));
  }, [userId]);

  // Cleanup dictation on unmount or modal hide
  useEffect(() => {
    if (!showNewModal && isListening) {
      stopDictation();
    }
  }, [showNewModal]);

  const startDictation = (target: 'content' | 'title' = 'content') => {
    setSpeechError(null);
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setSpeechError('Speech recognition is not supported in this browser. Try Chrome, Edge, or Safari.');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = locale;

      recognition.onstart = () => {
        setIsListening(true);
        setDictationTarget(target);
        setInterimTranscript('');
      };

      recognition.onresult = (event: any) => {
        let finalChunk = '';
        let interimChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += transcript;
          } else {
            interimChunk += transcript;
          }
        }

        setInterimTranscript(interimChunk);

        if (finalChunk.trim()) {
          if (target === 'title') {
            setTitle((prev) => (prev ? `${prev} ${finalChunk}` : finalChunk).trim());
          } else {
            setContent((prev) => (prev ? `${prev} ${finalChunk}` : finalChunk).trim());
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setSpeechError('Microphone permission denied. Please allow mic access in browser settings.');
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Speech dictation issue: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setSpeechError('Could not start voice dictation. Please check microphone permissions.');
      setIsListening(false);
    }
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        // ignore stop errors
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  };

  const toggleDictation = (target: 'content' | 'title') => {
    if (isListening && dictationTarget === target) {
      stopDictation();
    } else {
      startDictation(target);
    }
  };

  const handleSaveEntry = () => {
    if (!title.trim() || !content.trim()) return;

    const tagsArray = moodTags.split(',').map((t) => t.trim()).filter(Boolean);

    const newEntry: JournalEntry = {
      id: `j-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      moodRating,
      moodTags: tagsArray.length > 0 ? tagsArray : ['Reflective'],
      title,
      content,
      isPrivate: true,
      synced: true,
      updatedAt: new Date().toISOString()
    };

    const updated = saveJournalEntry(newEntry, userId);
    setEntries(updated);
    setTitle('');
    setContent('');
    setShowNewModal(false);
  };

  const handleDeleteEntry = (id: string) => {
    const updated = deleteJournalEntry(id, userId);
    setEntries(updated);
  };

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await deleteMemoryBlob(userId, memoryId);
      setMemoryBlobs((current) => current.filter((memory) => memory.id !== memoryId));
    } catch {
      setMemoryError('Could not delete that memory. Please try again.');
    }
  };

  const handleExportPDF = () => {
    if (entries.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    // Document Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(126, 34, 206); // Purple
    doc.text('Q Private Journal & Mood Archive', margin, y);
    y += 8;

    // Subtitle & Metadata
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    const dateStr = new Date().toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`Exported on ${dateStr} • Total Saved Reflections: ${entries.length}`, margin, y);
    y += 8;

    // Separator Line
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 12;

    // Loop through entries
    entries.forEach((entry, idx) => {
      // Check for page boundary
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42); // Slate-900

      const moodEmoji =
        entry.moodRating >= 4
          ? 'Positive'
          : entry.moodRating === 3
          ? 'Neutral'
          : 'Challenging';
      const headerText = `${entry.title}`;
      doc.text(headerText, margin, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Date: ${entry.date} at ${entry.time} | Mood: ${moodEmoji} (${entry.moodRating}/5)`,
        margin,
        y
      );
      y += 5;

      if (entry.moodTags && entry.moodTags.length > 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(37, 99, 235);
        doc.text(`Tags: ${entry.moodTags.map((t) => `#${t}`).join(', ')}`, margin, y);
        y += 6;
      }

      // Entry Content Text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85); // Slate-700
      const splitContent = doc.splitTextToSize(entry.content, contentWidth);

      splitContent.forEach((line: string) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += 5;
      });

      y += 6;
      if (idx < entries.length - 1) {
        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;
      }
    });

    const filename = `Q_Journal_Archive_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  const getMoodIcon = (rating: number) => {
    if (rating >= 4) return <Smile className="w-5 h-5 text-emerald-600" />;
    if (rating === 3) return <Meh className="w-5 h-5 text-amber-600" />;
    return <Frown className="w-5 h-5 text-rose-600" />;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-600" /> Q Private Journal & Mood
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Safe, encrypted local reflections. Track emotional wellbeing and transition milestones offline.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportPDF}
            disabled={entries.length === 0}
            title={entries.length === 0 ? 'No journal entries to export' : 'Export Journal Entries as PDF'}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border border-slate-200 active:scale-95"
          >
            <FileDown className="w-4 h-4 text-purple-600" />
            <span>Export PDF</span>
          </button>

          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 text-purple-200" />
            <span>New Entry</span>
          </button>
        </div>
      </div>

      {/* Daily Mood Tracker Widget */}
      <MoodTracker onAskQSupport={onAskQSupport} userId={userId} />

      {/* Mood Summary Header */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-600" />
          <span className="font-medium">Encrypted Local Storage • Device only</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Total Entries: <strong className="text-purple-600">{entries.length}</strong></span>
          <span>Last Reflection: <strong className="text-slate-900">{entries[0]?.date || 'None'}</strong></span>
        </div>
      </div>

      {/* Cloud Memory Blobs */}
      <section className="p-4 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">What Q Remembers</h2>
            <p className="text-[11px] text-slate-500">Private memory blobs attached to your account. You can remove them at any time.</p>
          </div>
          <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
        </div>
        {memoryError && <p className="text-xs text-rose-700">{memoryError}</p>}
        {memoryBlobs.length === 0 && !memoryError && (
          <p className="text-xs text-slate-500">Q has no saved cloud memories for this account.</p>
        )}
        <div className="space-y-2">
          {memoryBlobs.map((memory) => (
            <div key={memory.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-purple-50 border border-purple-100">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide font-bold text-purple-700">{memory.kind}</div>
                <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">{memory.content}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteMemory(memory.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                title="Delete this memory"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Journal Entries List */}
      <div className="space-y-3.5">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 transition-all space-y-3 shadow-sm hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
                  {getMoodIcon(entry.moodRating)}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">{entry.title}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                    <Calendar className="w-3 h-3 text-purple-600" />
                    <span>{entry.date} at {entry.time}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDeleteEntry(entry.id)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors active:scale-95"
                title="Delete Entry"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap pl-1">
              {entry.content}
            </p>

            {/* Tags */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 flex-wrap">
                {entry.moodTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-purple-50 text-purple-700 border border-purple-200"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-600" /> Private & Synced
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* New Entry Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-white border border-slate-200 shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2 text-slate-900">
                <BookOpen className="w-5 h-5 text-purple-600" /> New Private Reflection
              </h3>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Hands-free Voice Dictation Active Banner */}
              {isListening && (
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 flex items-start gap-3 text-purple-900 animate-pulse">
                  <div className="p-2 rounded-lg bg-purple-600 text-white shrink-0 animate-bounce">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span className="flex items-center gap-1.5">
                        <Mic className="w-3.5 h-3.5 text-purple-700" /> Dictating hands-free to{' '}
                        <u className="capitalize">{dictationTarget}</u>...
                      </span>
                      <button
                        type="button"
                        onClick={stopDictation}
                        className="px-2 py-0.5 rounded bg-purple-200 hover:bg-purple-300 text-purple-900 font-bold text-[10px]"
                      >
                        Stop
                      </button>
                    </div>
                    <p className="text-[11px] text-purple-700 italic">
                      {interimTranscript ? `"${interimTranscript}"` : 'Listening to your voice... speak naturally.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Speech Error Banner */}
              {speechError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-rose-800 text-xs">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{speechError}</span>
                  </span>
                  <button onClick={() => setSpeechError(null)} className="text-rose-500 font-bold ml-2">
                    ✕
                  </button>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-600 font-medium">Title</label>
                  <button
                    type="button"
                    onClick={() => toggleDictation('title')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                      isListening && dictationTarget === 'title'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                    }`}
                  >
                    {isListening && dictationTarget === 'title' ? (
                      <>
                        <MicOff className="w-3 h-3" /> Stop Voice
                      </>
                    ) : (
                      <>
                        <Mic className="w-3 h-3 text-purple-600" /> Dictate Title
                      </>
                    )}
                  </button>
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Setting boundaries, transition milestone, or evening thoughts..."
                  className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Mood Rating (1 to 5)</label>
                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setMoodRating(num)}
                      className={`flex-1 py-2 rounded-md font-semibold text-xs transition-all active:scale-95 ${
                        moodRating === num
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                      }`}
                    >
                      {num} {num >= 4 ? '😊' : num === 3 ? '😐' : '😔'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Mood Tags (comma separated)</label>
                <input
                  type="text"
                  value={moodTags}
                  onChange={(e) => setMoodTags(e.target.value)}
                  placeholder="e.g. Hopeful, Inspired, Anxious, Peaceful"
                  className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-600 font-medium">Reflection Content</label>
                  <button
                    type="button"
                    onClick={() => toggleDictation('content')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                      isListening && dictationTarget === 'content'
                        ? 'bg-purple-600 text-white shadow-sm animate-pulse'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                    }`}
                  >
                    {isListening && dictationTarget === 'content' ? (
                      <>
                        <MicOff className="w-3 h-3 text-white" /> Stop Listening
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5 text-purple-600" /> Hands-Free Dictation
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write freely or tap 'Hands-Free Dictation' to dictate your thoughts..."
                  rows={5}
                  className="w-full p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEntry}
                disabled={!title.trim() || !content.trim()}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs disabled:opacity-50 shadow-sm"
              >
                Save Private Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
