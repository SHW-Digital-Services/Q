// src/components/QLogo.tsx
import React, { useState } from 'react';

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

  // Public Supabase-hosted logo (user-provided)
  const SUPABASE_LOGO = 'https://brnhalxydcakutxiregp.supabase.co/storage/v1/object/public/images/Logo.png';

  // Local fallbacks (kept for offline/dev)
  const base = (import.meta as any).env?.BASE_URL || '/';
  const localLogo = `${base}logo.png`;

  // Try the public hosted logo first, then the bundled transparent asset.
  const initialRemote = SUPABASE_LOGO;
  const [src, setSrc] = useState<string>(initialRemote);
  const [usedFallback, setUsedFallback] = useState(false);

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${sizeMap[size]} ${className} rounded-full bg-white/95 ring-1 ring-purple-200/70 shadow-md`}>
      <img
        src={src}
        alt={alt}
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          // If remote fails, fall back to local files
          if (!usedFallback) {
            console.warn('[QLogo] remote logo failed to load, falling back to local asset:', src);
            setUsedFallback(true);
            setSrc(localLogo);
          } else {
            console.error('[QLogo] All logo sources failed to load:', img.src);
          }
        }}
        className="relative w-full h-full object-contain select-none rounded-full drop-shadow-md"
      />
    </div>
  );
};
