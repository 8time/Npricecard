import { useEffect, useReducer, useState } from 'react';
import { DEFAULT_FONT_FAMILY } from '../lib/fonts';
import { loadDocuments, saveDocument } from '../lib/storage';
import { DEFAULT_LAYER_ORDER, getDefaultLayout, getDefaultImageLayout, getTemplateById } from '../templates';
import { computeAutoLayout } from '../lib/canvasWorkspace';
import type {
  CardDesign,
  CardDocument,
  CardSizeId,
  CustomTextObjectId,
  EditableObjectId,
  ImageLayer,
  ImageObjectId,
  ObjectLayout,
  PaperSizeId,
  SavedDocument,
  ShapeLayer,
  ShapeObjectId,
  TemplateId,
} from '../types';

type State = {
  document: CardDocument;
  savedItems: SavedDocument[];
  past: CardDocument[];
  future: CardDocument[];
};

type Action =
  | { type: 'setPaperSize'; paperSizeId: PaperSizeId }
  | { type: 'setCardSize'; cardSizeId: CardSizeId }
  | { type: 'setTemplate'; templateId: TemplateId }
  | { type: 'setField'; field: 'productName' | 'price' | 'prText'; value: string }
  | { type: 'setFontFamily'; fontFamily: string }
  | { type: 'setImage'; imageDataUrl: string | null }
  | { type: 'setLayout'; objectId: EditableObjectId; layout: ObjectLayout }
  | { type: 'moveLayer'; objectId: EditableObjectId; direction: 'up' | 'down' }
  | { type: 'sendLayerToBack'; objectId: EditableObjectId }
  | { type: 'addCustomText' }
  | { type: 'updateCustomText'; objectId: CustomTextObjectId; text: string }
  | { type: 'updateCustomTextStyle'; objectId: CustomTextObjectId; style: Partial<import('../types').TextStyle> }
  | { type: 'removeCustomText'; objectId: CustomTextObjectId }
  | { type: 'toggleFlag'; field: keyof CardDocument['priceFlags'] }
  | { type: 'setLayerOrder'; layerOrder: EditableObjectId[] }
  | { type: 'toggleLayerMeta'; objectId: string; field: 'locked' | 'hidden' }
  | { type: 'toggleCropMarks' }
  | { type: 'toggleLayoutMode' }
  | { type: 'toggleSnap' }
  | { type: 'setSnapGrid'; mm: number }
  | { type: 'addShape'; shape: ShapeLayer }
  | { type: 'updateShape'; id: ShapeObjectId; shape: Partial<ShapeLayer> }
  | { type: 'removeShape'; id: ShapeObjectId }
  | { type: 'addInstance'; x: number; y: number; design?: Partial<CardDesign> | CardDocument }
  | { type: 'removeInstance'; id: string }
  | { type: 'updateInstance'; id: string; x: number; y: number; angle: number }
  | { type: 'updateInstanceCropMarks'; id: string; showCropMarks: boolean }
  | { type: 'addImageLayer'; dataUrl: string }
  | { type: 'removeImageLayer'; id: ImageObjectId }
  | { type: 'setSavedItems'; items: SavedDocument[] }
  | { type: 'loadSavedDocument'; item: SavedDocument }
  | { type: 'setCustomDimensions'; widthMm: number; heightMm: number }
  | { type: 'updateInstanceDesign'; id: string; design: Partial<CardDesign> }
  | { type: 'autoLayout'; count: number }
  | { type: 'autoLayoutWithDesigns'; designs: CardDocument[]; count: number }
  | { type: 'clearInstances' }
  | { type: 'setLayoutGap'; xMm: number; yMm: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'setPriceFlag'; flag: string; value?: any };

const defaultTemplate = getTemplateById('blank');

