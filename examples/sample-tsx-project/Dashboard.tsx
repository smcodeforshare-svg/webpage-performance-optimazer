import React, { useState, useEffect } from 'react';

interface MetricItem {
  id: string;
  value: number;
  label: string;
}

export const MetricsDashboard: React.FC<{ items: MetricItem[] }> = ({ items }) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Bottleneck 1: Unthrottled window resize event listener
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Bottleneck 2: Quadratic O(N^2) object spread in .reduce()
  const itemsMap = items.reduce((acc, item) => ({
    ...acc,
    [item.id]: item
  }), {} as Record<string, MetricItem>);

  return (
    <div className="metrics-dashboard">
      <h3>Window Width: {windowWidth}px</h3>
      <div>Total Metrics: {Object.keys(itemsMap).length}</div>
    </div>
  );
};
