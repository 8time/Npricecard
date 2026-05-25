export const WORKSPACE_PADDING = 200;

export const TEMPLATE_WIDTH = 1000;
export const TEMPLATE_HEIGHT = 700;

export const PAPER_MM_SIZES = {
  A3: { label: 'A3', width: 420, height: 297 },
  A4: { label: 'A4', width: 297, height: 210 },
  A5: { label: 'A5', width: 210, height: 148 },
  B4: { label: 'B4', width: 364, height: 257 },
  B5: { label: 'B5', width: 257, height: 182 },
} as const;

export const CARD_MM_SIZES = {
  A4: { label: 'A4', width: 297, height: 210 },
  A5: { label: 'A5', width: 210, height: 148 },
  A6: { label: 'A6', width: 148, height: 105 },
  B5: { label: 'B5', width: 257, height: 182 },
  B6: { label: 'B6', width: 182, height: 128 },
} as const;

export const PRINT_MARGIN_MM = 5;
export const LAYOUT_GAP_MM = 5;

// A4 landscape width = 1000px is the editor's base scale.
export const PX_PER_MM = TEMPLATE_WIDTH / PAPER_MM_SIZES.A4.width;
export const PRINT_MARGIN_PX = Math.round(PRINT_MARGIN_MM * PX_PER_MM);
export const LAYOUT_GAP_PX = Math.round(LAYOUT_GAP_MM * PX_PER_MM);

export const PAPER_SIZES = Object.fromEntries(
  Object.entries(PAPER_MM_SIZES).map(([id, size]) => [
    id,
    {
      label: size.label,
      width: Math.round(size.width * PX_PER_MM),
      height: Math.round(size.height * PX_PER_MM),
    },
  ]),
) as {
  [K in keyof typeof PAPER_MM_SIZES]: {
    label: (typeof PAPER_MM_SIZES)[K]['label'];
    width: number;
    height: number;
  };
};

export type PaperSizeId = keyof typeof PAPER_SIZES;

export const CARD_SIZES = Object.fromEntries(
  Object.entries(CARD_MM_SIZES).map(([id, size]) => [
    id,
    {
      label: size.label,
      width: Math.round(size.width * PX_PER_MM),
      height: Math.round(size.height * PX_PER_MM),
    },
  ]),
) as {
  [K in keyof typeof CARD_MM_SIZES]: {
    label: (typeof CARD_MM_SIZES)[K]['label'];
    width: number;
    height: number;
  };
};

export type CardSizeId = keyof typeof CARD_SIZES | 'custom';

export const getCardMmSize = (
  cardSizeId: CardSizeId,
  customWidthMm: number,
  customHeightMm: number,
) => {
  if (cardSizeId === 'custom') {
    return { width: customWidthMm, height: customHeightMm };
  }

  const size = CARD_MM_SIZES[cardSizeId as keyof typeof CARD_MM_SIZES];
  return { width: size.width, height: size.height };
};

export const getCardPxSize = (
  cardSizeId: CardSizeId,
  customWidthMm: number = PAPER_MM_SIZES.A4.width,
  customHeightMm: number = PAPER_MM_SIZES.A4.height,
) => {
  const size = getCardMmSize(cardSizeId, customWidthMm, customHeightMm);
  return {
    width: Math.round(size.width * PX_PER_MM),
    height: Math.round(size.height * PX_PER_MM),
  };
};

export const getCardOrigin = (
  paperSizeId: PaperSizeId,
  cardSizeId: CardSizeId,
  customWidthMm: number = PAPER_MM_SIZES.A4.width,
  customHeightMm: number = PAPER_MM_SIZES.A4.height,
) => {
  const paper = PAPER_SIZES[paperSizeId];
  const card = getCardPxSize(cardSizeId, customWidthMm, customHeightMm);
  const contentW = Math.max(paper.width, card.width);
  const contentH = Math.max(paper.height, card.height);

  return {
    cardX: WORKSPACE_PADDING + Math.round((contentW - card.width) / 2),
    cardY: WORKSPACE_PADDING + Math.round((contentH - card.height) / 2),
    paperX: WORKSPACE_PADDING + Math.round((contentW - paper.width) / 2),
    paperY: WORKSPACE_PADDING + Math.round((contentH - paper.height) / 2),
    cardPxWidth: card.width,
    cardPxHeight: card.height,
    paperWidth: paper.width,
    paperHeight: paper.height,
    canvasWidth: contentW + WORKSPACE_PADDING * 2,
    canvasHeight: contentH + WORKSPACE_PADDING * 2,
  };
};

export const getPrintableArea = (
  paperSizeId: PaperSizeId,
  cardSizeId: CardSizeId,
  customWidthMm: number = PAPER_MM_SIZES.A4.width,
  customHeightMm: number = PAPER_MM_SIZES.A4.height,
) => {
  const origin = getCardOrigin(paperSizeId, cardSizeId, customWidthMm, customHeightMm);
  return {
    x: origin.paperX + PRINT_MARGIN_PX,
    y: origin.paperY + PRINT_MARGIN_PX,
    width: Math.max(0, origin.paperWidth - PRINT_MARGIN_PX * 2),
    height: Math.max(0, origin.paperHeight - PRINT_MARGIN_PX * 2),
  };
};

// 自動面付けの配置計算（パネルの表示とストアの実処理で共有する単一の真実）
export const computeAutoLayout = (
  paperSizeId: PaperSizeId,
  cardSizeId: CardSizeId,
  customWidthMm: number = PAPER_MM_SIZES.A4.width,
  customHeightMm: number = PAPER_MM_SIZES.A4.height,
  gapXMm: number = 0,
  gapYMm: number = 0,
) => {
  const { paperX, paperY, paperWidth, paperHeight, cardPxWidth: cw, cardPxHeight: ch } =
    getCardOrigin(paperSizeId, cardSizeId, customWidthMm, customHeightMm);

  const margin = PRINT_MARGIN_PX;
  const gapX = Math.round(gapXMm * PX_PER_MM);
  const gapY = Math.round(gapYMm * PX_PER_MM);
  const printableWidth = Math.max(0, paperWidth - margin * 2);
  const printableHeight = Math.max(0, paperHeight - margin * 2);

  const colsNormal = Math.max(0, Math.floor((printableWidth + gapX) / (cw + gapX)));
  const rowsNormal = Math.max(0, Math.floor((printableHeight + gapY) / (ch + gapY)));
  const countNormal = colsNormal * rowsNormal;

  const colsRotated = Math.max(0, Math.floor((printableWidth + gapX) / (ch + gapX)));
  const rowsRotated = Math.max(0, Math.floor((printableHeight + gapY) / (cw + gapY)));
  const countRotated = colsRotated * rowsRotated;

  const useRotated = countRotated > countNormal;
  const finalW = useRotated ? ch : cw;
  const finalH = useRotated ? cw : ch;
  const finalCols = useRotated ? colsRotated : colsNormal;
  const finalRows = useRotated ? rowsRotated : rowsNormal;
  const finalAngle = useRotated ? 90 : 0;
  const maxPossible = Math.max(countNormal, countRotated);

  return {
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
    finalRows,
    finalAngle,
    useRotated,
    maxPossible,
  };
};