const initialState: State = {
  document: {
    templateId: defaultTemplate.id,
    paperSizeId: 'A4',
    cardSizeId: 'custom',
    customWidthMm: 90,
    customHeightMm: 55,
    productName: defaultTemplate.productName.text,
    price: defaultTemplate.price.text,
    prText: defaultTemplate.prText.text,
    fontFamily: DEFAULT_FONT_FAMILY,
    imageDataUrl: null,
    imageLayers: [],
    layout: getDefaultLayout(defaultTemplate.id),
    customTextLayers: [],
    shapeLayers: [],
    layerOrder: [...DEFAULT_LAYER_ORDER],
    layerMeta: {},
    priceFlags: {
      includeTax: true,
      showTaxLabel: true,
      showYen: true,
      yenSizeScale: 0.5,
      hasStroke: false,
      strokeWidth: 8,
    },
    showCropMarks: false,
    layoutGapXMm: 0,
    layoutGapYMm: 0,
    snapEnabled: false,
    snapGridMm: 5,
    instances: [],
    layoutMode: false,
    mergeFields: [],
    quantity: 1,
  },
  savedItems: [],
  past: [],
  future: [],
};

const migrateDocument = (doc: CardDocument): CardDocument => {
  let imageLayers: ImageLayer[] = doc.imageLayers || [];
  let layerOrder: EditableObjectId[] = doc.layerOrder?.length ? doc.layerOrder : [...DEFAULT_LAYER_ORDER];
  let layout = doc.layout || {};
  let imageDataUrl = doc.imageDataUrl;

  // 旧 imageDataUrl を imageLayers へ移行
  if (imageDataUrl && imageLayers.length === 0) {
    const id = 'image:migrated' as ImageObjectId;
    const defaultLayout = doc.layout?.['image' as EditableObjectId] || getDefaultImageLayout(doc.templateId || 'blank');
    imageLayers = [{ id, name: '画像1', dataUrl: imageDataUrl, layout: defaultLayout }];
    layout = { ...layout, [id]: defaultLayout };
    layerOrder = layerOrder.map((oid) => ((oid as string) === 'image' ? id : oid)) as EditableObjectId[];
    if (!layerOrder.includes(id)) layerOrder = [id, ...layerOrder.filter((oid) => (oid as string) !== 'image')];
    imageDataUrl = null;
  } else {
    // 旧 'image' エントリをレイヤー順から除去
    layerOrder = layerOrder.filter((oid) => (oid as string) !== 'image') as EditableObjectId[];
  }

  // 旧ドキュメントに 'border' レイヤーがなければ先頭に追加
  if (!layerOrder.includes('border' as EditableObjectId)) {
    layerOrder = ['border' as EditableObjectId, ...layerOrder];
  }

  return {
    ...doc,
    paperSizeId: doc.paperSizeId || 'A4',
    cardSizeId: doc.cardSizeId || 'A4',
    customWidthMm: doc.customWidthMm || 210,
    customHeightMm: doc.customHeightMm || 148,
    showCropMarks: doc.showCropMarks ?? false,
    layoutGapXMm: doc.layoutGapXMm ?? 0,
    layoutGapYMm: doc.layoutGapYMm ?? 0,
    snapEnabled: doc.snapEnabled ?? false,
    snapGridMm: doc.snapGridMm ?? 5,
    instances: doc.instances || [],
    layoutMode: doc.layoutMode ?? false,
    fontFamily: doc.fontFamily || DEFAULT_FONT_FAMILY,
    customTextLayers: doc.customTextLayers || [],
    shapeLayers: doc.shapeLayers || [],
    layerOrder,
    layerMeta: doc.layerMeta || {},
    mergeFields: doc.mergeFields || [],
    imageLayers,
    imageDataUrl: imageDataUrl ?? null,
    layout,
  };
};

const moveLayer = (layerOrder: EditableObjectId[], objectId: EditableObjectId, direction: 'up' | 'down') => {
  const next = [...layerOrder];
  const index = next.indexOf(objectId);
  if (index === -1) return next;
  const targetIndex = direction === 'up' ? index + 1 : index - 1;
  if (targetIndex < 0 || targetIndex >= next.length) return next;
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
};

const cloneDesignSnapshot = (document: CardDocument | Partial<CardDesign>): CardDesign => {
  const design = { ...(document as Record<string, unknown>) };
  delete design.instances;
  delete design.layoutMode;
  delete design.paperSizeId;
  return JSON.parse(JSON.stringify(design)) as CardDesign;
};

const baseReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'setPaperSize':
      return { ...state, document: { ...state.document, paperSizeId: action.paperSizeId } };
    case 'setCardSize':
      return { ...state, document: { ...state.document, cardSizeId: action.cardSizeId } };
    case 'setTemplate': {
      const template = getTemplateById(action.templateId);
      if (action.templateId === 'blank') {
        return {
          ...state,
          document: {
            ...state.document,
            templateId: 'blank',
            productName: template.productName.text,
            price: template.price.text,
            prText: template.prText.text,
            layout: getDefaultLayout('blank'),
            customTextLayers: [],
            shapeLayers: [],
            imageLayers: [],
            imageDataUrl: null,
            layerOrder: [...DEFAULT_LAYER_ORDER],
            layerMeta: {},
            priceFlags: {
              includeTax: false,
              showTaxLabel: false,
              showYen: false,
              yenSizeScale: 0.5,
              hasStroke: false,
              strokeWidth: 8,
            },
          },
        };
      }
      const imgIds = state.document.imageLayers.map((l) => l.id);
      const imgLayouts = Object.fromEntries(imgIds.map((id) => [id, state.document.layout[id] || state.document.imageLayers.find((l) => l.id === id)!.layout]));
      return {
        ...state,
        document: {
          ...state.document,
          templateId: template.id,
          productName: template.productName.text,
          price: template.price.text,
          prText: template.prText.text,
          layout: { ...getDefaultLayout(template.id), ...imgLayouts },
          customTextLayers: [],
          imageLayers: state.document.imageLayers,
          layerOrder: [...imgIds, ...DEFAULT_LAYER_ORDER],
        },
      };
    }
    case 'setField':
      return { ...state, document: { ...state.document, [action.field]: action.value } };
    case 'setFontFamily':
      return { ...state, document: { ...state.document, fontFamily: action.fontFamily } };
    case 'setImage': {
      if (!action.imageDataUrl) return state;
      const imgCount = state.document.imageLayers.length + 1;
      const newImgId = `image:${Date.now()}` as ImageObjectId;
      const newImgLayout = getDefaultImageLayout(state.document.templateId);
      const newImgLayer: ImageLayer = {
        id: newImgId,
        name: `画像${imgCount}`,
        dataUrl: action.imageDataUrl,
        layout: newImgLayout,
      };
      return {
        ...state,
        document: {
          ...state.document,
          imageDataUrl: null,
          imageLayers: [...state.document.imageLayers, newImgLayer],
          layout: { ...state.document.layout, [newImgId]: newImgLayout },
          layerOrder: [newImgId, ...state.document.layerOrder],
        },
      };
    }
    case 'addImageLayer': {
      const imgCount = state.document.imageLayers.length + 1;
      const newImgId = `image:${Date.now()}` as ImageObjectId;
      const newImgLayout = getDefaultImageLayout(state.document.templateId);
      const newImgLayer: ImageLayer = {
        id: newImgId,
        name: `画像${imgCount}`,
        dataUrl: action.dataUrl,
        layout: newImgLayout,
      };
      return {
        ...state,
        document: {
          ...state.document,
          imageLayers: [...state.document.imageLayers, newImgLayer],
          layout: { ...state.document.layout, [newImgId]: newImgLayout },
          layerOrder: [newImgId, ...state.document.layerOrder],
        },
      };
    }
    case 'removeImageLayer':
      return {
        ...state,
        document: {
          ...state.document,
          imageLayers: state.document.imageLayers.filter((l) => l.id !== action.id),
          layerOrder: state.document.layerOrder.filter((oid) => oid !== action.id),
        },
      };
    case 'setLayout':
      return {
        ...state,
        document: {
          ...state.document,
          layout: { ...state.document.layout, [action.objectId]: action.layout },
        },
      };
    case 'moveLayer':
      return {
        ...state,
        document: {
          ...state.document,
          layerOrder: moveLayer(state.document.layerOrder, action.objectId, action.direction),
        },
      };
    case 'sendLayerToBack':
      return {
        ...state,
        document: {
          ...state.document,
          layerOrder: [action.objectId, ...state.document.layerOrder.filter((id) => id !== action.objectId)],
        },
      };
    case 'addCustomText': {
      const number = state.document.customTextLayers.length + 2;
      const id: CustomTextObjectId = `customText:${Date.now()}`;
      return {
        ...state,
        document: {
          ...state.document,
          customTextLayers: [
            ...state.document.customTextLayers,
            {
              id,
              name: `文字${number}`,
              text: `文字${number}`,
              style: {
                fill: '#111827',
                fontSize: 72,
                fontWeight: 'bold',
                stroke: 'transparent',
                strokeWidth: 0,
                left: 120,
                top: 170 + state.document.customTextLayers.length * 40,
              },
            },
          ],
          layout: {
            ...state.document.layout,
            [id]: { left: 120, top: 170 + state.document.customTextLayers.length * 40, scaleX: 1, scaleY: 1 },
          },
          layerOrder: [...state.document.layerOrder, id],
        },
      };
    }
    case 'updateCustomText':
      return {
        ...state,
        document: {
          ...state.document,
          customTextLayers: state.document.customTextLayers.map((layer) =>
            layer.id === action.objectId ? { ...layer, text: action.text } : layer,
          ),
        },
      };
    case 'updateCustomTextStyle':
      return {
        ...state,
        document: {
          ...state.document,
          customTextLayers: state.document.customTextLayers.map((layer) =>
            layer.id === action.objectId ? { ...layer, style: { ...layer.style, ...action.style } } : layer,
          ),
        },
      };
    case 'removeCustomText':
      return {
        ...state,
        document: {
          ...state.document,
          customTextLayers: state.document.customTextLayers.filter((l) => l.id !== action.objectId),
          layerOrder: state.document.layerOrder.filter((id) => id !== action.objectId),
        },
      };
    case 'setPriceFlag': {
      const { flag, value } = action as { type: 'setPriceFlag'; flag: string; value?: any };
      const currentVal = state.document.priceFlags[flag as keyof typeof state.document.priceFlags];
      return {
        ...state,
        document: {
          ...state.document,
          priceFlags: {
            ...state.document.priceFlags,
            [flag]: value !== undefined ? value : !currentVal,
          },
        },
      };
    }
    case 'setLayerOrder':
      return { ...state, document: { ...state.document, layerOrder: action.layerOrder } };
    case 'toggleLayerMeta': {
      const current = state.document.layerMeta[action.objectId] || { locked: false, hidden: false };
      return {
        ...state,
        document: {
          ...state.document,
          layerMeta: {
            ...state.document.layerMeta,
            [action.objectId]: { ...current, [action.field]: !current[action.field] },
          },
        },
      };
    }
    case 'setSavedItems':
      return { ...state, savedItems: action.items };
    case 'loadSavedDocument':
      return { ...state, document: migrateDocument(action.item.document) };
    case 'setCustomDimensions':
      return {
        ...state,
        document: {
          ...state.document,
          cardSizeId: 'custom',
          customWidthMm: action.widthMm,
          customHeightMm: action.heightMm,
        },
      };
    case 'toggleCropMarks':
      return { ...state, document: { ...state.document, showCropMarks: !state.document.showCropMarks } };
    case 'toggleLayoutMode':
      return { ...state, document: { ...state.document, layoutMode: !state.document.layoutMode } };
    case 'toggleSnap':
      return { ...state, document: { ...state.document, snapEnabled: !state.document.snapEnabled } };
    case 'setSnapGrid':
      return { ...state, document: { ...state.document, snapGridMm: action.mm } };
    case 'addShape': {
      const shapeId = action.shape.id;
      return {
        ...state,
        document: {
          ...state.document,
          shapeLayers: [...state.document.shapeLayers, action.shape],
          layout: {
            ...state.document.layout,
            [shapeId]: {
              left: action.shape.layout.left,
              top: action.shape.layout.top,
              scaleX: action.shape.layout.scaleX,
              scaleY: action.shape.layout.scaleY,
              angle: action.shape.layout.angle,
            },
          },
          layerOrder: [...state.document.layerOrder, shapeId],
        },
      };
    }
    case 'updateShape':
      return {
        ...state,
        document: {
          ...state.document,
          shapeLayers: state.document.shapeLayers.map((s) =>
            s.id === action.id ? { ...s, ...action.shape } : s
          ),
        },
      };
    case 'removeShape':
      return {
        ...state,
        document: {
          ...state.document,
          shapeLayers: state.document.shapeLayers.filter((s) => s.id !== action.id),
          layerOrder: state.document.layerOrder.filter((id) => id !== action.id),
        },
      };
    case 'addInstance': {
      const designToUse = action.design
        ? cloneDesignSnapshot({ ...state.document, ...action.design })
        : cloneDesignSnapshot(state.document);

      // ドロップしたデザインのカードサイズをメインドキュメントに反映（右パネルでリサイズできるよう）
      const incomingCardSizeId = action.design?.cardSizeId;
      const cardSizeId = incomingCardSizeId ?? state.document.cardSizeId;
      const customWidthMm = action.design?.customWidthMm ?? state.document.customWidthMm;
      const customHeightMm = action.design?.customHeightMm ?? state.document.customHeightMm;

      return {
        ...state,
        document: {
          ...state.document,
          cardSizeId,
          customWidthMm,
          customHeightMm,
          instances: [
            ...state.document.instances,
            {
              id: `inst-${Date.now()}`,
              x: action.x,
              y: action.y,
              angle: 0,
              design: designToUse,
              showCropMarks: state.document.showCropMarks,
            },
          ],
        },
      };
    }
    case 'removeInstance':
      return {
        ...state,
        document: {
          ...state.document,
          instances: state.document.instances.filter((i) => i.id !== action.id),
        },
      };
    case 'updateInstance':
      return {
        ...state,
        document: {
          ...state.document,
          instances: state.document.instances.map((i) =>
            i.id === action.id ? { ...i, x: action.x, y: action.y, angle: action.angle } : i
          ),
        },
      };
    case 'updateInstanceCropMarks':
      return {
        ...state,
        document: {
          ...state.document,
          instances: state.document.instances.map((i) =>
            i.id === action.id ? { ...i, showCropMarks: action.showCropMarks } : i
          ),
        },
      };
    case 'updateInstanceDesign':
      return {
        ...state,
        document: {
          ...state.document,
          instances: state.document.instances.map((i) =>
            i.id === action.id ? { ...i, design: { ...i.design, ...action.design } } : i
          ),
        },
      };
    case 'clearInstances':
      return {
        ...state,
        document: { ...state.document, instances: [] },
      };
    case 'autoLayout': {
      const {
        paperX,
        paperY,
        margin,
        gapX,
        gapY,
        printableWidth,
        printableHeight,
        finalW,
        finalH,
        finalCols,
        finalAngle,
        useRotated,
        maxPossible,
      } = computeAutoLayout(
        state.document.paperSizeId,
        state.document.cardSizeId,
        state.document.customWidthMm,
        state.document.customHeightMm,
        state.document.layoutGapXMm ?? 0,
        state.document.layoutGapYMm ?? 0,
      );

      if (maxPossible <= 0 || finalCols <= 0) {
        return state;
      }

      const targetCount = Math.min(action.count, maxPossible);

      const actualCols = Math.min(targetCount, finalCols);
      const actualRows = Math.ceil(targetCount / finalCols);

      const totalW = actualCols * finalW + (actualCols - 1) * gapX;
      const totalH = actualRows * finalH + (actualRows - 1) * gapY;
      const startX = Math.round(paperX + margin + (printableWidth - totalW) / 2);
      const startY = Math.round(paperY + margin + (printableHeight - totalH) / 2);

      const designSnapshot: CardDesign = cloneDesignSnapshot(state.document);

      const newInstances = [];
      let count = 0;
      for (let r = 0; r < actualRows && count < targetCount; r++) {
        for (let c = 0; c < finalCols && count < targetCount; c++) {
          const cellX = startX + c * (finalW + gapX);
          const cellY = startY + r * (finalH + gapY);
          newInstances.push({
            id: `inst-${Date.now()}-${count}`,
            x: useRotated ? cellX + finalW : cellX,
            y: cellY,
            angle: finalAngle,
            design: designSnapshot,
            showCropMarks: state.document.showCropMarks,
          });
          count++;
        }
      }
      return {
        ...state,
        document: { ...state.document, instances: newInstances },
      };
    }
    case 'autoLayoutWithDesigns': {
      const {
        paperX, paperY, margin, gapX, gapY,
        printableWidth, printableHeight,
        finalW, finalH, finalCols, finalAngle, useRotated, maxPossible,
      } = computeAutoLayout(
        state.document.paperSizeId,
        state.document.cardSizeId,
        state.document.customWidthMm,
        state.document.customHeightMm,
        state.document.layoutGapXMm ?? 0,
        state.document.layoutGapYMm ?? 0,
      );
      if (maxPossible <= 0 || finalCols <= 0 || action.designs.length === 0) return state;

      const targetCount = Math.min(action.count, maxPossible);
      const actualCols = Math.min(targetCount, finalCols);
      const actualRows = Math.ceil(targetCount / finalCols);
      const totalW = actualCols * finalW + (actualCols - 1) * gapX;
      const totalH = actualRows * finalH + (actualRows - 1) * gapY;
      const startX = Math.round(paperX + margin + (printableWidth - totalW) / 2);
      const startY = Math.round(paperY + margin + (printableHeight - totalH) / 2);

      const newInstances = [];
      let placed = 0;
      for (let r = 0; r < actualRows && placed < targetCount; r++) {
        for (let c = 0; c < finalCols && placed < targetCount; c++) {
          const src = action.designs[placed % action.designs.length];
          const design = cloneDesignSnapshot(src);
          const cellX = startX + c * (finalW + gapX);
          const cellY = startY + r * (finalH + gapY);
          newInstances.push({
            id: `inst-${Date.now()}-${placed}`,
            x: useRotated ? cellX + finalW : cellX,
            y: cellY,
            angle: finalAngle,
            design,
            showCropMarks: state.document.showCropMarks,
          });
          placed++;
        }
      }
      return { ...state, document: { ...state.document, instances: newInstances } };
    }
    case 'setLayoutGap':
      return {
        ...state,
        document: {
          ...state.document,
          layoutGapXMm: action.xMm,
          layoutGapYMm: action.yMm,
        },
      };
    default:
      return state;
  }
};

