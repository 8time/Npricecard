import { useEffect, useRef, useState } from 'react';
import { Canvas, Group, Object as FabricObject, Rect } from 'fabric';
import { Layout, Minus, Plus, RotateCcw } from 'lucide-react';
import {
  computeAutoLayout,
  getCardOrigin,
  PRINT_MARGIN_PX,
  WORKSPACE_PADDING,
} from '../lib/canvasWorkspace';
import { drawCropMarks, drawCropMarksFromInstances, drawGroupCropMarks } from '../lib/cropMarks';
import type { PaperSizeId, CardSizeId } from '../lib/canvasWorkspace';
import { drawCardObjects } from '../lib/drawUtils';
import { DEFAULT_LAYER_ORDER, getDefaultLayout, getTemplateById } from '../templates';
import type { CardDesign, CardDocument, EditableObjectId, ObjectLayout, SavedDocument, TemplateId } from '../types';

interface CanvasStageProps {
  document: CardDocument;
  zoom: number;
  savedItems: SavedDocument[];
  selectedInstanceIds: string[];
  onCanvasReady: (canvas: Canvas) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onObjectLayoutChange: (id: EditableObjectId, layout: ObjectLayout) => void;
  onPaperSizeChange: (paperSizeId: PaperSizeId) => void;
  onCardSizeChange: (cardSizeId: CardSizeId) => void;
  onCustomDimensionsChange: (widthMm: number, heightMm: number) => void;
  onToggleLayoutMode: () => void;
  onAddInstance: (x: number, y: number, design?: Partial<CardDesign> | CardDocument) => void;
  onRemoveInstance: (id: string) => void;
  onUpdateInstance: (id: string, x: number, y: number, angle: number) => void;
  onUpdateInstanceCropMarks: (id: string, show: boolean) => void;
  onSelectionChange: (objectId: string | null, instanceId: string | null) => void;
  onMultiSelectionChange: (instanceIds: string[]) => void;
  onGroupInstances: (instanceIds: string[]) => void;
  onUngroupInstances: (groupId: string) => void;
}

type CanvasObjectWithData = FabricObject & {
  data?: {
    objectId?: EditableObjectId;
    instanceId?: string;
  };
};

type DropPayload =
  | { type: 'template'; id: TemplateId }
  | { type: 'saved'; item: SavedDocument };

const clampCardToPrintableArea = (
  x: number,
  y: number,
  cardWidth: number,
  cardHeight: number,
  paperX: number,
  paperY: number,
  paperWidth: number,
  paperHeight: number,
) => {
  const minX = paperX + PRINT_MARGIN_PX;
  const minY = paperY + PRINT_MARGIN_PX;
  const maxX = paperX + paperWidth - PRINT_MARGIN_PX - cardWidth;
  const maxY = paperY + paperHeight - PRINT_MARGIN_PX - cardHeight;

  return {
    x: maxX < minX ? paperX + (paperWidth - cardWidth) / 2 : Math.min(maxX, Math.max(minX, x)),
    y: maxY < minY ? paperY + (paperHeight - cardHeight) / 2 : Math.min(maxY, Math.max(minY, y)),
  };
};

const createTemplateDesign = (document: CardDocument, templateId: TemplateId): CardDocument => {
  const template = getTemplateById(templateId);
  return {
    ...document,
    templateId: template.id,
    productName: template.productName.text,
    price: template.price.text,
    prText: template.prText.text,
    layout: getDefaultLayout(template.id),
    customTextLayers: [],
    layerOrder: [...DEFAULT_LAYER_ORDER],
  };
};

const mergeInstanceDesign = (document: CardDocument, design: CardDesign): CardDocument => ({
  ...document,
  ...design,
  paperSizeId: document.paperSizeId,
  instances: [],
  layoutMode: false,
});

const createCardFrame = (left: number, top: number, width: number, height: number, showBorder = false) =>
  new Rect({
    left,
    top,
    width,
    height,
    fill: '#ffffff',
    stroke: showBorder ? '#94a3b8' : 'transparent',
    strokeWidth: showBorder ? 1 : 0,
    selectable: false,
    evented: false,
  });


