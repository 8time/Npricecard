import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  initSaveFolder,
  isFileSystemAccessSupported,
  loadDocumentsFromFs,
  saveDocumentToFs,
  deleteDocumentFromFs,
  selectSaveFolder,
} from './lib/storageFs';
import { Canvas, Group, Rect, StaticCanvas } from 'fabric';
import { CanvasStage } from './components/CanvasStage';
import { EditorPanel } from './components/EditorPanel';
import { TemplateSidebar } from './components/TemplateSidebar';
import { LayerPanel } from './components/LayerPanel';
import { ShapeToolbar } from './components/ShapeToolbar';
import { QrPanel } from './components/QrPanel';
import { AlignmentTools } from './components/AlignmentTools';
import { MergeFieldPanel } from './components/MergeFieldPanel';
import { getCardOrigin, getCardMmSize, PAPER_MM_SIZES, computeAutoLayout } from './lib/canvasWorkspace';
import type { PaperSizeId, CardSizeId } from './lib/canvasWorkspace';
import { drawCropMarks } from './lib/cropMarks';
import { DEFAULT_FONT_FAMILY, loadBundledFonts, loadUploadedFonts, saveUploadedFont, SYSTEM_FONTS } from './lib/fonts';
import { usePriceCardStore } from './hooks/usePriceCardStore';
import { LayoutSettingsPanel } from './components/LayoutSettingsPanel';
import { exportCardsPdf } from './lib/pdf';
import { drawCardObjects } from './lib/drawUtils';
import type {
  AppStep,
  CardDocument,
  EditableObjectId,
  FontOption,
  ImageObjectId,
  MergeField,
  ObjectLayout,
  PriceFlags,
  ShapeLayer,
} from './types';

const generateCardThumbnail = async (doc: CardDocument): Promise<string> => {
  const { cardPxWidth, cardPxHeight } = getCardOrigin(
    doc.paperSizeId,
    doc.cardSizeId,
    doc.customWidthMm,
    doc.customHeightMm,
  );
  const el = document.createElement('canvas');
  el.width = cardPxWidth;
  el.height = cardPxHeight;
  const fc = new StaticCanvas(el, { enableRetinaScaling: false });
  const sx = cardPxWidth / 1000;
  const sy = cardPxHeight / 700;
  const su = Math.min(sx, sy);
  const objects = await drawCardObjects(doc, true, 0, 0, sx, sy, su);
  fc.add(...objects);
  fc.renderAll();
  const thumbnail = fc.toDataURL({
    format: 'png',
    multiplier: 200 / Math.max(cardPxWidth, cardPxHeight),
  });
  fc.dispose();
  el.remove();
  return thumbnail;
};

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.05;

// ステップ定義
const STEPS: { id: AppStep; label: string; icon: string }[] = [
  { id: 'design', label: 'デザイン編集', icon: '✏️' },
  { id: 'layout', label: 'レイアウト', icon: '📐' },
];

// 左サイドバーツール定義
const SIDE_TOOLS = [
  { id: 'templates', label: 'テンプレ', icon: '▱' },
  { id: 'layers', label: 'レイヤー', icon: '▰' },
  { id: 'shapes', label: '図形', icon: '⬛' },
  { id: 'qr', label: 'QR', icon: '⊞' },
  { id: 'merge', label: '差込', icon: '⊕' },
  { id: 'align', label: '整列', icon: '⇌' },
];

