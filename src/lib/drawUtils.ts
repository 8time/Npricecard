import { Rect, Textbox, Circle, FabricImage } from 'fabric';
import type { CardDocument, TextStyle } from '../types';
import { getTemplateById } from '../templates';

export const drawCardObjects = async (
  design: CardDocument,
  isPreview: boolean = false,
  cardX: number = 0,
  cardY: number = 0,
  sx: number = 1,
  sy: number = 1,
  su: number = 1
) => {
  const objects: any[] = [];
  const template = getTemplateById(design.templateId);
  const isBlankTemplate = design.templateId === 'blank';

  // ヘルパー: 税率ラベルの生成
  const formatTaxLabel = (doc: CardDocument) => {
    return doc.priceFlags.includeTax ? '税込' : '税抜';
  };

  // ヘルパー: Textbox生成
  const makeTextbox = (id: string, text: string, style: TextStyle) => {
    const layout = design.layout[id] || { left: 0, top: 0, scaleX: 1, scaleY: 1 };
    const meta = design.layerMeta?.[id] || { locked: false, hidden: false };
    const isLocked = meta.locked;

    return new Textbox(text, {
      ...style,
      fontSize: style.fontSize * su,
      fontFamily: design.fontFamily,
      left: (isPreview ? 0 : cardX) + layout.left * sx,
      top: (isPreview ? 0 : cardY) + layout.top * sy,
      scaleX: layout.scaleX,
      scaleY: layout.scaleY,
      angle: layout.angle ?? 0,
      charSpacing: layout.charSpacing ?? 0,
      originX: 'left',
      originY: 'top',
      centeredRotation: true,
      editable: false,
      hasControls: !isPreview && !isLocked,
      selectable: !isPreview && !isLocked,
      evented: !isPreview && !isLocked,
      lockMovementX: isLocked, lockMovementY: isLocked,
      lockScalingX: isLocked, lockScalingY: isLocked,
      lockRotation: isLocked,
      transparentCorners: false,
      cornerStyle: 'circle',
      borderColor: '#3b82f6', cornerColor: '#3b82f6',
      data: { objectId: id },
    });
  };

  const parts = new Map<string, any>();
  parts.set('productName', makeTextbox('productName', design.productName, template.productName));
  parts.set('taxLabel', makeTextbox('taxLabel', formatTaxLabel(design), template.taxLabel));
  
  // 価格
  const priceText = design.price;
  const fullPriceText = priceText + (design.priceFlags.showYen ? '円' : '');
  const priceLayout = design.layout.price || { left: 0, top: 0, scaleX: 1, scaleY: 1 };
  const metaPrice = design.layerMeta?.price || { locked: false, hidden: false };
  const isPriceLocked = metaPrice.locked;

  const priceTb = new Textbox(fullPriceText, {
    ...template.price,
    fontSize: template.price.fontSize * su,
    fontFamily: design.fontFamily,
    left: (isPreview ? 0 : cardX) + priceLayout.left * sx,
    top: (isPreview ? 0 : cardY) + priceLayout.top * sy,
    scaleX: priceLayout.scaleX,
    scaleY: priceLayout.scaleY,
    angle: priceLayout.angle ?? 0,
    charSpacing: priceLayout.charSpacing ?? 0,
    originX: 'left',
    originY: 'top',
    centeredRotation: true,
    stroke: design.priceFlags.hasStroke ? '#000000' : 'transparent',
    strokeWidth: design.priceFlags.hasStroke ? (design.priceFlags.strokeWidth || 8) * su : 0,
    paintFirst: 'stroke',
    editable: false,
    hasControls: !isPreview && !isPriceLocked,
    selectable: !isPreview && !isPriceLocked,
    evented: !isPreview && !isPriceLocked,
    lockMovementX: isPriceLocked, lockMovementY: isPriceLocked,
    lockScalingX: isPriceLocked, lockScalingY: isPriceLocked,
    lockRotation: isPriceLocked,
    transparentCorners: false,
    cornerStyle: 'circle',
    borderColor: '#3b82f6', cornerColor: '#3b82f6',
    data: { objectId: 'price' },
  });

  if (design.priceFlags.showYen && fullPriceText.endsWith('円')) {
    const yenIndex = priceText.length;
    const yenSize = (template.price.fontSize * (design.priceFlags.yenSizeScale || 0.5)) * su;
    priceTb.setSelectionStyles({ fontSize: yenSize }, yenIndex, yenIndex + 1);
  }
  parts.set('price', priceTb);
  parts.set('prText', makeTextbox('prText', design.prText, template.prText));

  design.customTextLayers?.forEach((l: any) => {
    parts.set(l.id, makeTextbox(l.id, l.text, l.style));
  });

  for (const imageLayer of (design.imageLayers || [])) {
    const il = design.layout[imageLayer.id] || imageLayer.layout;
    const meta = design.layerMeta?.[imageLayer.id] || { locked: false, hidden: false };
    if (meta.hidden) continue;
    const isLocked = meta.locked;
    let img: FabricImage;
    try {
      img = await FabricImage.fromURL(imageLayer.dataUrl, { crossOrigin: 'anonymous' });
    } catch (err) {
      console.warn('画像の読み込みに失敗しました:', imageLayer.id, err);
      continue;
    }
    img.set({
      left: (isPreview ? 0 : cardX) + il.left * sx,
      top: (isPreview ? 0 : cardY) + il.top * sy,
      scaleX: il.scaleX * sx,
      scaleY: il.scaleY * sy,
      angle: il.angle ?? -8,
      originX: 'left',
      originY: 'top',
      centeredRotation: true,
      selectable: !isPreview && !isLocked,
      evented: !isPreview && !isLocked,
      hasControls: !isPreview && !isLocked,
      lockMovementX: isLocked, lockMovementY: isLocked,
      lockScalingX: isLocked, lockScalingY: isLocked,
      lockRotation: isLocked,
      transparentCorners: false,
      cornerStyle: 'circle',
      borderColor: '#3b82f6', cornerColor: '#3b82f6',
      data: { objectId: imageLayer.id },
    });
    parts.set(imageLayer.id, img);
  }

  // 図形
  const shapeLayers = design.shapeLayers || [];
  const shapeMap = new Map<string, any>();
  for (const sl of shapeLayers) {
    const meta = design.layerMeta?.[sl.id] || { locked: false, hidden: false };
    if (meta.hidden) continue;
    const lo = design.layout[sl.id] || sl.layout;
    const w = sl.layout.width * sx;
    const h = sl.layout.height * sy;
    const common = {
      left: (isPreview ? 0 : cardX) + lo.left * sx,
      top: (isPreview ? 0 : cardY) + lo.top * sy,
      fill: sl.fill, stroke: sl.stroke, strokeWidth: sl.strokeWidth,
      opacity: sl.opacity,
      scaleX: lo.scaleX ?? 1, scaleY: lo.scaleY ?? 1,
      angle: lo.angle ?? 0,
      originX: 'left' as const,
      originY: 'top' as const,
      centeredRotation: true,
      selectable: !isPreview && !meta.locked,
      evented: !isPreview && !meta.locked,
      hasControls: !isPreview,
      transparentCorners: false,
      cornerStyle: 'circle' as const,
      data: { objectId: sl.id },
    };
    let shapeObj: any;
    if (sl.shapeType === 'circle') {
      shapeObj = new Circle({ ...common, radius: Math.min(w, h) / 2 });
    } else if (sl.shapeType === 'line' || sl.shapeType === 'arrow') {
      shapeObj = new Rect({ ...common, width: w, height: Math.max(sl.strokeWidth, 2) });
    } else {
      shapeObj = new Rect({ ...common, width: w, height: h, rx: sl.rx ?? 0, ry: sl.rx ?? 0 });
    }
    shapeMap.set(sl.id, shapeObj);
  }

  design.layerOrder.forEach((id: string) => {
    if (id === 'border') {
      if (!isPreview && isBlankTemplate) {
        const borderMeta = design.layerMeta?.['border'] || { locked: false, hidden: false };
        if (!borderMeta.hidden) {
          objects.push(new Rect({
            left: cardX,
            top: cardY,
            width: template.width * sx,
            height: template.height * sy,
            fill: 'transparent',
            stroke: '#94a3b8',
            strokeWidth: 1,
            selectable: false,
            evented: false,
            data: { objectId: 'border' },
          }));
        }
      }
      return;
    }
    if (id === 'taxLabel' && !design.priceFlags.showTaxLabel) return;
    const meta = design.layerMeta?.[id] || { locked: false, hidden: false };
    if (meta.hidden) return;
    const textObj = parts.get(id);
    const shapeObj = shapeMap.get(id);
    if (textObj) objects.push(textObj);
    if (shapeObj) objects.push(shapeObj);
  });

  if (!isBlankTemplate) {
    const X = isPreview ? 0 : cardX;
    const Y = isPreview ? 0 : cardY;
    const HEADER_H = 105;

    const bgObjects: any[] = [];

    // 背景
    bgObjects.push(new Rect({
      left: X, top: Y,
      width: template.width * sx, height: template.height * sy,
      fill: template.backgroundColor,
      rx: 16 * su, ry: 16 * su,
      selectable: false, evented: false,
    }));

    // ヘッダーバンド（上部角丸 + 下部フラット）
    bgObjects.push(new Rect({
      left: X, top: Y,
      width: template.width * sx, height: HEADER_H * sy,
      fill: template.accentColor,
      rx: 16 * su, ry: 16 * su,
      selectable: false, evented: false,
    }));
    bgObjects.push(new Rect({
      left: X, top: Y + (HEADER_H - 20) * sy,
      width: template.width * sx, height: 20 * sy,
      fill: template.accentColor,
      selectable: false, evented: false,
    }));

    objects.unshift(...bgObjects);

    // 内側ボーダー
    objects.push(new Rect({
      left: X + 24 * sx, top: Y + 24 * sy,
      width: (template.width - 48) * sx, height: (template.height - 48) * sy,
      fill: 'transparent',
      stroke: template.borderColor, strokeWidth: 8 * su,
      rx: 26 * su, ry: 26 * su,
      selectable: false, evented: false,
    }));

    // 店名テキスト（ヘッダー内、中央寄せ）
    objects.push(new Textbox(template.priceLabel, {
      left: X, top: Y + 29 * sy,
      width: template.width * sx,
      textAlign: 'center',
      fontSize: 48 * su,
      fontWeight: 'bold', fill: '#ffffff',
      selectable: false, evented: false,
    }));
  }

  return objects;
};
