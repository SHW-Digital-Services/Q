import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  Grid,
  ShieldCheck,
  Clock,
  Check,
  X,
  AlertCircle,
  Delete,
  RotateCcw,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { SecuritySettings } from '../types';
import { getSecuritySettings, saveSecuritySettings } from '../services/storage';

interface SecuritySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: (updated: SecuritySettings) => void;
  onTestLock: () => void;
}

export const SecuritySettingsModal: React.FC<SecuritySettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsUpdated,
  onTestLock
}) => {
  const [settings, setSettings] = useState<SecuritySettings>(getSecuritySettings());

  // Setup wizard states
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [tempPin, setTempPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [tempPattern, setTempPattern] = useState<number[]>([]);
  const [confirmPattern, setConfirmPattern] = useState<number[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(getSecuritySettings());
      setIsEditingCode(false);
      setErrorMessage(null);
      setSuccessNotice(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleLock = (enabled: boolean) => {
    if (enabled && !settings.pinCode && (!settings.patternPath || settings.patternPath.length === 0)) {
      // Prompt user to set a code first
      setIsEditingCode(true);
      setStep('create');
      setErrorMessage('Please set up a 4-digit PIN or 3x3 pattern code first.');
      return;
    }

    const updated: SecuritySettings = {
      ...settings,
      enabled
    };
    saveSecuritySettings(updated);
    setSettings(updated);
    onSettingsUpdated(updated);
    flashSuccess(enabled ? 'Privacy Lock Enabled' : 'Privacy Lock Disabled');
  };

  const handleSelectLockType = (type: 'pin' | 'pattern') => {
    setSettings((prev) => ({ ...prev, lockType: type }));
    setIsEditingCode(true);
    setStep('create');
    setTempPin('');
    setConfirmPin('');
    setTempPattern([]);
    setConfirmPattern([]);
    setErrorMessage(null);
  };

  // PIN Setup logic
  const handlePinNumPress = (num: string) => {
    setErrorMessage(null);
    if (step === 'create') {
      if (tempPin.length >= 4) return;
      const next = tempPin + num;
      setTempPin(next);
      if (next.length === 4) {
        setStep('confirm');
      }
    } else {
      if (confirmPin.length >= 4) return;
      const next = confirmPin + num;
      setConfirmPin(next);
      if (next.length === 4) {
        if (next === tempPin) {
          saveNewPin(next);
        } else {
          setErrorMessage('PIN codes did not match. Please try again.');
          setConfirmPin('');
        }
      }
    }
  };

  const saveNewPin = (pin: string) => {
    const updated: SecuritySettings = {
      ...settings,
      enabled: true,
      lockType: 'pin',
      pinCode: pin
    };
    saveSecuritySettings(updated);
    setSettings(updated);
    onSettingsUpdated(updated);
    setIsEditingCode(false);
    flashSuccess('4-Digit PIN updated successfully!');
  };

  // Pattern Setup logic
  const handlePatternDotPress = (idx: number) => {
    setErrorMessage(null);
    if (step === 'create') {
      if (tempPattern.includes(idx)) return;
      const next = [...tempPattern, idx];
      setTempPattern(next);
    } else {
      if (confirmPattern.includes(idx)) return;
      const next = [...confirmPattern, idx];
      setConfirmPattern(next);
    }
  };

  const handleConfirmPatternSetup = () => {
    if (step === 'create') {
      if (tempPattern.length < 3) {
        setErrorMessage('Pattern must connect at least 3 dots.');
        return;
      }
      setStep('confirm');
    } else {
      const isMatch =
        confirmPattern.length === tempPattern.length &&
        confirmPattern.every((val, i) => val === tempPattern[i]);

      if (isMatch) {
        saveNewPattern(confirmPattern);
      } else {
        setErrorMessage('Patterns did not match. Draw your pattern again.');
        setConfirmPattern([]);
      }
    }
  };

  const saveNewPattern = (pattern: number[]) => {
    const updated: SecuritySettings = {
      ...settings,
      enabled: true,
      lockType: 'pattern',
      patternPath: pattern
    };
    saveSecuritySettings(updated);
    setSettings(updated);
    onSettingsUpdated(updated);
    setIsEditingCode(false);
    flashSuccess('3x3 Security Pattern updated successfully!');
  };

  const handleUpdateDelay = (delay: number) => {
    const updated: SecuritySettings = {
      ...settings,
      autoLockDelaySeconds: delay
    };
    saveSecuritySettings(updated);
    setSettings(updated);
    onSettingsUpdated(updated);
    flashSuccess('Auto-Lock timer updated');
  };

  const handleUpdateScope = (scope: 'entire_app' | 'journal_only') => {
    const updated: SecuritySettings = {
      ...settings,
      lockScope: scope
    };
    saveSecuritySettings(updated);
    setSettings(updated);
    onSettingsUpdated(updated);
    flashSuccess('Lock protection scope updated');
  };

  const flashSuccess = (msg: string) => {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-700/80 text-white border border-purple-500/50 shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">App Privacy & Security Lock</h2>
              <p className="text-[11px] text-purple-200 font-medium">
                Protect sensitive journal notes & personal data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-purple-200 hover:text-white hover:bg-purple-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto flex-1 text-slate-800">
          {/* Notification Banners */}
          {successNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Main Lock Status Switch */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">Enable Privacy Lock</span>
                {settings.enabled ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-600" /> Active
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                    Off
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Requires PIN or Pattern before displaying confidential contents
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleToggleLock(!settings.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                settings.enabled ? 'bg-purple-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 2. Setup / Edit Code Section */}
          {isEditingCode ? (
            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-purple-200/80 pb-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-purple-700" />
                  <span className="text-xs font-bold text-purple-900">
                    {step === 'create'
                      ? `Set New ${settings.lockType === 'pin' ? '4-Digit PIN' : '3x3 Pattern'}`
                      : `Confirm Your ${settings.lockType === 'pin' ? 'PIN Code' : 'Pattern'}`}
                  </span>
                </div>
                <button
                  onClick={() => setIsEditingCode(false)}
                  className="text-[11px] font-semibold text-purple-700 hover:text-purple-900"
                >
                  Cancel
                </button>
              </div>

              {/* PIN Wizard */}
              {settings.lockType === 'pin' && (
                <div className="flex flex-col items-center space-y-3">
                  <p className="text-[11px] text-slate-600 text-center font-medium">
                    {step === 'create' ? 'Enter a 4-digit PIN code:' : 'Re-enter your 4-digit PIN to confirm:'}
                  </p>

                  <div className="flex items-center gap-3">
                    {[0, 1, 2, 3].map((idx) => {
                      const cur = step === 'create' ? tempPin : confirmPin;
                      const filled = cur.length > idx;
                      return (
                        <div
                          key={idx}
                          className={`w-4 h-4 rounded-full border-2 transition-all ${
                            filled ? 'bg-purple-600 border-purple-700 scale-110 shadow-sm' : 'border-slate-300 bg-white'
                          }`}
                        />
                      );
                    })}
                  </div>

                  {/* Keypad */}
                  <div className="grid grid-cols-3 gap-2 w-full max-w-[220px]">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handlePinNumPress(n)}
                        className="w-12 h-12 rounded-xl bg-white hover:bg-purple-600 hover:text-white border border-slate-200 text-slate-800 font-bold text-lg flex items-center justify-center transition-all active:scale-95 mx-auto shadow-sm"
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => (step === 'create' ? setTempPin('') : setConfirmPin(''))}
                      className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 font-bold text-[10px] flex items-center justify-center transition-all mx-auto uppercase"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePinNumPress('0')}
                      className="w-12 h-12 rounded-xl bg-white hover:bg-purple-600 hover:text-white border border-slate-200 text-slate-800 font-bold text-lg flex items-center justify-center transition-all active:scale-95 mx-auto shadow-sm"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        step === 'create'
                          ? setTempPin((p) => p.slice(0, -1))
                          : setConfirmPin((p) => p.slice(0, -1))
                      }
                      className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center transition-all mx-auto"
                    >
                      <Delete className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                </div>
              )}

              {/* Pattern Wizard */}
              {settings.lockType === 'pattern' && (
                <div className="flex flex-col items-center space-y-3">
                  <p className="text-[11px] text-slate-600 text-center font-medium">
                    {step === 'create'
                      ? 'Tap dots in order to draw your pattern path:'
                      : 'Re-tap the dots in exact order to confirm:'}
                  </p>

                  <div className="grid grid-cols-3 gap-4 p-3 bg-white rounded-2xl border border-slate-200">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => {
                      const cur = step === 'create' ? tempPattern : confirmPattern;
                      const selected = cur.includes(idx);
                      const order = cur.indexOf(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handlePatternDotPress(idx)}
                          className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                            selected
                              ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-300'
                              : 'bg-slate-100 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          <div
                            className={`rounded-full ${selected ? 'w-3 h-3 bg-white' : 'w-2.5 h-2.5 bg-slate-400'}`}
                          />
                          {selected && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-900 text-white font-bold text-[9px] flex items-center justify-center">
                              {order + 1}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => (step === 'create' ? setTempPattern([]) : setConfirmPattern([]))}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmPatternSetup}
                      className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all"
                    >
                      {step === 'create' ? 'Next: Confirm Pattern' : 'Save Pattern'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* 3. Choose Lock Type */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Select Lock Mechanism
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSelectLockType('pin')}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col items-start gap-1.5 ${
                      settings.lockType === 'pin'
                        ? 'bg-purple-50 border-purple-400 text-purple-900 shadow-sm ring-2 ring-purple-200'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-purple-600 text-white">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">4-Digit PIN</div>
                      <div className="text-[10px] text-slate-500">Fast numeric keypad unlock</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectLockType('pattern')}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col items-start gap-1.5 ${
                      settings.lockType === 'pattern'
                        ? 'bg-purple-50 border-purple-400 text-purple-900 shadow-sm ring-2 ring-purple-200'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-purple-600 text-white">
                      <Grid className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">3x3 Pattern</div>
                      <div className="text-[10px] text-slate-500">Connect dots gesture pattern</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 4. Lock Scope Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Protection Scope
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleUpdateScope('entire_app')}
                    className={`p-2.5 rounded-xl border font-semibold text-left transition-all ${
                      settings.lockScope === 'entire_app'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold">Lock Entire App</div>
                    <div className="text-[10px] opacity-80 font-normal">Requires code on startup</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateScope('journal_only')}
                    className={`p-2.5 rounded-xl border font-semibold text-left transition-all ${
                      settings.lockScope === 'journal_only'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold">Journal & Mood Only</div>
                    <div className="text-[10px] opacity-80 font-normal">Locks sensitive records</div>
                  </button>
                </div>
              </div>

              {/* 5. Auto-Lock Delay Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Auto-Lock Timer
                </label>
                <div className="grid grid-cols-4 gap-1.5 text-[11px] font-semibold">
                  {[
                    { label: 'Immediate', value: 0 },
                    { label: '1 Min', value: 60 },
                    { label: '5 Mins', value: 300 },
                    { label: 'Manual', value: -1 }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleUpdateDelay(opt.value)}
                      className={`py-2 px-1 rounded-xl border text-center transition-all ${
                        settings.autoLockDelaySeconds === opt.value
                          ? 'bg-purple-600 text-white border-purple-600 font-bold shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. Test Lock Button */}
              {settings.enabled && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onTestLock();
                    }}
                    className="w-full py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Lock className="w-4 h-4 text-purple-600" />
                    <span>Test Lock Screen Now</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
