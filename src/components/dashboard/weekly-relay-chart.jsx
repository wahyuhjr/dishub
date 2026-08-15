'use client';

import { useMemo, useRef, useState } from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip as ChartTooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, Legend);

const PERIODS = [
  { key: 'week', label: 'Minggu Ini' },
  { key: 'month', label: 'Bulan Ini' },
];

/**
 * "Jumlah Relay Mingguan" bar chart. `weekly` is the last-7-days series
 * from getWeeklyRelayCounts() ({ label, total }[]); `monthly` is an
 * optional longer series for the "Bulan Ini" pill toggle — if omitted,
 * the toggle still renders but only "Minggu Ini" has data.
 */
export function WeeklyRelayChart({ weekly, monthly }) {
  const [period, setPeriod] = useState('week');
  const chartRef = useRef(null);

  const series = period === 'month' && monthly ? monthly : weekly;

  const data = useMemo(
    () => ({
      labels: series.map((point) => point.label),
      datasets: [
        {
          label: 'Relay berhasil',
          data: series.map((point) => point.total),
          borderRadius: 6,
          maxBarThickness: 36,
          backgroundColor(context) {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            if (!chartArea) return '#3B82F6';
            const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            gradient.addColorStop(0, '#3B82F6');
            gradient.addColorStop(1, '#22D3EE');
            return gradient;
          },
        },
      ],
    }),
    [series]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#FFFFFF',
          titleColor: '#10182B',
          bodyColor: '#5C6584',
          borderColor: '#E3E7F0',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#5C6584', font: { size: 11 } },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#5C6584', font: { size: 11 }, precision: 0 },
          grid: { color: 'rgba(227, 231, 240, 0.8)' },
          border: { display: false },
        },
      },
    }),
    []
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Jumlah Relay Mingguan</CardTitle>
        <div className="flex items-center gap-1 rounded-full bg-surface-hover p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                period === p.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <Bar ref={chartRef} data={data} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}
