"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
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

const GITHUB_REPO_URL = "https://github.com/GetStream/vision-agents";
const STARRED_KEY = "vision_agent_starred";

export default function Home() {
  const [initialQuery, setInitialQuery] = useState<string | null>(null);
  const [initialVideo, setInitialVideo] = useState<File | null>(null);
  const [initialAIGreeting, setInitialAIGreeting] = useState<string | undefined>(undefined);
  const [activeSystemPrompt, setActiveSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);
  const [startWithScreenshare, setStartWithScreenshare] = useState(false);
  const [startWithVoice, setStartWithVoice] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [showGitHubPopup, setShowGitHubPopup] = useState(false);
  const [credits, setCredits] = useState<number>(20);

  // Initialize credits from localStorage
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastReset = localStorage.getItem('vision_agent_last_reset');
    const savedCredits = localStorage.getItem('vision_agent_credits');

    if (lastReset !== today) {
      // New day, reset credits
      setCredits(20);
      localStorage.setItem('vision_agent_credits', '20');
      localStorage.setItem('vision_agent_last_reset', today);
    } else if (savedCredits !== null) {
      setCredits(parseInt(savedCredits, 10));
    }
  }, []);

  // Update localStorage when credits change
  useEffect(() => {
    localStorage.setItem('vision_agent_credits', credits.toString());
  }, [credits]);

  const handleDecrementCredits = useCallback(() => {
    setCredits(prev => Math.max(0, prev - 1));
  }, []);

  // Store the pending action so we can execute it after the popup
  const pendingActionRef = useRef<(() => void) | null>(null);

  const proceedWithAction = useCallback((action: () => void) => {
    const hasStarred = typeof window !== "undefined" && localStorage.getItem(STARRED_KEY);
    if (!hasStarred) {
      pendingActionRef.current = action;
      setShowGitHubPopup(true);
    } else {
      action();
    }
  }, []);

  const handlePopupOk = useCallback(() => {
    // Open GitHub in new tab
    window.open(GITHUB_REPO_URL, "_blank", "noopener,noreferrer");
    // Mark as starred so the popup won't show again
    localStorage.setItem(STARRED_KEY, "true");
    setShowGitHubPopup(false);
    // Execute the pending action (navigate to chat)
    if (pendingActionRef.current) {
      pendingActionRef.current();
      pendingActionRef.current = null;
    }
  }, []);

  const handleStartChat = (query: string, file?: File) => {
    proceedWithAction(() => {
      setInitialQuery(query || "Analyze the uploaded video");
      if (file) setInitialVideo(file);
      handleDecrementCredits();
    });
  };

  const handleFeatureClick = (feature: typeof FEATURES[number]) => {
    proceedWithAction(() => {
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
    });
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
      {/* Global Header */}
      <header className="flex items-center justify-between p-4 md:p-6 border-b border-white/10 glass fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={handleBackToLanding}>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center font-bold shadow-lg">V</div>
          <h2 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
            Vision Agent
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg bg-zinc-500/10 border border-white/10 shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
            <span className="text-sm font-semibold text-white/90">
              {credits} Credits
            </span>
          </div>
          {initialQuery && (
            <button onClick={handleBackToLanding} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-200">
              New Chat
            </button>
          )}
        </div>
      </header>
      {!initialQuery ? (
        <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24">
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
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="github-star-link mt-4"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Star on GitHub
              </a>
            </div>

            {/* Prompt Input Section */}
            <div className="flex flex-col items-center gap-4">
              <InputBox
                onSend={handleStartChat}
                onVoiceToggle={(enabled) => {
                  if (enabled) {
                    setStartWithVoice(true);
                    handleStartChat("Voice assistant ready");
                  } else {
                    setVoiceEnabled(false);
                  }
                }}
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
        <div className="pt-20"> {/* Offset for fixed header */}
          <ChatInterface
            initialMessage={initialQuery}
            initialAIMessage={initialAIGreeting}
            systemPrompt={activeSystemPrompt}
            initialVideo={initialVideo || undefined}
            initialScreenshare={startWithScreenshare}
            initialVoice={startWithVoice}
            onBack={handleBackToLanding}
            credits={credits}
            setCredits={setCredits}
          />
        </div>
      )}

      {/* GitHub Star Popup Modal */}
      {showGitHubPopup && (
        <div className="modal-overlay" onClick={() => { setShowGitHubPopup(false); pendingActionRef.current = null; }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-star-icon">⭐</div>
            <h2 className="modal-title">Support This Project!</h2>
            <p className="modal-desc">
              If you find Vision Agent useful, please consider giving us a star on GitHub. It helps us grow and build more amazing features!
            </p>
            <button className="modal-btn-star" onClick={handlePopupOk}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Star on GitHub & Continue
            </button>
            <button className="modal-btn-ok" onClick={() => {
              localStorage.setItem(STARRED_KEY, "true");
              setShowGitHubPopup(false);
              if (pendingActionRef.current) {
                pendingActionRef.current();
                pendingActionRef.current = null;
              }
            }}>
              Skip for now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
