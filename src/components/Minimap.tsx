import React, { useEffect, useRef } from 'react';
import { ROAD_CONTROL_POINTS } from '../game/data';
import type { EnemyType, TowerType } from '../game/types';

interface MinimapProps {
  enemies: Array<{ x: number; z: number; type: EnemyType }>;
  towers: Array<{ x: number; z: number; type: TowerType }>;
}

const WORLD_SPAN = 52; // maps [-26, 26] into circular canvas

export const Minimap: React.FC<MinimapProps> = ({ enemies, towers }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const half = size / 2;
    const toPx = (wx: number, wz: number): [number, number] => [
      half + (wx / WORLD_SPAN) * size,
      half + (wz / WORLD_SPAN) * size,
    ];

    ctx.clearRect(0, 0, size, size);

    // Clip to circular map
    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.clip();

    // Grass base
    ctx.fillStyle = '#4c7c2c';
    ctx.fillRect(0, 0, size, size);

    // Subtle woodland edge shading
    ctx.fillStyle = '#365b1f';
    [
      [-18, -14, 20],
      [-23, -2, 18],
      [-20, 20, 18],
      [-2, -18, 17],
      [25, -15, 14],
    ].forEach(([tx, tz, r]) => {
      const [px, pz] = toPx(tx, tz);
      ctx.beginPath();
      ctx.arc(px, pz, r, 0, Math.PI * 2);
      ctx.fill();
    });

    // River on eastern edge
    ctx.strokeStyle = '#3898cf';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    [
      [9, -26],
      [16, -17],
      [22, -10],
      [22, 3],
      [20, 11],
      [25, 24],
    ].forEach(([rx, rz], idx) => {
      const [px, pz] = toPx(rx, rz);
      if (idx === 0) ctx.moveTo(px, pz);
      else ctx.lineTo(px, pz);
    });
    ctx.stroke();

    // Winding S-shaped dirt road
    ctx.strokeStyle = '#d4a76a';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ROAD_CONTROL_POINTS.forEach(([rx, rz], idx) => {
      const [px, pz] = toPx(rx, rz);
      if (idx === 0) ctx.moveTo(px, pz);
      else ctx.lineTo(px, pz);
    });
    ctx.stroke();

    // Fortified House icon
    const [hx, hz] = toPx(17.5, -11.4);
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(hx - 6, hz - 5, 12, 10, 2);
    ctx.fill();
    ctx.stroke();

    // Built Towers
    const towerColors: Record<TowerType, string> = {
      gun: '#fbbf24',
      cannon: '#f97316',
      sniper: '#f87171',
      lightning: '#38bdf8',
    };
    towers.forEach((t) => {
      const [tx, tz] = toPx(t.x, t.z);
      ctx.fillStyle = towerColors[t.type];
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(tx, tz, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Live Enemies
    enemies.forEach((e) => {
      const [ex, ez] = toPx(e.x, e.z);
      ctx.fillStyle = e.type === 'drone' ? '#38bdf8' : e.type === 'shielded' ? '#60a5fa' : '#ef4444';
      ctx.beginPath();
      ctx.arc(ex, ez, e.type === 'heavy' ? 3.2 : 2.3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }, [enemies, towers]);

  return (
    <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-amber-400/70 bg-[#1c2419] shadow-lg shrink-0">
      <canvas ref={canvasRef} width={112} height={112} className="w-full h-full rounded-full" />
      <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#1c2419] border border-amber-400/60 text-[10px] font-bold text-amber-300 leading-none">
        N
      </span>
    </div>
  );
};
