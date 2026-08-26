import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CreditCard,
  Database,
  Download,
  Lock,
  LogOut,
  Mail,
  RotateCcw,
  Save,
  Shield,
  Sparkles,
  Gift,
  Copy,
  UserCircle
} from 'lucide-react';
import { AuthUser, UserMemoryProfile } from '../types';
import { getMemoryProfile, saveMemoryProfile } from '../services/storage';
import { getSupabaseClient, mapSupabaseUser } from '../services/supabase';

interface ProfileViewProps {
  currentUser: AuthUser;
  onUserChanged: (user: AuthUser) => void;
  onOpenAccount: () => void;
  onOpenBackup: () => void;
  onOpenSecurity: () => void;
  onOpenSubscription: () => void;
  onSignOut: () => void;
}

function linesToArray(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToLines(value: string[]): string {
  return value.join('\n');
}

function splitDisplayName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: 'Unknown' };
  if (parts.length === 1) return { firstName: '', lastName: parts[0] };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1]
  };
}

function buildAuthMetadata(profile: UserMemoryProfile) {
  const { firstName, lastName } = splitDisplayName(profile.name);
  return {
    name: profile.name,
    first_name: firstName,
    last_name: lastName,
    q_pronouns: profile.pronouns,
    q_location_region: profile.locationRegion,
    q_life_stage: profile.lifeStage,
    q_identity_tags: profile.identityTags,
    q_saved_goals: profile.savedGoals,
    q_opt_in_memory: profile.optInMemory,
    q_crm_sync_consent: profile.crmSyncConsent,
    q_privacy_level: profile.privacyLevel,
    q_profile_updated_at: new Date().toISOString()
  };
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  onUserChanged,
  onOpenAccount,
  onOpenBackup,
  onOpenSecurity,
  onOpenSubscription,
  onSignOut
}) => {
  const [profile, setProfile] = useState<UserMemoryProfile>(getMemoryProfile());
  const [identityTagsText, setIdentityTagsText] = useState(arrayToLines(profile.identityTags));
  const [savedGoalsText, setSavedGoalsText] = useState(arrayToLines(profile.savedGoals));
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referral, setReferral] = useState<any>(null);
  const [referralEmail, setReferralEmail] = useState('');
  const [referralStatus, setReferralStatus] = useState<string | null>(null);

  const authHeaders = async () => {
    const supabase = getSupabaseClient();
    const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    if (!data.session?.access_token) throw new Error('Please sign in again.');
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` };
  };

  const loadReferrals = async () => {
    try {
      const response = await fetch('/api/referrals/me', { headers: await authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load referrals.');
      setReferral(data);
    } catch (error:any) {
      setReferralStatus(error.message || 'Unable to load referrals.');
    }
  };

  useEffect(() => { void loadReferrals(); }, [currentUser.id]);

  const inviteReferral = async (event: React.FormEvent) => {
    event.preventDefault();
    setReferralStatus(null);
    try {
      const response = await fetch('/api/referrals/invite', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ email: referralEmail }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to create referral.');
      setReferralEmail('');
      setReferralStatus('Referral created. Copy your link and send it to this person.');
      await loadReferrals();
    } catch (error:any) { setReferralStatus(error.message || 'Unable to create referral.'); }
  };

  useEffect(() => {
    setIdentityTagsText(arrayToLines(profile.identityTags));
    setSavedGoalsText(arrayToLines(profile.savedGoals));
  }, [profile.identityTags, profile.savedGoals]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    let cancelled = false;

    supabase
      .from('profiles')
      .select('preferred_name, pronouns, identity_tags, location_region, life_stage, opt_in_memory, crm_sync_consent, privacy_level')
      .eq('id', currentUser.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;

        setProfile((storedProfile) => ({
          ...storedProfile,
          name: data.preferred_name ?? storedProfile.name,
          pronouns: data.pronouns ?? storedProfile.pronouns,
          identityTags: Array.isArray(data.identity_tags) ? data.identity_tags : storedProfile.identityTags,
          locationRegion: data.location_region ?? storedProfile.locationRegion,
          lifeStage: data.life_stage ?? storedProfile.lifeStage,
          optInMemory: typeof data.opt_in_memory === 'boolean' ? data.opt_in_memory : storedProfile.optInMemory,
          crmSyncConsent: typeof data.crm_sync_consent === 'boolean' ? data.crm_sync_consent : storedProfile.crmSyncConsent,
          privacyLevel: data.privacy_level === 'standard' ? 'standard' : storedProfile.privacyLevel
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser.id]);

  const profileCompleteness = useMemo(() => {
    const checks = [
      profile.name.trim(),
      profile.pronouns.trim(),
      profile.locationRegion.trim(),
      profile.lifeStage.trim(),
      profile.identityTags.length > 0,
      profile.savedGoals.length > 0
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile]);

  const handleSave = async () => {
    setIsSaving(true);
    setStatus(null);

    const updatedProfile: UserMemoryProfile = {
      ...profile,
      name: profile.name.trim(),
      pronouns: profile.pronouns.trim(),
      locationRegion: profile.locationRegion.trim(),
      lifeStage: profile.lifeStage.trim(),
      identityTags: linesToArray(identityTagsText),
      savedGoals: linesToArray(savedGoalsText)
    };

    const supabase = getSupabaseClient();
    let remoteSaveFailed = false;

    if (supabase) {
      const profileRow = {
        id: currentUser.id,
        preferred_name: updatedProfile.name || null,
        pronouns: updatedProfile.pronouns || null,
        identity_tags: updatedProfile.identityTags,
        location_region: updatedProfile.locationRegion || null,
        life_stage: updatedProfile.lifeStage || null,
        opt_in_memory: updatedProfile.optInMemory,
        crm_sync_consent: updatedProfile.crmSyncConsent,
        privacy_level: updatedProfile.privacyLevel,
        updated_at: new Date().toISOString()
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileRow, { onConflict: 'id' });

      const { data, error: authError } = await supabase.auth.updateUser({
        data: buildAuthMetadata(updatedProfile)
      });

      if (profileError || authError) {
        remoteSaveFailed = true;
        setStatus({
          tone: 'error',
          message: 'Profile saved locally. Your account profile could not be updated.'
        });
      }

      const mappedUser = mapSupabaseUser(data.user);
      if (mappedUser) onUserChanged(mappedUser);
    }

    saveMemoryProfile(updatedProfile);
    setProfile(updatedProfile);

    if (!remoteSaveFailed) {
      setStatus({ tone: 'success', message: supabase ? 'Profile saved securely.' : 'Profile saved locally.' });
    }
    setIsSaving(false);
  };

  const handleResetDraft = () => {
    const stored = getMemoryProfile();
    setProfile(stored);
    setIdentityTagsText(arrayToLines(stored.identityTags));
    setSavedGoalsText(arrayToLines(stored.savedGoals));
    setStatus(null);
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordStatus(null);

    if (newPassword.length < 8) {
      setPasswordStatus({ tone: 'error', message: 'Use at least 8 characters for the new password.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ tone: 'error', message: 'The new passwords do not match.' });
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setPasswordStatus({ tone: 'error', message: 'Supabase authentication is not configured.' });
      return;
    }

    setIsPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsPasswordSaving(false);

    if (error) {
      setPasswordStatus({ tone: 'error', message: error.message || 'Password could not be changed.' });
      return;
    }

    setNewPassword('');
    setConfirmPassword('');
    setPasswordStatus({ tone: 'success', message: 'Password changed.' });
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-purple-700">
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" />
              ) : (
                <UserCircle className="h-8 w-8" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black text-slate-950">{currentUser.name || profile.name || 'Q member'}</h1>
              <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-slate-500">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{currentUser.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
              {profileCompleteness}% complete
            </div>
            <button
              type="button"
              onClick={onOpenAccount}
              className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
            >
              Account
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-purple-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-purple-100 p-2 text-purple-700"><Gift className="h-5 w-5" /></div>
          <div className="flex-1">
            <h2 className="text-sm font-black text-slate-950">Refer friends and earn credit</h2>
            <p className="mt-1 text-xs text-slate-500">Your friend receives 10% back on their first payment. You receive credit worth 20% after their payment clears the 14-day holding period.</p>
          </div>
          <div className="text-right"><div className="text-[10px] font-bold uppercase text-slate-400">Available credit</div><div className="text-xl font-black text-purple-700">{referral ? new Intl.NumberFormat('en-GB',{style:'currency',currency:referral.currency}).format(referral.balanceMinor / 100) : '—'}</div></div>
        </div>
        {referral?.referralUrl && <div className="mt-4 flex gap-2"><input readOnly value={referral.referralUrl} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"/><button type="button" onClick={() => { void navigator.clipboard.writeText(referral.referralUrl); setReferralStatus('Referral link copied.'); }} className="inline-flex items-center gap-1 rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white"><Copy className="h-3.5 w-3.5"/>Copy</button></div>}
        <form onSubmit={inviteReferral} className="mt-3 flex gap-2"><input required type="email" value={referralEmail} onChange={event=>setReferralEmail(event.target.value)} placeholder="Friend's email address" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs"/><button className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700">Create referral</button></form>
        {referralStatus && <p className="mt-2 text-xs font-semibold text-slate-600">{referralStatus}</p>}
        {referral?.referrals?.length > 0 && <div className="mt-4 border-t border-slate-100 pt-3"><h3 className="text-xs font-black text-slate-700">Your referrals</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{referral.referrals.map((item:any)=><div key={item.id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs"><div className="truncate font-bold text-slate-700">{item.prospect_email}</div><div className="capitalize text-slate-500">{item.status.replace('_',' ')}</div></div>)}</div></div>}
        <p className="mt-3 text-[10px] text-slate-400">Credit is non-transferable, expires after 12 months, and can reduce up to 50% of an eligible invoice. Refunds, disputes, and self-referrals do not qualify.</p>
      </div>

      {status && (
        <div
          className={`rounded-xl border p-3 text-xs font-semibold ${
            status.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {status.message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <form
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-black text-slate-950">
                <Sparkles className="h-4 w-4 text-purple-600" />
                Personal context
              </h2>
              <p className="mt-1 text-xs text-slate-500">Saved locally and used only when Q memory is enabled.</p>
            </div>
            <button
              type="button"
              onClick={handleResetDraft}
              className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              title="Reset unsaved changes"
              aria-label="Reset unsaved changes"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-bold text-slate-700">
              <span>Preferred name</span>
              <input
                type="text"
                value={profile.name}
                onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-purple-500 focus:bg-white"
              />
            </label>

            <label className="space-y-1.5 text-xs font-bold text-slate-700">
              <span>Pronouns</span>
              <input
                type="text"
                value={profile.pronouns}
                onChange={(event) => setProfile({ ...profile, pronouns: event.target.value })}
                placeholder="she/her, he/him, they/them"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-purple-500 focus:bg-white"
              />
            </label>

            <label className="space-y-1.5 text-xs font-bold text-slate-700">
              <span>Location or region</span>
              <input
                type="text"
                value={profile.locationRegion}
                onChange={(event) => setProfile({ ...profile, locationRegion: event.target.value })}
                placeholder="City, county, state, or country"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-purple-500 focus:bg-white"
              />
            </label>

            <label className="space-y-1.5 text-xs font-bold text-slate-700">
              <span>Life stage</span>
              <select
                value={profile.lifeStage}
                onChange={(event) => setProfile({ ...profile, lifeStage: event.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-purple-500 focus:bg-white"
              >
                <option value="">Prefer not to say</option>
                <option value="student">Student</option>
                <option value="early_career">Early career</option>
                <option value="working">Working</option>
                <option value="parent_or_carer">Parent or carer</option>
                <option value="retired">Retired</option>
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-bold text-slate-700">
              <span>Identity notes</span>
              <textarea
                rows={5}
                value={identityTagsText}
                onChange={(event) => setIdentityTagsText(event.target.value)}
                placeholder="One note per line"
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-purple-500 focus:bg-white"
              />
            </label>

            <label className="space-y-1.5 text-xs font-bold text-slate-700">
              <span>Goals Q should remember</span>
              <textarea
                rows={5}
                value={savedGoalsText}
                onChange={(event) => setSavedGoalsText(event.target.value)}
                placeholder="One goal per line"
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-purple-500 focus:bg-white"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 sm:min-w-72">
              <span>Allow Q context memory</span>
              <input
                type="checkbox"
                checked={profile.optInMemory}
                onChange={(event) => setProfile({ ...profile, optInMemory: event.target.checked })}
                className="h-4 w-4 accent-purple-600"
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 sm:min-w-72">
              <span>Allow account support contact</span>
              <input
                type="checkbox"
                checked={profile.crmSyncConsent}
                onChange={(event) => setProfile({ ...profile, crmSyncConsent: event.target.checked })}
                className="h-4 w-4 accent-purple-600"
              />
            </label>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-purple-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'Saving...' : 'Save profile'}</span>
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <form
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            onSubmit={handlePasswordChange}
          >
            <h2 className="flex items-center gap-2 text-sm font-black text-slate-950">
              <Lock className="h-4 w-4 text-purple-600" />
              Change password
            </h2>
            <div className="mt-3 space-y-3">
              {passwordStatus && (
                <div
                  className={`rounded-xl border p-3 text-xs font-semibold ${
                    passwordStatus.tone === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-rose-200 bg-rose-50 text-rose-800'
                  }`}
                >
                  {passwordStatus.message}
                </div>
              )}
              <label className="space-y-1.5 text-xs font-bold text-slate-700">
                <span>New password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-purple-500 focus:bg-white"
                />
              </label>
              <label className="space-y-1.5 text-xs font-bold text-slate-700">
                <span>Confirm password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-purple-500 focus:bg-white"
                />
              </label>
              <button
                type="submit"
                disabled={isPasswordSaving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                <span>{isPasswordSaving ? 'Updating...' : 'Update password'}</span>
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-black text-slate-950">
              <Shield className="h-4 w-4 text-emerald-600" />
              Privacy
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(['high', 'standard'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setProfile({ ...profile, privacyLevel: level })}
                  className={`rounded-xl border px-3 py-2 text-xs font-bold capitalize transition ${
                    profile.privacyLevel === level
                      ? 'border-purple-600 bg-purple-50 text-purple-800'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              High privacy masks personal context before external AI requests. Standard keeps more context available for tailored support.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-black text-slate-950">
              <Database className="h-4 w-4 text-purple-600" />
              Account actions
            </h2>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={onOpenSecurity}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs font-bold text-slate-700 transition hover:bg-slate-100"
              >
                <span>Security settings</span>
                <Lock className="h-4 w-4 text-slate-500" />
              </button>
              <button
                type="button"
                onClick={onOpenBackup}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs font-bold text-slate-700 transition hover:bg-slate-100"
              >
                <span>Backup and restore</span>
                <Download className="h-4 w-4 text-slate-500" />
              </button>
              <button
                type="button"
                onClick={onOpenSubscription}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs font-bold text-slate-700 transition hover:bg-slate-100"
              >
                <span>Subscription</span>
                <CreditCard className="h-4 w-4 text-slate-500" />
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs font-bold text-slate-400"
                disabled
              >
                <span>Notifications</span>
                <Bell className="h-4 w-4 text-slate-400" />
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="flex w-full items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-left text-xs font-bold text-rose-700 transition hover:bg-rose-100"
              >
                <span>Sign out</span>
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
};
