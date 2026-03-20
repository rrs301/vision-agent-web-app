"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface InputBoxProps {
  onSend: (message: string, file?: File) => void;
  onVoiceToggle?: (enabled: boolean) => void;
  voiceEnabled?: boolean;
  placeholder?: string;
}

export const InputBox: React.FC<InputBoxProps> = ({
  onSend,
  onVoiceToggle,
  voiceEnabled = false,
  placeholder = "Ask me anything about your videos..."
}) => {
  const [value, setValue] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 180; // roughly 6 rows
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  }, []);

  useEffect(() => { adjustHeight(); }, [value, adjustHeight]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() || selectedFile) {
      onSend(value, selectedFile || undefined);
      setValue('');
      setSelectedFile(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
    } else if (file) {
      alert("Please select a video file.");
    }
  };

  return (
    <div className="flex flex-col w-full max-w-2xl gap-2">
      {/* Selected file chip */}
      {selectedFile && (
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 animate-enter">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-primary/15">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-primary">
              <path d="m22 8-6 4 6 4V8Z"></path><rect width="14" height="12" x="2" y="6" rx="2" ry="2"></rect>
            </svg>
          </div>
          <span className="text-sm text-zinc-300 truncate max-w-[200px] font-medium">{selectedFile.name}</span>
          <button
            onClick={() => setSelectedFile(null)}
            className="ml-auto text-zinc-500 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
          </button>
        </div>
      )}

      {/* Main prompt area */}
      <form onSubmit={handleSubmit} className="relative w-full animate-slide-up">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="video/*"
          className="hidden"
        />

        <div className="glass-input rounded-2xl overflow-hidden focus-within:border-brand-primary/50 focus-within:shadow-[0_0_30px_rgba(59,130,246,0.15)] transition-all duration-300">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={2}
            className="w-full bg-transparent resize-none py-4 px-5 text-white placeholder:text-zinc-500 focus:outline-none text-base leading-relaxed"
            style={{ minHeight: '64px' }}
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-3 pb-3">
            {/* Left: attachment actions */}
            <div className="flex items-center gap-1">
              {/* Video upload */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-xl text-zinc-400 hover:text-brand-primary hover:bg-brand-primary/10 transition-all"
                title="Upload Video"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m22 8-6 4 6 4V8Z"></path><rect width="14" height="12" x="2" y="6" rx="2" ry="2"></rect>
                  <path d="M12 10v4"></path><path d="M10 12h4"></path>
                </svg>
              </button>

              {/* Voice toggle */}
              {onVoiceToggle && (
                <button
                  type="button"
                  onClick={() => onVoiceToggle(!voiceEnabled)}
                  className={`p-2.5 rounded-xl transition-all ${
                    voiceEnabled
                      ? 'text-orange-400 bg-orange-500/15 shadow-[0_0_12px_rgba(251,146,60,0.2)]'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                  title={voiceEnabled ? 'Voice Mode On' : 'Enable Voice Mode'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="22"></line>
                  </svg>
                </button>
              )}
            </div>

            {/* Right: send button */}
            <button
              type="submit"
              disabled={!value.trim() && !selectedFile}
              className="rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary p-2.5 text-white transition-all hover:scale-105 hover:shadow-[0_0_24px_rgba(59,130,246,0.4)] disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"></path>
                <path d="m12 5 7 7-7 7"></path>
              </svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
