import type { Canvas } from 'fabric';

type Props = {
  canvas: Canvas | null;
};

type AlignType =
  | 'left' | 'centerH' | 'right'
  | 'top' | 'centerV' | 'bottom'
  | 'distributeH' | 'distributeV';

const ALIGN_BUTTONS: { type: AlignType; label: string; icon: string }[] = [
  { type: 'left', label: '左揃え', icon: '⬅' },
  { type: 'centerH', label: '左右中央', icon: '↔' },
  { type: 'right', label: '右揃え', icon: '➡' },
  { type: 'top', label: '上揃え', icon: '⬆' },
  { type: 'centerV', label: '上下中央', icon: '↕' },
  { type: 'bottom', label: '下揃え', icon: '⬇' },
  { type: 'distributeH', label: '水平等間隔', icon: '⇔' },
  { type: 'distributeV', label: '垂直等間隔', icon: '⇕' },
];

export const AlignmentTools = ({ canvas }: Props) => {
  const handleAlign = (type: AlignType) => {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length < 2) return;

    const lefts = activeObjects.map((o) => o.left ?? 0);
    const tops = activeObjects.map((o) => o.top ?? 0);
    const rights = activeObjects.map((o) => (o.left ?? 0) + o.getScaledWidth());
    const bottoms = activeObjects.map((o) => (o.top ?? 0) + o.getScaledHeight());

    const minLeft = Math.min(...lefts);
    const maxRight = Math.max(...rights);
    const minTop = Math.min(...tops);
    const maxBottom = Math.max(...bottoms);

    switch (type) {
      case 'left':
        activeObjects.forEach((o) => o.set({ left: minLeft }));
        break;
      case 'right':
        activeObjects.forEach((o) => o.set({ left: maxRight - o.getScaledWidth() }));
        break;
      case 'centerH':
        activeObjects.forEach((o) => o.set({ left: (minLeft + maxRight) / 2 - o.getScaledWidth() / 2 }));
        break;
      case 'top':
        activeObjects.forEach((o) => o.set({ top: minTop }));
        break;
      case 'bottom':
        activeObjects.forEach((o) => o.set({ top: maxBottom - o.getScaledHeight() }));
        break;
      case 'centerV':
        activeObjects.forEach((o) => o.set({ top: (minTop + maxBottom) / 2 - o.getScaledHeight() / 2 }));
        break;
      case 'distributeH': {
        const sorted = [...activeObjects].sort((a, b) => (a.left ?? 0) - (b.left ?? 0));
        const totalWidth = sorted.reduce((sum, o) => sum + o.getScaledWidth(), 0);
        const gap = (maxRight - minLeft - totalWidth) / Math.max(sorted.length - 1, 1);
        let currentX = minLeft;
        sorted.forEach((o) => {
          o.set({ left: currentX });
          currentX += o.getScaledWidth() + gap;
        });
        break;
      }
      case 'distributeV': {
        const sorted = [...activeObjects].sort((a, b) => (a.top ?? 0) - (b.top ?? 0));
        const totalHeight = sorted.reduce((sum, o) => sum + o.getScaledHeight(), 0);
        const gap = (maxBottom - minTop - totalHeight) / Math.max(sorted.length - 1, 1);
        let currentY = minTop;
        sorted.forEach((o) => {
          o.set({ top: currentY });
          currentY += o.getScaledHeight() + gap;
        });
        break;
      }
    }

    canvas.requestRenderAll();
  };

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-black uppercase tracking-wider text-[#8896a5]">整列</div>
      <div className="grid grid-cols-4 gap-1">
        {ALIGN_BUTTONS.map((btn) => (
          <button
            key={btn.type}
            type="button"
            title={btn.label}
            onClick={() => handleAlign(btn.type)}
            className="flex flex-col items-center gap-0.5 rounded border border-[#d9e0e6] bg-white py-1.5 text-center transition hover:border-[#3b82f6] hover:bg-[#eff6ff]"
          >
            <span className="text-sm">{btn.icon}</span>
            <span className="text-[8px] font-semibold text-[#374151]">{btn.label}</span>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-[#9ca3af]">複数選択して整列</p>
    </div>
  );
};
