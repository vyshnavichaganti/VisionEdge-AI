import React from 'react';
import { Camera, Scan, Route, Compass, ArrowRight } from 'lucide-react';

export const FlowBanner: React.FC = () => {
  return (
    <div className="flow-banner">
      <span className="flow-title">Pipeline Workflow</span>
      <div className="flow-steps">
        <div className="flow-pill">
          <Camera className="w-4 h-4" />
          <span>Camera</span>
        </div>
        <ArrowRight className="flow-arrow" />
        <div className="flow-pill">
          <Scan className="w-4 h-4" />
          <span>Detect</span>
        </div>
        <ArrowRight className="flow-arrow" />
        <div className="flow-pill">
          <Route className="w-4 h-4" />
          <span>Track</span>
        </div>
        <ArrowRight className="flow-arrow" />
        <div className="flow-pill">
          <Compass className="w-4 h-4" />
          <span>Distance</span>
        </div>
      </div>
    </div>
  );
};
