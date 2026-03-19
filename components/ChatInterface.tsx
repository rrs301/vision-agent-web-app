"use client";

import React, { useEffect, useState, useRef } from 'react';
import { GlassContainer } from './ui/GlassContainer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  videoUrl?: string;
  isStreaming?: boolean;
}

interface ChatInterfaceProps {
  initialMessage: string;
  initialVideo?: File;
  initialScreenshare?: boolean;
  onBack: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  initialMessage,
  initialVideo,
  initialScreenshare,
  onBack
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const pendingTranscriptRef = useRef('');
  const liveWsRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initial setup and global cleanup
  useEffect(() => {
    const startChat = async () => {
      if (initialScreenshare) {
        await startScreenShare();
      }
      let videoUrl: string | undefined;
      if (initialVideo) {
        videoUrl = URL.createObjectURL(initialVideo);
      }

      const userMessage: Message = {
        id: '1',
        role: 'user',
        content: initialMessage,
        videoUrl
      };

      setMessages([userMessage]);
      await getAIResponse(initialMessage, initialVideo);
    };

    startChat();

    return () => {
      stopLiveSession();
    };
  }, []);

  // Voice session toggle
  useEffect(() => {
    if (voiceEnabled) {
      startLiveSession();
    } else {
      stopLiveSession();
    }
  }, [voiceEnabled]);

