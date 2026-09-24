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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nextCountdown = getCountdown(targetDate);
      setCountdown(nextCountdown);
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
    <div className="mt-8 w-full min-w-0 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[1.5rem] bg-transparent p-[2px] shadow-2xl shadow-black/10 rainbow-border">
      <div className="flex min-w-0 flex-col gap-3 rounded-[1.25rem] bg-white p-5">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-black">Official launch</div>
        <div className="whitespace-normal break-words rounded-3xl bg-slate-950/40 p-4 text-center text-xs leading-5 text-white/90 sm:text-sm">
          Launch begins 1 November 2026 at 09:00 UK time
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-5 sm:gap-3">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 rounded-3xl bg-slate-950/40 p-3 sm:p-4">
            <div className="text-xl font-black tracking-tight text-white sm:text-3xl">{String(item.value).padStart(2, '0')}</div>
            <div className="mt-2 text-[10px] uppercase text-purple-100/70 sm:text-[11px]">{item.label}</div>
          </div>
        ))}
      </div>
      <div
        className={`mt-4 rounded-3xl border px-4 py-4 text-sm text-center font-semibold transition-all duration-500 ${
          countdown.expired
            ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100 shadow-inner shadow-emerald-500/20 opacity-100 translate-y-0'
            : 'border-transparent bg-transparent text-transparent opacity-0 -translate-y-3'
        }`}
      >
        Join the waitlist for updates. Public access opens when Q is ready.
      </div>
    </div>
  );
};

export default CountdownTimer;