export const CanvasStage: React.FC<CanvasStageProps> = ({
  document,
  zoom,
  savedItems,
  selectedInstanceIds,
  onCanvasReady,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onObjectLayoutChange,
  onToggleLayoutMode,
  onAddInstance,
  onRemoveInstance,
  onUpdateInstance,
  onSelectionChange,
  onMultiSelectionChange,
  onGroupInstances,
  onUngroupInstances,
}) => {
  const canvasElementRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef(document);
  const onRemoveInstanceRef = useRef(onRemoveInstance);
  const onGroupInstancesRef = useRef(onGroupInstances);
  const onUngroupInstancesRef = useRef(onUngroupInstances);
  const selectedInstanceIdsRef = useRef(selectedInstanceIds);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  useEffect(() => {
    onRemoveInstanceRef.current = onRemoveInstance;
  }, [onRemoveInstance]);

  useEffect(() => {
    onGroupInstancesRef.current = onGroupInstances;
  }, [onGroupInstances]);

  useEffect(() => {
    onUngroupInstancesRef.current = onUngroupInstances;
  }, [onUngroupInstances]);

  useEffect(() => {
    selectedInstanceIdsRef.current = selectedInstanceIds;
  }, [selectedInstanceIds]);

  // キャンバスの初期化
  useEffect(() => {
    if (!canvasElementRef.current) return;

    const canvas = new Canvas(canvasElementRef.current, {
      width: 800,
      height: 600,
      backgroundColor: '#f1f5f9',
      preserveObjectStacking: true,
      enableRetinaScaling: true,
    });

    fabricRef.current = canvas;
    onCanvasReady(canvas);

    const notifySelection = () => {
      const active = canvas.getActiveObjects() as CanvasObjectWithData[];
      const instanceIds = active
        .map((o) => o.data?.instanceId)
        .filter((id): id is string => !!id);
      const objectIds = active
        .map((o) => o.data?.objectId as string | undefined)
        .filter((id): id is string => !!id);

      if (instanceIds.length > 0) {
        onSelectionChange(null, instanceIds[0]);
        onMultiSelectionChange(instanceIds);
      } else if (objectIds.length > 0) {
        onSelectionChange(objectIds[0] as EditableObjectId, null);
        onMultiSelectionChange([]);
      } else {
        onSelectionChange(null, null);
        onMultiSelectionChange([]);
      }
    };

    canvas.on('selection:created', notifySelection);
    canvas.on('selection:updated', notifySelection);

    canvas.on('selection:cleared', () => {
      onSelectionChange(null, null);
      onMultiSelectionChange([]);
    });

    const SNAP_PX = 12;
    canvas.on('object:scaling', (e) => {
      const obj = e.target as CanvasObjectWithData | undefined;
      if (!obj?.data?.objectId) return;
      if (!(obj.data.objectId as string).startsWith('image:')) return;

      const naturalW = obj.width ?? 0;
      const naturalH = obj.height ?? 0;
      if (naturalW === 0 || naturalH === 0) return;

      const currentDocument = documentRef.current;
      const { cardX, cardY, cardPxWidth, cardPxHeight } = getCardOrigin(
        currentDocument.paperSizeId,
        currentDocument.cardSizeId,
        currentDocument.customWidthMm,
        currentDocument.customHeightMm
      );
      const cardRight = cardX + cardPxWidth;
      const cardBottom = cardY + cardPxHeight;

      const left = obj.left ?? 0;
      const top = obj.top ?? 0;
      const right = left + naturalW * (obj.scaleX ?? 1);
      const bottom = top + naturalH * (obj.scaleY ?? 1);
      const corner = (e as any).transform?.corner as string ?? '';

      if ((corner.includes('r') || corner === '') && Math.abs(right - cardRight) < SNAP_PX) {
        obj.set({ scaleX: (cardRight - left) / naturalW });
      } else if ((corner.includes('l') || corner === '') && Math.abs(left - cardX) < SNAP_PX) {
        obj.set({ left: cardX, scaleX: (right - cardX) / naturalW });
      }

      if ((corner.includes('b') || corner === '') && Math.abs(bottom - cardBottom) < SNAP_PX) {
        obj.set({ scaleY: (cardBottom - top) / naturalH });
      } else if ((corner.includes('t') || corner === '') && Math.abs(top - cardY) < SNAP_PX) {
        obj.set({ top: cardY, scaleY: (bottom - cardY) / naturalH });
      }
    });

    canvas.on('object:modified', (e) => {
      const obj = e.target as CanvasObjectWithData | undefined;
      if (!obj) return;
      const currentDocument = documentRef.current;

      const { cardX, cardY, cardPxWidth, cardPxHeight } = getCardOrigin(
        currentDocument.paperSizeId,
        currentDocument.cardSizeId,
        currentDocument.customWidthMm,
        currentDocument.customHeightMm
      );
      const sx = cardPxWidth / 1000;
      const sy = cardPxHeight / 700;

      if (obj.data?.objectId) {
        // キャンバス座標 -> テンプレート座標へ変換
        const normalizedLeft = (obj.left! - cardX) / sx;
        const normalizedTop = (obj.top! - cardY) / sy;

        // 画像レイヤーは描画時に scaleX *= sx / scaleY *= sy しているので割り戻す
        const isImage = (obj.data.objectId as string).startsWith('image:');
        onObjectLayoutChange(obj.data.objectId, {
          left: Math.round(normalizedLeft),
          top: Math.round(normalizedTop),
          scaleX: isImage ? (obj.scaleX ?? 1) / sx : (obj.scaleX ?? 1),
          scaleY: isImage ? (obj.scaleY ?? 1) / sy : (obj.scaleY ?? 1),
          angle: obj.angle ?? 0,
          charSpacing: (obj as any).charSpacing,
        });
      } else if (obj.data?.instanceId) {
        onUpdateInstance(obj.data.instanceId, obj.left ?? 0, obj.top ?? 0, obj.angle ?? 0);
      } else if (typeof (obj as any).getObjects === 'function') {
        // ActiveSelection: 複数インスタンスをまとめて移動した場合
        const sel = obj as any;
        for (const child of (sel.getObjects() as CanvasObjectWithData[])) {
          if (!child.data?.instanceId) continue;
          // calcTransformMatrix() でキャンバス絶対座標の変換行列を取得
          // mat[4]=絶対中心X, mat[5]=絶対中心Y
          const mat = (child as any).calcTransformMatrix() as number[];
          const cx = mat[4];
          const cy = mat[5];
          const childAngle = (child as any).angle ?? 0;
          let instX: number;
          let instY: number;
          if (Math.abs(childAngle - 90) < 1) {
            // angle=90: fabricのleft=視覚右端, top=視覚上端
            instX = cx + cardPxHeight / 2;
            instY = cy - cardPxWidth / 2;
          } else {
            instX = cx - cardPxWidth / 2;
            instY = cy - cardPxHeight / 2;
          }
          onUpdateInstance(child.data.instanceId as string, instX, instY, childAngle);
        }
      }
    });

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, []);

  // ズームと位置の同期
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const { paperWidth, paperHeight } = getCardOrigin(
      document.paperSizeId,
      document.cardSizeId,
      document.customWidthMm,
      document.customHeightMm
    );

    const canvasWidth = paperWidth + WORKSPACE_PADDING * 2;
    const canvasHeight = paperHeight + WORKSPACE_PADDING * 2;

    canvas.setDimensions({
      width: canvasWidth * zoom,
      height: canvasHeight * zoom,
    });

    canvas.setZoom(zoom);
    canvas.calcOffset();
    canvas.requestRenderAll();

    // 中央へスクロール (カード本体が中心に来るように調整)
    const container = containerRef.current;
    if (container) {
      const { cardX, cardY, cardPxWidth, cardPxHeight } = getCardOrigin(
        document.paperSizeId,
        document.cardSizeId,
        document.customWidthMm,
        document.customHeightMm
      );
      const scrollX = Math.max(0, (cardX + cardPxWidth / 2) * zoom - container.clientWidth / 2);
      const scrollY = Math.max(0, (cardY + cardPxHeight / 2) * zoom - container.clientHeight / 2);
      container.scrollTo({
        left: scrollX,
        top: scrollY,
        behavior: 'instant' as any
      });
    }
  }, [document.paperSizeId, document.cardSizeId, document.customWidthMm, document.customHeightMm, zoom, document.layoutMode]);

  // ---- オブジェクト描画 ----------------------------------------------------------
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const { cardX, cardY, cardPxWidth, cardPxHeight, paperX, paperY, paperWidth, paperHeight } =
      getCardOrigin(document.paperSizeId, document.cardSizeId, document.customWidthMm, document.customHeightMm);

    // canvas.clear() が selection:cleared を発火して selectedInstanceIds を上書きする前に
    // この時点での選択IDをクロージャに捕捉する
    const capturedSelectedIds = selectedInstanceIds;

    let cancelled = false;

    const render = async () => {
      try {
        canvas.clear();
        canvas.backgroundColor = '#f1f5f9';

        const sx = cardPxWidth / 1000;
        const sy = cardPxHeight / 700;
        const su = Math.min(sx, sy);

        // 用紙背景
        canvas.add(new Rect({
          left: paperX, top: paperY,
          width: paperWidth, height: paperHeight,
          fill: '#ffffff',
          stroke: '#cbd5e1',
          strokeWidth: 1,
          selectable: false,
          evented: false,
        }));

        canvas.add(new Rect({
          left: paperX + PRINT_MARGIN_PX,
          top: paperY + PRINT_MARGIN_PX,
          width: Math.max(0, paperWidth - PRINT_MARGIN_PX * 2),
          height: Math.max(0, paperHeight - PRINT_MARGIN_PX * 2),
          fill: 'transparent',
          stroke: '#1d9bf0',
          strokeWidth: 2,
          strokeDashArray: [10, 7],
          selectable: false,
          evented: false,
        }));

        if (document.layoutMode) {
          // 面付けモード: インスタンス群を表示
          const gapXMm = document.layoutGapXMm ?? 0;
          const gapYMm = document.layoutGapYMm ?? 0;
          const showCardBorder = gapXMm > 0 || gapYMm > 0;

          for (const inst of document.instances) {
            if (cancelled) return;
            const instanceDocument = mergeInstanceDesign(document, inst.design);
            const objs = await drawCardObjects(instanceDocument, true, 0, 0, sx, sy, su);
            if (cancelled) return;
            const frame = createCardFrame(0, 0, cardPxWidth, cardPxHeight, showCardBorder);
            const group = new Group([frame, ...objs], {
              left: Math.round(inst.x),
              top: Math.round(inst.y),
              angle: inst.angle,
              selectable: true,
              hasControls: true,
              objectCaching: false,
            });
            // カードの内容がカード枠外へはみ出さないようにクリップ
            // frame.left/top はグループ化後にローカル座標（グループ中心起点）へ更新される
            group.clipPath = new Rect({
              left: frame.left,
              top: frame.top,
              width: cardPxWidth,
              height: cardPxHeight,
              absolutePositioned: false,
            });
            (group as CanvasObjectWithData).data = { instanceId: inst.id };
            canvas.add(group);
          }

          // トンボ描画
          if (document.showCropMarks && document.instances.length > 0) {
            const instanceGroups = document.instanceGroups || [];
            // getBoundingRect(absolute, calculate) の使い分け:
            //   absolute=false (デフォルト) → oCoords: ビューポート変換済み = スクリーン座標 ← バグの原因
            //   absolute=true              → aCoords: ビューポート変換なし = ワールド座標  ← 正しい
            // calculate=true で毎回強制再計算し、座標キャッシュの陳腐化を防ぐ
            const getAbsBoundingRect = (obj: CanvasObjectWithData) => {
              obj.setCoords(); // キャッシュを明示的に更新
              return (obj as any).getBoundingRect(true, true) as { left: number; top: number; width: number; height: number };
            };

            const allCanvasObjs = canvas.getObjects() as CanvasObjectWithData[];

            if (instanceGroups.length > 0) {
              // グループあり: 選択状態に依存せずグループデータから直接描画（安定性向上）
              const groupedIds = new Set(instanceGroups.flatMap((g) => g.instanceIds));

              for (const grp of instanceGroups) {
                let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
                const grpCardBounds: { left: number; top: number; right: number; bottom: number }[] = [];
                for (const id of grp.instanceIds) {
                  const obj = allCanvasObjs.find((o) => o.data?.instanceId === id);
                  if (!obj) continue;
                  const r = getAbsBoundingRect(obj);
                  gMinX = Math.min(gMinX, r.left);
                  gMinY = Math.min(gMinY, r.top);
                  gMaxX = Math.max(gMaxX, r.left + r.width);
                  gMaxY = Math.max(gMaxY, r.top + r.height);
                  grpCardBounds.push({ left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height });
                }
                if (isFinite(gMinX)) {
                  drawGroupCropMarks(
                    canvas,
                    { minX: gMinX, minY: gMinY, maxX: gMaxX, maxY: gMaxY },
                    grpCardBounds,
                  );
                }
              }

              // グループ外のインスタンスは選択ベース
              const ungroupedSelected = capturedSelectedIds.filter((id) => !groupedIds.has(id));
              if (ungroupedSelected.length > 0) {
                const ungroupedInsts = document.instances.filter((i) => ungroupedSelected.includes(i.id));
                if (ungroupedInsts.length > 0) {
                  drawCropMarksFromInstances(canvas, ungroupedInsts, cardPxWidth, cardPxHeight);
                }
              }
            } else {
              // グループなし: 選択インスタンスまたは自動グリッドトンボ
              const targetInstances = capturedSelectedIds.length > 0
                ? document.instances.filter((i) => capturedSelectedIds.includes(i.id))
                : null;

              if (targetInstances && targetInstances.length > 0) {
                drawCropMarksFromInstances(canvas, targetInstances, cardPxWidth, cardPxHeight);
              } else {
                // 選択なし：全インスタンスの自動グリッドトンボ
                const layout = computeAutoLayout(
                  document.paperSizeId,
                  document.cardSizeId,
                  document.customWidthMm,
                  document.customHeightMm,
                  gapXMm,
                  gapYMm,
                );
                const { finalW, finalH, finalCols, gapX, gapY, useRotated } = layout;
                const n = document.instances.length;
                const cols = Math.min(finalCols, n);
                const rows = Math.ceil(n / Math.max(1, finalCols));
                const firstInst = document.instances[0];
                const blockX = useRotated
                  ? Math.round(firstInst.x - finalW)
                  : Math.round(firstInst.x);
                const blockY = Math.round(firstInst.y);
                drawCropMarks(canvas, blockX, blockY, cols, rows, finalW, finalH, gapX, gapY);
              }
            }
          }
        } else {
          // デザイン編集モード: メインデザインを描画
          canvas.add(createCardFrame(cardX, cardY, cardPxWidth, cardPxHeight));
          const objects = await drawCardObjects(document, false, cardX, cardY, sx, sy, su);
          if (cancelled) return;
          if (objects && objects.length > 0) {
            canvas.add(...objects);
          }
        }

        if (!cancelled) {
          canvas.renderAll();
        }
      } catch (err) {
        console.error('キャンバス描画エラー:', err);
        if (!cancelled) canvas.renderAll();
      }
    };

    void render();
    return () => { cancelled = true; };
  }, [document]);

  // キーボードイベント (スペースキーでのパンニング・Deleteでの選択削除)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        setIsSpacePressed(true);
        if (e.target === window.document.body) e.preventDefault();
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const activeObj = canvas.getActiveObject() as CanvasObjectWithData | null;
        if (activeObj?.data?.instanceId) {
          onRemoveInstanceRef.current(activeObj.data.instanceId);
          canvas.discardActiveObject();
          canvas.requestRenderAll();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        const ids = selectedInstanceIdsRef.current;
        if (!e.shiftKey) {
          // Ctrl+G: グループ化
          if (ids.length >= 2) {
            onGroupInstancesRef.current(ids);
          }
        } else {
          // Shift+Ctrl+G: グループ化解除
          const doc = documentRef.current;
          const groups = doc.instanceGroups || [];
          const group = groups.find((g) => ids.some((id) => g.instanceIds.includes(id)));
          if (group) {
            onUngroupInstancesRef.current(group.id);
          }
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    // レイアウトモード以外ではインスタンス追加しない
    if (!document.layoutMode) return;

    const jsonData = e.dataTransfer.getData('application/json');
    const templateId = e.dataTransfer.getData('application/price-card-template') as TemplateId;
    const savedId = e.dataTransfer.getData('application/price-card-saved');
    const data = jsonData || (templateId ? JSON.stringify({ type: 'template', id: templateId }) : (savedId ? JSON.stringify({ type: 'saved', id: savedId }) : ''));
    if (!data) return;

    try {
      const payload = JSON.parse(data) as DropPayload | { type: 'saved'; id: string } | SavedDocument;
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const dropX = (e.clientX - rect.left + container.scrollLeft) / zoom;
      const dropY = (e.clientY - rect.top + container.scrollTop) / zoom;

      const { paperX, paperY, paperWidth, paperHeight, cardPxWidth, cardPxHeight } = getCardOrigin(
        document.paperSizeId,
        document.cardSizeId,
        document.customWidthMm,
        document.customHeightMm,
      );
      const position = clampCardToPrintableArea(
        dropX - cardPxWidth / 2,
        dropY - cardPxHeight / 2,
        cardPxWidth,
        cardPxHeight,
        paperX,
        paperY,
        paperWidth,
        paperHeight,
      );

      if ('type' in payload && payload.type === 'template') {
        onAddInstance(position.x, position.y, createTemplateDesign(document, payload.id));
      } else if ('type' in payload && payload.type === 'saved') {
        // ID参照：savedItemsから検索
        const savedItem = savedItems.find((i) => i.id === (payload as { type: 'saved'; id: string }).id);
        if (savedItem) {
          onAddInstance(position.x, position.y, savedItem.document);
        }
      } else if ('document' in payload) {
        onAddInstance(position.x, position.y, (payload as SavedDocument).document);
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* ツールバー */}
      <div className="flex h-12 items-center justify-between border-b border-[#cbd5e1] bg-white px-4 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 rounded-lg bg-[#f1f5f9] p-1">
            <button onClick={onZoomOut} className="rounded p-1 text-[#64748b] hover:bg-white hover:text-[#1e293b]" title="縮小">
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-12 text-center text-xs font-bold text-[#475569]">{Math.round(zoom * 100)}%</span>
            <button onClick={onZoomIn} className="rounded p-1 text-[#64748b] hover:bg-white hover:text-[#1e293b]" title="拡大">
              <Plus className="h-4 w-4" />
            </button>
            <button onClick={onZoomReset} className="ml-1 rounded p-1 text-[#64748b] hover:bg-white hover:text-[#1e293b]" title="リセット">
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          onClick={onToggleLayoutMode}
          className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
            document.layoutMode 
              ? 'bg-[#3b82f6] text-white shadow-md' 
              : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]'
          }`}
        >
          <Layout className="h-4 w-4" />
          {document.layoutMode ? 'デザイン編集へ戻る' : 'レイアウト（面付け）'}
        </button>
      </div>

      {/* キャンバスエリア */}
      <div
        ref={containerRef}
        onDragOver={handleContainerDragOver}
        onDrop={handleContainerDrop}
        className={`flex-1 overflow-auto bg-[#eef2f5] scrollbar-hide focus:outline-none ${
          isSpacePressed ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
      >
        <div className="grid min-h-full place-items-center px-8 py-16">
          <canvas ref={canvasElementRef} />
        </div>
      </div>

      {/* ステータスバー */}
      <div className="flex h-8 items-center justify-center border-t border-[#cbd5e1] bg-white px-4 text-[10px] font-bold text-[#64748b]">
        用紙: {document.paperSizeId} | カード: {document.cardSizeId} | {document.layoutMode ? 'レイアウトモード' : 'デザイン編集モード'}
      </div>
    </div>
  );
};
