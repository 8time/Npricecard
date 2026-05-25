import type { CardDocument, EditableObjectId, LayerMeta } from '../types';

type Props = {
  document: CardDocument;
  onToggleLayerMeta: (objectId: string, field: 'locked' | 'hidden') => void;
  onMoveLayer: (objectId: EditableObjectId, direction: 'up' | 'down') => void;
  onRemoveCustomText: (objectId: import('../types').CustomTextObjectId) => void;
  onRemoveShape: (id: import('../types').ShapeObjectId) => void;
  onRemoveImageLayer: (id: import('../types').ImageObjectId) => void;
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
};

const getLayerLabel = (id: string, doc: CardDocument): string => {
  if (id === 'border') return '枠線';
  if (id === 'productName') return '商品名';
  if (id === 'price') return '価格';
  if (id === 'taxLabel') return '税表示';
  if (id === 'prText') return 'PRテキスト';
  if (id.startsWith('image:')) {
    const found = doc.imageLayers?.find((l) => l.id === id);
    return found?.name ?? '画像';
  }
  if (id.startsWith('customText:')) {
    const found = doc.customTextLayers.find((l) => l.id === id);
    return found?.name ?? id;
  }
  if (id.startsWith('shape:')) {
    const found = doc.shapeLayers.find((l) => l.id === id);
    return found?.name ?? id;
  }
  return id;
};

const getLayerIcon = (id: string): string => {
  if (id === 'border') return '▭';
  if (id.startsWith('image:')) return '🖼️';
  if (id.startsWith('shape:')) return '⬛';
  return '𝐀';
};

export const LayerPanel = ({
  document,
  onToggleLayerMeta,
  onMoveLayer,
  onRemoveCustomText,
  onRemoveShape,
  onRemoveImageLayer,
  selectedObjectId,
  onSelectObject,
}: Props) => {
  const reversedOrder = [...document.layerOrder].reverse();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#d9e0e6] bg-[#f8fafc] px-3 py-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-[#8896a5]">レイヤー</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {reversedOrder.map((id) => {
          const meta: LayerMeta = document.layerMeta[id] || { locked: false, hidden: false };
          const isSelected = selectedObjectId === id;
          const isCustomText = id.startsWith('customText:');
          const isShape = id.startsWith('shape:');
          const isImageLayer = id.startsWith('image:');
          const isBuiltIn = !isCustomText && !isShape && !isImageLayer;

          return (
            <div
              key={id}
              onClick={() => onSelectObject(isSelected ? null : id)}
              className={`group flex cursor-pointer items-center gap-1.5 border-b border-[#edf0f3] px-2 py-1.5 text-xs transition ${
                isSelected
                  ? 'bg-[#e8f4ff] text-[#1d6fad]'
                  : meta.hidden
                  ? 'opacity-40 hover:bg-[#f0f4f8]'
                  : 'hover:bg-[#f0f4f8]'
              }`}
            >
              <span className="w-4 shrink-0 text-center text-[10px]">{getLayerIcon(id)}</span>
              <span className="flex-1 truncate font-medium">{getLayerLabel(id, document)}</span>

              {/* 非表示トグル */}
              <button
                type="button"
                title={meta.hidden ? '表示' : '非表示'}
                onClick={(e) => { e.stopPropagation(); onToggleLayerMeta(id, 'hidden'); }}
                className="shrink-0 text-[10px] text-[#94a3b8] opacity-0 transition hover:text-[#374151] group-hover:opacity-100"
              >
                {meta.hidden ? '👁️' : '👁'}
              </button>

              {/* ロックトグル */}
              <button
                type="button"
                title={meta.locked ? 'ロック解除' : 'ロック'}
                onClick={(e) => { e.stopPropagation(); onToggleLayerMeta(id, 'locked'); }}
                className={`shrink-0 text-[10px] transition group-hover:opacity-100 ${meta.locked ? 'text-[#f59e0b]' : 'text-[#94a3b8] opacity-0 hover:text-[#374151]'}`}
              >
                {meta.locked ? '🔒' : '🔓'}
              </button>

              {/* 移動ボタン */}
              <div className="flex flex-col opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMoveLayer(id as EditableObjectId, 'up'); }}
                  className="leading-none text-[9px] text-[#94a3b8] hover:text-[#374151]"
                >▲</button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMoveLayer(id as EditableObjectId, 'down'); }}
                  className="leading-none text-[9px] text-[#94a3b8] hover:text-[#374151]"
                >▼</button>
              </div>

              {/* 削除ボタン（カスタム・図形・画像レイヤー） */}
              {!isBuiltIn && (
                <button
                  type="button"
                  title="削除"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isCustomText) onRemoveCustomText(id as import('../types').CustomTextObjectId);
                    if (isShape) onRemoveShape(id as import('../types').ShapeObjectId);
                    if (isImageLayer) onRemoveImageLayer(id as import('../types').ImageObjectId);
                  }}
                  className="shrink-0 text-[10px] text-[#f87171] opacity-0 transition hover:text-[#dc2626] group-hover:opacity-100"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        {document.layerOrder.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-[#94a3b8]">
            レイヤーがありません
          </div>
        )}
      </div>
    </div>
  );
};
