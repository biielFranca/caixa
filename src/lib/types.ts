export type Method = "dinheiro" | "pix" | "cartao";
export type Platform = "99" | "ifood" | "keeta" | "caderno";
export type Role = "cozinha" | "entregador" | "outro";

export const METHODS: Method[] = ["dinheiro", "pix", "cartao"];
export const PLATFORMS: Platform[] = ["99", "ifood", "keeta", "caderno"];

export const METHOD_LABEL: Record<Method, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao: "Cartão",
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  "99": "99 Food",
  ifood: "iFood",
  keeta: "Keeta",
  caderno: "Caderno",
};

export type Employee = {
  id: string;
  name: string;
  slug: string;
  role: Role;
  daily_rate: number;
  per_delivery: number;
  free_deliveries: number;
  fixed_amount: number | null;
  active: boolean;
};

export type Day = {
  id: string;
  date: string;
  cash_open: number;
  coin_open: number;
  counted_cash: number;
  counted_coin: number;
  notes: string | null;
  needs_review: boolean;
  source_sheet: string | null;
  closed_at: string | null;
};

export type Entry = {
  id: string;
  day_id: string;
  method: Method;
  amount: number;
  note: string | null;
  position: number;
};

export type Shift = {
  id: string;
  day_id: string;
  employee_id: string;
  deliveries: number | null;
  amount: number | null;
  note: string | null;
};

export type PlatformRevenue = {
  id: string;
  day_id: string;
  platform: Platform;
  amount: number;
};

export type Saving = {
  id: string;
  person: string;
  date: string | null;
  amount: number;
  note: string | null;
};

export type Settings = {
  id: number;
  default_daily_rate: number;
  default_per_delivery: number;
  default_free_deliveries: number;
  kitchen_amount: number;
};

export type DaySummary = {
  id: string;
  date: string;
  cash_open: number;
  coin_open: number;
  counted_cash: number;
  counted_coin: number;
  needs_review: boolean;
  closed_at: string | null;
  total_dinheiro: number;
  total_pix: number;
  total_cartao: number;
  total_caderno: number;
  total_caixa: number;
  difference: number;
  total_funcionarios: number;
  total_livre: number;
};
