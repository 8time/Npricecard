import type { CardDocument } from '../types';

type Instance = CardDocument['instances'][number];

export type AlignmentToolsProps = {
  instances: Instance[];
  selectedInstanceIds: string[];
  cardPxWidth: number;
  cardPxHeight: number;
  layoutMode: boolean;
  onUpdateInstances: (updates: { id: string; x: number; y: number }[]) => void;
};

type AlignType =
  | 'left' | 'centerH' | 'right'
  | 'top' | 'centerV' | 'bottom'
  | 'distributeH' | 'distributeV';

// 回転を考慮した軸平行バウンディングボックスを返す
function getVisualBounds(inst: Instance, w: number, h: number) {
  const cx = inst.x + w / 2;
  const cy = inst.y + h / 2;
  const rad = ((inst.angle ?? 0) * Math.PI) / 180;
  const cosA = Math.abs(Math.cos(rad));
  const sinA = Math.abs(Math.sin(rad));
  const hw = (cosA * w + sinA * h) / 2;
  const hh = (sinA * w + cosA * h) / 2;
  return {
    left: cx - hw, top: cy - hh,
    right: cx + hw, bottom: cy + hh,
    cx, cy, hw, hh,
    vw: hw * 2, vh: hh * 2,
  };
}

// --- SVG アイコン ---
const AlignLeftIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <rect x="2.5" y="2" width="1.5" height="16" rx="0.5"/>
    <rect x="4.5" y="4" width="11" height="4.5" rx="0.5"/>
    <rect x="4.5" y="11.5" width="6.5" height="4.5" rx="0.5"/>
  </svg>
);

const AlignCenterHIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <rect x="9.25" y="2" width="1.5" height="16" rx="0.5"/>
    <rect x="2.5" y="4" width="15" height="4.5" rx="0.5"/>
    <rect x="5.5" y="11.5" width="9" height="4.5" rx="0.5"/>
  </svg>
);

const AlignRightIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <rect x="16" y="2" width="1.5" height="16" rx="0.5"/>
    <rect x="3.5" y="4" width="11" height="4.5" rx="0.5"/>
    <rect x="8.5" y="11.5" width="6.5" height="4.5" rx="0.5"/>
  </svg>
);

const AlignTopIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <rect x="2" y="2.5" width="16" height="1.5" rx="0.5"/>
    <rect x="4" y="4.5" width="4.5" height="11" rx="0.5"/>
    <rect x="11.5" y="4.5" width="4.5" height="6.5" rx="0.5"/>
  </svg>
);

const AlignCenterVIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <rect x="2" y="9.25" width="16" height="1.5" rx="0.5"/>
    <rect x="4" y="2.5" width="4.5" height="15" rx="0.5"/>
    <rect x="11.5" y="5.5" width="4.5" height="9" rx="0.5"/>
  </svg>
);

const AlignBottomIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <rect x="2" y="16" width="16" height="1.5" rx="0.5"/>
    <rect x="4" y="3.5" width="4.5" height="11" rx="0.5"/>
    <rect x="11.5" y="8.5" width="4.5" height="6.5" rx="0.5"/>
  </svg>
);

const DistributeHIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <rect x="2" y="3" width="1.5" height="14" rx="0.5"/>
    <rect x="16.5" y="3" width="1.5" height="14" rx="0.5"/>
    <rect x="4.25" y="7" width="3.5" height="6" rx="0.5"/>
    <rect x="8.25" y="7" width="3.5" height="6" rx="0.5"/>
    <rect x="12.25" y="7" width="3.5" height="6" rx="0.5"/>
  </svg>
);

const DistributeVIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <rect x="3" y="2" width="14" height="1.5" rx="0.5"/>
    <rect x="3" y="16.5" width="14" height="1.5" rx="0.5"/>
    <rect x="7" y="4.25" width="6" height="3.5" rx="0.5"/>
    <rect x="7" y="8.25" width="6" height="3.5" rx="0.5"/>
    <rect x="7" y="12.25" width="6" height="3.5" rx="0.5"/>
  </svg>
);

type GroupDef = {
  label: string;
  cols: number;
  items: { type: AlignType; label: string; icon: React.ReactElement; minCount: number }[];
};

const ALIGN_GROUPS: GroupDef[] = [
  {
    label: '水平方向に整列',
    cols: 3,
    items: [
      { type: 'left', label: '左揃え', icon: <AlignLeftIcon />, minCount: 1 },
      { type: 'centerH', label: '左右中央', icon: <AlignCenterHIcon />, minCount: 1 },
      { type: 'right', label: '右揃え', icon: <AlignRightIcon />, minCount: 1 },
    ],
  },
  {
    label: '垂直方向に整列',
    cols: 3,
    items: [
      { type: 'top', label: '上揃え', icon: <AlignTopIcon />, minCount: 1 },
      { type: 'centerV', label: '上下中央', icon: <AlignCenterVIcon />, minCount: 1 },
      { type: 'bottom', label: '下揃え', icon: <AlignBottomIcon />, minCount: 1 },
    ],
  },
  {
    label: '均等配置',
    cols: 2,
    items: [
      { type: 'distributeH', label: '水平均等', icon: <DistributeHIcon />, minCount: 3 },
      { type: 'distributeV', label: '垂直均等', icon: <DistributeVIcon />, minCount: 3 },
    ],
  },
];

