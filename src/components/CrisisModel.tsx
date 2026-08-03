import React from 'react';
import { ShieldAlert, PhoneCall, ExternalLink, X, HeartHandshake, CheckCircle2 } from 'lucide-react';
import { CRISIS_RESOURCES } from '../data/initialData';

interface CrisisModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CrisisModal: React.FC<CrisisModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-slate-900 border border-purple-500/30 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-gradient-to-r from-red-950/40 via-purple-950/40 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                24/7 Crisis & Peer Support
              </h2>
              <p className="text-xs text-slate-400">Confidential, non-judgmental, and affirmative care</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 rounded-lg hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Quick Grounding Banner */}
          <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs leading-relaxed space-y-2 text-purple-200">
            <div className="flex items-center gap-2 font-semibold text-purple-300 text-sm">
              <HeartHandshake className="w-4 h-4 text-purple-400" />
              You are safe here. Take a deep breath.
            </div>
            <p>
              If you are in acute physical danger, feeling overwhelmed, or need someone who understands LGBTQ+ lived experiences, support is available 24 hours a day.
            </p>
          </div>

          {/* Resources List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CRISIS_RESOURCES.map((resource) => (
              <div
                key={resource.id}
                className="p-4 rounded-xl bg-slate-800/70 border border-slate-700/60 hover:border-purple-500/40 transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-slate-100">{resource.name}</h3>
                    <span className="inline-block px-2 py-0.5 mt-1 text-[10px] font-medium rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {resource.region} • {resource.availability}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 line-clamp-2">{resource.description}</p>

                <div className="pt-2 border-t border-slate-700/50 flex flex-col gap-2">
                  <a
                    href={`tel:${resource.phoneOrText.replace(/[^0-9+]/g, '')}`}
                    className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition-colors"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    {resource.phoneOrText}
                  </a>
                  {resource.website && (
                    <a
                      href={`https://${resource.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 text-[11px] text-purple-400 hover:text-purple-300 hover:underline"
                    >
                      Visit {resource.website} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Grounding Checklist */}
          <div className="pt-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Immediate 5-Step Grounding Technique</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                <span>5 things you can see around you</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                <span>4 things you can physically touch</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                <span>3 things you can hear right now</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                <span>2 things you can smell or like</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>Q Offline Safety Vault • Always accessible offline</span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
