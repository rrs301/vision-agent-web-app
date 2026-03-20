"use client";

import React from 'react';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;          // e.g. "from-blue-500 to-cyan-400"
  glowColor: string;         // e.g. "rgba(59,130,246,0.3)"
  onClick: () => void;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  gradient,
  glowColor,
  onClick
}) => {
  return (
    <button
      onClick={onClick}
      className="feature-card glass group relative rounded-2xl p-6 text-left transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 overflow-hidden cursor-pointer w-full"
      style={{
        '--glow-color': glowColor,
      } as React.CSSProperties}
    >
      {/* Shimmer overlay */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="shimmer-effect absolute inset-0" />
      </div>

      {/* Hover border glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          boxShadow: `inset 0 0 0 1px ${glowColor}, 0 0 30px ${glowColor}`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 space-y-4">
        {/* Icon circle */}
        <div
          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}
        >
          {icon}
        </div>

        {/* Text */}
        <div className="space-y-1.5">
          <h3 className="text-lg font-semibold text-white group-hover:text-white transition-colors">
            {title}
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
            {description}
          </p>
        </div>

        {/* Arrow indicator */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 group-hover:text-white/70 transition-all">
          <span>Try it</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform">
            <path d="M5 12h14"></path>
            <path d="m12 5 7 7-7 7"></path>
          </svg>
        </div>
      </div>
    </button>
  );
};
