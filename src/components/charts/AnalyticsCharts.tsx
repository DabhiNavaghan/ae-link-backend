'use client';

import React, { useEffect, useState } from 'react';

// ─── LineChart ────────────────────────────────────────────────────────────────

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

export const LineChart: React.FC<LineChartProps> = ({
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

  const allValues = [...data.map(d => d.value), ...(secondaryData?.map(d => d.value) || [])];
  const maxValue = Math.max(...allValues, 1);
  const minValue = 0;
  const range = maxValue - minValue;
  const xStep = (chartWidth - padding.left - padding.right) / (data.length - 1 || 1);
  const yScale = chartHeight / (range || 1);

  const primaryPoints = data.map((d, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + chartHeight - (d.value - minValue) * yScale,
  }));

  const secondaryPoints = secondaryData?.map((d, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + chartHeight - (d.value - minValue) * yScale,
  })) || [];

  const createPath = (points: { x: number; y: number }[]): string => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
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

  const gridLines = showGrid
    ? Array.from({ length: 5 }, (_, i) => (
        <line
          key={`grid-${i}`}
          x1={padding.left}
          y1={padding.top + (chartHeight / 4) * i}
          x2={chartWidth - padding.right}
          y2={padding.top + (chartHeight / 4) * i}
          stroke="#E2E8F0"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
      ))
    : [];

  const yLabels = Array.from({ length: 5 }, (_, i) => {
    const value = Math.round(minValue + (range / 4) * (4 - i));
    const y = padding.top + (chartHeight / 4) * i;
    return (
      <text key={`y-label-${i}`} x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="12" fill="#64748B">
        {value.toLocaleString()}
      </text>
    );
  });

  const step = Math.ceil(data.length / 6);
  const xLabels = data
    .filter((_, i) => i % step === 0)
    .map((d, i) => {
      const point = primaryPoints[i * step];
      if (!point) return null;
      return (
        <text key={`x-label-${i}`} x={point.x} y={chartHeight + padding.top + 20} textAnchor="middle" fontSize="12" fill="#64748B">
          {d.label}
        </text>
      );
    });

  return (
    <div className="w-full">
      {title && <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>}
      <div className="relative w-full overflow-x-auto">
        <svg width={chartWidth} height={height} className="min-w-full" style={{ fontFamily: 'inherit' }}>
          {gridLines}
          <line x1={padding.left} y1={padding.top} x2={padding.left} y2={chartHeight + padding.top} stroke="#CBD5E1" strokeWidth="1" />
          <line x1={padding.left} y1={chartHeight + padding.top} x2={chartWidth - padding.right} y2={chartHeight + padding.top} stroke="#CBD5E1" strokeWidth="1" />
          {yLabels}
          {xLabels}
          {secondaryPath && (
            <>
              <path d={secondaryPath} fill="none" stroke={secondaryColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {secondaryPoints.map((point, i) => (
                <circle key={`sp-${i}`} cx={point.x} cy={point.y} r="4" fill="white" stroke={secondaryColor} strokeWidth="2" style={{ opacity: animated ? animationOffset : 1 }}>
                  <title>{`${secondaryData?.[i]?.label}: ${secondaryData?.[i]?.value.toLocaleString()}`}</title>
                </circle>
              ))}
            </>
          )}
          <path d={primaryPath} fill="none" stroke={primaryColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {primaryPoints.map((point, i) => (
            <circle key={`pp-${i}`} cx={point.x} cy={point.y} r="4" fill="white" stroke={primaryColor} strokeWidth="2" style={{ opacity: animated ? animationOffset : 1 }}>
              <title>{`${data[i]?.label}: ${data[i]?.value.toLocaleString()}`}</title>
            </circle>
          ))}
        </svg>
      </div>
    </div>
  );
};

// ─── DonutChart ───────────────────────────────────────────────────────────────

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

const DEFAULT_COLORS = ['#6366F1', '#14B8A6', '#FF6B35', '#94A3B8', '#10B981', '#F43F5E', '#F59E0B', '#8B5CF6'];

export const DonutChart: React.FC<DonutChartProps> = ({
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

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = size / 2;
  const innerRadius = radius * 0.6;
  const outerRadius = radius * 0.95;

  if (!data || data.length === 0 || total === 0) {
    return (
      <div className="w-full">
        {title && <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>}
        <div className="flex flex-col items-center">
          <svg width={size * 1.2} height={size * 1.2} className="mx-auto">
            <circle cx={radius} cy={radius} r={outerRadius} fill="none" stroke="#E2E8F0" strokeWidth={outerRadius - innerRadius} />
            {centerText && (
              <text x={radius} y={radius} textAnchor="middle" dominantBaseline="middle" fontSize="16" fontWeight="600" fill="#94A3B8">{centerText}</text>
            )}
          </svg>
          <p className="text-sm text-slate-400 text-center mt-4">No data yet</p>
        </div>
      </div>
    );
  }

  let currentAngle = -Math.PI / 2;
  const segments = data.map((segment, index) => {
    const sliceAngle = (segment.value / total) * Math.PI * 2;
    const color = segment.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
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
    const path = `M ${outerStartX} ${outerStartY} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEndX} ${outerEndY} L ${endX} ${endY} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${startX} ${startY} Z`;
    const percentage = ((segment.value / total) * 100).toFixed(1);
    const middleAngle = currentAngle + sliceAngle / 2;
    const labelRadius = (innerRadius + outerRadius) / 2;
    const labelX = radius + labelRadius * Math.cos(middleAngle);
    const labelY = radius + labelRadius * Math.sin(middleAngle);
    currentAngle = endAngle;
    return { path, color, label: segment.label, value: segment.value, percentage, labelX, labelY };
  });

  return (
    <div className="w-full">
      {title && <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>}
      <div className="flex flex-col items-center">
        <svg width={size * 1.2} height={size * 1.2} className="mx-auto">
          {segments.map((segment, index) => (
            <g key={`segment-${index}`}>
              <path d={segment.path} fill={segment.color} opacity="0.9" className="hover:opacity-100 transition-opacity duration-200 cursor-pointer">
                <title>{`${segment.label}: ${segment.value} (${segment.percentage}%)`}</title>
              </path>
              {segment.percentage !== '0.0' && (
                <text x={segment.labelX} y={segment.labelY} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="600" fill="white" pointerEvents="none" style={{ opacity: animated ? animationOffset : 1, transition: 'opacity 0.6s ease' }}>
                  {segment.percentage}%
                </text>
              )}
            </g>
          ))}
          {centerText && (
            <text x={radius} y={radius} textAnchor="middle" dominantBaseline="middle" fontSize="16" fontWeight="600" fill="#1E293B" pointerEvents="none" style={{ opacity: animated ? animationOffset : 1, transition: 'opacity 0.6s ease' }}>
              {centerText}
            </text>
          )}
        </svg>
        <div className="mt-6 w-full">
          {data.map((segment, index) => (
            <div key={`legend-${index}`} className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: segment.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length] }} />
              <div className="flex items-center justify-between flex-1 min-w-0">
                <span className="text-sm text-slate-600 truncate">{segment.label}</span>
                <span className="text-sm font-medium text-slate-900 ml-2">{segment.value.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── BarChart ─────────────────────────────────────────────────────────────────

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

export const BarChart: React.FC<BarChartProps> = ({
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
  const chartWidth = 600;
  const padding = 20;

  return (
    <div className="w-full">
      {title && <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>}
      <div style={{ height, display: 'flex', flexDirection: 'column' }}>
        {data.map((item, index) => {
          const barWidth = ((item.value / maxValue) / 100) * (chartWidth - padding * 2) * 100;
          return (
            <div key={`bar-${index}`} className="flex items-center gap-3 flex-1" style={{ minHeight: barHeight }}>
              <div style={{ width: 120, flexShrink: 0 }}>
                <p className="text-sm font-medium text-slate-700 truncate">{item.label}</p>
              </div>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div className="bg-slate-100 rounded h-8 relative flex-1">
                  <div
                    className="h-full rounded transition-all duration-500"
                    style={{ backgroundColor: color, width: animated ? `${barWidth * animationOffset}px` : `${barWidth}px`, opacity: 0.9 }}
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
  );
};
