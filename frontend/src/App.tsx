import React, { useState } from 'react';
import { Header } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { LiveCamera } from './components/LiveCamera';
import { DetectionsTable } from './components/DetectionsTable';
import { FlowBanner } from './components/FlowBanner';
import { DetectionObject, SummaryData } from './services/api';

export const App: React.FC = () => {
  const [objects, setObjects] = useState<DetectionObject[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    total_objects: 0,
    people_count: 0,
    scene_status: 'Clear',
    tracking_status: 'Standby'
  });
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  const handleDetectionsUpdate = (newObjects: DetectionObject[], newSummary: SummaryData) => {
    setObjects(newObjects);
    setSummary(newSummary);
  };

  return (
    <div className="app-container">
      <Header />

      <SummaryCards summary={summary} isStreaming={isStreaming} />

      <main className="main-grid">
        <LiveCamera
          onDetectionsUpdate={handleDetectionsUpdate}
          isStreaming={isStreaming}
          setIsStreaming={setIsStreaming}
        />

        <DetectionsTable objects={objects} isStreaming={isStreaming} />
      </main>

      <FlowBanner />
    </div>
  );
};

export default App;
