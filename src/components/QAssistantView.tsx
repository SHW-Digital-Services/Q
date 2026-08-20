import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  User,
  Shield,
  BookmarkPlus,
  RotateCcw,
  Sliders,
  Check,
  ChevronRight,
  Zap,
  Lock
} from 'lucide-react';
import { ChatMessage, UserMemoryProfile, LifeGuide } from '../types';
import { getChatHistory, saveChatMessage, clearChatHistory, getMemoryProfile, saveMemoryProfile, saveLifeGuide } from '../services/storage';
import { maskPII, sanitizeChatHistory, sanitizeProfileForExternalService } from '../services/pii';
import { queryVettedKnowledge } from '../services/trustedKnowledge';
import { getRecentMemoryBlobs, saveMemoryBlob } from '../services/memory';
import { QLogo } from './QLogo';

interface QAssistantViewProps {
  onOpenReflection?: () => void;
  userId: string;
}

export const QAssistantView: React.FC<QAssistantViewProps> = ({ onOpenReflection, userId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<UserMemoryProfile>(getMemoryProfile());
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [savedGuideNotice, setSavedGuideNotice] = useState<string | null>(null);
  const [reflectionPrompt, setReflectionPrompt] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const history = getChatHistory();
    if (history.length === 0) {
      // Initial Q welcome message
      const welcomeMsg: ChatMessage = {
        id: 'msg-welcome',
        sender: 'q_ai',
        text: `Hello ${profile.name || 'friend'}. I am Q Intelligence, your personalized AI life companion tailored for LGBTQ+ lived experiences.\n\nWhether you need guidance on affirming healthcare, workplace name updates, local safe spaces, coming out strategies, or legal rights in your region, I'm here to support you safely and confidentially. How can I help you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        category: 'Welcome'
      };
      setMessages([welcomeMsg]);
      saveChatMessage(welcomeMsg);
    } else {
      setMessages(history);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputPrompt;
    if (!query.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    saveChatMessage(userMsg);
    setInputPrompt('');
    setIsLoading(true);

    try {
      // Privacy boundary: only safeInput may leave the device for the hosted API.
      const safeInput = maskPII(query);
      let recentMemories = [];
      if (profile.optInMemory) {
        try {
          recentMemories = await getRecentMemoryBlobs(userId);
        } catch (memoryError) {
          console.warn('[Q Memory] Recent memory retrieval unavailable:', memoryError);
        }
      }
      const needsVettedKnowledge = /\b(legal|law|rights|health|healthcare|medical|doctor|therapy|prescription|insurance)\b/i.test(query);
      let trustedKnowledge;
      if (needsVettedKnowledge) {
        try {
          trustedKnowledge = await queryVettedKnowledge(safeInput);
        } catch (knowledgeError) {
          console.warn('[Q Knowledge] Vetted repository unavailable:', knowledgeError);
        }
      }
      const groundedPrompt = trustedKnowledge
        ? `User asked: ${safeInput}\n\nHere is the vetted community context:\n${trustedKnowledge.items
            .map((item) => `- ${item.title}: ${item.summary} (Source: ${item.source})`)
            .join('\n')}\n\nPlease answer based strictly on the context provided. If it does not answer the question, say so clearly.`
        : safeInput;
      const memoryContext = recentMemories.length > 0
        ? `\n\nRecent user-approved memory context:\n${recentMemories.map((memory) => `- ${memory.content}`).join('\n')}`
        : '';
      const response = await fetch('/api/q-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `${groundedPrompt}${memoryContext}`,
          history: sanitizeChatHistory(updatedMessages.slice(-6)),
          userProfile: sanitizeProfileForExternalService(profile),
          trustedKnowledge
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Q chat service unavailable.');

      const aiMsg: ChatMessage = {
        id: `q-${Date.now()}`,
        sender: 'q_ai',
        text: data.reply || 'I am here to support you.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionItems: data.actionItems,
        trustedSources: trustedKnowledge?.items
      };

      setMessages((prev) => [...prev, aiMsg]);
      saveChatMessage(aiMsg);
      if (profile.optInMemory && data.reply) {
        void saveMemoryBlob(userId, data.reply).catch((memoryError) => {
          console.warn('[Q Memory] Response persistence unavailable:', memoryError);
        });
      }
      if (/\b(stress|stressed|anxious|anxiety|overwhelmed|panic|dysphoria|depressed|depression|burnout|unsafe|coming out|health concern|workplace conflict|grief|trauma)\b/i.test(query)) {
        setReflectionPrompt(true);
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Q chat service unavailable.';
      console.warn('[Q Client] Server call failed:', errorMessage);
      const fallbackMsg: ChatMessage = {
        id: `q-off-${Date.now()}`,
        sender: 'q_ai',
        text: `Q could not generate a live AI response right now.\n\nReason: ${errorMessage}\n\nPlease try again in a moment. If this keeps happening, the server AI provider or API key needs checking.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      saveChatMessage(fallbackMsg);
      if (/\b(stress|stressed|anxious|anxiety|overwhelmed|panic|dysphoria|depressed|depression|burnout|unsafe|coming out|health concern|workplace conflict|grief|trauma)\b/i.test(query)) {
        setReflectionPrompt(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToGuides = (msg: ChatMessage) => {
    const newGuide: LifeGuide = {
      id: `guide-${Date.now()}`,
      title: `Q Insight: ${msg.text.slice(0, 45)}...`,
      category: 'social',
      summary: msg.text.slice(0, 140),
      steps: [
        { id: 'st-1', text: 'Review key recommendations', completed: false },
        { id: 'st-2', text: 'Apply strategies to personal situation', completed: false }
      ],
      aiGenerated: true,
      savedOffline: true,
      updatedAt: new Date().toISOString()
    };
    saveLifeGuide(newGuide);
    setSavedGuideNotice('Saved to your offline Q Life Guides!');
    setTimeout(() => setSavedGuideNotice(null), 2500);
  };

  const handleClearHistory = () => {
    clearChatHistory();
    const resetMsg: ChatMessage = {
      id: `msg-reset-${Date.now()}`,
      sender: 'q_ai',
      text: 'Memory context cleared for this session. How can Q assist you next?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([resetMsg]);
    saveChatMessage(resetMsg);
  };

  const quickPrompts = [
    { title: 'Affirming Healthcare Navigation', text: 'How do I find culturally competent LGBTQ+ doctors and ask about insurance coverage?' },
    { title: 'Workplace Name & Pronoun Policy', text: 'Draft a professional email to HR asking to update my display name and email alias.' },
    { title: 'Family Boundaries & Coming Out', text: 'What strategies help set clear boundaries when coming out to traditional family?' },
    { title: 'Regional Legal Protections', text: 'How can I check non-discrimination laws and name marker change processes in my area?' }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] max-w-4xl mx-auto gap-3">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <QLogo size="sm" />
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              Q Intelligence
            </h1>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Context Memory: <span className="text-purple-600 font-semibold">{profile.pronouns}</span> • Privacy:{' '}
              <span className="text-purple-700 font-semibold capitalize">{profile.privacyLevel}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMemoryModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-purple-50 hover:border-purple-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors shadow-sm"
          >
            <Sliders className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">Memory Engine</span>
          </button>
          <button
            onClick={handleClearHistory}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs border border-slate-200 transition-colors shadow-sm"
            title="Clear active chat history"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {savedGuideNotice && (
        <div className="p-3 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 text-xs font-semibold flex items-center gap-2 animate-fade-in shadow-sm">
          <Check className="w-4 h-4 text-purple-600" />
          {savedGuideNotice}
        </div>
      )}

      {reflectionPrompt && (
        <div className="p-3 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>That sounds like an important moment. Would a private reflection or mood check-in help?</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setReflectionPrompt(false);
                onOpenReflection?.();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
            >
              Open Journal & Mood
            </button>
            <button
              type="button"
              onClick={() => setReflectionPrompt(false)}
              className="px-2.5 py-1.5 rounded-lg text-emerald-700 font-semibold hover:bg-emerald-100"
            >
              Not now
            </button>
          </div>
        </div>
      )}


      {/* Main Conversation Canvas */}
      <div className="flex-1 overflow-y-auto space-y-3.5 p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        {messages.map((msg) => {
          const isAI = msg.sender === 'q_ai';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 max-w-[90%] sm:max-w-2xl ${isAI ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                  isAI
                    ? 'bg-purple-950 text-white border-purple-800 shadow-sm p-0.5 overflow-hidden'
                    : 'bg-slate-800 text-white border-slate-900 shadow-sm'
                }`}
              >
                {isAI ? <QLogo size="xs" /> : <User className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed space-y-3 ${
                  isAI
                    ? 'bg-slate-50 border border-slate-200 text-slate-800 shadow-sm'
                    : 'bg-purple-600 text-white font-medium shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {isAI && msg.trustedSources && msg.trustedSources.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-emerald-800">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 font-semibold">
                      <Shield className="w-3 h-3 text-emerald-600" />
                      Verified by Q&apos;s Vetted Library
                    </span>
                    {msg.trustedSources.map((source) => (
                      source.sourceUrl ? (
                        <a key={`${msg.id}-${source.title}`} href={source.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-emerald-950">
                          {source.title}
                        </a>
                      ) : (
                        <span key={`${msg.id}-${source.title}`}>{source.title}</span>
                      )
                    ))}
                  </div>
                )}

                {/* Action Items list if available */}
                {msg.actionItems && msg.actionItems.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Suggested Action Steps:
                    </span>
                    <ul className="space-y-1">
                      {msg.actionItems.map((item, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                          <ChevronRight className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Footer Controls for AI messages */}
                {isAI && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                    <span>Q Intelligence • {msg.timestamp}</span>
                    <button
                      onClick={() => handleSaveToGuides(msg)}
                      className="flex items-center gap-1 text-purple-700 hover:text-purple-900 font-semibold transition-colors"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      Save to Vault
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-3 text-xs text-purple-800 bg-purple-50 p-3 rounded-2xl border border-purple-200 w-fit font-medium">
            <QLogo size="xs" className="animate-spin" />
            <span>Q is synthesizing personalized guidance...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Category Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(prompt.text)}
            className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-purple-50 text-slate-700 border border-slate-200 hover:border-purple-300 text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95"
          >
            <Zap className="w-3.5 h-3.5 text-purple-600" />
            {prompt.title}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-2 p-2 rounded-2xl bg-white border border-slate-200 shadow-md"
      >
        <span
          title={inputPrompt.trim() ? 'PII shield active: this message will be masked before leaving your device' : 'PII shield ready'}
          className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold shrink-0 transition-colors ${
            inputPrompt.trim()
              ? 'bg-emerald-100 text-emerald-700 animate-pulse'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">PII Shield</span>
        </span>
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Ask Q about healthcare, legal rights, family boundaries..."
          disabled={isLoading}
          className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
        />
        <button
          type="submit"
          disabled={!inputPrompt.trim() || isLoading}
          className="p-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 transition-all shadow-sm font-semibold active:scale-95 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Q Memory Engine Settings Modal */}
      {showMemoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white border border-slate-200 shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2 text-slate-900">
                <Shield className="w-5 h-5 text-purple-600" /> Q Context Memory Settings
              </h3>
              <button onClick={() => setShowMemoryModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Preferred Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Pronouns</label>
                <input
                  type="text"
                  value={profile.pronouns}
                  onChange={(e) => setProfile({ ...profile, pronouns: e.target.value })}
                  placeholder="e.g. They/Them, She/Her, He/Him"
                  className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Region / Location (for Legal & Healthcare laws)</label>
                <input
                  type="text"
                  value={profile.locationRegion}
                  onChange={(e) => setProfile({ ...profile, locationRegion: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div>
                  <div className="font-semibold text-slate-800">Opt-In AI Context Memory</div>
                  <div className="text-[11px] text-slate-500">Allow Q to recall pronouns and goals in chat</div>
                </div>
                <input
                  type="checkbox"
                  checked={profile.optInMemory}
                  onChange={(e) => setProfile({ ...profile, optInMemory: e.target.checked })}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => {
                  saveMemoryProfile(profile);
                  setShowMemoryModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-sm"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
