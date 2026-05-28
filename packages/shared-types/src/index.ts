// @domkrat/shared-types — общие TypeScript типы между API и фронтами.
// Наполнение начнётся когда появятся API DTO в Sprint 1+.

export type Locale = 'ru' | 'uz';

export interface MultiLangText {
  ru: string;
  uz: string;
}
