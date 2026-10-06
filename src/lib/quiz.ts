export type Option = { label: string; value: number; hint?: string };
export type Question = {
  id: string;
  title: string;
  description?: string;
  options: Option[];
};
export type Answers = Record<string, number>;
