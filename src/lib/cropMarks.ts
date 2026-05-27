import { Line, StaticCanvas } from 'fabric';
import { PX_PER_MM } from './canvasWorkspace';

type InstancePos = { x: number; y: number; angle: number };

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

/**
 * グループ全体のバウンディングボックスを囲む1組のトンボを描画する。
 * グループ化された複数インスタンスを1つのまとまりとして扱う場合に使用。
 */
export const drawCropMarksForGroup = (
  canvas: StaticCanvas,
  instances: InstancePos[],
  cardW: number,
  cardH: number,
  scale = 1,
) => {
  if (instances.length === 0) return;

  const getBounds = (inst: InstancePos) => {
    if (inst.angle === 90) {
      return { left: inst.x - cardH, top: inst.y, right: inst.x, bottom: inst.y + cardW };
    }
    return { left: inst.x, top: inst.y, right: inst.x + cardW, bottom: inst.y + cardH };
  };

  const bounds = instances.map(getBounds);
  const minX = Math.min(...bounds.map((b) => b.left));
  const minY = Math.min(...bounds.map((b) => b.top));
  const maxX = Math.max(...bounds.map((b) => b.right));
  const maxY = Math.max(...bounds.map((b) => b.bottom));

  drawCropMarks(canvas, minX, minY, 1, 1, maxX - minX, maxY - minY, 0, 0, scale);
};

/**
 * 選択されたインスタンスの実際の配置位置に基づいてトンボを描画する。
 * インスタンスのX・Y座標からグリッド構造を自動検出し drawCropMarks を呼ぶ。
 */
export const drawCropMarksFromInstances = (
  canvas: StaticCanvas,
  instances: InstancePos[],
  cardW: number,
  cardH: number,
  scale = 1,
) => {
  if (instances.length === 0) return;

  // angle=90 CCW 回転時: fabric の left=視覚的右端 なので視覚左端は x - cardH
  const getBounds = (inst: InstancePos) => {
    if (inst.angle === 90) {
      return { left: inst.x - cardH, top: inst.y, right: inst.x, bottom: inst.y + cardW };
    }
    return { left: inst.x, top: inst.y, right: inst.x + cardW, bottom: inst.y + cardH };
  };

  const bounds = instances.map(getBounds);

  // angle が混在する場合は各カードが異なるサイズに見える可能性があるため
  // 各 bound のサイズを個別に取得する
  const getEffSize = (b: ReturnType<typeof getBounds>) => ({
    w: b.right - b.left,
    h: b.bottom - b.top,
  });

  // 近い座標値をひとつのグループとして扱うクラスタリング
  const TOLERANCE = 3;
  const cluster = (vals: number[]) => {
    const sorted = [...vals].sort((a, b) => a - b);
    const result: number[] = [];
    for (const v of sorted) {
      if (!result.length || v - result[result.length - 1] > TOLERANCE) result.push(v);
    }
    return result;
  };

  const uniqueX = cluster(bounds.map((b) => b.left));
  const uniqueY = cluster(bounds.map((b) => b.top));
  const cols = uniqueX.length;
  const rows = uniqueY.length;

  if (cols * rows === instances.length && instances.length > 1) {
    // 整列グリッド: T マーク付きで一括描画
    const { w: effW, h: effH } = getEffSize(bounds[0]);
    const gapX = cols > 1 ? Math.max(0, uniqueX[1] - uniqueX[0] - effW) : 0;
    const gapY = rows > 1 ? Math.max(0, uniqueY[1] - uniqueY[0] - effH) : 0;
    drawCropMarks(canvas, uniqueX[0], uniqueY[0], cols, rows, effW, effH, gapX, gapY, scale);
  } else {
    // 非グリッド: カードごとに個別 L マーク
    for (let i = 0; i < bounds.length; i++) {
      const b = bounds[i];
      const { w: effW, h: effH } = getEffSize(b);
      drawCropMarks(canvas, b.left, b.top, 1, 1, effW, effH, 0, 0, scale);
    }
  }
};
