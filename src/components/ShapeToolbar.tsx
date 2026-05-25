import { useState } from 'react';
import type { ShapeLayer, ShapeObjectId, ShapeType } from '../types';

type Props = {
  onAddShape: (shape: ShapeLayer) => void;
};

const SHAPE_BUTTONS: { type: ShapeType; label: string; icon: string }[] = [
  { type: 'rect', label: '四角', icon: '⬜' },
  { type: 'circle', label: '円', icon: '⭕' },
  { type: 'line', label: '線', icon: '➖' },
  { type: 'arrow', label: '矢印', icon: '➡️' },
];

export const ShapeToolbar = ({ onAddShape }: Props) => {
  const [fill, setFill] = useState('#ffffff');
  const [stroke, setStroke] = useState('#111827');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [opacity, setOpacity] = useState(100);
  const [rx, setRx] = useState(0);

  const handleAdd = (shapeType: ShapeType) => {
    const id: ShapeObjectId = `shape:${Date.now()}`;
    const shape: ShapeLayer = {
      id,
      name: SHAPE_BUTTONS.find((b) => b.type === shapeType)?.label ?? '図形',
      shapeType,
      fill: shapeType === 'line' || shapeType === 'arrow' ? 'transparent' : fill,
      stroke,
      strokeWidth,
      opacity: opacity / 100,
      rx: shapeType === 'rect' ? rx : undefined,
      layout: {
        left: 100,
        top: 100,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        width: shapeType === 'line' || shapeType === 'arrow' ? 200 : 150,
        height: shapeType === 'line' || shapeType === 'arrow' ? 4 : 100,
      },
    };
    onAddShape(shape);
  };

  return (
    <div className="space-y-3">
      <div className="text-[11px] font-black uppercase tracking-wider text-[#8896a5]">図形を追加</div>

      {/* 図形ボタン */}
      <div className="grid grid-cols-4 gap-1.5">
        {SHAPE_BUTTONS.map((btn) => (
          <button
            key={btn.type}
            type="button"
            onClick={() => handleAdd(btn.type)}
            className="flex flex-col items-center gap-0.5 rounded-lg border border-[#d9e0e6] bg-white py-2 text-center transition hover:border-[#3b82f6] hover:bg-[#eff6ff]"
          >
            <span className="text-lg">{btn.icon}</span>
            <span className="text-[10px] font-semibold text-[#374151]">{btn.label}</span>
          </button>
        ))}
      </div>

      {/* スタイル設定 */}
      <div className="rounded-lg border border-[#d9e0e6] bg-white p-2.5 space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <label className="w-16 font-semibold text-[#6b7280]">塗り</label>
          <input
            type="color"
            value={fill}
            onChange={(e) => setFill(e.target.value)}
            className="h-6 w-10 cursor-pointer rounded border border-[#d9e0e6]"
          />
          <span className="text-[10px] text-[#9ca3af]">{fill}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="w-16 font-semibold text-[#6b7280]">線の色</label>
          <input
            type="color"
            value={stroke}
            onChange={(e) => setStroke(e.target.value)}
            className="h-6 w-10 cursor-pointer rounded border border-[#d9e0e6]"
          />
          <span className="text-[10px] text-[#9ca3af]">{stroke}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="w-16 font-semibold text-[#6b7280]">線幅</label>
          <input
            type="range"
            min={0}
            max={30}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-6 text-right text-[10px]">{strokeWidth}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="w-16 font-semibold text-[#6b7280]">角丸</label>
          <input
            type="range"
            min={0}
            max={80}
            value={rx}
            onChange={(e) => setRx(Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-6 text-right text-[10px]">{rx}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="w-16 font-semibold text-[#6b7280]">不透明度</label>
          <input
            type="range"
            min={10}
            max={100}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-8 text-right text-[10px]">{opacity}%</span>
        </div>
      </div>
    </div>
  );
};
