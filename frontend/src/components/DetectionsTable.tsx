import React from 'react';
import { DetectionObject } from '../services/api';
import { Box, Hash, Gauge, Target } from 'lucide-react';

interface DetectionsTableProps {
  objects: DetectionObject[];
  isStreaming: boolean;
}

export const DetectionsTable: React.FC<DetectionsTableProps> = ({ objects, isStreaming }) => {
  return (
    <div className="card table-card">
      <div className="card-title">
        <span>Detected Objects</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          {isStreaming ? `${objects.length} Active Target(s)` : 'Camera Stopped'}
        </span>
      </div>

      <div className="table-wrapper">
        <table className="objects-table">
          <thead>
            <tr>
              <th><Box className="inline-block w-4 h-4 mr-1" /> Object</th>
              <th><Gauge className="inline-block w-4 h-4 mr-1" /> Confidence</th>
              <th><Target className="inline-block w-4 h-4 mr-1" /> Distance</th>
              <th><Hash className="inline-block w-4 h-4 mr-1" /> Track ID</th>
            </tr>
          </thead>
          <tbody>
            {isStreaming && objects.length > 0 ? (
              objects.map((obj, idx) => (
                <tr key={`${obj.track_id ?? 'obj'}-${idx}`}>
                  <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{obj.object_name}</td>
                  <td>{Math.round(obj.confidence * 100)}%</td>
                  <td>
                    <span className="badge-distance">{obj.distance_display}</span>
                  </td>
                  <td>
                    {obj.track_id !== null ? (
                      <span className="badge-track">#{obj.track_id}</span>
                    ) : (
                      <span style={{ color: '#999' }}>-</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  {isStreaming ? 'No objects currently detected in camera view.' : 'Start camera to begin real-time detection & distance estimation.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
