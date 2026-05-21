import type { ReactNode } from 'react';
import './DeviceFrame.css';

export function DeviceFrame({ children }: { children: ReactNode }) {
  return (
    <div className="device">
      <div className="device-surface">{children}</div>
    </div>
  );
}
