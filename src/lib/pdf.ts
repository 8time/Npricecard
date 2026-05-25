import { PDFDocument, PDFPage, rgb } from 'pdf-lib';

const MM_TO_PT = 72 / 25.4;

const pageSizes = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  A3: { width: 297, height: 420 },
  B4: { width: 257, height: 364 },
  B5: { width: 182, height: 257 },
} as const;

export type PaperSize = keyof typeof pageSizes;

type ExportOptions = {
  imageDataUrl: string;
  paperSize?: PaperSize;
  cardWidthMm?: number;
  cardHeightMm?: number;
  showCropMarks?: boolean;
};

export const exportCardsPdf = async ({
  imageDataUrl,
  paperSize = 'A4',
  cardWidthMm = 90,
  cardHeightMm = 55,
  showCropMarks = false,
}: ExportOptions) => {
  const pdf = await PDFDocument.create();
  const paper = pageSizes[paperSize];
  const page = pdf.addPage([paper.width * MM_TO_PT, paper.height * MM_TO_PT]);
  const pngImage = await pdf.embedPng(imageDataUrl);

  const marginMm = 5;
  const cardWidthPt = cardWidthMm * MM_TO_PT;
  const cardHeightPt = cardHeightMm * MM_TO_PT;
  const marginPt = marginMm * MM_TO_PT;
  
  // 用紙の向きを常に横向きとして扱う（エディタの表示に合わせる）
  const pageWidth = Math.max(paper.width, paper.height) * MM_TO_PT;
  const pageHeight = Math.min(paper.width, paper.height) * MM_TO_PT;
  page.setSize(pageWidth, pageHeight);

  const maxColumns = Math.floor((pageWidth - marginPt * 2) / cardWidthPt);
  const maxRows = Math.floor((pageHeight - marginPt * 2) / cardHeightPt);

  for (let row = 0; row < maxRows; row += 1) {
    for (let column = 0; column < maxColumns; column += 1) {
      const x = marginPt + column * cardWidthPt;
      const y = pageHeight - marginPt - (row + 1) * cardHeightPt;
      page.drawImage(pngImage, { x, y, width: cardWidthPt, height: cardHeightPt });
      if (showCropMarks) {
        drawCropMarks(page, x, y, cardWidthPt, cardHeightPt);
      }
    }
  }

  return pdf.save();
};

const drawCropMarks = (
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const mark = 10;
  const color = rgb(0.2, 0.2, 0.2);
  const lines = [
    [x - mark, y, x - 2, y],
    [x, y - mark, x, y - 2],
    [x + width + 2, y, x + width + mark, y],
    [x + width, y - mark, x + width, y - 2],
    [x - mark, y + height, x - 2, y + height],
    [x, y + height + 2, x, y + height + mark],
    [x + width + 2, y + height, x + width + mark, y + height],
    [x + width, y + height + 2, x + width, y + height + mark],
  ] as const;

  lines.forEach(([x1, y1, x2, y2]) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.7, color });
  });
};
