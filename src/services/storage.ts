import {
  UserMemoryProfile,
  LifeGuide,
  LivedExperienceStory,
  JournalEntry,
  ChatMessage,
  SyncStatusState,
  DailyMoodLog,
  SecuritySettings
} from '../types';
import {
  DEFAULT_USER_PROFILE,
  INITIAL_LIFE_GUIDES,
  INITIAL_LIVED_EXPERIENCES,
  INITIAL_JOURNAL_ENTRIES
} from '../data/initialData';

const KEYS = {
  PROFILE: 'q_user_profile_v1',
  GUIDES: 'q_life_guides_v1',
  EXPERIENCES: 'q_lived_experiences_v1',
  JOURNAL: 'q_journal_entries_v1',
  CHAT: 'q_chat_history_v1',
  SYNC_STATE: 'q_sync_state_v1',
  MOOD_LOGS: 'q_daily_mood_logs_v1',
  SECURITY: 'q_security_settings_v1'
};

function userScopedKey(key: string, userId?: string): string {
  return userId ? `${key}:${userId}` : key;
}

// Helper safely accessing localStorage
function getItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (err) {
    console.warn(`[Q Storage] Error reading key ${key}:`, err);
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[Q Storage] Error writing key ${key}:`, err);
  }
}

// User Profile Memory
export function getMemoryProfile(): UserMemoryProfile {
  return getItem<UserMemoryProfile>(KEYS.PROFILE, DEFAULT_USER_PROFILE);
}

export function saveMemoryProfile(profile: UserMemoryProfile): UserMemoryProfile {
  setItem(KEYS.PROFILE, profile);
  recordPendingSync();
  return profile;
}

// Life Guides
export function getLifeGuides(): LifeGuide[] {
  return getItem<LifeGuide[]>(KEYS.GUIDES, INITIAL_LIFE_GUIDES);
}

export function saveLifeGuide(guide: LifeGuide): LifeGuide[] {
  const current = getLifeGuides();
  const idx = current.findIndex((g) => g.id === guide.id);
  let updated: LifeGuide[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = { ...guide, updatedAt: new Date().toISOString() };
  } else {
    updated = [{ ...guide, updatedAt: new Date().toISOString() }, ...current];
  }
  setItem(KEYS.GUIDES, updated);
  recordPendingSync();
  return updated;
}

export function toggleGuideStep(guideId: string, stepId: string): LifeGuide[] {
  const current = getLifeGuides();
  const updated = current.map((g) => {
    if (g.id === guideId) {
      const updatedSteps = g.steps.map((s) => (s.id === stepId ? { ...s, completed: !s.completed } : s));
      const completedCount = updatedSteps.filter((s) => s.completed).length;
      const readProgressPct = updatedSteps.length > 0 ? Math.round((completedCount / updatedSteps.length) * 100) : 0;
      return {
        ...g,
        steps: updatedSteps,
        readProgressPct,
        lastReadAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    return g;
  });
  setItem(KEYS.GUIDES, updated);
  recordPendingSync();
  return updated;
}

export function bookmarkGuideProgress(guideId: string, stepId?: string): LifeGuide[] {
  const current = getLifeGuides();
  const updated = current.map((g) => {
    if (g.id === guideId) {
      const isCurrentlyBookmarked = g.bookmarkedStepId === stepId;
      const newBookmarkedStepId = isCurrentlyBookmarked ? undefined : stepId;
      const hasBookmark = !!newBookmarkedStepId || (!isCurrentlyBookmarked && g.isBookmarked);
      return {
        ...g,
        bookmarkedStepId: newBookmarkedStepId,
        isBookmarked: hasBookmark,
        lastReadAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    return g;
  });
  setItem(KEYS.GUIDES, updated);
  recordPendingSync();
  return updated;
}

export function toggleGuideBookmark(guideId: string): LifeGuide[] {
  const current = getLifeGuides();
  const updated = current.map((g) => {
    if (g.id === guideId) {
      const nextIsBookmarked = !g.isBookmarked;
      return {
        ...g,
        isBookmarked: nextIsBookmarked,
        bookmarkedStepId: nextIsBookmarked ? g.bookmarkedStepId : undefined,
        updatedAt: new Date().toISOString()
      };
    }
    return g;
  });
  setItem(KEYS.GUIDES, updated);
  recordPendingSync();
  return updated;
}

// Lived Experiences
export function getLivedExperiences(): LivedExperienceStory[] {
  const stored = getItem<LivedExperienceStory[] | null>(KEYS.EXPERIENCES, null);
  if (!stored) return INITIAL_LIVED_EXPERIENCES;

  // Add newly shipped seed stories to existing local installs without
  // replacing anything the user has saved or changed.
  const existingIds = new Set(stored.map((story) => story.id));
  const missingSeedStories = INITIAL_LIVED_EXPERIENCES.filter((story) => !existingIds.has(story.id));
  if (missingSeedStories.length === 0) return stored;

  const merged = [...stored, ...missingSeedStories];
  setItem(KEYS.EXPERIENCES, merged);
  return merged;
}

export function addLivedExperience(exp: LivedExperienceStory): LivedExperienceStory[] {
  const current = getLivedExperiences();
  const updated = [exp, ...current];
  setItem(KEYS.EXPERIENCES, updated);
  recordPendingSync();
  return updated;
}

export function toggleSaveLivedExperience(id: string): LivedExperienceStory[] {
  const current = getLivedExperiences();
  const updated = current.map((e) => (e.id === id ? { ...e, savedOffline: !e.savedOffline } : e));
  setItem(KEYS.EXPERIENCES, updated);
  recordPendingSync();
  return updated;
}

// Journal Entries
export function getJournalEntries(userId?: string): JournalEntry[] {
  return getItem<JournalEntry[]>(userScopedKey(KEYS.JOURNAL, userId), INITIAL_JOURNAL_ENTRIES);
}

export function saveJournalEntry(entry: JournalEntry, userId?: string): JournalEntry[] {
  const current = getJournalEntries(userId);
  const idx = current.findIndex((j) => j.id === entry.id);
  let updated: JournalEntry[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = { ...entry, updatedAt: new Date().toISOString() };
  } else {
    updated = [{ ...entry, updatedAt: new Date().toISOString() }, ...current];
  }
  setItem(userScopedKey(KEYS.JOURNAL, userId), updated);
  recordPendingSync();
  return updated;
}

export function deleteJournalEntry(id: string, userId?: string): JournalEntry[] {
  const current = getJournalEntries(userId);
  const updated = current.filter((j) => j.id !== id);
  setItem(userScopedKey(KEYS.JOURNAL, userId), updated);
  recordPendingSync();
  return updated;
}

// Daily Mood Tracker
export function getDailyMoodLogs(userId?: string): DailyMoodLog[] {
  return getItem<DailyMoodLog[]>(userScopedKey(KEYS.MOOD_LOGS, userId), []);
}

export function saveDailyMoodLog(log: DailyMoodLog, userId?: string): DailyMoodLog[] {
  const current = getDailyMoodLogs(userId);
  const idx = current.findIndex((m) => m.date === log.date);
  let updated: DailyMoodLog[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = log;
  } else {
    updated = [log, ...current];
  }
  setItem(userScopedKey(KEYS.MOOD_LOGS, userId), updated);
  recordPendingSync();
  return updated;
}

export function getPastWeekMoodLogs(userId?: string): DailyMoodLog[] {
  const existing = getDailyMoodLogs(userId);
  const logsMap = new Map<string, DailyMoodLog>();
  existing.forEach((item) => logsMap.set(item.date, item));

  const result: DailyMoodLog[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    if (logsMap.has(dateStr)) {
      result.push(logsMap.get(dateStr)!);
    }
  }

  return result;
}

// Chat Messages
export function getChatHistory(): ChatMessage[] {
  return getItem<ChatMessage[]>(KEYS.CHAT, []);
}

export function saveChatMessage(msg: ChatMessage): ChatMessage[] {
  const current = getChatHistory();
  const updated = [...current, msg];
  setItem(KEYS.CHAT, updated);
  return updated;
}

export function clearChatHistory(): void {
  localStorage.removeItem(KEYS.CHAT);
}

// Sync Metadata
function recordPendingSync(): void {
  const current = getSyncStatus();
  setItem<SyncStatusState>(KEYS.SYNC_STATE, {
    ...current,
    pendingSyncCount: current.pendingSyncCount + 1,
    lastSyncedAt: new Date().toLocaleTimeString()
  });
}

export function getSyncStatus(): SyncStatusState {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  return getItem<SyncStatusState>(KEYS.SYNC_STATE, {
    isOnline,
    lastSyncedAt: new Date().toLocaleTimeString(),
    pendingSyncCount: 0,
    syncMode: 'auto',
    cloudConnected: isOnline
  });
}

export function markSynced(): SyncStatusState {
  const updated: SyncStatusState = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastSyncedAt: new Date().toLocaleTimeString(),
    pendingSyncCount: 0,
    syncMode: 'auto',
    cloudConnected: true
  };
  setItem(KEYS.SYNC_STATE, updated);
  return updated;
}

const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  enabled: false,
  lockType: 'pin',
  pinCode: '',
  patternPath: [],
  autoLockDelaySeconds: 0,
  lockScope: 'entire_app'
};

export function getSecuritySettings(): SecuritySettings {
  return getItem<SecuritySettings>(KEYS.SECURITY, DEFAULT_SECURITY_SETTINGS);
}

export function saveSecuritySettings(settings: SecuritySettings): SecuritySettings {
  setItem(KEYS.SECURITY, settings);
  return settings;
}

// Full Backup JSON Export & Import
export function exportAppDataJSON(): string {
  const dump = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    profile: getMemoryProfile(),
    guides: getLifeGuides(),
    experiences: getLivedExperiences(),
    journal: getJournalEntries(),
    moodLogs: getDailyMoodLogs(),
    chat: getChatHistory()
  };
  return JSON.stringify(dump, null, 2);
}

export function importAppDataJSON(jsonData: string): boolean {
  try {
    const parsed = JSON.parse(jsonData);
    if (parsed.profile) setItem(KEYS.PROFILE, parsed.profile);
    if (parsed.guides) setItem(KEYS.GUIDES, parsed.guides);
    if (parsed.experiences) setItem(KEYS.EXPERIENCES, parsed.experiences);
    if (parsed.journal) setItem(KEYS.JOURNAL, parsed.journal);
    if (parsed.moodLogs) setItem(KEYS.MOOD_LOGS, parsed.moodLogs);
    if (parsed.chat) setItem(KEYS.CHAT, parsed.chat);
    markSynced();
    return true;
  } catch (err) {
    console.error('[Q Storage] Import error:', err);
    return false;
  }
}
