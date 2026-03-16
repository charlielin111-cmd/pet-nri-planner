export interface NutrientDefinition {
  id: string;
  name: string;
  nameEn: string;
  category: NutrientCategory;
  unit: string;
  order: number;
}

export type NutrientCategory =
  | 'protein_amino'
  | 'fat_fatty'
  | 'mineral'
  | 'vitamin_other'
  | 'carbohydrate';

export const NUTRIENT_CATEGORY_LABELS: Record<NutrientCategory, string> = {
  protein_amino: '蛋白質與胺基酸類',
  fat_fatty: '脂肪與脂肪酸類',
  mineral: '礦物質類',
  vitamin_other: '維生素與其他類',
  carbohydrate: '碳水化合物類',
};

export interface Ingredient {
  id: string;
  materialCode: string;
  name: string;
  pricePerGram: number;
  caloriesPer100g?: number; // kcal per 100g
  nutrients: Record<string, number | 'ND'>;
  updatedAt: string;
}

export interface MarketChannel {
  id: string;
  name: string;
  limits: Record<string, NutrientLimit>;
  updatedAt: string;
}

export interface NutrientLimit {
  type: 'min' | 'max' | 'range';
  min?: number;
  max?: number;
}

export interface Formula {
  id: string;
  code: string;
  name: string;
  channelId: string;
  servingSize?: number; // grams per serving
  note?: string;
  ingredients: FormulaIngredient[];
  updatedAt: string;
}

export interface FormulaIngredient {
  ingredientId: string;
  amount: number; // grams
}

export interface ValidationResult {
  nutrientId: string;
  nutrientName: string;
  value: number;
  unit: string;
  limit: NutrientLimit;
  passed: boolean;
}
