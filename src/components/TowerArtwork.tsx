import React from 'react';
import type { EnemyType, TowerType } from '../game/types';

export const TowerIconSVG: React.FC<{ type: TowerType; className?: string }> = ({
  type,
  className = 'w-12 h-12',
}) => {
  switch (type) {
    case 'gun':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <polygon points="14,50 50,50 45,38 19,38" fill="#6b6760" stroke="#292524" strokeWidth="2" />
          <rect x="20" y="34" width="24" height="6" rx="2" fill="#f59e0b" />
          <rect x="18" y="20" width="24" height="14" rx="4" fill="#475569" stroke="#1e293b" strokeWidth="2" />
          <rect x="24" y="16" width="12" height="5" rx="2" fill="#fbbf24" />
          <rect x="38" y="22" width="18" height="4.5" rx="1.5" fill="#94a3b8" stroke="#1e293b" strokeWidth="1.5" />
          <rect x="38" y="28" width="18" height="4.5" rx="1.5" fill="#94a3b8" stroke="#1e293b" strokeWidth="1.5" />
          <circle cx="57" cy="24.2" r="2.5" fill="#fde047" />
        </svg>
      );
    case 'cannon':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <polygon points="10,52 54,52 48,42 16,42" fill="#78716c" stroke="#292524" strokeWidth="2" />
          <path d="M18 42 L24 30 L42 30 L46 42 Z" fill="#9a5b2c" stroke="#451a03" strokeWidth="2" />
          <g transform="rotate(-22 32 28)">
            <rect x="16" y="19" width="32" height="14" rx="6" fill="#334155" stroke="#0f172a" strokeWidth="2" />
            <ellipse cx="48" cy="26" rx="3.5" ry="7.5" fill="#475569" stroke="#0f172a" strokeWidth="1.5" />
            <rect x="24" y="18.5" width="4" height="15" fill="#f59e0b" />
          </g>
          <circle cx="24" cy="40" r="5" fill="#334155" stroke="#0f172a" strokeWidth="2" />
        </svg>
      );
    case 'sniper':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <path d="M18 52 L22 26 L42 26 L46 52 Z" fill="#78716c" stroke="#292524" strokeWidth="2" />
          <rect x="18" y="22" width="28" height="6" rx="1.5" fill="#57534e" stroke="#292524" strokeWidth="1.5" />
          <rect x="20" y="17" width="6" height="6" fill="#78716c" stroke="#292524" strokeWidth="1.5" />
          <rect x="38" y="17" width="6" height="6" fill="#78716c" stroke="#292524" strokeWidth="1.5" />
          <circle cx="32" cy="14" r="5.5" fill="#334155" stroke="#0f172a" strokeWidth="1.5" />
          <rect x="33" y="12.5" width="5" height="2.5" rx="1" fill="#ef4444" />
          <rect x="30" y="18" width="28" height="3.2" rx="1" fill="#475569" stroke="#0f172a" strokeWidth="1.2" />
          <rect x="34" y="15.5" width="8" height="2.5" rx="1" fill="#f59e0b" />
          <path d="M29 36 L35 36 L35 42 L32 45 L29 42 Z" fill="#1d4ed8" stroke="#fbbf24" strokeWidth="1.2" />
        </svg>
      );
    case 'lightning':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <polygon points="16,52 48,52 44,44 20,44" fill="#64748b" stroke="#1e293b" strokeWidth="2" />
          <path d="M22 44 L25 24 L39 24 L42 44 Z" fill="#854d0e" stroke="#451a03" strokeWidth="2" />
          <polygon points="32,8 40,18 32,28 24,18" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="1.5" />
          <path d="M16 20 L24 22 L20 26" stroke="#7dd3fc" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M48 20 L40 22 L44 26" stroke="#7dd3fc" strokeWidth="2.2" strokeLinecap="round" />
          <polygon points="32,31 28,38 33,38 30,43 36,36 31,36" fill="#fde047" />
        </svg>
      );
  }
};

export const EnemyIconSVG: React.FC<{ type: EnemyType; className?: string }> = ({
  type,
  className = 'w-10 h-10',
}) => {
  switch (type) {
    case 'infantry':
      return (
        <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
          <circle cx="24" cy="15" r="7" fill="#64748b" stroke="#1e293b" strokeWidth="2" />
          <path d="M16 14 C16 8, 32 8, 32 14 Z" fill="#475569" />
          <rect x="17" y="22" width="14" height="14" rx="4" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.8" />
          <rect x="24" y="26" width="16" height="3.5" rx="1" fill="#334155" />
        </svg>
      );
    case 'scout':
      return (
        <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
          <path d="M10 18 Q18 16 22 22 L12 24 Z" fill="#ef4444" />
          <circle cx="26" cy="15" r="6.5" fill="#334155" stroke="#0f172a" strokeWidth="2" />
          <rect x="27" y="13" width="6" height="3.5" rx="1" fill="#f97316" />
          <path d="M19 22 L31 22 L28 36 L17 36 Z" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />
          <path d="M6 28 H14 M4 33 H13" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'heavy':
      return (
        <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
          <rect x="11" y="17" width="26" height="22" rx="6" fill="#475569" stroke="#0f172a" strokeWidth="2" />
          <circle cx="24" cy="13" r="6" fill="#334155" stroke="#0f172a" strokeWidth="2" />
          <rect x="20" y="12" width="8" height="2.5" fill="#ef4444" />
          <path d="M11 20 L21 20 L21 35 L16 40 L11 35 Z" fill="#64748b" stroke="#cbd5e1" strokeWidth="1.5" />
        </svg>
      );
    case 'shielded':
      return (
        <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
          <circle cx="24" cy="24" r="19" fill="#0ea5e9" fillOpacity="0.2" stroke="#38bdf8" strokeWidth="2.2" strokeDasharray="4 2" />
          <circle cx="24" cy="16" r="6" fill="#1e3a8a" stroke="#0f172a" strokeWidth="1.5" />
          <rect x="21" y="14.5" width="7" height="2.5" fill="#38bdf8" />
          <rect x="17" y="22" width="14" height="13" rx="3" fill="#1d4ed8" stroke="#0f172a" strokeWidth="1.5" />
        </svg>
      );
    case 'drone':
      return (
        <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
          <line x1="10" y1="14" x2="38" y2="30" stroke="#475569" strokeWidth="3" />
          <line x1="38" y1="14" x2="10" y2="30" stroke="#475569" strokeWidth="3" />
          <circle cx="10" cy="14" r="5" fill="none" stroke="#38bdf8" strokeWidth="2" />
          <circle cx="38" cy="14" r="5" fill="none" stroke="#38bdf8" strokeWidth="2" />
          <circle cx="10" cy="30" r="5" fill="none" stroke="#38bdf8" strokeWidth="2" />
          <circle cx="38" cy="30" r="5" fill="none" stroke="#38bdf8" strokeWidth="2" />
          <circle cx="24" cy="22" r="7" fill="#1e293b" stroke="#f97316" strokeWidth="2" />
          <circle cx="24" cy="22" r="3" fill="#f97316" />
        </svg>
      );
  }
};
