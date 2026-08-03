import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  Delete,
  RotateCcw,
  Sparkles,
  KeyRound,
  Grid,
  AlertTriangle,
  Eye,
  EyeOff,
  PhoneCall
} from 'lucide-react';
import { SecuritySettings } from '../types';
import { QLogo } from './QLogo';

interface SecurityLockOverlayProps {
  settings: SecuritySettings;
  onUnlock: () => void;
  onOpenCrisis: () => void;
  onResetSecurity: () => void;
  scopeLabel?: string;
}

export const SecurityLockOverlay: React.FC<SecurityLockOverlayProps> = ({
  settings,
  onUnlock,
  onOpenCrisis,
  onResetSecurity,
  scopeLabel = 'Q Privacy Lock'
}) => {
  // Input states
  const [enteredPin, setEnteredPin] = useState('');
  const [patternInput, setPatternInput] = useState<number[]>([]);
  const [isPatternDragging, setIsPatternDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [showForgotConfirm, setShowForgotConfirm] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [peekPattern, setPeekPattern] = useState(false);

  const patternContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset inputs on mount
    setEnteredPin('');
    setPatternInput([]);
    setErrorMessage(null);
  }, [settings]);

  // Handle PIN Number Input
  const handlePinPress = (num: string) => {
    if (enteredPin.length >= 4) return;
    const nextPin = enteredPin + num;
    setEnteredPin(nextPin);
    setErrorMessage(null);

    // Auto-verify on 4th digit
    if (nextPin.length === 4) {
      if (nextPin === settings.pinCode) {
        onUnlock();
      } else {
        triggerError('Incorrect PIN code. Please try again.');
      }
    }
  };

  const handlePinBackspace = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handlePinClear = () => {
    setEnteredPin('');
    setErrorMessage(null);
  };

  // Handle Pattern Grid Input (3x3 grid: nodes 0 to 8)
  const handlePatternDotClick = (nodeIndex: number) => {
    setErrorMessage(null);
    if (patternInput.includes(nodeIndex)) return;

    const nextPattern = [...patternInput, nodeIndex];
    setPatternInput(nextPattern);

    // Check pattern length match with target pattern
    const targetLength = settings.patternPath?.length || 4;
    if (nextPattern.length >= targetLength) {
      verifyPattern(nextPattern);
    }
  };

  const handlePatternTouchStart = (nodeIndex: number) => {
    setIsPatternDragging(true);
    setPatternInput([nodeIndex]);
    setErrorMessage(null);
  };

  const handlePatternTouchMove = (e: React.TouchEvent) => {
    if (!isPatternDragging) return;
    const touch = e.touches[0];
    const elem = document.elementFromPoint(touch.clientX, touch.clientY);
    if (elem) {
      const nodeAttr = elem.getAttribute('data-node-index');
      if (nodeAttr !== null) {
        const idx = parseInt(nodeAttr, 10);
        if (!isNaN(idx) && !patternInput.includes(idx)) {
          setPatternInput((prev) => [...prev, idx]);
        }
      }
    }
  };

  const handlePatternTouchEnd = () => {
    setIsPatternDragging(false);
    if (patternInput.length > 0) {
      verifyPattern(patternInput);
    }
  };

  const verifyPattern = (pattern: number[]) => {
    const targetPattern = settings.patternPath || [];
    const isMatch =
      pattern.length === targetPattern.length &&
      pattern.every((val, idx) => val === targetPattern[idx]);

    if (isMatch) {
      onUnlock();
    } else {
      triggerError('Pattern path does not match. Try again.');
      setPatternInput([]);
    }
  };

  const triggerError = (msg: string) => {
    setErrorMessage(msg);
    setIsShaking(true);
    setAttempts((prev) => prev + 1);
    setTimeout(() => setIsShaking(false), 500);
    setEnteredPin('');
  };

  // Helper to compute node center coordinates for Pattern SVG connection line
  const getNodeCenter = (index: number) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    // Map to 300x300 SVG viewport coordinate space
    const x = 50 + col * 100;
    const y = 50 + row * 100;
    return { x, y };
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 text-white animate-fade-in select-none overflow-y-auto">
      {/* Background ambient light */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-purple-600/20 rounded-full blur-[100px] pointer-events-none" />

      <div
        className={`w-full max-w-sm bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center relative transition-transform ${
          isShaking ? 'animate-bounce text-rose-300' : ''
        }`}
      >
        {/* Top Header */}
        <div className="flex flex-col items-center mb-6 text-center space-y-2">
          <div className="relative mb-1">
            <QLogo size="md" />
            <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-purple-600 text-white shadow-md border border-slate-900">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-white">{scopeLabel}</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {settings.lockType === 'pin'
                ? 'Enter your 4-digit PIN to access sensitive data'
                : 'Draw your 3x3 security pattern to unlock'}
            </p>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="w-full mb-4 px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs text-center font-semibold flex items-center justify-center gap-1.5 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. PIN Keypad Mode */}
        {settings.lockType === 'pin' && (
          <div className="w-full flex flex-col items-center space-y-6">
            {/* PIN Indicator Dots */}
            <div className="flex items-center gap-4 py-2">
              {[0, 1, 2, 3].map((idx) => {
                const filled = enteredPin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 transition-all transform ${
                      filled
                        ? 'bg-purple-500 border-purple-400 scale-110 shadow-lg shadow-purple-500/50'
                        : 'border-slate-700 bg-slate-800/80'
                    }`}
                  />
                );
              })}
            </div>

            {/* Numeric Keypad Grid */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-[260px]">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinPress(num)}
                  className="w-16 h-16 rounded-2xl bg-slate-800/90 hover:bg-purple-600/80 active:bg-purple-700 text-white font-bold text-xl flex items-center justify-center border border-slate-700/80 transition-all shadow-md active:scale-95 mx-auto"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handlePinClear}
                className="w-16 h-16 rounded-2xl bg-slate-800/40 hover:bg-slate-800 text-slate-400 font-bold text-xs flex items-center justify-center border border-slate-800 transition-all active:scale-95 mx-auto uppercase"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handlePinPress('0')}
                className="w-16 h-16 rounded-2xl bg-slate-800/90 hover:bg-purple-600/80 active:bg-purple-700 text-white font-bold text-xl flex items-center justify-center border border-slate-700/80 transition-all shadow-md active:scale-95 mx-auto"
              >
                0
              </button>
              <button
                type="button"
                onClick={handlePinBackspace}
                className="w-16 h-16 rounded-2xl bg-slate-800/40 hover:bg-slate-800 text-slate-300 font-bold text-base flex items-center justify-center border border-slate-800 transition-all active:scale-95 mx-auto"
              >
                <Delete className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
        )}

        {/* 2. Pattern Grid Mode */}
        {settings.lockType === 'pattern' && (
          <div className="w-full flex flex-col items-center space-y-4">
            <div
              ref={patternContainerRef}
              onTouchStart={() => setIsPatternDragging(true)}
              onTouchMove={handlePatternTouchMove}
              onTouchEnd={handlePatternTouchEnd}
              className="relative w-[280px] h-[280px] bg-slate-950/60 rounded-3xl border border-slate-800 p-4 touch-none select-none flex items-center justify-center"
            >
              {/* SVG Connecting Lines between selected nodes */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 300">
                {patternInput.map((nodeIdx, i) => {
                  if (i === 0) return null;
                  const start = getNodeCenter(patternInput[i - 1]);
                  const end = getNodeCenter(nodeIdx);
                  return (
                    <line
                      key={`line-${i}`}
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      stroke="#c084fc"
                      strokeWidth="6"
                      strokeLinecap="round"
                      opacity="0.9"
                    />
                  );
                })}
              </svg>

              {/* 3x3 Nodes Grid */}
              <div className="grid grid-cols-3 gap-6 w-full h-full relative z-10">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => {
                  const isSelected = patternInput.includes(idx);
                  const orderIndex = patternInput.indexOf(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      data-node-index={idx}
                      onClick={() => handlePatternDotClick(idx)}
                      onTouchStart={() => handlePatternTouchStart(idx)}
                      className={`relative w-14 h-14 rounded-full mx-auto flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-purple-600 border-2 border-purple-300 shadow-lg shadow-purple-500/50 scale-110'
                          : 'bg-slate-800/80 border border-slate-700 hover:bg-slate-700/80'
                      }`}
                    >
                      <div
                        className={`rounded-full transition-all ${
                          isSelected ? 'w-4 h-4 bg-white shadow-sm' : 'w-3 h-3 bg-slate-400'
                        }`}
                      />
                      {isSelected && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-900 border border-purple-400 text-purple-300 font-bold text-[10px] flex items-center justify-center">
                          {orderIndex + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pattern Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPatternInput([])}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Pattern</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions & Emergency Access */}
        <div className="w-full mt-6 pt-4 border-t border-slate-800/80 flex flex-col items-center gap-2">
          {/* Emergency Helpline (Safety feature: always accessible even if locked!) */}
          <button
            type="button"
            onClick={onOpenCrisis}
            className="w-full py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs font-bold flex items-center justify-center gap-2 transition-all"
          >
            <PhoneCall className="w-3.5 h-3.5 text-red-400" />
            <span>24/7 LGBTQ+ Helpline Access</span>
          </button>

          {/* Forgot PIN / Reset fallback option */}
          {!showForgotConfirm ? (
            <button
              type="button"
              onClick={() => setShowForgotConfirm(true)}
              className="text-[11px] text-slate-400 hover:text-purple-300 font-medium transition-colors pt-1"
            >
              Forgot PIN or Pattern?
            </button>
          ) : (
            <div className="w-full p-3 rounded-xl bg-amber-950/50 border border-amber-800/60 text-amber-200 text-xs text-center space-y-2 animate-fade-in">
              <p className="font-semibold text-[11px]">
                Reset security lock settings to restore access?
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onResetSecurity();
                    setShowForgotConfirm(false);
                  }}
                  className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px]"
                >
                  Reset Lock
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgotConfirm(false)}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