export const AlignmentTools = ({
  instances,
  selectedInstanceIds,
  cardPxWidth: w,
  cardPxHeight: h,
  layoutMode,
  onUpdateInstances,
}: AlignmentToolsProps) => {
  const selected = instances.filter((i) => selectedInstanceIds.includes(i.id));
  const count = selected.length;

  const handleAlign = (type: AlignType) => {
    if (count === 0) return;

    const bounds = selected.map((inst) => ({ inst, ...getVisualBounds(inst, w, h) }));
    const selLeft = Math.min(...bounds.map((b) => b.left));
    const selTop = Math.min(...bounds.map((b) => b.top));
    const selRight = Math.max(...bounds.map((b) => b.right));
    const selBottom = Math.max(...bounds.map((b) => b.bottom));
    const selCenterX = (selLeft + selRight) / 2;
    const selCenterY = (selTop + selBottom) / 2;

    if (type === 'distributeH') {
      if (count < 3) return;
      const sorted = [...bounds].sort((a, b) => a.cx - b.cx);
      const totalVisW = sorted.reduce((s, b) => s + b.vw, 0);
      const gap = (selRight - selLeft - totalVisW) / (sorted.length - 1);
      let curX = selLeft;
      onUpdateInstances(
        sorted.map(({ inst, hw, cy, vw }) => {
          const newCx = curX + hw;
          curX += vw + gap;
          return { id: inst.id, x: Math.round(newCx - w / 2), y: Math.round(cy - h / 2) };
        }),
      );
      return;
    }

    if (type === 'distributeV') {
      if (count < 3) return;
      const sorted = [...bounds].sort((a, b) => a.cy - b.cy);
      const totalVisH = sorted.reduce((s, b) => s + b.vh, 0);
      const gap = (selBottom - selTop - totalVisH) / (sorted.length - 1);
      let curY = selTop;
      onUpdateInstances(
        sorted.map(({ inst, cx, hh, vh }) => {
          const newCy = curY + hh;
          curY += vh + gap;
          return { id: inst.id, x: Math.round(cx - w / 2), y: Math.round(newCy - h / 2) };
        }),
      );
      return;
    }

    onUpdateInstances(
      bounds.map(({ inst, cx, cy, hw, hh }) => {
        let newCx = cx;
        let newCy = cy;
        switch (type) {
          case 'left':    newCx = selLeft + hw; break;
          case 'centerH': newCx = selCenterX; break;
          case 'right':   newCx = selRight - hw; break;
          case 'top':     newCy = selTop + hh; break;
          case 'centerV': newCy = selCenterY; break;
          case 'bottom':  newCy = selBottom - hh; break;
        }
        return { id: inst.id, x: Math.round(newCx - w / 2), y: Math.round(newCy - h / 2) };
      }),
    );
  };

  if (!layoutMode) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-[#cbd5e1]">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
        <p className="text-[11px] leading-relaxed text-[#9ca3af]">
          レイアウトモードで<br/>使用できます
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 選択状態バッジ */}
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-black uppercase tracking-wider text-[#8896a5]">整列</div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          count > 0 ? 'bg-[#eff6ff] text-[#3b82f6]' : 'bg-[#f3f4f6] text-[#9ca3af]'
        }`}>
          {count > 0 ? `${count}個選択中` : '未選択'}
        </span>
      </div>

      {count === 0 && (
        <p className="text-[11px] text-[#9ca3af]">
          レイアウトモードでカードを選択してください
        </p>
      )}

      {ALIGN_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">
            {group.label}
          </div>
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${group.cols}, minmax(0, 1fr))` }}
          >
            {group.items.map((item) => {
              const disabled = count < item.minCount;
              return (
                <button
                  key={item.type}
                  type="button"
                  title={item.label}
                  disabled={disabled}
                  onClick={() => handleAlign(item.type)}
                  className={`flex flex-col items-center gap-1 rounded-md border py-2 transition-colors ${
                    disabled
                      ? 'cursor-not-allowed border-[#e5e7eb] bg-[#f9fafb] text-[#d1d5db]'
                      : 'cursor-pointer border-[#d9e0e6] bg-white text-[#374151] hover:border-[#3b82f6] hover:bg-[#eff6ff] hover:text-[#3b82f6]'
                  }`}
                >
                  {item.icon}
                  <span className="text-[8px] font-semibold leading-none">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {count > 0 && count < 3 && (
        <p className="text-[10px] text-[#9ca3af]">
          均等配置は3個以上の選択で使用できます
        </p>
      )}
    </div>
  );
};