  const captureFrame = (): Promise<File | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current || !screenStream) return resolve(null);
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], 'screenshot.jpg', { type: 'image/jpeg' }));
        } else {
          resolve(null);
        }
      }, 'image/jpeg', 0.8);
    });
  };

  const startLiveSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ws = new WebSocket('ws://localhost:8000/live_chat');
      liveWsRef.current = ws;

      // Playback (Agent -> User)
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      await audioCtx.audioWorklet.addModule('/audio-processor.js');
      const workletNode = new AudioWorkletNode(audioCtx, 'audio-processor');
      workletNode.connect(audioCtx.destination);
      audioCtxRef.current = audioCtx;
      audioWorkletNodeRef.current = workletNode;

      // Recording (User -> Agent)
      const recordingContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const source = recordingContext.createMediaStreamSource(stream);
      const processor = recordingContext.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(recordingContext.destination);

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          ws.send(pcmData.buffer);
        }
      };

      (ws as any)._recordingContext = recordingContext;
      (ws as any)._processor = processor;
      (ws as any)._stream = stream;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'partial_transcript') {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.id === 'live-transcript') {
               return [...prev.slice(0, -1), { ...last, content: `Heard: ${data.content}` }];
            }
            return [...prev, { id: 'live-transcript', role: 'user', content: `Heard: ${data.content}` }];
          });
        } else if (data.type === 'transcript') {
          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== 'live-transcript');
            return [...filtered, { id: Date.now().toString() + '-user', role: 'user', content: data.content }];
          });
          if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
        } else if (data.type === 'clear_audio') {
          // Interrupt AI speech
          if (audioWorkletNodeRef.current) {
            audioWorkletNodeRef.current.port.postMessage({ type: 'clear' });
          }
        } else if (data.type === 'text') {
          setIsTyping(false);
          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== 'live-transcript');
            const lastMsg = filtered[filtered.length - 1];
            if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
              return [...filtered.slice(0, -1), { ...lastMsg, content: lastMsg.content + data.content }];
            } else {
              return [...filtered, { id: Date.now().toString(), role: 'assistant', content: data.content, isStreaming: true }];
            }
          });
        } else if (data.type === 'audio') {
          const binaryString = window.atob(data.content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
          const pcm16 = new Int16Array(bytes.buffer);
          if (audioWorkletNodeRef.current) {
            audioWorkletNodeRef.current.port.postMessage(pcm16.buffer, [pcm16.buffer]);
          }
          if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
        } else if (data.type === 'text_end') {
          setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
        }
      };

      frameIntervalRef.current = setInterval(async () => {
        if (screenStream && ws.readyState === WebSocket.OPEN) {
          const frame = await captureFrame();
          if (frame) {
            const reader = new FileReader();
            reader.onload = () => ws.send(JSON.stringify({ type: 'image', content: reader.result as string }));
            reader.readAsDataURL(frame);
          }
        }
      }, 3000);

      setIsLive(true);
    } catch (err) {
      console.error("Error starting live session:", err);
      setVoiceEnabled(false);
    }
  };

  const stopLiveSession = () => {
    if (liveWsRef.current) {
      const ws = liveWsRef.current as any;
      if (ws._processor) ws._processor.disconnect();
      if (ws._recordingContext) ws._recordingContext.close();
      if (ws._stream) ws._stream.getTracks().forEach((t: any) => t.stop());
      ws.close();
      liveWsRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    audioWorkletNodeRef.current = null;
    setIsLive(false);
  };

  const getAIResponse = async (prompt: string, videoFile?: File) => {
    if (voiceEnabled) {
      if (liveWsRef.current?.readyState === WebSocket.OPEN) {
        liveWsRef.current.send(JSON.stringify({ type: 'prompt', content: prompt }));
      }
      return;
    }

    setIsTyping(true);
    let fileToShare = videoFile;
    if (!fileToShare && screenStream) fileToShare = await captureFrame() || undefined;

    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('session_id', sessionId);
      if (fileToShare) formData.append('video', fileToShare);

      const response = await fetch('http://localhost:8000/analyze_stream', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Backend failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const assistantMessage: Message = { id: Date.now().toString(), role: 'assistant', content: '', isStreaming: true };
      setMessages(prev => [...prev, assistantMessage]);

      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: accumulated } : m));
      }
      setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { id: 'err', role: 'assistant', content: "Error connecting to backend." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" } as any, audio: false });
      setScreenStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      stream.getTracks()[0].onended = () => setScreenStream(null);
    } catch (err) {
      console.error("Error sharing screen:", err);
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputValue.trim() && !selectedVideo) || isTyping) return;
    const msg = inputValue;
    const video = selectedVideo;
    
    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, { 
      id: userMsgId, 
      role: 'user', 
      content: msg,
      videoUrl: video ? URL.createObjectURL(video) : undefined
    }]);
    
    setInputValue('');
    setSelectedVideo(null);
    getAIResponse(msg || "Analyze this video", video || undefined);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedVideo(file);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-transparent animate-enter">
      <header className="flex items-center justify-between p-4 md:p-6 border-b border-white/10 glass">
        <div className="flex items-center gap-3" onClick={onBack} style={{cursor: 'pointer'}}>
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center font-bold">V</div>
          <h2 className="text-xl font-semibold hidden sm:block">Vision Agent</h2>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-all ${voiceEnabled ? 'bg-orange-500/20 text-orange-500 border border-orange-500/30' : 'bg-zinc-500/10 text-zinc-400 hover:text-white'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
            <span className="hidden xs:inline">{voiceEnabled ? 'Voice Mode On' : 'Voice Mode Off'}</span>
          </button>
          <button
            onClick={screenStream ? stopScreenShare : startScreenShare}
            className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-all ${screenStream ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-brand-primary/20 text-brand-primary hover:bg-brand-primary/30'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            <span className="hidden xs:inline">{screenStream ? 'Stop Sharing' : 'Share Screen'}</span>
          </button>
          <button onClick={onBack} className="text-zinc-400 hover:text-white transition-colors">New Chat</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {screenStream && (
            <div className="relative group overflow-hidden rounded-xl border border-brand-primary/30 shadow-2xl">
              <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 bg-red-500/20 backdrop-blur-md border border-red-500/30 rounded-full">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                <span className="text-xs font-medium text-red-500 uppercase tracking-wider">Live Preview</span>
              </div>
              <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-video object-cover" />
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <GlassContainer className={`max-w-[80%] ${m.role === 'user' ? 'bg-brand-primary/10 border-brand-primary/20' : ''}`}>
                <div className="space-y-3">
                  {m.videoUrl && <video src={m.videoUrl} controls className="w-full rounded-lg border border-white/10 shadow-lg" />}
                  <p className="text-zinc-100 leading-relaxed whitespace-pre-wrap">
                    {m.content}
                    {m.id === 'live-transcript' && <span className="text-brand-primary animate-pulse ml-2 font-medium"> (Processing...)</span>}
                    {m.isStreaming && <span className="inline-block w-1 h-4 bg-brand-primary ml-1 animate-pulse">|</span>}
                  </p>
                </div>
              </GlassContainer>
            </div>
          ))}
          {isTyping && !messages[messages.length - 1]?.isStreaming && (
            <div className="flex justify-start">
              <GlassContainer>
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </GlassContainer>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 border-t border-white/10 glass">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative space-y-4">
          {selectedVideo && (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 animate-enter">
              <div className="text-brand-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"></path><rect width="14" height="12" x="2" y="6" rx="2" ry="2"></rect></svg>
              </div>
              <span className="text-sm text-zinc-300 truncate max-w-[200px]">{selectedVideo.name}</span>
              <button 
                type="button"
                onClick={() => setSelectedVideo(null)}
                className="ml-auto text-zinc-500 hover:text-white transition-colors"
                title="Remove Video"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
              </button>
            </div>
          )}
          <div className="relative">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="video/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-brand-primary transition-colors"
              title="Upload Video"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"></path><rect width="14" height="12" x="2" y="6" rx="2" ry="2"></rect><path d="M12 10v4"></path><path d="M10 12h4"></path></svg>
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={screenStream ? "Ask about your screen..." : "Upload a video or ask a question..."}
              disabled={isTyping}
              className="w-full glass-input rounded-xl py-4 pl-12 pr-16 text-white placeholder:text-zinc-500 focus:ring-0 disabled:opacity-50"
            />
            <button type="submit" disabled={(!inputValue.trim() && !selectedVideo) || isTyping} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-brand-primary hover:text-white transition-colors disabled:opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
