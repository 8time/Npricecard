import React from 'react';
import {
  CARD_MM_SIZES,
  computeAutoLayout,
  getCardMmSize,
} from '../lib/canvasWorkspace';
import type { CardDocument, CardSizeId, PaperSizeId, SavedDocument } from '../types';

type Props = {
  document: CardDocument;
  savedItems: SavedDocument[];
  designQueue: SavedDocument[];
  onPaperSizeChange: (id: PaperSizeId) => void;
  onCardSizeChange: (id: CardSizeId) => void;
  onCustomDimensionsChange: (widthMm: number, heightMm: number) => void;
  onAutoLayout: (count: number) => void;
  onClearInstances: () => void;
  onToggleSnap: () => void;
  onToggleCropMarks: () => void;
  onSetLayoutGap: (xMm: number, yMm: number) => void;
  onAddInstance: () => void;
  onAddCurrentToQueue: () => void;
  onAddSavedToQueue: (item: SavedDocument) => void;
  onRemoveFromQueue: (index: number) => void;
  onClearQueue: () => void;
  onAutoLayoutWithDesigns: (count: number) => void;
};

const paperSizes: PaperSizeId[] = ['A3', 'A4', 'A5', 'B4', 'B5'];
const cardSizes: CardSizeId[] = ['A4', 'A5', 'A6', 'B5', 'B6', 'custom'];

const clampDimension = (value: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1000, Math.max(10, value));
};

const clampGap = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(20, value);
};

