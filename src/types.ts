export type TemplateId = 'blank';
export type PaperSizeId = 'A3' | 'A4' | 'A5' | 'B4' | 'B5';
export type CardSizeId = 'A4' | 'A5' | 'A6' | 'B5' | 'B6' | 'custom';
export type BuiltInObjectId = 'productName' | 'taxLabel' | 'price' | 'prText' | 'border';
export type CustomTextObjectId = `customText:${string}`;
export type ShapeObjectId = `shape:${string}`;
export type ImageObjectId = `image:${string}`;
export type EditableObjectId = BuiltInObjectId | CustomTextObjectId | ShapeObjectId | ImageObjectId;

// アプリのメインステップ
export type AppStep = 'design' | 'layout';

export type TextStyle = {
  fill: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  stroke: string;
  strokeWidth: number;
  left: number;
  top: number;
};

export type ObjectLayout = {
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  angle?: number;
  charSpacing?: number;
};

export type CardTemplate = {
  id: TemplateId;
  name: string;
  themeNote: string;
  width: number;
  height: number;
  backgroundColor: string;
  accentColor: string;
  borderColor: string;
  priceLabel: string;
  productName: TextStyle & { text: string };
  taxLabel: TextStyle & { text: string };
  price: TextStyle & { text: string };
  prText: TextStyle & { text: string };
  imageLayout: ObjectLayout;
};

export type PriceFlags = {
  includeTax: boolean;
  showTaxLabel: boolean;
  showYen: boolean;
  yenSizeScale: number;
  hasStroke: boolean;
  strokeWidth: number;
};

export type CardLayout = Record<string, ObjectLayout>;

export type CustomTextLayer = {
  id: CustomTextObjectId;
  name: string;
  text: string;
  style: TextStyle;
};

// 図形レイヤー
export type ShapeType = 'rect' | 'circle' | 'line' | 'arrow';

export type ShapeLayer = {
  id: ShapeObjectId;
  name: string;
  shapeType: ShapeType;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  rx?: number; // 角丸
  layout: ObjectLayout & { width: number; height: number };
};

// レイヤーのメタ情報（ロック・非表示）
export type LayerMeta = {
  locked: boolean;
  hidden: boolean;
};

// 画像レイヤー
export type ImageLayer = {
  id: ImageObjectId;
  name: string;
  dataUrl: string;
  layout: ObjectLayout;
};

// QRコードレイヤー
export type QrLayer = {
  id: `qr:${string}`;
  name: string;
  value: string;
  layout: ObjectLayout & { sizePx: number };
};

// 差し込みフィールド
export type MergeField = {
  id: string;
  fieldName: string;
  values: string[];
};

export type CardDocument = {
  templateId: TemplateId;
  paperSizeId: PaperSizeId;
  cardSizeId: CardSizeId;
  customWidthMm: number;
  customHeightMm: number;
  productName: string;
  price: string;
  prText: string;
  fontFamily: string;
  imageDataUrl: string | null; // 旧フォーマット（マイグレーション用）
  imageLayers: ImageLayer[];
  layout: CardLayout;
  customTextLayers: CustomTextLayer[];
  shapeLayers: ShapeLayer[];
  layerOrder: EditableObjectId[];
  layerMeta: Record<string, LayerMeta>;
  priceFlags: PriceFlags;
  showCropMarks: boolean;
  layoutGapXMm: number;
  layoutGapYMm: number;
  snapEnabled: boolean;
  snapGridMm: number;
  instances: Array<{
    id: string;
    x: number;
    y: number;
    angle: number;
    design: CardDesign;
    showCropMarks: boolean;
  }>;
  layoutMode: boolean;
  mergeFields: MergeField[];
  quantity: number;
  productNameColor?: string;
  priceColor?: string;
  prTextColor?: string;
  instanceGroups: Array<{
    id: string;
    instanceIds: string[];
  }>;
};

export type CardDesign = Omit<CardDocument, 'instances' | 'layoutMode' | 'paperSizeId'>;

export type FontSource = 'system' | 'bundled' | 'uploaded';

export type FontOption = {
  id: string;
  name: string;
  family: string;
  source: FontSource;
};

export type StoredFont = FontOption & {
  dataUrl: string;
  fileName: string;
  createdAt: number;
};

export type SavedDocument = {
  id: string;
  name: string;
  updatedAt: number;
  document: CardDocument;
  thumbnail?: string;
};
