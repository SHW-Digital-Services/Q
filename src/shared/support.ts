export const supportStatuses = ['new', 'in_progress', 'waiting_for_user', 'resolved', 'closed'] as const;
export type SupportStatus = typeof supportStatuses[number];
export const supportCategories = ['general', 'account', 'billing', 'privacy', 'technical', 'feedback'] as const;
export const supportStatusLabels: Record<SupportStatus, string> = { new: 'New', in_progress: 'In progress', waiting_for_user: 'Waiting for you', resolved: 'Resolved', closed: 'Closed' };
export interface SupportRequest {
  id: string; name: string | null; email?: string; category: string; subject: string; message: string;
  status: SupportStatus; user_id?: string | null; assigned_to?: string | null;
  due_at?:string|null; priority?:string; email_account_id?:string;email_folder_id?:string;email_message_id?:string;
  created_at: string; updated_at: string; archived_at?: string | null;
}
export interface SupportMessage {
  id: string; author_kind: 'user' | 'staff'; internal: boolean; body: string; created_at: string;
  notification_status?: 'pending' | 'sending' | 'sent' | 'failed' | 'unavailable' | null;
}
export interface SupportEvent { id: string; action: string; status: string; created_at: string; actor_id?: string | null; assigned_to?: string | null }
export interface SupportConversation { request: SupportRequest; messages: SupportMessage[]; events: SupportEvent[] }
