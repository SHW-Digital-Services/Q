// src/components/QLogo.tsx
import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface QLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  alt?: string;
}

export const QLogo: React.FC<QLogoProps> = ({ className = '', size = 'md', alt = 'Q Logo' }) => {
  const { theme } = useTheme();

  const sizeMap = {
    xs: 'w-5 h-5',
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-24 h-24'
  } as const;

  // Public Supabase-hosted logo (user-provided)
  const SUPABASE_LOGO = 'https://brnhalxydcakutxiregp.supabase.co/storage/v1/object/public/images/Logo.png';

  // Local fallbacks (kept for offline/dev)
  const base = (import.meta as any).env?.BASE_URL || '/';
  const localLight = `${base}q-logo.png`;
  const localDark = `${base}q-logo-white.png`;

  // We'll try the public hosted logo first, then local assets if it fails.
  // For dark theme, we apply a CSS filter if a separate dark image isn't available.
  const initialRemote = SUPABASE_LOGO;
  const initialLocal = theme === 'dark' ? localDark : localLight;

  const [src, setSrc] = useState<string>(initialRemote);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    if (usedFallback) {
      setSrc(localLight);
      console.debug('[QLogo] theme changed, using local fallback:', theme, localLight);
    } else {
      setSrc(initialRemote);
      console.debug('[QLogo] using remote logo:', initialRemote);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${sizeMap[size]} ${className} rounded-full p-2 bg-white/90 dark:bg-slate-950/70 shadow-sm`}>
      <img
        src={src}
        alt={alt}
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          // If remote fails, fall back to local files
          if (!usedFallback) {
            console.warn('[QLogo] remote logo failed to load, falling back to local asset:', src);
            setUsedFallback(true);
            setSrc(theme === 'dark' ? localDark : localLight);
          } else {
            // If local dark-white is missing, try the other local file
            if (img.src.endsWith('q-logo-white.png')) {
              console.warn('[QLogo] q-logo-white.png missing, trying q-logo.png');
              setSrc(localLight);
            } else {
              console.error('[QLogo] All logo sources failed to load:', img.src);
            }
          }
        }}
        className={`relative w-full h-full object-contain select-none rounded-full drop-shadow-md ${
          theme === 'dark' ? 'filter brightness-0 invert' : ''
        }`}
        onLoad={() => {
          console.debug('[QLogo] loaded image src:', src, 'theme:', theme, 'usedFallback:', usedFallback);
        }}
      />
    </div>
  );
};