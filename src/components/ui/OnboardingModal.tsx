'use client';

import React from 'react';
import {
  X,
  Zap,
  BarChart3,
  Users,
  DollarSign,
  TrendingUp,
  Bot,
  Sparkles,
} from 'lucide-react';

interface OnboardingModalProps {
  onClose: () => void;
}

const highlights = [
  { icon: DollarSign,  text: 'API cost & ROI tracking',           color: '#FFE600' },
  { icon: BarChart3,   text: 'Token consumption & billable usage', color: '#a855f7' },
  { icon: Users,       text: 'Team & user-level insights',         color: '#60a5fa' },
  { icon: TrendingUp,  text: 'Trend analysis & period comparisons',color: '#34d399' },
  { icon: Bot,         text: 'Models, IDE & Agent usage',          color: '#f97316' },
  { icon: Sparkles,    text: 'AI inferences on every page',        color: '#ec4899' },
];

export function OnboardingModal({ onClose }: OnboardingModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-ey-border shadow-2xl overflow-hidden"
        style={{ background: '#1a1a1a' }}
      >
        {/* Top accent bar */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #FFE60060, #FFE600, #FFE60060)' }} />

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-ey-muted hover:text-ey-light hover:bg-white/10 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8 pb-7">
          {/* Logo + Title */}
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-ey-yellow/15 border border-ey-yellow/30 rounded-xl shrink-0">
              <Zap className="w-5 h-5 text-ey-yellow" />
            </div>
            <div>
              <h2 id="onboarding-title" className="text-lg font-bold text-ey-light leading-tight">
                Welcome to AI Usage Analytics Dashboard
              </h2>
              <p className="text-xs text-ey-muted mt-0.5">Your Enterprise AI Intelligence Hub</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-ey-light/75 leading-relaxed mb-6">
            A centralised dashboard that transforms raw AI tool usage logs into
            strategic intelligence — helping leadership understand ROI, adoption, and
            efficiency across the entire organisation.
          </p>

          {/* Highlights grid */}
          <div className="grid grid-cols-2 gap-2.5 mb-7">
            {highlights.map(({ icon: Icon, text, color }) => (
              <div
                key={text}
                className="flex items-center gap-2.5 p-3 rounded-lg border"
                style={{ background: `${color}08`, borderColor: `${color}22` }}
              >
                <div className="p-1.5 rounded-md shrink-0" style={{ background: `${color}22` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <span className="text-xs text-ey-light leading-tight">{text}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            id="onboarding-get-started-btn"
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-ey-black transition-all hover:brightness-110 active:scale-95"
            style={{ background: '#FFE600' }}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
