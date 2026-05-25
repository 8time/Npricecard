import type { CardDocument } from '../types';

export const formatTaxLabel = (document: CardDocument) => {
  if (!document.priceFlags.showTaxLabel || !document.priceFlags.includeTax) {
    return '';
  }
  return '税込';
};

export const formatPriceDisplay = (document: CardDocument) => {
  return document.price;
};