const App = () => {
  const { state, dispatch, deleteSavedItem } = usePriceCardStore();
  const canvasRef = useRef<Canvas | null>(null);
  const [fonts, setFonts] = useState<FontOption[]>(SYSTEM_FONTS);
  const [zoom, setZoom] = useState(0.65);
  const [notice, setNotice] = useState('準備完了');
  const [activeSideTool, setActiveSideTool] = useState<string>('templates');
  const [currentStep, setCurrentStep] = useState<AppStep>('design');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const [saveFolderName, setSaveFolderName] = useState<string | null>(null);
  const [designQueue, setDesignQueue] = useState<import('./types').SavedDocument[]>([]);

  const layoutMode = currentStep === 'layout';
  const documentForCanvas = useMemo(
    () => ({ ...state.document, layoutMode }),
    [state.document, layoutMode],
  );

  useEffect(() => {
    const loadFonts = async () => {
      const [bundledFonts, uploadedFonts] = await Promise.all([loadBundledFonts(), loadUploadedFonts()]);
      setFonts([...SYSTEM_FONTS, ...bundledFonts, ...uploadedFonts]);
    };
    void loadFonts();
  }, []);

  // 初回起動時: preset-designs.json のデザインを自動インポート
  useEffect(() => {
    const IMPORT_KEY = 'presetDesignsImported';
    if (localStorage.getItem(IMPORT_KEY)) return;

    const run = async () => {
      try {
        const res = await fetch('/preset-designs.json', { cache: 'no-cache' });
        if (!res.ok) return;
        const items = (await res.json()) as import('./types').SavedDocument[];
        if (!Array.isArray(items) || items.length === 0) {
          localStorage.setItem(IMPORT_KEY, '1');
          return;
        }
        const { saveDocument, loadDocuments: ld } = await import('./lib/storage');
        for (const item of items) {
          if (!item.thumbnail) {
            try { item.thumbnail = await generateCardThumbnail(item.document); } catch { /* 無視 */ }
          }
          await saveDocument(item);
        }
        const loaded = await ld();
        dispatch({ type: 'setSavedItems', items: loaded });
        localStorage.setItem(IMPORT_KEY, '1');
        setNotice(`${items.length}件のデザインをプリセットとして読み込みました`);
      } catch {
        // ファイルがない・壊れている場合は静かに無視
      }
    };

    void run();
  }, []);

  // 起動時: 以前選んだ保存フォルダを復元
  useEffect(() => {
    const init = async () => {
      const handle = await initSaveFolder();
      if (handle) {
        dirHandleRef.current = handle;
        setSaveFolderName(handle.name);
        const items = await loadDocumentsFromFs(handle);
        dispatch({ type: 'setSavedItems', items });

        // サムネイルがないアイテムを非同期でサムネイル生成して保存
        const missing = items.filter((item) => !item.thumbnail);
        if (missing.length > 0) {
          for (const item of missing) {
            try {
              const thumbnail = await generateCardThumbnail(item.document);
              await saveDocumentToFs(handle, { ...item, thumbnail });
            } catch {
              // 生成失敗は無視
            }
          }
          const updated = await loadDocumentsFromFs(handle);
          dispatch({ type: 'setSavedItems', items: updated });
        }
      }
    };
    void init();
  }, []);

  // レイアウトモードへ切替時、用紙全体が画面に収まるズームへ自動調整
  useEffect(() => {
    if (currentStep !== 'layout') return;

    const { canvasWidth, canvasHeight } = getCardOrigin(
      state.document.paperSizeId,
      state.document.cardSizeId,
      state.document.customWidthMm,
      state.document.customHeightMm,
    );

    // 固定レイアウト幅: 左ナビ56 + 左パネル208 + 右パネル320
    // 固定レイアウト高: ヘッダー56 + キャンバスツールバー48 + ステータスバー32
    const availableWidth = window.innerWidth - 96 - 384 - 384 - 32;
    const availableHeight = window.innerHeight - 56 - 48 - 32 - 32;

    const fitZoom = Math.min(availableWidth / canvasWidth, availableHeight / canvasHeight);
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom)));
  }, [currentStep, state.document.paperSizeId, state.document.cardSizeId, state.document.customWidthMm, state.document.customHeightMm]);

  const handleCanvasReady = useCallback((canvas: Canvas) => {
    canvasRef.current = canvas;
  }, []);

  const handleObjectLayoutChange = useCallback(
    (objectId: EditableObjectId, layout: ObjectLayout) => {
      dispatch({ type: 'setLayout', objectId, layout });
      setNotice('保存中...');
    },
    [dispatch],
  );

  const handleUploadImage = async (file: File | null) => {
    if (!file) return;
    const imageDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    dispatch({ type: 'setImage', imageDataUrl });
    setNotice('保存中...');
  };

  const handleUploadFont = async (file: File | null) => {
    if (!file) return;
    const font = await saveUploadedFont(file);
    setFonts((current) => [...current.filter((item) => item.family !== font.family), font]);
    dispatch({ type: 'setFontFamily', fontFamily: font.family });
    setNotice('フォント追加完了');
  };

  // QRコードを画像として挿入
  const handleInsertQr = (dataUrl: string, _value: string) => {
    dispatch({ type: 'setImage', imageDataUrl: dataUrl });
    setNotice('QRコードを挿入しました');
  };

  // ---- キーボードショートカット (Undo / Redo) --------------------------------------
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 入力フィールドにフォーカスがある場合はスキップ
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            dispatch({ type: 'redo' });
          } else {
            dispatch({ type: 'undo' });
          }
        } else if (e.key === 'y') {
          e.preventDefault();
          dispatch({ type: 'redo' });
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [dispatch]);

  const handleExportPdf = async () => {
    const { cardPxWidth, cardPxHeight, paperX, paperY, paperWidth, paperHeight } = getCardOrigin(
      state.document.paperSizeId,
      state.document.cardSizeId,
      state.document.customWidthMm,
      state.document.customHeightMm,
    );
    const { width: cardWidthMm, height: cardHeightMm } = getCardMmSize(
      state.document.cardSizeId,
      state.document.customWidthMm,
      state.document.customHeightMm,
    );

    setNotice('PDF生成中...');

    const MULT = 3;

    // ---- オフスクリーン StaticCanvas に再描画して dataUrl を取得 ----
    // ズームや青破線など UI 要素を含まない純粋な印刷用画像を生成する。
    let dataUrl: string;

    if (layoutMode) {
      // 用紙全体サイズのキャンバスに全インスタンスを描画
      const sx = (cardPxWidth / 1000) * MULT;
      const sy = (cardPxHeight / 700) * MULT;
      const su = Math.min(sx, sy);

      const el = document.createElement('canvas');
      el.width = Math.round(paperWidth * MULT);
      el.height = Math.round(paperHeight * MULT);
      const fc = new StaticCanvas(el, { enableRetinaScaling: false });
      fc.backgroundColor = '#ffffff';

      for (const inst of state.document.instances) {
        const instanceDoc: CardDocument = {
          ...state.document,
          ...inst.design,
          paperSizeId: state.document.paperSizeId,
          instances: [],
          layoutMode: false,
        };
        const objs = await drawCardObjects(instanceDoc, true, 0, 0, sx, sy, su);
        const frame = new Rect({
          left: 0,
          top: 0,
          width: cardPxWidth * MULT,
          height: cardPxHeight * MULT,
          fill: '#ffffff',
          selectable: false,
          evented: false,
        });
        const group = new Group([frame, ...objs], {
          left: (inst.x - paperX) * MULT,
          top: (inst.y - paperY) * MULT,
          angle: inst.angle,
          selectable: false,
          evented: false,
        });
        fc.add(group);
      }

      // 全体トンボ
      if (state.document.showCropMarks && state.document.instances.length > 0) {
        const gapXMm = state.document.layoutGapXMm ?? 0;
        const gapYMm = state.document.layoutGapYMm ?? 0;
        const layout = computeAutoLayout(
          state.document.paperSizeId,
          state.document.cardSizeId,
          state.document.customWidthMm,
          state.document.customHeightMm,
          gapXMm,
          gapYMm,
        );
        const { finalW, finalH, finalCols, gapX, gapY, useRotated } = layout;
        const n = state.document.instances.length;
        const cols = Math.min(finalCols, n);
        const rows = Math.ceil(n / Math.max(1, finalCols));
        // 実際のインスタンス位置を基準にトンボを配置（手動配置にも対応）
        // angle=90 CCW 回転時: left=visual_right なので blockX = inst.x - finalW
        const firstInst = state.document.instances[0];
        const instRelX = firstInst.x - paperX;
        const instRelY = firstInst.y - paperY;
        const blockX = useRotated
          ? (instRelX - finalW) * MULT
          : instRelX * MULT;
        const blockY = instRelY * MULT;
        drawCropMarks(fc, blockX, blockY, cols, rows, finalW * MULT, finalH * MULT, gapX * MULT, gapY * MULT, MULT);
      }

      fc.renderAll();
      dataUrl = fc.toDataURL({ format: 'png', multiplier: 1 });
      fc.dispose();
    } else {
      // カードサイズのキャンバスに1枚描画
      const sx = (cardPxWidth / 1000) * MULT;
      const sy = (cardPxHeight / 700) * MULT;
      const su = Math.min(sx, sy);

      const el = document.createElement('canvas');
      el.width = Math.round(cardPxWidth * MULT);
      el.height = Math.round(cardPxHeight * MULT);
      const fc = new StaticCanvas(el, { enableRetinaScaling: false });
      fc.backgroundColor = '#ffffff';

      const objects = await drawCardObjects(state.document, true, 0, 0, sx, sy, su);
      if (objects.length > 0) fc.add(...objects);
      fc.renderAll();
      dataUrl = fc.toDataURL({ format: 'png', multiplier: 1 });
      fc.dispose();
    }

    // ---- PDF 生成 ----
    let bytes: ArrayBuffer;
    const MM_TO_PT = 72 / 25.4;
    const hasMergeFields = state.document.mergeFields.some((f) => f.values.length > 0);

    if (!layoutMode && hasMergeFields) {
      const maxCount = Math.max(...state.document.mergeFields.map((f) => f.values.length));
      const { PDFDocument } = await import('pdf-lib');
      const pdf = await PDFDocument.create();
      for (let i = 0; i < maxCount; i++) {
        const pngImage = await pdf.embedPng(dataUrl);
        const page = pdf.addPage([cardWidthMm * MM_TO_PT, cardHeightMm * MM_TO_PT]);
        page.drawImage(pngImage, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
      }
      bytes = (await pdf.save()) as unknown as ArrayBuffer;
    } else if (layoutMode) {
      const { PDFDocument } = await import('pdf-lib');
      const pdf = await PDFDocument.create();
      const { width: paperWidthMm, height: paperHeightMm } = PAPER_MM_SIZES[state.document.paperSizeId];
      const page = pdf.addPage([paperWidthMm * MM_TO_PT, paperHeightMm * MM_TO_PT]);
      const pngImage = await pdf.embedPng(dataUrl);
      page.drawImage(pngImage, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
      bytes = (await pdf.save()) as unknown as ArrayBuffer;
    } else {
      bytes = (await exportCardsPdf({
        imageDataUrl: dataUrl,
        paperSize: state.document.paperSizeId as any,
        cardWidthMm,
        cardHeightMm,
        showCropMarks: state.document.showCropMarks,
      })) as unknown as ArrayBuffer;
    }

    const pdfBytes = new Uint8Array(bytes.byteLength);
    pdfBytes.set(new Uint8Array(bytes));
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${state.document.productName || 'price-card'}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice('PDF出力完了');
  };

  const handleSelectSaveFolder = async () => {
    const handle = await selectSaveFolder();
    if (!handle) return;
    dirHandleRef.current = handle;
    setSaveFolderName(handle.name);
    const items = await loadDocumentsFromFs(handle);
    dispatch({ type: 'setSavedItems', items });
    setNotice(`保存先: ${handle.name}`);
  };

  const handleSave = async () => {
    if (!dirHandleRef.current) {
      // フォルダ未選択なら先に選んでもらう
      const handle = await selectSaveFolder();
      if (!handle) return;
      dirHandleRef.current = handle;
      setSaveFolderName(handle.name);
    }

    const thumbnail = await generateCardThumbnail(state.document);

    const timestamp = Date.now();
    const item = {
      id: `card-${timestamp}`,
      name: `${state.document.productName || '値札'}-${new Date(timestamp).toLocaleTimeString('ja-JP')}`,
      updatedAt: timestamp,
      document: state.document,
      thumbnail,
    };

    await saveDocumentToFs(dirHandleRef.current, item);
    const items = await loadDocumentsFromFs(dirHandleRef.current);
    dispatch({ type: 'setSavedItems', items });
    setNotice('保存完了');
  };

  const handleExportDesigns = () => {
    const json = JSON.stringify(state.savedItems, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `price-card-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice('バックアップを書き出しました');
  };

  const handleImportDesigns = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      // 配列（書出ボタン形式）でも単体オブジェクト（FSフォルダ個別ファイル）でも受け付ける
      const items = (Array.isArray(parsed) ? parsed : [parsed]) as import('./types').SavedDocument[];
      if (items.length === 0 || typeof items[0] !== 'object') throw new Error('invalid format');
      const { saveDocument, loadDocuments: ld } = await import('./lib/storage');
      for (const item of items) {
        // id がない場合は生成（古い形式・FS個別ファイル対応）
        if (!item.id) {
          item.id = `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }
        if (!item.thumbnail) {
          try {
            item.thumbnail = await generateCardThumbnail(item.document);
          } catch {
            // サムネイル生成失敗は無視
          }
        }
        await saveDocument(item);
      }
      const loaded = await ld();
      dispatch({ type: 'setSavedItems', items: loaded });
      setNotice(`${items.length}件のデザインを読み込みました`);
    } catch (err) {
      console.error('[import]', err);
      const msg = err instanceof Error ? err.message : String(err);
      setNotice(`読み込み失敗: ${msg}`);
    }
  };

  const handleSelectTemplate = useCallback(
    (templateId: import('./types').TemplateId) => {
      dispatch({ type: 'setTemplate', templateId });
      setCurrentStep('design');
      setSelectedInstanceIds([]);
      setSelectedInstanceId(null);
      setNotice('テンプレートを適用しました');
    },
    [dispatch],
  );

  // 右パネルの内容
  const renderRightPanel = () => {
    if (currentStep === 'layout') {
      return (
        <LayoutSettingsPanel
          document={state.document}
          savedItems={state.savedItems}
          designQueue={designQueue}
          onPaperSizeChange={(id) => dispatch({ type: 'setPaperSize', paperSizeId: id })}
          onCardSizeChange={(id) => dispatch({ type: 'setCardSize', cardSizeId: id })}
          onCustomDimensionsChange={(widthMm, heightMm) =>
            dispatch({ type: 'setCustomDimensions', widthMm, heightMm })
          }
          onAutoLayout={(count) => dispatch({ type: 'autoLayout', count })}
          onClearInstances={() => dispatch({ type: 'clearInstances' })}
          onCenterInstances={() => dispatch({ type: 'centerInstances' })}
          onToggleSnap={() => dispatch({ type: 'toggleSnap' })}
          onToggleCropMarks={() => dispatch({ type: 'toggleCropMarks' })}
          onSetLayoutGap={(xMm, yMm) => dispatch({ type: 'setLayoutGap', xMm, yMm })}
          onAddCurrentToQueue={() => {
            const timestamp = Date.now();
            setDesignQueue((q) => [...q, {
              id: `queue-${timestamp}`,
              name: state.document.productName || '現在のデザイン',
              updatedAt: timestamp,
              document: state.document,
            }]);
          }}
          onAddSavedToQueue={(item) => setDesignQueue((q) => [...q, item])}
          onRemoveFromQueue={(index) => setDesignQueue((q) => q.filter((_, i) => i !== index))}
          onClearQueue={() => setDesignQueue([])}
          onAutoLayoutWithDesigns={(count) => {
            dispatch({ type: 'autoLayoutWithDesigns', designs: designQueue.map((q) => q.document), count });
            setNotice(`${Math.min(count, state.document.instances.length || count)}枚配置しました`);
          }}
          onAddInstance={() => {
            const { paperX, paperY, paperWidth, paperHeight, cardPxWidth, cardPxHeight } = getCardOrigin(
              state.document.paperSizeId,
              state.document.cardSizeId,
              state.document.customWidthMm,
              state.document.customHeightMm
            );
            dispatch({
              type: 'addInstance',
              x: paperX + (paperWidth - cardPxWidth) / 2,
              y: paperY + (paperHeight - cardPxHeight) / 2,
            });
          }}
        />
      );
    }

    const selectedInst = selectedInstanceId ? state.document.instances.find(i => i.id === selectedInstanceId) : null;
    const currentDesign = selectedInst ? (selectedInst.design as any) : state.document;

    return (
      <EditorPanel
        document={currentDesign}
        fonts={fonts}
        layerOrder={currentDesign.layerOrder || state.document.layerOrder}
        customTextLayers={currentDesign.customTextLayers || []}
        onChangeField={(field, value) => {
          if (selectedInstanceId) {
            dispatch({ type: 'updateInstanceDesign', id: selectedInstanceId, design: { [field]: value } });
          } else {
            dispatch({ type: 'setField', field, value });
          }
          setNotice('保存中...');
        }}
        onChangeProductNameColor={(color) => {
          if (selectedInstanceId) {
            dispatch({ type: 'updateInstanceDesign', id: selectedInstanceId, design: { productNameColor: color } });
          } else {
            dispatch({ type: 'setProductNameColor', color });
          }
          setNotice('保存中...');
        }}
        onChangePriceColor={(color) => {
          if (selectedInstanceId) {
            dispatch({ type: 'updateInstanceDesign', id: selectedInstanceId, design: { priceColor: color } });
          } else {
            dispatch({ type: 'setPriceColor', color });
          }
          setNotice('保存中...');
        }}
        onChangePrTextColor={(color) => {
          if (selectedInstanceId) {
            dispatch({ type: 'updateInstanceDesign', id: selectedInstanceId, design: { prTextColor: color } });
          } else {
            dispatch({ type: 'setPrTextColor', color });
          }
          setNotice('保存中...');
        }}
        onCardSizeChange={(cardSizeId) => {
          if (selectedInstanceId) {
            dispatch({ type: 'updateInstanceDesign', id: selectedInstanceId, design: { cardSizeId } });
          } else {
            dispatch({ type: 'setCardSize', cardSizeId });
          }
          setNotice('保存中...');
        }}
        onCustomDimensionsChange={(customWidthMm, customHeightMm) => {
          if (selectedInstanceId) {
            dispatch({
              type: 'updateInstanceDesign',
              id: selectedInstanceId,
              design: { cardSizeId: 'custom', customWidthMm, customHeightMm },
            });
          } else {
            dispatch({ type: 'setCustomDimensions', widthMm: customWidthMm, heightMm: customHeightMm });
          }
          setNotice('保存中...');
        }}
        onAddTextLayer={() => {
          dispatch({ type: 'addCustomText' });
          setNotice('保存中...');
        }}
        onChangeCustomText={(objectId, text) => {
          dispatch({ type: 'updateCustomText', objectId, text });
          setNotice('保存中...');
        }}
        onMoveLayer={(objectId, direction) => {
          dispatch({ type: 'moveLayer', objectId, direction });
          setNotice('保存中...');
        }}
        onSendLayerToBack={(objectId) => {
          dispatch({ type: 'sendLayerToBack', objectId });
          setNotice('保存中...');
        }}
        onReorderLayers={(layerOrder) => {
          dispatch({ type: 'setLayerOrder', layerOrder });
          setNotice('保存中...');
        }}
        onChangeFont={(fontFamily) => {
          const font = fontFamily || DEFAULT_FONT_FAMILY;
          if (selectedInstanceId) {
            dispatch({ type: 'updateInstanceDesign', id: selectedInstanceId, design: { fontFamily: font } });
          } else {
            dispatch({ type: 'setFontFamily', fontFamily: font });
          }
          setNotice('保存中...');
        }}
        onUploadFont={handleUploadFont}
        onChangePriceFlag={(field, value) => {
          if (selectedInstanceId) {
            const nextFlags = { 
              ...currentDesign.priceFlags, 
              [field]: value !== undefined ? value : !currentDesign.priceFlags[field as keyof PriceFlags] 
            };
            dispatch({ type: 'updateInstanceDesign', id: selectedInstanceId, design: { priceFlags: nextFlags } });
          } else {
            dispatch({ type: 'setPriceFlag', flag: field, value });
          }
          setNotice('保存中...');
        }}
        onUploadImage={handleUploadImage}
        onRemoveImageLayer={(id: ImageObjectId) => {
          dispatch({ type: 'removeImageLayer', id });
          setNotice('保存中...');
        }}
        onToggleLayerMeta={(objectId, field) => {
          dispatch({ type: 'toggleLayerMeta', objectId, field });
          setNotice('保存中...');
        }}
        onUpdateLayout={(objectId, layout) => {
          if (selectedInstanceId) {
            const nextLayout = { ...currentDesign.layout, [objectId]: { ...currentDesign.layout[objectId], ...layout } };
            dispatch({ type: 'updateInstanceDesign', id: selectedInstanceId, design: { layout: nextLayout } });
          } else {
            dispatch({ type: 'setLayout', objectId, layout: { ...state.document.layout[objectId], ...layout } });
          }
          setNotice('保存中...');
        }}
      />
    );
  };

  // 左サイドパネルのコンテンツ
  const renderSidePanel = () => {
    switch (activeSideTool) {
      case 'templates':
        return (
          <TemplateSidebar
            activeTemplateId={state.document.templateId}
            savedItems={state.savedItems}
            onSelectTemplate={handleSelectTemplate}
            onLoadSaved={(item) => {
              dispatch({ type: 'loadSavedDocument', item });
              setNotice('読み込み完了');
            }}
            onDeleteSaved={async (id) => {
              if (dirHandleRef.current) {
                await deleteDocumentFromFs(dirHandleRef.current, id);
                const items = await loadDocumentsFromFs(dirHandleRef.current);
                dispatch({ type: 'setSavedItems', items });
              } else {
                void deleteSavedItem(id);
              }
              setNotice('削除完了');
            }}
            onExport={handleExportDesigns}
            onImport={handleImportDesigns}
          />
        );
      case 'layers':
        return (
          <LayerPanel
            document={state.document}
            selectedObjectId={selectedObjectId}
            onSelectObject={setSelectedObjectId}
            onToggleLayerMeta={(objectId, field) => {
              dispatch({ type: 'toggleLayerMeta', objectId, field });
            }}
            onMoveLayer={(objectId, direction) => {
              dispatch({ type: 'moveLayer', objectId, direction });
            }}
            onRemoveCustomText={(objectId) => {
              dispatch({ type: 'removeCustomText', objectId });
            }}
            onRemoveShape={(id) => {
              dispatch({ type: 'removeShape', id });
            }}
            onRemoveImageLayer={(id: ImageObjectId) => {
              dispatch({ type: 'removeImageLayer', id });
            }}
          />
        );
      case 'shapes':
        return (
          <div className="p-3">
            <ShapeToolbar
              onAddShape={(shape: ShapeLayer) => {
                dispatch({ type: 'addShape', shape });
                setNotice('図形を追加');
              }}
            />
          </div>
        );
      case 'qr':
        return (
          <div className="p-3">
            <QrPanel onInsertQr={handleInsertQr} />
          </div>
        );
      case 'merge':
        return (
          <div className="p-3">
            <MergeFieldPanel
              document={state.document}
              onUpdateMergeFields={(fields: MergeField[]) => {
                // mergeFields は CardDocument 拡張が必要なため仮実装
                console.log('merge fields updated', fields);
              }}
            />
          </div>
        );
      case 'align': {
        const { cardPxWidth: aw, cardPxHeight: ah } = getCardOrigin(
          state.document.paperSizeId,
          state.document.cardSizeId,
          state.document.customWidthMm,
          state.document.customHeightMm,
        );
        return (
          <div className="p-3">
            <AlignmentTools
              instances={state.document.instances}
              selectedInstanceIds={selectedInstanceIds}
              cardPxWidth={aw}
              cardPxHeight={ah}
              layoutMode={layoutMode}
              onUpdateInstances={(updates) =>
                dispatch({ type: 'batchUpdateInstances', updates })
              }
            />
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="h-screen min-w-[1380px] overflow-hidden bg-[#eef2f5] text-[#111827]" style={{ fontFamily: "'Inter', 'Noto Sans JP', sans-serif" }}>
      {/* ヘッダー */}
      <header className="flex h-14 items-center justify-between border-b border-[#2a3a4f] bg-[#0f1724] px-4 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#10b981] text-sm font-black">P</div>
          <h1 className="text-sm font-black tracking-wide">Price Card Editor</h1>
        </div>

        {/* ステップナビゲーション */}
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => {
            const isActive = currentStep === step.id;
            const isDone = STEPS.findIndex((s) => s.id === currentStep) > i;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStep(step.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? 'bg-[#10b981] text-white shadow-lg'
                    : isDone
                    ? 'bg-[#0d5c42] text-[#6ee7b7]'
                    : 'text-[#8896a5] hover:text-white'
                }`}
              >
                <span>{step.icon}</span>
                <span>{step.label}</span>
                {i < STEPS.length - 1 && <span className="ml-1 text-[#374151]">›</span>}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#49b184]">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-[#3bb37f] text-[9px] text-[#0f1724]">✓</span>
            {notice}
          </div>
          {isFileSystemAccessSupported() && (
            <button
              type="button"
              onClick={handleSelectSaveFolder}
              title="保存先フォルダを選択"
              className="flex h-8 items-center gap-1.5 rounded-md border border-white/20 px-3 text-xs font-bold text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              📁 {saveFolderName ?? '保存先未設定'}
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="h-8 rounded-md border border-white/20 px-4 text-xs font-bold text-white transition hover:bg-white/10"
          >
            💾 保存
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="h-8 rounded-md bg-[#10b981] px-4 text-xs font-bold text-white shadow transition hover:bg-[#059669]"
          >
            🖨️ PDF出力
          </button>
        </div>
      </header>

      <main className="flex h-[calc(100vh-56px)] overflow-hidden">
        {/* 左アイコンナビ */}
        <nav className="flex w-24 shrink-0 flex-col border-r border-[#d9e0e6] bg-white pt-2">
          {SIDE_TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              title={tool.label}
              onClick={() => setActiveSideTool(tool.id)}
              className={`flex h-[72px] w-full flex-col items-center justify-center gap-1.5 border-l-2 transition ${
                activeSideTool === tool.id
                  ? 'border-[#10b981] bg-[#f0fdf8] text-[#10b981]'
                  : 'border-transparent text-[#94a3b8] hover:bg-[#f8fafc] hover:text-[#374151]'
              }`}
            >
              <span className="text-3xl leading-none">{tool.icon}</span>
              <span className="text-xs font-bold">{tool.label}</span>
            </button>
          ))}
        </nav>

        {/* 左サイドパネル */}
        <aside className="flex w-96 shrink-0 flex-col overflow-hidden border-r border-[#d9e0e6] bg-white">
          <div className="flex-1 overflow-y-auto">
            {renderSidePanel()}
          </div>
          {/* スナップ設定 */}
          <div className="border-t border-[#d9e0e6] bg-[#f8fafc] px-3 py-2">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-[#374151] cursor-pointer">
              <input
                type="checkbox"
                checked={state.document.snapEnabled}
                onChange={() => dispatch({ type: 'toggleSnap' })}
                className="h-3 w-3"
              />
              スナップ ON
            </label>
            {state.document.snapEnabled && (
              <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                <span className="text-[#6b7280]">グリッド</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={state.document.snapGridMm}
                  onChange={(e) => dispatch({ type: 'setSnapGrid', mm: Number(e.target.value) })}
                  className="w-12 rounded border border-[#d9e0e6] px-1 py-0.5 text-center text-[10px]"
                />
                <span className="text-[#6b7280]">mm</span>
              </div>
            )}
          </div>
        </aside>

        {/* キャンバス */}
        <CanvasStage
          document={documentForCanvas}
          zoom={zoom}
          savedItems={state.savedItems}
          selectedInstanceIds={selectedInstanceIds}
          onCanvasReady={handleCanvasReady}
          onZoomIn={() => setZoom((c) => Math.min(MAX_ZOOM, Number((c + ZOOM_STEP).toFixed(2))))}
          onZoomOut={() => setZoom((c) => Math.max(MIN_ZOOM, Number((c - ZOOM_STEP).toFixed(2))))}
          onZoomReset={() => setZoom(0.35)}
          onObjectLayoutChange={handleObjectLayoutChange}
          onPaperSizeChange={(paperSizeId: PaperSizeId) => {
            dispatch({ type: 'setPaperSize', paperSizeId });
            setNotice('保存中...');
          }}
          onCardSizeChange={(cardSizeId: CardSizeId) => {
            if (selectedInstanceId) {
              dispatch({ type: 'updateInstanceDesign', id: selectedInstanceId, design: { cardSizeId } });
            } else {
              dispatch({ type: 'setCardSize', cardSizeId });
            }
            setNotice('保存中...');
          }}
          onCustomDimensionsChange={(w, h) => {
            if (selectedInstanceId) {
              dispatch({ type: 'updateInstanceDesign', id: selectedInstanceId, design: { customWidthMm: w, customHeightMm: h } });
            } else {
              dispatch({ type: 'setCustomDimensions', widthMm: w, heightMm: h });
            }
            setNotice('保存中...');
          }}
          onToggleLayoutMode={() => {
            setCurrentStep(layoutMode ? 'design' : 'layout');
          }}
          onAddInstance={(x, y, design) => dispatch({ type: 'addInstance', x, y, design })}
          onRemoveInstance={(id) => dispatch({ type: 'removeInstance', id })}
          onUpdateInstance={(id, x, y, angle) => dispatch({ type: 'updateInstance', id, x, y, angle })}
          onUpdateInstanceCropMarks={(id, showCropMarks) =>
            dispatch({ type: 'updateInstanceCropMarks', id, showCropMarks })
          }
          onSelectionChange={(objId, instId) => {
            setSelectedObjectId(objId);
            setSelectedInstanceId(instId);
          }}
          onMultiSelectionChange={(ids) => {
            setSelectedInstanceIds(ids);
            if (ids.length > 0) setSelectedInstanceId(ids[0]);
          }}
          onGroupInstances={(instanceIds) => dispatch({ type: 'groupInstances', instanceIds })}
          onUngroupInstances={(groupId) => dispatch({ type: 'ungroupInstances', groupId })}
        />

        {/* 右パネル（デザイン編集・レイアウトの両方で表示） */}
        {(currentStep === 'design' || currentStep === 'layout') && (
          <aside className="flex w-96 shrink-0 flex-col overflow-hidden border-l border-[#d9e0e6] bg-white">
            <div className="flex-1 overflow-y-auto">
              {renderRightPanel()}
            </div>
          </aside>
        )}

      </main>
    </div>
  );
};

export default App;
