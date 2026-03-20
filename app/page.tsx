"use client";

import React, { useState } from "react";
import { InputBox } from "@/components/ui/InputBox";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { ChatInterface } from "@/components/ChatInterface";
import { FEATURE_PROMPTS, DEFAULT_SYSTEM_PROMPT } from "@/config/featurePrompts";

const FEATURES = [
  {
    id: "vision-chat",
    title: "AI Vision Chat",
    description: "Share your screen and have a live conversation about what the AI sees.",
    gradient: "from-blue-500 to-cyan-400",
    glowColor: "rgba(59,130,246,0.25)",
    prompt: "Sharing screen for analysis",
    screenshare: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    id: "video-qa",
    title: "Video Q&A",
    description: "Upload any video and ask detailed questions about its content.",
    gradient: "from-violet-500 to-purple-400",
    glowColor: "rgba(139,92,246,0.25)",
    prompt: "Analyze the uploaded video",
    aiGreeting: "Hey there! 👋 I'm ready to analyze any video you share. Upload a video using the attachment button below and ask me anything about it — I can describe scenes, identify objects, answer questions, and more!",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 8-6 4 6 4V8Z" /><rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
      </svg>
    ),
  },
  {
    id: "voice-agent",
    title: "Voice Agent",
    description: "Hands-free, voice-powered AI assistant for natural conversations.",
    gradient: "from-orange-500 to-amber-400",
    glowColor: "rgba(251,146,60,0.25)",
    prompt: "Voice assistant ready",
    voice: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    ),
  },
  {
    id: "highlights",
    title: "Smart Highlights",
    description: "Automatically extract key moments and highlights from any footage.",
    gradient: "from-emerald-500 to-teal-400",
    glowColor: "rgba(16,185,129,0.25)",
    prompt: "Extract the key highlights and important moments from this video",
    aiGreeting: "Hi! ⭐ I can find the most important moments in your video. Upload a video below and I'll extract key highlights, interesting scenes, and notable moments for you!",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    id: "accessibility",
    title: "Accessibility Buddy",
    description: "AI-powered screen narration and visual descriptions for everyone.",
    gradient: "from-pink-500 to-rose-400",
    glowColor: "rgba(236,72,153,0.25)",
    prompt: "Describe everything you see on screen in detail for accessibility",
    screenshare: true,
    aiGreeting: "Hello! 💡 I'm your Accessibility Buddy. Share your screen using the button above and I'll provide real-time descriptions of what's on screen — perfect for navigation assistance, reading content aloud, or understanding visual elements.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
      </svg>
    ),
  },
  {
    id: "uiux-audit",
    title: "UI/UX Auditor",
    description: "Get real-time design feedback and accessibility checks on your screen.",
    gradient: "from-sky-500 to-indigo-400",
    glowColor: "rgba(56,189,248,0.25)",
    prompt: "Audit the UI/UX on my screen. Check for alignment, contrast, spacing, and accessibility issues.",
    screenshare: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
];

export default function Home() {
  const [initialQuery, setInitialQuery] = useState<string | null>(null);
  const [initialVideo, setInitialVideo] = useState<File | null>(null);
  const [initialAIGreeting, setInitialAIGreeting] = useState<string | undefined>(undefined);
  const [activeSystemPrompt, setActiveSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);
  const [startWithScreenshare, setStartWithScreenshare] = useState(false);
  const [startWithVoice, setStartWithVoice] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const handleStartChat = (query: string, file?: File) => {
    setInitialQuery(query || "Analyze the uploaded video");
    if (file) setInitialVideo(file);
  };

  const handleFeatureClick = (feature: typeof FEATURES[number]) => {
    if ((feature as any).screenshare) {
      setStartWithScreenshare(true);
    }
    if ((feature as any).voice) {
      setStartWithVoice(true);
    }
    // AI-initiated: set the greeting so AI speaks first
    if ((feature as any).aiGreeting) {
      setInitialAIGreeting((feature as any).aiGreeting);
    }
    // Set feature-specific system prompt
    setActiveSystemPrompt(FEATURE_PROMPTS[feature.id] || DEFAULT_SYSTEM_PROMPT);
    setInitialQuery(feature.prompt || "Analyze the uploaded video");
  };

  const handleBackToLanding = () => {
    setInitialQuery(null);
    setInitialVideo(null);
    setInitialAIGreeting(undefined);
    setActiveSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setStartWithScreenshare(false);
    setStartWithVoice(false);
    setVoiceEnabled(false);
  };

  return (
    <div className="mesh-gradient min-h-screen text-white overflow-x-hidden">
      {!initialQuery ? (
        <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-4xl text-center space-y-10 animate-enter">
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
              <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                Your intelligent partner for visual analysis, powered by GetStream Vision Agents and Gemini.
              </p>
            </div>

            {/* Prompt Input Section */}
            <div className="flex flex-col items-center gap-4">
              <InputBox
                onSend={handleStartChat}
                onVoiceToggle={setVoiceEnabled}
                voiceEnabled={voiceEnabled}
                placeholder="Upload a video and ask a question, or type a prompt..."
              />
            </div>

            {/* Feature Cards Grid */}
            <div className="pt-4">
              <p className="text-sm font-medium text-zinc-500 uppercase tracking-widest mb-6">
                Explore Features
              </p>
              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto animate-slide-up"
                style={{ animationDelay: '0.15s' }}
              >
                {FEATURES.map((feature) => (
                  <FeatureCard
                    key={feature.id}
                    icon={feature.icon}
                    title={feature.title}
                    description={feature.description}
                    gradient={feature.gradient}
                    glowColor={feature.glowColor}
                    onClick={() => handleFeatureClick(feature)}
                  />
                ))}
              </div>
            </div>
          </div>
        </main>
      ) : (
        <ChatInterface
          initialMessage={initialQuery}
          initialAIMessage={initialAIGreeting}
          systemPrompt={activeSystemPrompt}
          initialVideo={initialVideo || undefined}
          initialScreenshare={startWithScreenshare}
          onBack={handleBackToLanding}
        />
      )}
    </div>
  );
}
