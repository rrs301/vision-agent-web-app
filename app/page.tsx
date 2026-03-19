"use client";

import React, { useState } from "react";
import { InputBox } from "@/components/ui/InputBox";
import { ChatInterface } from "@/components/ChatInterface";

export default function Home() {
  const [initialQuery, setInitialQuery] = useState<string | null>(null);
  const [initialVideo, setInitialVideo] = useState<File | null>(null);
  const [startWithScreenshare, setStartWithScreenshare] = useState(false);

  const handleStartChat = (query: string, file?: File) => {
    setInitialQuery(query || "Analysis of uploaded video");
    if (file) setInitialVideo(file);
  };

  const handleStartWithScreenshare = () => {
    setInitialQuery("Sharing screen for analysis");
    setStartWithScreenshare(true);
  };

  const handleBackToLanding = () => {
    setInitialQuery(null);
    setInitialVideo(null);
    setStartWithScreenshare(false);
  };

  return (
    <div className="mesh-gradient min-h-screen text-white overflow-x-hidden">
      {!initialQuery ? (
        <main className="flex min-h-screen flex-col items-center justify-center px-6">
          <div className="w-full max-w-4xl text-center space-y-8 animate-enter">
            {/* Hero Section */}
            <div className="space-y-4">
              <div className="inline-block animate-float">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-4xl font-black shadow-[0_0_40px_rgba(59,130,246,0.3)]">
                  V
                </div>
              </div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                AI Vision Agent
              </h1>
              <p className="text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto">
                Your intelligent partner for visual analysis, using GetStream Vision Agents and Gemini.
              </p>
            </div>

            {/* Input Section */}
            <div className="pt-8 flex flex-col items-center gap-6">
              <InputBox 
                onSend={handleStartChat} 
                placeholder="Upload a video and ask a question..." 
              />
              <div className="flex items-center gap-3">
                <div className="h-px w-12 bg-white/10"></div>
                <span className="text-zinc-500 text-sm font-medium uppercase tracking-wider">OR</span>
                <div className="h-px w-12 bg-white/10"></div>
              </div>
              <button
                onClick={handleStartWithScreenshare}
                className="glass px-8 py-4 rounded-2xl flex items-center gap-3 text-brand-primary hover:text-white hover:bg-brand-primary/20 transition-all border border-brand-primary/30 group"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                <span className="font-semibold text-lg">Start Screen Share</span>
              </button>
            </div>

            {/* Suggestions */}
            <div className="pt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto animate-slide-up" style={{ animationDelay: '0.2s' }}>
              {[
                "Detect objects in a video",
                "Explain what is happening",
                "Extract highlights from the footage"
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleStartChat(suggestion)}
                  className="glass p-4 rounded-xl text-sm text-zinc-400 hover:text-white hover:border-white/30 transition-all text-left"
                >
                  {suggestion} →
                </button>
              ))}
            </div>
          </div>
        </main>
      ) : (
        <ChatInterface 
          initialMessage={initialQuery} 
          initialVideo={initialVideo || undefined}
          initialScreenshare={startWithScreenshare}
          onBack={handleBackToLanding} 
        />
      )}
    </div>
  );
}
