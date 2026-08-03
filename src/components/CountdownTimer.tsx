import React, { useEffect, useState } from 'react';

interface CountdownTimerProps {
  targetDate: Date;
}

interface CountdownState {
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function getCountdown(target: Date): CountdownState {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) {
    return { weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  let remaining = diff;
  const weeks = Math.floor(remaining / 604_800_000);
  remaining %= 604_800_000;
  const days = Math.floor(remaining / 86_400_000);
  remaining %= 86_400_000;
  const hours = Math.floor(remaining / 3_600_000);
  remaining %= 3_600_000;
  const minutes = Math.floor(remaining / 60_000);
  remaining %= 60_000;
  const seconds = Math.floor(remaining / 1_000);

  return { weeks, days, hours, minutes, seconds, expired: false };
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate }) => {
  const [countdown, setCountdown] = useState<CountdownState>(() => getCountdown(targetDate));
  const [isLive, setIsLive] = useState<boolean>(countdown.expired);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nextCountdown = getCountdown(targetDate);
      setCountdown(nextCountdown);
      if (nextCountdown.expired) {
        setIsLive(true);
      }
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [targetDate]);

  const items = [
    { label: 'Weeks', value: countdown.weeks },
    { label: 'Days', value: countdown.days },
    { label: 'Hours', value: countdown.hours },
    { label: 'Minutes', value: countdown.minutes },
    { label: 'Seconds', value: countdown.seconds }
  ];

  return (
    <div className="mt-8 rounded-[1.5rem] p-[2px] shadow-2xl shadow-black/10 rainbow-border overflow-hidden bg-transparent">
      <div className="flex flex-col gap-3 bg-white rounded-[1.25rem] p-5">
        <div className="text-xs uppercase tracking-[0.3em] text-black font-bold">Official launch</div>
        <div className="rounded-3xl bg-slate-950/40 p-4 text-center text-sm text-white/90">
          Launch begins 1st Sept 2026 at 09:00 UK time
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-5 sm:gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-3xl bg-slate-950/40 p-3 sm:p-4">
            <div className="text-xl font-black tracking-tight text-white sm:text-3xl">{String(item.value).padStart(2, '0')}</div>
            <div className="mt-2 text-[10px] uppercase text-purple-100/70 sm:text-[11px]">{item.label}</div>
          </div>
        ))}
      </div>
      <div
        className={`mt-4 rounded-3xl border px-4 py-4 text-sm text-center font-semibold transition-all duration-500 ${
          isLive
            ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100 shadow-inner shadow-emerald-500/20 opacity-100 translate-y-0'
            : 'border-transparent bg-transparent text-transparent opacity-0 -translate-y-3'
        }`}
      >
        Launch is live now in the UK.
      </div>
    </div>
  );
};

export default CountdownTimer;
