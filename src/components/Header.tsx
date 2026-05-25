import React from 'react';
import { Menu, Settings, ShieldAlert, Sparkles, RefreshCw, Layers, Globe } from 'lucide-react';

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  onResetChat: () => void;
  activeModel: string;
  useSearch: boolean;
  hasActiveMessages: boolean;
}

export default function Header({
  onToggleSidebar,
  onResetChat,
  activeModel,
  useSearch,
  hasActiveMessages,
}: Omit<HeaderProps, 'onOpenSettings'>) {
  return (
    <header className="sticky top-0 z-30 w-full h-15 border-b border-zinc-900 bg-zinc-950/70 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
      {/* LEFT: Toggle button only */}
      <div className="flex items-center">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl hover:bg-zinc-900 border border-zinc-950 hover:border-zinc-800 text-zinc-350 hover:text-white transition-all cursor-pointer"
          title="Buka Menu"
        >
          <Menu size={18} />
        </button>
      </div>

      {/* CENTER: Branded "WORM AIVA" title centered beautifully exactly like reference image */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center select-none leading-none">
        <span className="font-extrabold tracking-[0.25em] text-xs sm:text-sm text-transparent bg-clip-text bg-gradient-to-r from-[#ff003c] via-[#ff476e] to-[#ffccd5] uppercase drop-shadow-[0_0_12px_rgba(255,51,85,0.35)]">
          WORM AIVA
        </span>
        <span className="text-[7.5px] font-mono font-black text-white/90 tracking-[0.22em] mt-0.5 uppercase">
          v1.2
        </span>
      </div>

      {/* RIGHT: Clear Session status button */}
      <div className="flex items-center gap-2.5">
        {hasActiveMessages && (
          <button
            onClick={onResetChat}
            className="p-1.5 rounded-lg hover:bg-[#ff3355]/10 border border-zinc-900 hover:border-[#ff3355]/20 text-zinc-400 hover:text-[#ff3355] transition-all cursor-pointer flex items-center justify-center gap-1 text-xs px-2.5"
            title="Bersihkan obrolan saat ini"
          >
            <RefreshCw size={12} />
            <span className="hidden sm:inline text-[11px] font-sans">Reset Sesi</span>
          </button>
        )}
      </div>
    </header>
  );
}
