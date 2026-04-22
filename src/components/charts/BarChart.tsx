'use client';

import React, { useEffect, useState } from 'react';

interface BarData {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarData[];
  title?: string;
  color?: string;
  height?: number;
  animated?: boolean;
}

const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  color = '#6366F1',
  height = 300,
  animated = true,
}) => {
  const [animationOffset, setAnimationOffset] = useState(0);

  useEffect(() => {
    if (!animated) return;
    setAnimationOffset(0);
    const timer = setTimeout(() => setAnimationOffset(1), 50);
    return () => clearTimeout(timer);
  }, [animated]);

  if (!data || data.length === 0) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height }}>
        <p className="text-slate-500">No data available</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const barHeight = height / data.length;
  const labelWidth = 120;
  const chartWidth = 600;
  const padding = 20;

  return (
    <div className="w-full">
      {title && <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>}
      <div className="overflow-x-auto">
        <div style={{ height, display: 'flex', flexDirection: 'column' }}>
          {data.map((item, index) => {
            const percentage = (item.value / maxValue) * 100;
            const barWidth = (percentage / 100) * (chartWidth - padding * 2);

            return (
              <div
                key={`bar-${index}`}
                className="flex items-center gap-3 flex-1"
                style={{ minHeight: barHeight }}
              >
                {/* Label */}
                <div style={{ width: labelWidth, flexShrink: 0 }}>
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {item.label}
                  </p>
                </div>

                {/* Bar container */}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <div className="bg-slate-100 rounded h-8 relative flex-1">
                    <div
                      className="h-full rounded transition-all duration-500 hover:opacity-80"
                      style={{
                        backgroundColor: color,
                        width: animated ? `${barWidth * animationOffset}px` : `${barWidth}px`,
                        opacity: 0.9,
                      }}
                    />
                  </div>
                  <p className="text-sm font-semibold text-slate-900 flex-shrink-0 w-16 text-right">
                    {item.value.toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BarChart;
