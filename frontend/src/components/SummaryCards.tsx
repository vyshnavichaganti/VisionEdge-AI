import React from 'react';
import { Layers, Users, Activity, Crosshair } from 'lucide-react';
import { SummaryData } from '../services/api';

interface SummaryCardsProps {
  summary: SummaryData;
  isStreaming: boolean;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary, isStreaming }) => {
  return (
    <div className="summary-grid">
      <div className="stat-card">
        <div className="stat-icon">
          <Layers className="w-5 h-5" />
        </div>
        <div className="stat-info">
          <span className="stat-label">Objects Detected</span>
          <span className="stat-value">{isStreaming ? summary.total_objects : 0}</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">
          <Users className="w-5 h-5" />
        </div>
        <div className="stat-info">
          <span className="stat-label">People</span>
          <span className="stat-value">{isStreaming ? summary.people_count : 0}</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">
          <Activity className="w-5 h-5" />
        </div>
        <div className="stat-info">
          <span className="stat-label">Scene Status</span>
          <span className="stat-value" style={{ fontSize: '1.25rem' }}>
            {isStreaming ? (
              <span className="status-pill status-live">{summary.scene_status}</span>
            ) : (
              <span className="status-pill status-neutral">Standby</span>
            )}
          </span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">
          <Crosshair className="w-5 h-5" />
        </div>
        <div className="stat-info">
          <span className="stat-label">Tracking Status</span>
          <span className="stat-value" style={{ fontSize: '1.1rem' }}>
            {isStreaming ? (
              <span className="status-pill status-live">{summary.tracking_status}</span>
            ) : (
              <span className="status-pill status-neutral">Inactive</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};
