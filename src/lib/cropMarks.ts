import { Line, StaticCanvas } from 'fabric';
import { PX_PER_MM } from './canvasWorkspace';

type InstancePos = { x: number; y: number; angle: number };

const BASE_LEN = Math.round(3 * PX_PER_MM);
const BASE_OFFSET = Math.round(1 * PX_PER_MM);
const BASE_BAR = Math.round(1.5 * PX_PER_MM);
const CLUSTER_TOLERANCE = 3;
// カード辺座標のマージに使う許容誤差（浮動小数点ズレ + getBoundingRect の微誤差を吸収）
const EDGE_CLUSTER_TOLERANCE = 8;

// 近い座標値を同一グループとみなすクラスタリング（最初の値を代表値として採用）
const cluster = (vals: number[]): number[] => {
  const sorted = [...vals].sort((a, b) => a - b);
  const result: number[] = [];
  for (const v of sorted) {
    if (!result.length || v - result[result.length - 1] > CLUSTER_TOLERANCE) result.push(v);
  }
  return result;
};

// 許容誤差内の値を1グループとして平均値で統合するクラスタリング
// 隣接カードの辺座標（浮動小数点誤差あり）を確実に1本に統合するために使用
const clusterMean = (vals: number[], tolerance: number): number[] => {
  const sorted = [...vals].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const result: number[] = [];
  let sum = sorted[0];
  let count = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] <= tolerance) {
      sum += sorted[i];
      count++;
    } else {
      result.push(sum / count);
      sum = sorted[i];
      count = 1;
    }
  }
  result.push(sum / count);
  return result;
};

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
 * グループ化されたカード群に対してトンボを描画する。
 * 外周4コーナーの L マークに加え、内側カード境界の中間トンボ（1本線）を描画する。
 *
 * 中間トンボはグループのバウンディングボックスの外側にのみ描画し、
 * 印刷エリア内には一切線を引かない。
 *
 * groupBounds: グループ全体のバウンディングボックス（ワールド座標）
 * cardBounds:  グループ内各カードの個別バウンディングボックス（ワールド座標）
 */
export const drawGroupCropMarks = (
  canvas: StaticCanvas,
  groupBounds: { minX: number; minY: number; maxX: number; maxY: number },
  cardBounds: Array<{ left: number; top: number; right: number; bottom: number }>,
  scale = 1,
) => {
  const { minX, minY, maxX, maxY } = groupBounds;

  // 外周4コーナーの L マーク
  drawCropMarks(canvas, minX, minY, 1, 1, maxX - minX, maxY - minY, 0, 0, scale);

  if (cardBounds.length < 2) return;

  const len = Math.round(BASE_LEN * scale);
  const offset = Math.round(BASE_OFFSET * scale);
  const style = { stroke: '#000000', strokeWidth: 0.75 * scale, selectable: false, evented: false };

  const addLine = (x1: number, y1: number, x2: number, y2: number) => {
    canvas.add(new Line([x1, y1, x2, y2], style));
  };

  // 各カードの左端・右端を収集し、EDGE_CLUSTER_TOLERANCE で統合して内側境界を抽出
  // clusterMean を使うことで隣接カードの辺の浮動小数点誤差（数px程度）を確実に1値にまとめる
  const allX = cardBounds.flatMap((b) => [b.left, b.right]);
  const interiorX = clusterMean(allX, EDGE_CLUSTER_TOLERANCE).filter(
    (x) => x > minX + EDGE_CLUSTER_TOLERANCE && x < maxX - EDGE_CLUSTER_TOLERANCE,
  );

  // 各カードの上端・下端を収集し、同様に統合して内側境界を抽出
  const allY = cardBounds.flatMap((b) => [b.top, b.bottom]);
  const interiorY = clusterMean(allY, EDGE_CLUSTER_TOLERANCE).filter(
    (y) => y > minY + EDGE_CLUSTER_TOLERANCE && y < maxY - EDGE_CLUSTER_TOLERANCE,
  );

  // 縦カット線（内側 X）→ グループ上端・下端の外側に短い縦の直線1本ずつ
  // 線はグループ外側にのみ向かって引く（内側には絶対に入らない）
  for (const cutX of interiorX) {
    // 上側: minY から offset 離れた外側を起点に、さらに上（len）へ
    addLine(cutX, minY - offset, cutX, minY - offset - len);
    // 下側: maxY から offset 離れた外側を起点に、さらに下（len）へ
    addLine(cutX, maxY + offset, cutX, maxY + offset + len);
  }

  // 横カット線（内側 Y）→ グループ左端・右端の外側に短い横の直線1本ずつ
  // 線はグループ外側にのみ向かって引く（内側には絶対に入らない）
  for (const cutY of interiorY) {
    // 左側: minX から offset 離れた外側を起点に、さらに左（len）へ
    addLine(minX - offset, cutY, minX - offset - len, cutY);
    // 右側: maxX から offset 離れた外側を起点に、さらに右（len）へ
    addLine(maxX + offset, cutY, maxX + offset + len, cutY);
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

  drawGroupCropMarks(canvas, { minX, minY, maxX, maxY }, bounds, scale);
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
