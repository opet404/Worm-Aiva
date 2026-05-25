import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Search, Trash2, MessageSquare, ShieldAlert, Sparkles, X, ChevronLeft, ChevronRight, RefreshCw 
} from 'lucide-react';
import { ChatSession } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onClearAll: () => void;
}

export default function Sidebar({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onClearAll,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleClearClick = () => {
    onClearAll();
  };

  // Sift sessions matching the input query
  const filteredSessions = sessions.filter((session) => {
    const titleMatch = session.title.toLowerCase().includes(searchQuery.toLowerCase());
    const messageMatch = session.messages.some((msg) =>
      msg.text.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return titleMatch || messageMatch;
  });

  return (
    <>
      {/* Mobile background mask when open */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar sidebar body container */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className={`fixed md:sticky top-0 left-0 h-screen z-45 w-[280px] bg-[#09090c] border-r border-zinc-900 flex flex-col justify-between`}
      >
        {/* Glow ambient inside sidebar */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-glow-red opacity-10 pointer-events-none"></div>

        {/* TOP SEGMENT: Search & New Chat Controls */}
        <div className="p-4 space-y-4 border-b border-zinc-905">
          {/* Logo brand for mobile layout screen inside sidebar header */}
          <div className="flex items-center justify-between md:hidden">
            <div className="flex items-center gap-2">
              <img
                src="https://i.ibb.co.com/T5JkfpS/file-00000000329c71fa9276e0523e9d3280.png"
                alt="Worm Aiva logo"
                referrerPolicy="no-referrer"
                className="w-7 h-7 object-contain"
              />
              <span className="font-extrabold text-sm tracking-widest bg-gradient-to-r from-white to-[#ff3355] bg-clip-text text-transparent uppercase">
                Worm Aiva
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {/* New Chat Prompt Trigger Button */}
          <button
            onClick={() => {
              onNewChat();
              onClose(); // Close sidebar on mobile
            }}
            className="w-full h-11 rounded-xl flex items-center justify-center gap-2.5 bg-gradient-to-r from-red-950/40 via-red-900/20 to-zinc-900 border border-[#ff3355]/35 hover:border-[#ff3355]/70 hover:shadow-[0_0_15px_rgba(255,51,85,0.15)] text-white text-xs font-semibold tracking-wide transition-all duration-300 transform active:scale-95 cursor-pointer"
          >
            <Plus size={15} className="text-[#ff3355]" />
            Obrolan Baru
          </button>

          {/* Sifting/Search Tool Input */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-3.5 text-zinc-550" />
            <input
              type="text"
              placeholder="Cari riwayat obrolan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 rounded-xl text-xs bg-zinc-950/70 text-zinc-200 border border-zinc-900 focus:border-[#ff3355]/40 focus:outline-none transition-colors duration-200 placeholder-zinc-650 font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-[10px] text-zinc-500 hover:text-zinc-250 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* MID SEGMENT: Session list scrolling */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {filteredSessions.length > 0 ? (
            <div className="space-y-1">
              <div className="px-2 pb-2 text-[10px] font-mono text-zinc-600 uppercase tracking-widest flex items-center gap-1">
                <span>RIWAYAT SESI ({filteredSessions.length})</span>
              </div>
              {filteredSessions.map((s) => {
                const isActive = s.id === activeSessionId;
                return (
                  <motion.div
                    key={s.id}
                    onClick={() => {
                      onSelectSession(s.id);
                      onClose(); // Close on mobile
                    }}
                    whileHover={{ x: 4, backgroundColor: isActive ? 'rgba(127, 29, 29, 0.15)' : 'rgba(24, 24, 27, 0.8)' }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                    className={`group relative rounded-xl p-3 flex items-center justify-between transition-all duration-300 cursor-pointer select-none ${
                      isActive
                        ? 'bg-red-950/15 border-l-[3px] border-[#ff3355] text-zinc-100 shadow-[0_0_10px_rgba(255,51,85,0.03)]'
                        : 'hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <MessageSquare
                        size={14}
                        className={isActive ? 'text-[#ff3355]' : 'text-zinc-650 group-hover:text-zinc-400'}
                      />
                      <span className="text-xs font-medium truncate font-sans tracking-wide">
                        {s.title}
                      </span>
                    </div>

                    {/* Deletion pill handle */}
                    <button
                      onClick={(e) => onDeleteSession(s.id, e)}
                      title="Hapus sesi"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-800 text-zinc-550 hover:text-red-400 transition-all cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <MessageSquare size={20} className="text-zinc-800 mb-2" />
              <p className="text-xs text-zinc-600 font-sans">
                {searchQuery ? 'Sesi tidak ditemukan' : 'Belum ada riwayat sesi'}
              </p>
            </div>
          )}
        </div>

        {/* BOTTOM SEGMENT: Reset button & Developer details */}
        <div className="p-4 border-t border-zinc-950 bg-zinc-950/20 space-y-3">
          {sessions.length > 0 && (
            <button
              onClick={handleClearClick}
              className="w-full py-2.5 rounded-xl border border-zinc-900 hover:border-red-900/40 bg-zinc-950 hover:bg-red-950/20 text-zinc-400 hover:text-red-400 text-xs font-semibold tracking-wide transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 size={13} />
              Reset Semua Riwayat
            </button>
          )}

          {/* Secure watermark credits */}
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600">
            <span className="flex items-center gap-1">
              <Sparkles size={9} className="text-[#ff3355]" />
              WORM AIVA v1.2
            </span>
            <span>SECURE IP</span>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
