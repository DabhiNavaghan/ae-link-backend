'use client';

import React, { useEffect, useState } from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  secondaryData?: DataPoint[];
  title?: string;
  primaryColor?: string;
  secondaryColor?: string;
  height?: number;
  showGrid?: boolean;
  animated?: boolean;
}

const LineChart: React.FC<LineChartProps> = ({
  data,
  secondaryData,
  title,
  primaryColor = '#6366F1',
  secondaryColor = '#14B8A6',
  height = 300,
  showGrid = true,
  animated = true,
}) => {
  const [animationOffset, setAnimationOffset] = useState(0);
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = 800;
  const chartHeight = height - padding.top - padding.bottom;

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

  // Calculate scales
  const allValues = [...data.map(d => d.value), ...(secondaryData?.map(d => d.value) || [])];
  const maxValue = Math.max(...allValues, 1);
  const minValue = 0;
  const range = maxValue - minValue;

  const xStep = (chartWidth - padding.left - padding.right) / (data.length - 1 || 1);
  const yScale = chartHeight / (range || 1);

  // Generate points for primary line
  const primaryPoints = data.map((d, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + chartHeight - ((d.value - minValue) * yScale),
  }));

  // Generate points for secondary line
  const secondaryPoints = secondaryData?.map((d, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + chartHeight - ((d.value - minValue) * yScale),
  })) || [];

  // Create smooth path using cubic bezier
  const createPath = (points: typeof primaryPoints): string => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y}`;
    }

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const cp1x = curr.x + (next.x - curr.x) / 3;
      const cp1y = curr.y + (next.y - curr.y) / 3;
      const cp2x = next.x - (next.x - curr.x) / 3;
      const cp2y = next.y - (next.y - curr.y) / 3;
      path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${next.x} ${next.y}`;
    }

    return path;
  };

  const primaryPath = createPath(primaryPoints);
  const secondaryPath = secondaryData ? createPath(secondaryPoints) : '';

  // Grid lines
  const gridLines = [];
  if (showGrid) {
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      gridLines.push(
        <line
          key={`grid-${i}`}
          x1={padding.left}
          y1={y}
          x2={chartWidth - padding.right}
          y2={y}
          stroke="#E2E8F0"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
      );
    }
  }

  // Y-axis labels
  const yLabels = [];
  for (let i = 0; i <= 4; i++) {
    const value = Math.round(minValue + (range / 4) * (4 - i));
    const y = padding.top + (chartHeight / 4) * i;
    yLabels.push(
      <text
        key={`y-label-${i}`}
        x={padding.left - 10}
        y={y + 4}
        textAnchor="end"
        fontSize="12"
        fill="#64748B"
      >
        {value.toLocaleString()}
      </text>
    );
  }

  // X-axis labels (show every Nth label to avoid crowding)
  const step = Math.ceil(data.length / 6);
  const xLabels = [];
  for (let i = 0; i < data.length; i += step) {
    const point = primaryPoints[i];
    if (!point) continue;
    xLabels.push(
      <text
        key={`x-label-${i}`}
        x={point.x}
        y={chartHeight + padding.top + 20}
        textAnchor="middle"
        fontSize="12"
        fill="#64748B"
      >
        {data[i].label}
      </text>
    );
  }

  return (
    <div className="w-full">
      {title && <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>}
      <div className="relative w-full overflow-x-auto">
        <svg
          width={chartWidth}
          height={height}
          className="min-w-full"
          style={{ fontFamily: 'inherit' }}
        >
          {/* Grid */}
          {gridLines}

          {/* Y-axis */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={chartHeight + padding.top}
            stroke="#CBD5E1"
            strokeWidth="1"
          />

          {/* X-axis */}
          <line
            x1={padding.left}
            y1={chartHeight + padding.top}
            x2={chartWidth - padding.right}
            y2={chartHeight + padding.top}
            stroke="#CBD5E1"
            strokeWidth="1"
          />

          {/* Y-axis labels */}
          {yLabels}

          {/* X-axis labels */}
          {xLabels}

          {/* Secondary line (if provided) */}
          {secondaryPath && (
            <>
              <path
                d={secondaryPath}
                fill="none"
                stroke={secondaryColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDashoffset: animated ? chartWidth : 0,
                  strokeDasharray: animated ? chartWidth : 0,
                  animation: animated ? `drawLine 1s ease-out forwards` : 'none',
                }}
              />
              {/* Secondary line points */}
              {secondaryPoints.map((point, i) => (
                <circle
                  key={`secondary-point-${i}`}
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill="white"
                  stroke={secondaryColor}
                  strokeWidth="2"
                  className="hover:r-6 transition-all duration-200 cursor-pointer"
                  style={{
                    opacity: animated ? animationOffset : 1,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <title>{`${secondaryData?.[i]?.label}: ${secondaryData?.[i]?.value.toLocaleString()}`}</title>
                </circle>
              ))}
            </>
          )}

          {/* Primary line */}
          <path
            d={primaryPath}
            fill="none"
            stroke={primaryColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDashoffset: animated ? chartWidth : 0,
              strokeDasharray: animated ? chartWidth : 0,
              animation: animated ? `drawLine 1s ease-out forwards` : 'none',
            }}
          />

          {/* Primary line points */}
          {primaryPoints.map((point, i) => (
            <circle
              key={`primary-point-${i}`}
              cx={point.x}
              cy={point.y}
              r="4"
              fill="white"
              stroke={primaryColor}
              strokeWidth="2"
              className="hover:r-6 transition-all duration-200 cursor-pointer"
              style={{
                opacity: animated ? animationOffset : 1,
                transition: 'all 0.2s ease',
              }}
            >
              <title>{`${data[i]?.label}: ${data[i]?.value.toLocaleString()}`}</title>
            </circle>
          ))}
        </svg>
      </div>

      <style>{`
        @keyframes drawLine {
          from {
            stroke-dashoffset: 100%;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default LineChart;
