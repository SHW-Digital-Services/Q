export interface UserMemoryProfile {
  name: string;
  pronouns: string;
  identityTags: string[];
  locationRegion: string;
  lifeStage: string;
  optInMemory: boolean;
  savedGoals: string[];
  privacyLevel: 'high' | 'standard';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'q_ai';
  text: string;
  timestamp: string;
  category?: string;
  actionItems?: string[];
  suggestedResources?: { title: string; link?: string; category: string }[];
  trustedSources?: { title: string; source: string; sourceUrl?: string }[];
  isSaved?: boolean;
}

export interface LifeGuide {
  id: string;
  title: string;
  category: 'healthcare' | 'rights' | 'social' | 'mental_health' | 'career' | 'housing';
  summary: string;
  steps: { id: string; text: string; completed: boolean }[];
  keyContactsOrLinks?: { name: string; detail: string }[];
  aiGenerated?: boolean;
  savedOffline: boolean;
  updatedAt: string;
  bookmarkedStepId?: string;
  readProgressPct?: number;
  isBookmarked?: boolean;
  lastReadAt?: string;
}

export interface LivedExperienceStory {
  id: string;
  title: string;
  authorAlias: string;
  tags: string[];
  content: string;
  adviceKeyTakeaways: string[];
  upvotes: number;
  savedOffline: boolean;
  category: string;
}

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  moodRating: number; // 1 to 5
  moodTags: string[];
  title: string;
  content: string;
  isPrivate: boolean;
  synced: boolean;
  updatedAt: string;
}

export interface DailyMoodLog {
  id: string;
  date: string; // YYYY-MM-DD
  rating: number; // 1 to 5
  moodLabel: string;
  note?: string;
  tags?: string[];
  timestamp: string;
}

export interface CrisisResource {
  id: string;
  name: string;
  description: string;
  phoneOrText: string;
  website: string;
  region: string;
  availability: string;
  category: 'trans' | 'youth' | 'general' | 'mental_health' | 'legal';
}

export interface SyncStatusState {
  isOnline: boolean;
  lastSyncedAt: string | null;
  pendingSyncCount: number;
  syncMode: 'auto' | 'manual';
  cloudConnected: boolean;
}

export interface SecuritySettings {
  enabled: boolean;
  lockType: 'pin' | 'pattern';
  pinCode?: string; // 4-digit PIN string e.g. "1234"
  patternPath?: number[]; // Array of dot indices 0-8 for 3x3 pattern grid
  autoLockDelaySeconds: number; // 0 = immediate on hide, 60 = 1 min, 300 = 5 min, -1 = never
  lockScope: 'entire_app' | 'journal_only'; // Lock whole app or sensitive journal tab
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export interface InvestorSectionData {
  title: string;
  metric?: string;
  metricLabel?: string;
  description: string;
  details: string[];
}
