'use client';

import React, { useEffect, useState } from 'react';

interface DonutSegment {
  label: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: DonutSegment[];
  title?: string;
  centerText?: string;
  size?: number;
  animated?: boolean;
}

const DonutChart: React.FC<DonutChartProps> = ({
  data,
  title,
  centerText,
  size = 200,
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
      <div className="flex items-center justify-center" style={{ height: size }}>
        <p className="text-slate-500">No data available</p>
      </div>
    );
  }

  const defaultColors = [
    '#6366F1', // primary indigo
    '#14B8A6', // secondary teal
    '#FF6B35', // accent coral
    '#94A3B8', // slate
    '#10B981', // emerald
    '#F43F5E', // rose
    '#F59E0B', // amber
    '#8B5CF6', // purple
  ];

  const total = data.reduce((sum, d) => sum + d.value, 0);

  // If all values are 0, show empty state
  if (total === 0) {
    return (
      <div className="w-full">
        {title && <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>}
        <div className="flex flex-col items-center">
          <svg width={size} height={size} className="mx-auto">
            <circle cx={size / 2} cy={size / 2} r={size * 0.475} fill="none" stroke="#E2E8F0" strokeWidth={size * 0.15} />
            {centerText && (
              <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle" fontSize="16" fontWeight="600" fill="#94A3B8">{centerText}</text>
            )}
          </svg>
          <div className="mt-4">
            <p className="text-sm text-slate-400 text-center">No data yet</p>
          </div>
        </div>
      </div>
    );
  }

  const radius = size / 2;
  const innerRadius = radius * 0.6;
  const outerRadius = radius * 0.95;
  const donutWidth = outerRadius - innerRadius;

  let currentAngle = -Math.PI / 2;

  const segments = data.map((segment, index) => {
    const sliceAngle = (segment.value / total) * Math.PI * 2;
    const color = segment.color || defaultColors[index % defaultColors.length];

    // Calculate arc path
    const startX = radius + innerRadius * Math.cos(currentAngle);
    const startY = radius + innerRadius * Math.sin(currentAngle);
    const endAngle = currentAngle + sliceAngle;
    const endX = radius + innerRadius * Math.cos(endAngle);
    const endY = radius + innerRadius * Math.sin(endAngle);

    const outerStartX = radius + outerRadius * Math.cos(currentAngle);
    const outerStartY = radius + outerRadius * Math.sin(currentAngle);
    const outerEndX = radius + outerRadius * Math.cos(endAngle);
    const outerEndY = radius + outerRadius * Math.sin(endAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    // Path: outer arc, line to inner, inner arc back
    const path = `
      M ${outerStartX} ${outerStartY}
      A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEndX} ${outerEndY}
      L ${endX} ${endY}
      A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${startX} ${startY}
      Z
    `;

    const percentage = ((segment.value / total) * 100).toFixed(1);
    const middleAngle = currentAngle + sliceAngle / 2;
    const labelRadius = (innerRadius + outerRadius) / 2;
    const labelX = radius + labelRadius * Math.cos(middleAngle);
    const labelY = radius + labelRadius * Math.sin(middleAngle);

    currentAngle = endAngle;

    return {
      path,
      color,
      label: segment.label,
      value: segment.value,
      percentage,
      labelX,
      labelY,
    };
  });

  return (
    <div className="w-full">
      {title && <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>}
      <div className="flex flex-col items-center">
        <svg width={size * 1.2} height={size * 1.2} className="mx-auto">
          {/* Segments */}
          {segments.map((segment, index) => (
            <g key={`segment-${index}`}>
              <path
                d={segment.path}
                fill={segment.color}
                opacity="0.9"
                className="hover:opacity-100 transition-opacity duration-200 cursor-pointer group"
                style={{
                  strokeDasharray: animated ? '100' : '0',
                  strokeDashoffset: animated ? `${100 - animationOffset * 100}` : '0',
                  stroke: 'transparent',
                  transition: 'all 0.3s ease',
                }}
              >
                <title>{`${segment.label}: ${segment.value} (${segment.percentage}%)`}</title>
              </path>
              {/* Percentage labels on segments */}
              {segment.percentage !== '0.0' && (
                <text
                  x={segment.labelX}
                  y={segment.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="white"
                  pointerEvents="none"
                  style={{
                    opacity: animated ? animationOffset : 1,
                    transition: 'opacity 0.6s ease',
                  }}
                >
                  {segment.percentage}%
                </text>
              )}
            </g>
          ))}

          {/* Center text */}
          {centerText && (
            <text
              x={radius}
              y={radius}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="16"
              fontWeight="600"
              fill="#1E293B"
              pointerEvents="none"
              style={{
                opacity: animated ? animationOffset : 1,
                transition: 'opacity 0.6s ease',
              }}
            >
              {centerText}
            </text>
          )}
        </svg>

        {/* Legend */}
        <div className="mt-6 w-full">
          <div className="grid grid-cols-1 gap-2">
            {data.map((segment, index) => (
              <div key={`legend-${index}`} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor:
                      segment.color || defaultColors[index % defaultColors.length],
                  }}
                />
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="text-sm text-slate-600 truncate">{segment.label}</span>
                  <span className="text-sm font-medium text-slate-900 ml-2">
                    {segment.value.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonutChart;
