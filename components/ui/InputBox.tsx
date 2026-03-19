"use client";

import React, { useState, useRef } from 'react';

interface InputBoxProps {
  onSend: (message: string, file?: File) => void;
  placeholder?: string;
}

export const InputBox: React.FC<InputBoxProps> = ({ onSend, placeholder = "Ask me anything..." }) => {
  const [value, setValue] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() || selectedFile) {
      onSend(value, selectedFile || undefined);
      setValue('');
      setSelectedFile(null);
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

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col w-full max-w-2xl gap-2">
      {selectedFile && (
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 animate-enter">
          <div className="text-brand-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"></path><rect width="14" height="12" x="2" y="6" rx="2" ry="2"></rect></svg>
          </div>
          <span className="text-sm text-zinc-300 truncate max-w-[200px]">{selectedFile.name}</span>
          <button 
            onClick={() => setSelectedFile(null)}
            className="ml-auto text-zinc-500 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
          </button>
        </div>
      )}
      <form 
        onSubmit={handleSubmit}
        className="relative w-full animate-slide-up"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="video/*"
          className="hidden"
        />
        <button
          type="button"
          onClick={triggerFileInput}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-white transition-colors"
          title="Upload Video"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"></path><rect width="14" height="12" x="2" y="6" rx="2" ry="2"></rect><path d="M12 10v4"></path><path d="M10 12h4"></path></svg>
        </button>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="glass-input w-full rounded-2xl py-5 pl-14 pr-16 text-lg text-white placeholder:text-zinc-500 focus:ring-0"
        />
        <button
          type="submit"
          disabled={!value.trim() && !selectedFile}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl bg-brand-primary p-3 text-white transition-all hover:scale-110 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] disabled:opacity-50 disabled:hover:scale-100"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>
  );
};