export const LayoutSettingsPanel: React.FC<Props> = ({
  document,
  savedItems,
  designQueue,
  onPaperSizeChange,
  onCardSizeChange,
  onCustomDimensionsChange,
  onAutoLayout,
  onClearInstances,
  onToggleSnap,
  onToggleCropMarks,
  onSetLayoutGap,
  onAddInstance,
  onAddCurrentToQueue,
  onAddSavedToQueue,
  onRemoveFromQueue,
  onClearQueue,
  onAutoLayoutWithDesigns,
}) => {
  const [customCount, setCustomCount] = React.useState(1);
  const currentCardSize = getCardMmSize(
    document.cardSizeId,
    document.customWidthMm,
    document.customHeightMm,
  );
  const [dimensionInputs, setDimensionInputs] = React.useState({
    width: String(Math.round(currentCardSize.width * 10) / 10),
    height: String(Math.round(currentCardSize.height * 10) / 10),
  });
  const [gapInputs, setGapInputs] = React.useState({
    x: String(document.layoutGapXMm ?? 0),
    y: String(document.layoutGapYMm ?? 0),
  });

  React.useEffect(() => {
    setDimensionInputs({
      width: String(Math.round(currentCardSize.width * 10) / 10),
      height: String(Math.round(currentCardSize.height * 10) / 10),
    });
  }, [currentCardSize.width, currentCardSize.height]);

  React.useEffect(() => {
    setGapInputs({
      x: String(document.layoutGapXMm ?? 0),
      y: String(document.layoutGapYMm ?? 0),
    });
  }, [document.layoutGapXMm, document.layoutGapYMm]);

  const maxPossible = computeAutoLayout(
    document.paperSizeId,
    document.cardSizeId,
    document.customWidthMm,
    document.customHeightMm,
    document.layoutGapXMm ?? 0,
    document.layoutGapYMm ?? 0,
  ).maxPossible;

  const applyCustomDimensions = (widthMm: number, heightMm: number) => {
    onCardSizeChange('custom');
    onCustomDimensionsChange(widthMm, heightMm);
  };

  const commitDimensionInputs = (inputs = dimensionInputs) => {
    const nextWidth = clampDimension(Number(inputs.width), currentCardSize.width);
    const nextHeight = clampDimension(Number(inputs.height), currentCardSize.height);

    applyCustomDimensions(nextWidth, nextHeight);
    setDimensionInputs({
      width: String(Math.round(nextWidth * 10) / 10),
      height: String(Math.round(nextHeight * 10) / 10),
    });
  };

  const updateCustomDimensionInput = (axis: 'width' | 'height', value: string) => {
    const nextInputs = { ...dimensionInputs, [axis]: value };
    const nextWidth = Number(nextInputs.width);
    const nextHeight = Number(nextInputs.height);

    setDimensionInputs(nextInputs);

    if (
      Number.isFinite(nextWidth) &&
      Number.isFinite(nextHeight) &&
      nextWidth >= 10 &&
      nextWidth <= 1000 &&
      nextHeight >= 10 &&
      nextHeight <= 1000
    ) {
      applyCustomDimensions(nextWidth, nextHeight);
    }
  };

  const commitGapInputs = (inputs = gapInputs) => {
    const nextX = clampGap(Number(inputs.x));
    const nextY = clampGap(Number(inputs.y));
    onSetLayoutGap(nextX, nextY);
    setGapInputs({ x: String(nextX), y: String(nextY) });
  };

  const updateGapInput = (axis: 'x' | 'y', value: string) => {
    const nextInputs = { ...gapInputs, [axis]: value };
    setGapInputs(nextInputs);
    const v = Number(value);
    if (Number.isFinite(v) && v >= 0 && v <= 20) {
      const nextX = clampGap(Number(nextInputs.x));
      const nextY = clampGap(Number(nextInputs.y));
      onSetLayoutGap(nextX, nextY);
    }
  };

  return (
    <div className="flex h-full flex-col space-y-6 bg-white p-4">
      <header>
        <h2 className="flex items-center gap-2 text-sm font-black text-[#0f1724]">
          <span className="text-lg">📐</span> レイアウト設定
        </h2>
        <p className="mt-1 text-[10px] text-[#6b7280]">用紙への配置と印刷設定を行います</p>
      </header>

      <section className="space-y-2">
        <label className="text-[11px] font-bold uppercase tracking-wider text-[#374151]">印刷用紙サイズ</label>
        <div className="grid grid-cols-5 gap-1">
          {paperSizes.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onPaperSizeChange(id)}
              className={`h-8 rounded text-[10px] font-bold transition ${
                document.paperSizeId === id
                  ? 'bg-[#475569] text-white shadow-sm'
                  : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]'
              }`}
            >
              {id}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <label className="text-[11px] font-bold uppercase tracking-wider text-[#374151]">カードサイズ</label>
        <div className="grid grid-cols-3 gap-1">
          {cardSizes.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onCardSizeChange(id)}
              className={`h-8 rounded text-[10px] font-bold transition ${
                document.cardSizeId === id
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]'
              }`}
            >
              {id === 'custom' ? '自由' : CARD_MM_SIZES[id].label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10px] font-bold text-[#64748b]">幅 mm</span>
            <input
              type="number"
              min={10}
              max={1000}
              step={0.1}
              value={dimensionInputs.width}
              onChange={(event) => updateCustomDimensionInput('width', event.target.value)}
              onBlur={() => commitDimensionInputs()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              className="mt-1 h-9 w-full rounded-lg border border-[#cbd5e1] px-2 text-right text-sm font-bold outline-none focus:border-[#3b82f6]"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold text-[#64748b]">高さ mm</span>
            <input
              type="number"
              min={10}
              max={1000}
              step={0.1}
              value={dimensionInputs.height}
              onChange={(event) => updateCustomDimensionInput('height', event.target.value)}
              onBlur={() => commitDimensionInputs()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              className="mt-1 h-9 w-full rounded-lg border border-[#cbd5e1] px-2 text-right text-sm font-bold outline-none focus:border-[#3b82f6]"
            />
          </label>
        </div>
      </section>

      <section className="space-y-2">
        <label className="text-[11px] font-bold uppercase tracking-wider text-[#374151]">カード間隔</label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10px] font-bold text-[#64748b]">横 mm</span>
            <input
              type="number"
              min={0}
              max={20}
              step={0.1}
              value={gapInputs.x}
              onChange={(event) => updateGapInput('x', event.target.value)}
              onBlur={() => commitGapInputs()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              className="mt-1 h-9 w-full rounded-lg border border-[#cbd5e1] px-2 text-right text-sm font-bold outline-none focus:border-[#3b82f6]"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold text-[#64748b]">縦 mm</span>
            <input
              type="number"
              min={0}
              max={20}
              step={0.1}
              value={gapInputs.y}
              onChange={(event) => updateGapInput('y', event.target.value)}
              onBlur={() => commitGapInputs()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              className="mt-1 h-9 w-full rounded-lg border border-[#cbd5e1] px-2 text-right text-sm font-bold outline-none focus:border-[#3b82f6]"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
        <label className="block text-[11px] font-bold text-[#374151]">
          自動面付け（一括配置）
          <span className="ml-2 text-[9px] font-normal text-[#64748b]">最大目安: {maxPossible}枚</span>
        </label>

        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            max={Math.max(1, maxPossible)}
            value={customCount}
            onChange={(event) => setCustomCount(Math.max(1, parseInt(event.target.value, 10) || 1))}
            className="h-9 w-16 rounded-lg border border-[#cbd5e1] text-center text-sm font-bold outline-none focus:border-[#3b82f6]"
          />
          <button
            type="button"
            onClick={() => onAutoLayout(customCount)}
            disabled={maxPossible < 1}
            className="h-9 flex-1 rounded-lg bg-[#1e293b] text-[11px] font-bold text-white transition hover:bg-[#334155] disabled:cursor-not-allowed disabled:bg-[#cbd5e1]"
          >
            {customCount}枚配置する
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[4, 8, 10, 12, 16].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => onAutoLayout(num)}
              disabled={num > maxPossible}
              className={`h-8 rounded-lg border text-[10px] font-bold transition ${
                num > maxPossible
                  ? 'cursor-not-allowed border-[#f1f5f9] bg-[#f8fafc] text-[#cbd5e1]'
                  : 'border-[#cbd5e1] bg-white text-[#1e293b] hover:border-[#3b82f6] hover:bg-[#eff6ff]'
              }`}
            >
              {num}枚
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClearInstances}
          className="h-8 w-full rounded text-[10px] font-bold text-[#ef4444] transition hover:bg-[#fef2f2]"
        >
          全消去
        </button>
      </section>

      {/* 複数デザイン面付け */}
      <section className="space-y-2 rounded-xl border border-[#dbeafe] bg-[#eff6ff] p-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-[#1d4ed8]">
            複数デザイン面付け
          </label>
          {designQueue.length > 0 && (
            <span className="rounded-full bg-[#2563eb] px-2 py-0.5 text-[9px] font-bold text-white">
              {designQueue.length}種
            </span>
          )}
        </div>

        {/* キュー内のデザイン一覧 */}
        {designQueue.length > 0 && (
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {designQueue.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded border border-[#bfdbfe] bg-white px-1.5 py-1">
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt="" className="h-7 w-10 shrink-0 object-contain" />
                ) : (
                  <div className="h-7 w-10 shrink-0 rounded bg-[#e2e8f0]" />
                )}
                <span className="flex-1 truncate text-[10px] font-semibold text-[#1e293b]">
                  {item.name}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveFromQueue(i)}
                  className="shrink-0 text-[11px] text-[#94a3b8] hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 現在のデザインを追加 */}
        <button
          type="button"
          onClick={onAddCurrentToQueue}
          className="flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-[#93c5fd] bg-white text-[10px] font-bold text-[#2563eb] transition hover:bg-[#dbeafe]"
        >
          ＋ 今のデザインを追加
        </button>

        {/* 保存済みデザインから追加 */}
        {savedItems.length > 0 && (
          <>
            <p className="text-[9px] text-[#64748b]">保存済みから追加：</p>
            <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
              {savedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.name}
                  onClick={() => onAddSavedToQueue(item)}
                  className="relative h-10 w-14 overflow-hidden rounded border border-[#bfdbfe] bg-white transition hover:border-[#2563eb] hover:shadow"
                >
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.name} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[8px] text-[#94a3b8]">
                      {(item.name ?? '').slice(0, 4)}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-[#2563eb] py-0.5 text-center text-[7px] font-bold text-white opacity-0 transition hover:opacity-100">
                    追加
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* 実行ボタン */}
        <button
          type="button"
          onClick={() => onAutoLayoutWithDesigns(maxPossible)}
          disabled={designQueue.length === 0 || maxPossible < 1}
          className="h-9 w-full rounded-lg bg-[#2563eb] text-[11px] font-bold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-[#93c5fd]"
        >
          {designQueue.length > 0
            ? `リストで紙を埋める（最大 ${maxPossible} 枚）`
            : 'デザインをリストに追加してください'}
        </button>

        {designQueue.length > 0 && (
          <button
            type="button"
            onClick={onClearQueue}
            className="h-7 w-full rounded text-[10px] text-[#64748b] transition hover:text-red-500"
          >
            リストを空にする
          </button>
        )}
      </section>

      <section className="space-y-3">
        <label className="block text-[11px] font-bold text-[#374151]">カードの追加</label>
        <button
          type="button"
          onClick={onAddInstance}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#3b82f6] text-xs font-bold text-white shadow-md transition hover:bg-[#2563eb] active:scale-95"
        >
          <span>＋</span> 今のデザインを1枚追加
        </button>
      </section>

      <section className="space-y-3 border-t border-[#f1f5f9] pt-4">
        <label className="flex cursor-pointer items-center justify-between rounded-lg p-2 transition hover:bg-[#f8fafc]">
          <span className="text-xs font-bold text-[#374151]">グリッドスナップ</span>
          <input
            type="checkbox"
            checked={document.snapEnabled}
            onChange={onToggleSnap}
            className="h-4 w-4 rounded border-[#cbd5e1] text-[#3b82f6] focus:ring-[#3b82f6]"
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between rounded-lg p-2 transition hover:bg-[#f8fafc]">
          <span className="text-xs font-bold text-[#374151]">全体トンボを表示</span>
          <input
            type="checkbox"
            checked={document.showCropMarks}
            onChange={onToggleCropMarks}
            className="h-4 w-4 rounded border-[#cbd5e1] text-[#3b82f6] focus:ring-[#3b82f6]"
          />
        </label>
      </section>
    </div>
  );
};
