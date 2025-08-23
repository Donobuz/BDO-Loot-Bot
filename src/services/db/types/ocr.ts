// === OCR TYPES ===

export interface ItemTemplate {
    name: string;
    variations?: string[];
    fuzzyMatch?: boolean;
    fuzzyPattern?: string;
    minSimilarity?: number;
    value?: number;
}

export interface CropArea {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface TextFilters {
    minConfidence?: number;
    allowedCharacters?: string;
    minLength?: number;
}

export interface Pattern {
    type: string;
    regex: string;
    groups: string[];
}

export interface LocationTemplateData {
    name: string;
    cropArea?: CropArea;
    textFilters?: TextFilters;
    items: ItemTemplate[];
    patterns?: Pattern[];
}

export interface ItemMatcher {
    exact: Set<string>;
    fuzzy: Array<{
        name: string;
        pattern: RegExp;
        minSimilarity: number;
    }>;
}

export interface MatchResult {
    match: boolean;
    item?: string;
    confidence?: number;
    method?: 'exact' | 'fuzzy';
    text?: string;
}
