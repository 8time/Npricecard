import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';

import { useEffect, useState } from 'react';
import { CARD_MM_SIZES, getCardMmSize } from '../lib/canvasWorkspace';
import type {
  CardDocument,
  CardSizeId,
  CustomTextLayer,
  CustomTextObjectId,
  EditableObjectId,
  FontOption,
  ImageObjectId,
  ObjectLayout,
} from '../types';

const PRODUCT_NAME_COLORS: { hex: string; label: string }[] = [
  { hex: '#111827', label: '黒' },
  { hex: '#FFFFFF', label: '白' },
  { hex: '#d13b24', label: '赤' },
  { hex: '#FF6600', label: 'オレンジ' },
  { hex: '#FFFF00', label: '黄' },
  { hex: '#008000', label: '緑' },
  { hex: '#0000FF', label: '青' },
  { hex: '#800080', label: '紫' },
];

const ColorPalette = ({
  currentColor,
  defaultColor,
  onChange,
}: {
  currentColor: string | undefined;
  defaultColor: string;
  onChange: (color: string) => void;
}) => {
  const active = (currentColor ?? defaultColor).toLowerCase();
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {PRODUCT_NAME_COLORS.map(({ hex, label }) => {
        const isActive = active === hex.toLowerCase();
        return (
          <button
            key={hex}
            type="button"
            title={`${label} (${hex})`}
            onClick={() => onChange(hex)}
            className="relative h-6 w-6 rounded-full transition-transform hover:scale-110 focus:outline-none"
            style={{
              backgroundColor: hex,
              boxShadow: hex === '#FFFFFF' ? 'inset 0 0 0 1px #d1d5db' : undefined,
              outline: isActive ? '2px solid #2d8fc0' : '2px solid transparent',
              outlineOffset: '2px',
            }}
          >
            {isActive && (
              <span
                className="absolute inset-0 flex items-center justify-center text-[10px] font-black leading-none"
                style={{ color: hex === '#FFFFFF' || hex === '#FFFF00' ? '#374151' : '#ffffff' }}
              >
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

type Props = {
  document: CardDocument;
  fonts: FontOption[];
  layerOrder: EditableObjectId[];
  customTextLayers: CustomTextLayer[];
  onChangeField: (field: 'productName' | 'price' | 'prText', value: string) => void;
  onChangeProductNameColor: (color: string) => void;
  onChangePriceColor: (color: string) => void;
  onChangePrTextColor: (color: string) => void;
  onCardSizeChange: (cardSizeId: CardSizeId) => void;
  onCustomDimensionsChange: (widthMm: number, heightMm: number) => void;
  onAddTextLayer: () => void;
  onChangeCustomText: (objectId: CustomTextObjectId, text: string) => void;
  onMoveLayer: (objectId: EditableObjectId, direction: 'up' | 'down') => void;
  onSendLayerToBack: (objectId: EditableObjectId) => void;
  onReorderLayers: (layerOrder: EditableObjectId[]) => void;
  onChangeFont: (fontFamily: string) => void;
  onUploadFont: (file: File | null) => void;
  onUploadImage: (file: File | null) => void;
  onRemoveImageLayer: (id: ImageObjectId) => void;
  onToggleLayerMeta: (objectId: string, field: 'locked' | 'hidden') => void;
  onChangePriceFlag: (field: string, value?: any) => void;
  onUpdateLayout: (objectId: EditableObjectId, layout: Partial<ObjectLayout>) => void;
};

const fieldClassName =
  'mt-2 w-full rounded-md border border-[#ccd6df] bg-white px-3 py-2 text-sm text-[#111827] outline-none transition focus:border-[#2d8fc0]';

const cardSizes: CardSizeId[] = ['A4', 'A5', 'A6', 'B5', 'B6', 'custom'];

const clampDimension = (value: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1000, Math.max(10, value));
};

const getLayerName = (objectId: EditableObjectId, customTextLayers: CustomTextLayer[], document: CardDocument) => {
  if (objectId === 'border') return '枠線';
  if (objectId === 'productName') return '商品名';
  if (objectId === 'taxLabel') return '税込ラベル';
  if (objectId === 'price') return '価格';
  if (objectId === 'prText') return 'PR文';
  if ((objectId as string).startsWith('image:')) {
    return document.imageLayers?.find((l) => l.id === objectId)?.name ?? '画像';
  }
  return customTextLayers.find((layer) => layer.id === objectId)?.name ?? '文字';
};

type SortableLayerItemProps = {
  id: EditableObjectId;
  objectId: EditableObjectId;
  customTextLayers: CustomTextLayer[];
  document: CardDocument;
  onMoveLayer: (objectId: EditableObjectId, direction: 'up' | 'down') => void;
  onSendLayerToBack: (objectId: EditableObjectId) => void;
  onChangeCustomText: (objectId: CustomTextObjectId, text: string) => void;
  onRemoveImageLayer: (id: ImageObjectId) => void;
  onToggleLayerMeta: (objectId: string, field: 'locked' | 'hidden') => void;
  onUpdateLayout: (objectId: EditableObjectId, layout: Partial<ObjectLayout>) => void;
};

const SortableLayerItem = ({
  id,
  objectId,
  customTextLayers,
  document,
  onMoveLayer,
  onSendLayerToBack,
  onChangeCustomText,
  onRemoveImageLayer,
  onToggleLayerMeta,
  onUpdateLayout,
}: SortableLayerItemProps) => {
  const meta = document.layerMeta?.[objectId] || { locked: false, hidden: false };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-md border border-[#d9e0e6] bg-[#f8fafc] p-2 ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          <div
            {...attributes}
            {...listeners}
            className="grid h-7 w-5 shrink-0 cursor-grab place-items-center rounded hover:bg-[#e2e8f0] active:cursor-grabbing"
            title="ドラッグして並び替え"
          >
            <span className="text-xs text-[#94a3b8]">⋮⋮</span>
          </div>
          <span className="truncate text-sm font-bold">{getLayerName(objectId, customTextLayers, document)}</span>
          <button
            type="button"
            onClick={() => onToggleLayerMeta(objectId, 'locked')}
            className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
              meta.locked ? 'bg-[#475569] text-white' : 'text-[#94a3b8] hover:bg-[#e2e8f0] hover:text-[#475569]'
            }`}
            title={meta.locked ? 'ロック解除' : '位置を固定'}
          >
            {meta.locked ? '🔒' : '🔓'}
          </button>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onMoveLayer(objectId, 'up')}
            className="grid h-7 w-7 place-items-center rounded border border-[#ccd6df] bg-white text-xs font-bold transition hover:bg-[#f0f9ff] hover:text-[#2d8fc0]"
            title="前面へ"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMoveLayer(objectId, 'down')}
            className="grid h-7 w-7 place-items-center rounded border border-[#ccd6df] bg-white text-xs font-bold transition hover:bg-[#f0f9ff] hover:text-[#2d8fc0]"
            title="背面へ"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => onSendLayerToBack(objectId)}
            className="h-7 rounded border border-[#ccd6df] bg-white px-2 text-xs font-bold transition hover:bg-[#f0f9ff] hover:text-[#2d8fc0]"
            title="最背面へ"
          >
            最背面
          </button>
        </div>
      </div>
      {objectId.startsWith('customText:') && (
        <input
          value={customTextLayers.find((layer) => layer.id === objectId)?.text ?? ''}
          onChange={(event) => onChangeCustomText(objectId as CustomTextObjectId, event.target.value)}
          className={`${fieldClassName} mt-2`}
        />
      )}

      {/* 文字間隔調整 (テキストレイヤーのみ表示) */}
      {!(objectId as string).startsWith('image:') && objectId !== 'border' && (
        <div className="mt-2 space-y-1 rounded-sm bg-[#eff6ff] p-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold text-[#3b82f6]">
            <span>文字間隔</span>
            <span>{document.layout[objectId]?.charSpacing ?? 0}</span>
          </div>
          <input
            type="range"
            min="-100"
            max="1000"
            step="10"
            value={document.layout[objectId]?.charSpacing ?? 0}
            onChange={(e) => onUpdateLayout(objectId, { charSpacing: parseInt(e.target.value) })}
            className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-[#dbeafe] accent-[#3b82f6]"
          />
        </div>
      )}
      {(objectId as string).startsWith('image:') && (
        <>
          <label className="mt-2 block text-xs font-bold">
            回転角度
            <div className="mt-1 flex items-center gap-2">
              <input
                type="range"
                min="-180"
                max="180"
                value={document.layout[objectId]?.angle ?? 0}
                onChange={(event) => onUpdateLayout(objectId, { angle: Number(event.target.value) })}
                className="flex-1 accent-[#3b82f6]"
              />
              <input
                type="number"
                min="-180"
                max="180"
                value={document.layout[objectId]?.angle ?? 0}
                onChange={(event) => onUpdateLayout(objectId, { angle: Number(event.target.value) })}
                className="w-14 rounded border border-[#ccd6df] bg-white px-1.5 py-1 text-center text-[11px] font-bold outline-none focus:border-[#2d8fc0]"
              />
              <span className="text-[10px] text-[#94a3b8] -ml-1">°</span>
            </div>
          </label>
          <button
            type="button"
            onClick={() => onRemoveImageLayer(objectId as ImageObjectId)}
            className="mt-2 w-full rounded-md border border-[#efb9b9] bg-[#fff5f5] px-3 py-1.5 text-xs font-bold text-[#b42323] transition hover:bg-[#ffebeb]"
          >
            この画像を削除
          </button>
        </>
      )}
    </div>
  );
};

export const EditorPanel = ({
  document,
  fonts,
  layerOrder,
  customTextLayers,
  onChangeField,
  onChangeProductNameColor,
  onChangePriceColor,
  onChangePrTextColor,
  onCardSizeChange,
  onCustomDimensionsChange,
  onAddTextLayer,
  onChangeCustomText,
  onMoveLayer,
  onSendLayerToBack,
  onReorderLayers,
  onChangeFont,
  onUploadFont,
  onUploadImage,
  onRemoveImageLayer,
  onToggleLayerMeta,
  onChangePriceFlag,
  onUpdateLayout,
}: Props) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const displayLayers = [...layerOrder].reverse();

  const currentCardSize = getCardMmSize(
    document.cardSizeId,
    document.customWidthMm,
    document.customHeightMm,
  );
  const [dimensionInputs, setDimensionInputs] = useState({
    width: String(Math.round(currentCardSize.width * 10) / 10),
    height: String(Math.round(currentCardSize.height * 10) / 10),
  });

  useEffect(() => {
    setDimensionInputs({
      width: String(Math.round(currentCardSize.width * 10) / 10),
      height: String(Math.round(currentCardSize.height * 10) / 10),
    });
  }, [currentCardSize.width, currentCardSize.height]);

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = displayLayers.indexOf(active.id as EditableObjectId);
      const newIndex = displayLayers.indexOf(over.id as EditableObjectId);

      const newDisplayLayers = arrayMove(displayLayers, oldIndex, newIndex);
      // reverse して保存用の order に戻す
      onReorderLayers([...newDisplayLayers].reverse());
    }
  };

  return (
    <aside className="min-h-0 overflow-y-auto border-l border-[#d9e0e6] bg-white">
      <div className="border-b border-[#e3e8ed] px-4 py-4">
        <h2 className="text-base font-bold">設定</h2>
      </div>

      <div className="px-4 py-5">
        <section className="mb-5 rounded-lg border border-[#d9e0e6] bg-[#f8fafc] p-3">
          <h3 className="mb-3 text-sm font-bold">カードサイズ</h3>
          <div className="grid grid-cols-3 gap-1">
            {cardSizes.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onCardSizeChange(id)}
                className={`h-8 rounded text-[10px] font-bold transition ${
                  document.cardSizeId === id
                    ? 'bg-[#2563eb] text-white shadow-sm'
                    : 'bg-white text-[#475569] hover:bg-[#e2e8f0]'
                }`}
              >
                {id === 'custom' ? '自由' : CARD_MM_SIZES[id].label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
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
                className="mt-1 h-9 w-full rounded-md border border-[#ccd6df] bg-white px-2 text-right text-sm font-bold outline-none transition focus:border-[#2d8fc0]"
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
                className="mt-1 h-9 w-full rounded-md border border-[#ccd6df] bg-white px-2 text-right text-sm font-bold outline-none transition focus:border-[#2d8fc0]"
              />
            </label>
          </div>
        </section>

        <div className="mb-4">
          <label className="block text-sm font-bold">
            商品名
            <input
              value={document.productName}
              onChange={(event) => onChangeField('productName', event.target.value)}
              className={fieldClassName}
            />
          </label>
          <ColorPalette
            currentColor={document.productNameColor}
            defaultColor="#111827"
            onChange={onChangeProductNameColor}
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold">
            価格
            <input
              value={document.price}
              onChange={(event) => onChangeField('price', event.target.value.replace(/[^\d]/g, ''))}
              className={fieldClassName}
            />
          </label>
          <ColorPalette
            currentColor={document.priceColor}
            defaultColor="#d13b24"
            onChange={onChangePriceColor}
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold">
            PR文
            <textarea
              value={document.prText}
              onChange={(event) => onChangeField('prText', event.target.value)}
              className={`${fieldClassName} min-h-[72px] resize-none`}
            />
          </label>
          <ColorPalette
            currentColor={document.prTextColor}
            defaultColor="#111827"
            onChange={onChangePrTextColor}
          />
        </div>

        <section className="mb-5 border-t border-[#e3e8ed] pt-5">
          <h3 className="mb-3 text-sm font-bold">フォント</h3>
          <select
            value={document.fontFamily}
            onChange={(event) => onChangeFont(event.target.value)}
            className={fieldClassName}
            style={{ fontFamily: document.fontFamily }}
          >
            {fonts.map((font) => (
              <option key={font.id} value={font.family}>
                {font.name} {font.source === 'uploaded' ? '(アップロード)' : ''}
              </option>
            ))}
          </select>
          <label className="mt-3 block rounded-md border border-dashed border-[#b8c5cf] bg-[#f8fafc] px-3 py-3 text-center text-sm font-bold text-[#536170] hover:border-[#2d8fc0]">
            フォントをアップロード
            <input
              type="file"
              accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
              className="hidden"
              onChange={(event) => onUploadFont(event.target.files?.[0] ?? null)}
            />
          </label>
        </section>

        <section className="mb-5 border-t border-[#e3e8ed] pt-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold">レイヤー</h3>
            <button
              type="button"
              onClick={onAddTextLayer}
              className="rounded-md border border-[#ccd6df] bg-white px-2 py-1 text-xs font-bold transition hover:border-[#2d8fc0] hover:text-[#2d8fc0]"
            >
              文字を追加
            </button>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
          >
            <div className="grid gap-2">
              <SortableContext items={displayLayers} strategy={verticalListSortingStrategy}>
                {displayLayers.map((objectId) => (
                  <SortableLayerItem
                    key={objectId}
                    id={objectId}
                    objectId={objectId}
                    customTextLayers={customTextLayers}
                    document={document}
                    onMoveLayer={onMoveLayer}
                    onSendLayerToBack={onSendLayerToBack}
                    onChangeCustomText={onChangeCustomText}
                    onRemoveImageLayer={onRemoveImageLayer}
                    onToggleLayerMeta={onToggleLayerMeta}
                    onUpdateLayout={onUpdateLayout}
                  />
                ))}
              </SortableContext>
            </div>
          </DndContext>
        </section>

        <div className="mt-3 grid gap-2 text-sm">
          {/* 価格詳細設定 */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={document.priceFlags.includeTax}
                  onChange={(e) => onChangePriceFlag('includeTax', e.target.checked)}
                  className="w-4 h-4 rounded text-[#3b82f6] focus:ring-[#3b82f6]"
                />
                <span className="text-xs font-bold text-[#4b5563] group-hover:text-[#1f2937]">税込</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={document.priceFlags.showTaxLabel}
                  onChange={(e) => onChangePriceFlag('showTaxLabel', e.target.checked)}
                  className="w-4 h-4 rounded text-[#3b82f6] focus:ring-[#3b82f6]"
                />
                <span className="text-xs font-bold text-[#4b5563] group-hover:text-[#1f2937]">「税込」ラベル</span>
              </label>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={document.priceFlags.showYen}
                  onChange={(e) => onChangePriceFlag('showYen', e.target.checked)}
                  className="w-4 h-4 rounded text-[#3b82f6] focus:ring-[#3b82f6]"
                />
                <span className="text-xs font-bold text-[#4b5563] group-hover:text-[#1f2937]">「円」表示</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={document.priceFlags.hasStroke}
                  onChange={(e) => onChangePriceFlag('hasStroke', e.target.checked)}
                  className="w-4 h-4 rounded text-[#3b82f6] focus:ring-[#3b82f6]"
                />
                <span className="text-xs font-bold text-[#4b5563] group-hover:text-[#1f2937]">黒いふち</span>
              </label>
            </div>
          </div>

          {/* 円のサイズ & ふちの太さ */}
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <div className="flex justify-between">
                <label className="text-[10px] font-black text-[#6b7280] uppercase tracking-wider">円のサイズ</label>
                <span className="text-[10px] font-bold text-[#3b82f6]">{Math.round(document.priceFlags.yenSizeScale * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.2"
                step="0.05"
                value={document.priceFlags.yenSizeScale}
                onChange={(e) => onChangePriceFlag('yenSizeScale', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
              />
            </div>

            {document.priceFlags.hasStroke && (
              <div className="space-y-1">
                <div className="flex justify-between">
                  <label className="text-[10px] font-black text-[#6b7280] uppercase tracking-wider">ふちの太さ</label>
                  <span className="text-[10px] font-bold text-[#3b82f6]">{document.priceFlags.strokeWidth}px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="24"
                  step="1"
                  value={document.priceFlags.strokeWidth}
                  onChange={(e) => onChangePriceFlag('strokeWidth', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-7 border-t border-[#e3e8ed] pt-5">
          <label className="block rounded-md border border-dashed border-[#b8c5cf] bg-[#f8fafc] px-3 py-3 text-center text-sm font-bold text-[#536170] hover:border-[#2d8fc0]">
            画像を追加
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={(event) => onUploadImage(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <p className="mt-8 text-sm font-medium leading-6 text-[#111827]">
          #キャンバス上の文字や画像はドラッグで移動、角ハンドルでサイズ変更できます。
        </p>
      </div>
    </aside>
  );
};
