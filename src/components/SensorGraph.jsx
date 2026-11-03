import React, { useEffect, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const MAX_POINTS = 40;

export default function SensorGraph({ dataHistory, label = 'Acceleration', color = '#18181b', unit = 'm/s²' }) {
  const chartRef = useRef(null);

  const data = {
    labels: dataHistory.map((_, i) => ''),
    datasets: [
      {
        label: `${label} (${unit})`,
        data: dataHistory,
        borderColor: color,
        backgroundColor: `${color}22`,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    interaction: { intersect: false, mode: 'index' },
    scales: {
      x: {
        display: false,
      },
      y: {
        grid: {
          color: 'rgba(24, 24, 27, 0.06)',
        },
        ticks: {
          color: '#71717a',
          font: { size: 11, family: 'Inter' },
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(24, 24, 27, 0.92)',
        titleColor: '#fafafa',
        bodyColor: '#d4d4d8',
        borderColor: 'rgba(24, 24, 27, 0.1)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
      },
    },
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-700">{label}</h3>
        <span className="text-xs font-mono px-2 py-1 rounded-md" style={{ background: `${color}22`, color }}>
          {dataHistory.length > 0 ? dataHistory[dataHistory.length - 1]?.toFixed(1) : '0.0'} {unit}
        </span>
      </div>
      <div style={{ height: 140 }}>
        <Line ref={chartRef} data={data} options={options} />
      </div>
    </div>
  );
}

export { MAX_POINTS };
