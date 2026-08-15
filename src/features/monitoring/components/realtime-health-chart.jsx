'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip as ChartTooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HEALTH_STATUS } from '@/lib/health/constants';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, ChartTooltip, Legend, Filler);

const MAX_POINTS = 30;

/**
 * Rolling in-memory history of {time, online, degraded, offline, avgLatency}
 * samples. A new sample is appended every time the parent's health data
 * changes (periodic poll or Realtime INSERT) — this is what makes the
 * chart feel "live" without any dedicated time-series table/API: the
 * dashboard already recomputes counts on every update, we just keep the
 * last N of them instead of throwing them away.
 */
function useHealthHistory(items) {
  const [history, setHistory] = useState([]);
  const lastSignatureRef = useRef(null);

  const sample = useMemo(() => {
    let online = 0;
    let degraded = 0;
    let offline = 0;
    let unknown = 0;
    let latencySum = 0;
    let latencyCount = 0;

    for (const item of items) {
      if (item.status === HEALTH_STATUS.ONLINE) online += 1;
      else if (item.status === HEALTH_STATUS.DEGRADED) degraded += 1;
      else if (item.status === HEALTH_STATUS.OFFLINE) offline += 1;
      else unknown += 1;

      if (item.latency_ms != null) {
        latencySum += item.latency_ms;
        latencyCount += 1;
      }
    }

    return {
      online,
      degraded,
      offline,
      unknown,
      avgLatency: latencyCount > 0 ? Math.round(latencySum / latencyCount) : null,
    };
  }, [items]);

  useEffect(() => {
    const signature = JSON.stringify(sample);
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    setHistory((prev) => {
      const next = [
        ...prev,
        {
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          ...sample,
        },
      ];
      return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
    });
  }, [sample]);

  return history;
}

/**
 * Live-updating chart for /dashboard/monitoring — plots the count of
 * components/stations in each status, and the average latency, as new
 * samples arrive (poll every 30s, or instantly via Supabase Realtime).
 * Purely a client-side rolling window; no new data source is introduced.
 */
export function RealtimeHealthChart({ systemHealth, stationHealth }) {
  const combined = useMemo(() => [...systemHealth, ...stationHealth], [systemHealth, stationHealth]);
  const history = useHealthHistory(combined);

  const data = useMemo(
    () => ({
      labels: history.map((point) => point.time),
      datasets: [
        {
          label: 'Online',
          data: history.map((point) => point.online),
          borderColor: '#22D3A5',
          backgroundColor: 'rgba(34, 211, 165, 0.12)',
          pointRadius: 0,
          tension: 0.35,
          fill: true,
          yAxisID: 'y',
        },
        {
          label: 'Degraded',
          data: history.map((point) => point.degraded),
          borderColor: '#F5B94D',
          backgroundColor: 'rgba(245, 185, 77, 0.12)',
          pointRadius: 0,
          tension: 0.35,
          fill: true,
          yAxisID: 'y',
        },
        {
          label: 'Offline',
          data: history.map((point) => point.offline),
          borderColor: '#F4634B',
          backgroundColor: 'rgba(244, 99, 75, 0.12)',
          pointRadius: 0,
          tension: 0.35,
          fill: true,
          yAxisID: 'y',
        },
        {
          label: 'Rata-rata Latensi (ms)',
          data: history.map((point) => point.avgLatency),
          borderColor: '#3B82F6',
          backgroundColor: 'transparent',
          borderDash: [4, 4],
          pointRadius: 0,
          tension: 0.35,
          fill: false,
          yAxisID: 'y1',
        },
      ],
    }),
    [history]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: '#5C6584', font: { size: 11 } },
        },
        tooltip: {
          backgroundColor: '#FFFFFF',
          titleColor: '#10182B',
          bodyColor: '#5C6584',
          borderColor: '#E3E7F0',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#5C6584', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          border: { display: false },
        },
        y: {
          position: 'left',
          beginAtZero: true,
          ticks: { color: '#5C6584', font: { size: 11 }, precision: 0 },
          grid: { color: '#E3E7F0' },
          border: { display: false },
        },
        y1: {
          position: 'right',
          beginAtZero: true,
          ticks: { color: '#3B82F6', font: { size: 11 } },
          grid: { display: false },
          border: { display: false },
        },
      },
    }),
    []
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tren Status Real-Time</CardTitle>
        <p className="text-xs text-muted-foreground">
          Diperbarui otomatis setiap ada pemeriksaan baru (polling &amp; Realtime).
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          {history.length < 2 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Menunggu data pemeriksaan berikutnya…
            </div>
          ) : (
            <Line data={data} options={options} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
