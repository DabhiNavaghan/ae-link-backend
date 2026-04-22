'use client';

import React from 'react';

interface ChartDataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  title?: string;
  data: ChartDataPoint[];
  height?: number;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  animated?: boolean;
}

const colorMap: Record<string, string> = {
  primary: '#6366F1',
  secondary: '#14B8A6',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
};

const lightColorMap: Record<string, string> = {
  primary: '#EEF2FF',
  secondary: '#F0FDFA',
  success: '#F0FDF4',
  warning: '#FFFBEB',
  danger: '#FEF2F2',
};

export const LineChart: React.FC<LineChartProps> = ({
  title,
  data,
  height = 300,
  color = 'primary',
  animated = true,
}) => {
  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value));
  const minValue = 0;
  const range = maxValue - minValue;

  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: ((d.value - minValue) / range) * 100,
    label: d.label,
    value: d.value,
  }));

  const svgHeight = height;
  const svgWidth = 500;
  const padding = 40;

  const pathPoints = points
    .map((p) => {
      const x = (p.x / 100) * (svgWidth - padding * 2) + padding;
      const y = svgHeight - (p.y / 100) * (svgHeight - padding * 2) - padding;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="card p-6">
      {title && <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>}
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full"
        style={{ minHeight: svgHeight }}
      >
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((y) => (
          <line
            key={`grid-${y}`}
            x1={padding}
            y1={(svgHeight - (y / 100) * (svgHeight - padding * 2)) - padding}
            x2={svgWidth - padding}
            y2={(svgHeight - (y / 100) * (svgHeight - padding * 2)) - padding}
            stroke="#E2E8F0"
            strokeWidth="1"
          />
        ))}

        {/* Gradient fill */}
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colorMap[color]} stopOpacity="0.3" />
            <stop offset="100%" stopColor={colorMap[color]} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area */}
        <polyline
          points={`${padding},${svgHeight - padding} ${pathPoints} ${svgWidth - padding},${svgHeight - padding}`}
          fill={`url(#gradient-${color})`}
          stroke="none"
        />

        {/* Line */}
        <polyline
          points={pathPoints}
          fill="none"
          stroke={colorMap[color]}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            animation: animated ? `draw 1s ease-in-out` : 'none',
            strokeDasharray: animated ? `1000` : 'none',
            strokeDashoffset: animated ? `1000` : 'none',
          }}
        />

        {/* Points */}
        {points.map((p, i) => {
          const x = (p.x / 100) * (svgWidth - padding * 2) + padding;
          const y = svgHeight - (p.y / 100) * (svgHeight - padding * 2) - padding;
          return (
            <circle
              key={`point-${i}`}
              cx={x}
              cy={y}
              r="4"
              fill="white"
              stroke={colorMap[color]}
              strokeWidth="2"
            />
          );
        })}
      </svg>

      <style>{`
        @keyframes draw {
          from {
            stroke-dashoffset: 1000;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
};

export const BarChart: React.FC<LineChartProps> = ({
  title,
  data,
  height = 300,
  color = 'primary',
}) => {
  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value));
  const barWidth = 100 / data.length;
  const padding = 40;

  return (
    <div className="card p-6">
      {title && <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>}
      <svg
        viewBox={`0 0 500 ${height}`}
        className="w-full"
        style={{ minHeight: height }}
      >
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((y) => (
          <line
            key={`grid-${y}`}
            x1={padding}
            y1={(height - (y / 100) * (height - padding * 2)) - padding}
            x2={500 - padding}
            y2={(height - (y / 100) * (height - padding * 2)) - padding}
            stroke="#E2E8F0"
            strokeWidth="1"
          />
        ))}

        {/* Bars */}
        {data.map((d, i) => {
          const barHeight = (d.value / maxValue) * (height - padding * 2);
          const x = padding + (i * (500 - padding * 2)) / data.length + (barWidth * (500 - padding * 2)) / 200;
          const y = height - padding - barHeight;
          const w = ((500 - padding * 2) / data.length) * 0.7;

          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={w}
                height={barHeight}
                fill={colorMap[color]}
                rx="4"
                className="hover:opacity-80 transition-opacity"
              />
              <text
                x={x + w / 2}
                y={height - padding + 20}
                textAnchor="middle"
                fontSize="12"
                fill="#64748B"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

interface DonutChartProps {
  title?: string;
  data: ChartDataPoint[];
  size?: 'sm' | 'md' | 'lg';
}

export const DonutChart: React.FC<DonutChartProps> = ({
  title,
  data,
  size = 'md',
}) => {
  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const colors = [
    colorMap['primary'],
    colorMap['secondary'],
    colorMap['success'],
    colorMap['warning'],
    colorMap['danger'],
  ];

  const sizeMap = { sm: 200, md: 250, lg: 300 };
  const svgSize = sizeMap[size];
  const radius = svgSize / 2 - 30;
  const innerRadius = radius * 0.6;

  let currentAngle = -90;
  const slices = data.map((d, i) => {
    const sliceAngle = (d.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = svgSize / 2 + radius * Math.cos(startRad);
    const y1 = svgSize / 2 + radius * Math.sin(startRad);
    const x2 = svgSize / 2 + radius * Math.cos(endRad);
    const y2 = svgSize / 2 + radius * Math.sin(endRad);

    const ix1 = svgSize / 2 + innerRadius * Math.cos(startRad);
    const iy1 = svgSize / 2 + innerRadius * Math.sin(startRad);
    const ix2 = svgSize / 2 + innerRadius * Math.cos(endRad);
    const iy2 = svgSize / 2 + innerRadius * Math.sin(endRad);

    const largeArc = sliceAngle > 180 ? 1 : 0;

    const path = [
      `M ${ix1} ${iy1}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix2} ${iy2}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
      `Z`,
    ].join(' ');

    return {
      path,
      color: colors[i % colors.length],
      label: d.label,
      value: d.value,
      percentage: ((d.value / total) * 100).toFixed(1),
    };
  });

  return (
    <div className="card p-6">
      {title && <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>}
      <div className="flex flex-col items-center">
        <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
          {slices.map((slice, i) => (
            <path
              key={i}
              d={slice.path}
              fill={slice.color}
              opacity="0.8"
              className="hover:opacity-100 transition-opacity cursor-pointer"
            />
          ))}
          <circle cx={svgSize / 2} cy={svgSize / 2} r={innerRadius * 0.3} fill="white" />
        </svg>

        <div className="mt-6 space-y-2 w-full">
          {slices.map((slice, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="text-slate-600">{slice.label}</span>
              </div>
              <span className="font-semibold text-slate-900">{slice.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
