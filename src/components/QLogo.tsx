// src/components/QLogo.tsx
import React from 'react';

interface QLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  alt?: string;
}

export const QLogo: React.FC<QLogoProps> = ({ className = '', size = 'md', alt = 'Q Logo' }) => {
  const sizeMap = {
    xs: 'w-7 h-7 p-0.5',
    sm: 'w-10 h-10 p-1',
    md: 'w-14 h-14 p-1.5',
    lg: 'w-20 h-20 p-2',
    xl: 'w-28 h-28 p-2.5'
  } as const;

  // Keep the logo bundled with Q so navigation and safety controls never wait
  // for an external storage request and remain available offline.
  const base = (import.meta as any).env?.BASE_URL || '/';
  const localLogo = `${base}logo.png`;

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${sizeMap[size]} ${className} rounded-full bg-white/95 ring-1 ring-purple-200/70 shadow-md`}>
      <img
        src={localLogo}
        alt={alt}
        className="relative w-full h-full object-contain select-none rounded-full drop-shadow-md"
      />
    </div>
  );
};
