import type { BuiltInObjectId, CardLayout, CardTemplate, EditableObjectId } from './types';

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: 'blank',
    name: '白紙',
    themeNote: '真っ白な何もないカードから作成。',
    width: 1000,
    height: 700,
    backgroundColor: '#ffffff',
    accentColor: '#1f6feb',
    borderColor: 'transparent',
    priceLabel: '',
    productName: {
      text: '',
      fill: '#111827',
      fontSize: 88,
      fontWeight: 'bold',
      stroke: 'transparent',
      strokeWidth: 0,
      left: 90,
      top: 100,
    },
    taxLabel: {
      text: '',
      fill: '#111827',
      fontSize: 46,
      fontWeight: 'bold',
      stroke: 'transparent',
      strokeWidth: 0,
      left: 90,
      top: 280,
    },
    price: {
      text: '',
      fill: '#d13b24',
      fontSize: 200,
      fontWeight: 'bold',
      stroke: 'transparent',
      strokeWidth: 0,
      left: 180,
      top: 260,
    },
    prText: {
      text: '',
      fill: '#111827',
      fontSize: 48,
      fontWeight: 'bold',
      stroke: 'transparent',
      strokeWidth: 0,
      left: 90,
      top: 560,
    },
    imageLayout: {
      left: 685,
      top: 320,
      scaleX: 0.26,
      scaleY: 0.26,
    },
  },
];

export const getTemplateById = (id: CardTemplate['id']) =>
  CARD_TEMPLATES.find((template) => template.id === id) ?? CARD_TEMPLATES[0];

export const getDefaultLayout = (templateId: CardTemplate['id']): CardLayout => {
  const template = getTemplateById(templateId);
  const keys: Exclude<BuiltInObjectId, 'border'>[] = ['productName', 'taxLabel', 'price', 'prText'];

  return keys.reduce<CardLayout>((layout, key) => {
    const style = template[key];
    layout[key] = {
      left: style.left,
      top: style.top,
      scaleX: 1,
      scaleY: 1,
    };
    return layout;
  }, {} as CardLayout);
};

export const getDefaultImageLayout = (templateId: CardTemplate['id']) => {
  const template = getTemplateById(templateId);
  return { ...template.imageLayout, angle: 0 };
};

export const DEFAULT_LAYER_ORDER: EditableObjectId[] = ['border', 'productName', 'taxLabel', 'price', 'prText'];
