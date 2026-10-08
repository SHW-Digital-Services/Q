export const roadmapStatuses = ['under_review', 'planned', 'in_progress', 'available'] as const;
export type RoadmapStatus = typeof roadmapStatuses[number];
export const roadmapStatusLabels: Record<RoadmapStatus,string> = { under_review: 'Under review', planned: 'Planned', in_progress: 'In progress', available: 'Available' };
export const feedbackReviewStates = ['new','reviewed'] as const;
export interface RoadmapItem {
  id: string; title: string; summary: string; status: RoadmapStatus; published_at: string;
}
export interface RoadmapDraft {
  id: string; title: string; summary: string; status: RoadmapStatus; revision: number;
  published: boolean; published_title: string | null; published_summary: string | null;
  published_status: RoadmapStatus | null; published_at: string | null;
  archived_at: string | null; updated_at: string;
}
export interface FeedbackSuggestion {
  id: string; title: string; details: string; created_at: string; updated_at: string;
  review_state: 'new' | 'reviewed'; archived_at: string | null;
  roadmap: RoadmapItem | null;
}
export interface StaffFeedbackSuggestion extends FeedbackSuggestion {
  user_id: string | null; roadmap_id: string | null; revision: number;
}
