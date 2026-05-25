import { Line, StaticCanvas } from 'fabric';
import { PX_PER_MM } from './canvasWorkspace';

const BASE_LEN = Math.round(3 * PX_PER_MM);
const BASE_OFFSET = Math.round(1 * PX_PER_MM);
const BASE_BAR = Math.round(1.5 * PX_PER_MM);

/**
 * 全体トンボを描画する。
 * scale を指定するとマーク寸法が拡大されるので、高解像度エクスポート時は
 * blockX/Y/cardW/cardH/gapX/gapY もすべて同じ scale 倍した値を渡すこと。
 */
export const drawCropMarks = (
  canvas: StaticCanvas,
  blockX: number,
  blockY: number,
  cols: number,
  rows: number,
  cardW: number,
  cardH: number,
  gapX: number,
  gapY: number,
  scale = 1,
) => {
  const len = Math.round(BASE_LEN * scale);
  const offset = Math.round(BASE_OFFSET * scale);
  const bar = Math.round(BASE_BAR * scale);

  const blockW = cols * cardW + (cols - 1) * gapX;
  const blockH = rows * cardH + (rows - 1) * gapY;
  const style = { stroke: '#000000', strokeWidth: 0.75 * scale, selectable: false, evented: false };

  const addLine = (x1: number, y1: number, x2: number, y2: number) => {
    canvas.add(new Line([x1, y1, x2, y2], style));
  };

  // L marks at 4 corners
  const corners: { cx: number; cy: number; dx: -1 | 1; dy: -1 | 1 }[] = [
    { cx: blockX,          cy: blockY,          dx: -1, dy: -1 },
    { cx: blockX + blockW, cy: blockY,          dx:  1, dy: -1 },
    { cx: blockX,          cy: blockY + blockH, dx: -1, dy:  1 },
    { cx: blockX + blockW, cy: blockY + blockH, dx:  1, dy:  1 },
  ];
  for (const { cx, cy, dx, dy } of corners) {
    addLine(cx + dx * offset, cy, cx + dx * (offset + len), cy);
    addLine(cx, cy + dy * offset, cx, cy + dy * (offset + len));
  }

  // T marks at column boundaries (top & bottom of block)
  for (let c = 1; c < cols; c++) {
    const cutX = gapX > 0
      ? blockX + c * (cardW + gapX) - gapX / 2
      : blockX + c * cardW;
    addLine(cutX, blockY - offset - len, cutX, blockY - offset);
    addLine(cutX - bar, blockY - offset - len, cutX + bar, blockY - offset - len);
    addLine(cutX, blockY + blockH + offset, cutX, blockY + blockH + offset + len);
    addLine(cutX - bar, blockY + blockH + offset + len, cutX + bar, blockY + blockH + offset + len);
  }

  // T marks at row boundaries (left & right of block)
  for (let r = 1; r < rows; r++) {
    const cutY = gapY > 0
      ? blockY + r * (cardH + gapY) - gapY / 2
      : blockY + r * cardH;
    addLine(blockX - offset - len, cutY, blockX - offset, cutY);
    addLine(blockX - offset - len, cutY - bar, blockX - offset - len, cutY + bar);
    addLine(blockX + blockW + offset, cutY, blockX + blockW + offset + len, cutY);
    addLine(blockX + blockW + offset + len, cutY - bar, blockX + blockW + offset + len, cutY + bar);
  }
};