const reducer = (state: State, action: Action): State => {
  if (action.type === 'undo') {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, state.past.length - 1);
    return {
      ...state,
      document: previous,
      past: newPast,
      future: [state.document, ...state.future],
    };
  }

  if (action.type === 'redo') {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    const newFuture = state.future.slice(1);
    return {
      ...state,
      document: next,
      past: [...state.past, state.document],
      future: newFuture,
    };
  }

  const newState = baseReducer(state, action);

  // ドキュメントの内容に変化があった場合のみ履歴に保存
  if (newState.document !== state.document && action.type !== 'setSavedItems' && action.type !== 'loadSavedDocument') {
    return {
      ...newState,
      past: [...state.past, state.document].slice(-50), // 最大50件
      future: [],
    };
  }

  return newState;
};

export const usePriceCardStore = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [isStorageReady, setIsStorageReady] = useState(false);

  useEffect(() => {
    loadDocuments()
      .then((items) => dispatch({ type: 'setSavedItems', items }))
      .finally(() => setIsStorageReady(true));
  }, []);

  const persistCurrentDocument = async (thumbnail?: string) => {
    const timestamp = Date.now();
    const item: SavedDocument = {
      id: `card-${timestamp}`,
      name: `${state.document.productName || '値札'}-${new Date(timestamp).toLocaleTimeString('ja-JP')}`,
      updatedAt: timestamp,
      document: state.document,
      thumbnail,
    };
    await saveDocument(item);
    const items = await loadDocuments();
    dispatch({ type: 'setSavedItems', items });
  };

  const deleteSavedItem = async (id: string) => {
    const { deleteDocument, loadDocuments: ld } = await import('../lib/storage');
    await deleteDocument(id);
    const items = await ld();
    dispatch({ type: 'setSavedItems', items });
  };

  return { state, dispatch, isStorageReady, persistCurrentDocument, deleteSavedItem };
};
