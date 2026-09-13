import React from 'react';
import { Eye, ShieldCheck } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-title-group">
          <div className="gold-logo-mark">
            <Eye className="w-5 h-5" />
          </div>
          <h1 className="brand-title">
            VISIONEDGE <span className="accent">AI</span>
          </h1>
        </div>
        <p className="brand-subtitle">Real-Time Intelligent Object Detection</p>
      </div>

      <div className="phase-pill">
        <ShieldCheck className="w-4 h-4" style={{ color: 'var(--accent-gold)' }} />
        <span>Phase 1: Detect & Track | Phase 2: Distance</span>
      </div>
    </header>
  );
};
