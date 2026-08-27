import React, { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, ExternalLink, X } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [availablePlans, setAvailablePlans] = useState<Array<'monthly' | 'yearly'>>([]);
  const [foundingOfferAvailable, setFoundingOfferAvailable] = useState(false);

  const getAuthHeaders = async () => {
    const supabase = getSupabaseClient();
    const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    if (!data.session?.access_token) throw new Error('Please sign in before managing your subscription.');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`
    };
  };

  const parseResponse = async (response: Response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return { text };
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('paypal');
    if (!outcome) return;

    const clearPaypalQuery = () => {
      const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash}`;
      window.history.replaceState({}, '', cleanUrl);
    };

    const verifySubscription = async () => {
      const subscriptionId = params.get('subscription_id') ?? params.get('token') ?? params.get('token_id') ?? params.get('subscriptionId');
      const body = subscriptionId
        ? { subscriptionId }
        : {
            token: params.get('token') ?? '',
            tokenId: params.get('token_id') ?? ''
          };

      try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/billing/paypal/complete', {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
        const data = await parseResponse(response);
        if (!response.ok) throw new Error(data.error || data.text || 'Unable to verify subscription.');
        setStatus(data.status || 'APPROVAL_PENDING');
        if (data.pending) {
          setMessage('PayPal approval is still being confirmed. Please check again in a moment.');
        } else {
          setMessage('Your PayPal subscription was verified successfully.');
        }
      } catch (error: any) {
        setMessage(error.message || 'Unable to verify subscription.');
      } finally {
        clearPaypalQuery();
      }
    };

    if (outcome === 'success') {
      void verifySubscription();
    } else if (outcome === 'cancel' || outcome === 'cancelled') {
      setMessage('Subscription checkout was cancelled.');
      clearPaypalQuery();
    } else if (outcome === 'failed') {
      setMessage('PayPal checkout could not be completed. Please try again.');
      clearPaypalQuery();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/billing/paypal/plans').then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load plans.');
      const available = (data.plans ?? []).filter((plan:any) => plan.available).map((plan:any) => plan.key) as Array<'monthly' | 'yearly'>;
      setAvailablePlans(available);
      setFoundingOfferAvailable(data.foundingOfferAvailable === true);
      if (available.length && !available.includes(selectedPlan)) setSelectedPlan(available[0]);
    }).catch((error:any) => { setAvailablePlans([]); setMessage(error.message || 'Unable to load subscription plans.'); });
  }, [isOpen]);

  if (!isOpen) return null;

  const startSubscription = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/billing/paypal/create-subscription', {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan: selectedPlan })
      });
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.detail ? `${data.error} ${data.detail}` : data.error || data.text || 'Unable to start PayPal checkout.');
      window.location.assign(data.approvalUrl);
    } catch (error: any) {
      setMessage(error.message || 'Unable to start PayPal checkout.');
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/billing/paypal/status', { headers: await getAuthHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load subscription status.');
      setStatus(data.status || 'Not subscribed');
    } catch (error: any) {
      setMessage(error.message || 'Unable to load subscription status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-5 text-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black flex items-center gap-2"><CreditCard className="w-5 h-5 text-purple-600" /> Q Subscription</h2>
            <p className="text-xs text-slate-500 mt-1">Secure recurring billing through PayPal.</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              key: 'monthly',
              title: 'Monthly',
              price: '£9.99',
              description: 'Billed every month.'
            },
            {
              key: 'yearly',
              title: 'Yearly',
              price: '£99.99',
              description: 'Billed once per year.'
            }
          ].filter(plan => availablePlans.includes(plan.key as 'monthly' | 'yearly')).map((plan) => {
            const active = selectedPlan === plan.key;
            return (
              <button
                key={plan.key}
                type="button"
                onClick={() => setSelectedPlan(plan.key as 'monthly' | 'yearly')}
                className={`w-full text-left rounded-3xl border p-4 transition ${
                  active ? 'border-purple-600 bg-purple-600/10 text-purple-800' : 'border-slate-200 bg-white text-slate-900 hover:border-purple-300 hover:bg-purple-50'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-sm">{plan.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{plan.description}</p>
                  </div>
                  <div className="text-3xl font-black">{plan.price}</div>
                </div>
              </button>
            );
          })}
        </div>

        {foundingOfferAvailable && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900"><div className="font-black">Founding 100 offer: 50% off</div><p className="mt-1">Eligible non-staff customers receive 50% off their first 3 monthly payments or first annual payment. Availability is confirmed during checkout.</p></div>}

        {availablePlans.length === 0 && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-xs font-semibold text-slate-600">There are currently no subscription plans available.</div>}

        <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 space-y-3">
          <div className="text-sm font-semibold text-slate-700">What’s included</div>
          <ul className="space-y-2 text-xs text-slate-700">
            {['Expanded Q features', 'Private memory controls', 'Vetted knowledge access'].map((item) => (
              <li key={item} className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />{item}</li>
            ))}
          </ul>
        </div>

        {message && <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">{message}</div>}
        {status && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">Subscription status: {status}</div>}

        <div className="flex gap-2">
          <button onClick={startSubscription} disabled={loading || availablePlans.length === 0} className="flex-1 py-3 rounded-xl bg-[#0070ba] hover:bg-[#005ea6] text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            <ExternalLink className="w-4 h-4" /> {loading ? 'Connecting...' : 'Continue with PayPal'}
          </button>
          <button onClick={checkStatus} disabled={loading} className="px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold disabled:opacity-50">
            Check status
          </button>
        </div>
        <p className="text-[10px] text-slate-400 text-center">You will complete approval on PayPal. Q does not handle card details.</p>
      </div>
    </div>
  );
};
