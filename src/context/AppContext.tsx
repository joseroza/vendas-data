import { createContext, useContext, useReducer, ReactNode, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StatusPagamento = "pago" | "pendente" | "atrasado";
export type TipoPagamento = "avista" | "parcelado";

export interface Parcela {
  numero: number;
  total: number;
  vencimento: string;
  status: StatusPagamento;
}

export interface VendaPerfume {
  id: string;
  tipo: "perfume";
  cliente: string;
  telefone: string;
  perfume: string;
  precoUsd: number;
  cotacao: number;
  precoBrl: number;
  margemUsada: number;
  valorFinal: number;
  tipoPagamento: TipoPagamento;
  parcelas: Parcela[];
  observacoes: string;
  data: string;
  status: StatusPagamento;
}

export interface VendaEletronico {
  id: string;
  tipo: "eletronico";
  cliente: string;
  telefone: string;
  produto: string;
  precoCusto: number;
  precoVenda: number;
  lucro: number;
  isUsd: boolean;
  precoUsd?: number;
  cotacao?: number;
  margemUsada: number;
  tipoPagamento: TipoPagamento;
  parcelas: Parcela[];
  observacoes: string;
  data: string;
  status: StatusPagamento;
}

export type Venda = VendaPerfume | VendaEletronico;

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  notas: string;
}

export interface ProdutoPerfume {
  id: string;
  nome: string;
  precoUsd: number;
  precoBrl: number;
}

export interface ProdutoEletronico {
  id: string;
  nome: string;
  precoReferencia: number;
}

export interface AppState {
  margem: number;
  clientes: Cliente[];
  vendas: Venda[];
  catalogoPerfumes: ProdutoPerfume[];
  catalogoEletronicos: ProdutoEletronico[];
}

// ─── Initial State ────────────────────────────────────────────────────────────

const STORAGE_KEY = "salesview_data";

const defaultState: AppState = {
  margem: 20,
  clientes: [
    { id: "1", nome: "Maria Silva", telefone: "(11) 99999-1111", email: "maria@email.com", notas: "" },
    { id: "2", nome: "João Santos", telefone: "(21) 98888-2222", email: "", notas: "Cliente VIP" },
    { id: "3", nome: "Ana Costa", telefone: "(31) 97777-3333", email: "ana@email.com", notas: "" },
    { id: "4", nome: "Carlos Lima", telefone: "(41) 96666-4444", email: "", notas: "Preferência por eletrônicos" },
    { id: "5", nome: "Pedro Alves", telefone: "(51) 95555-5555", email: "pedro@email.com", notas: "" },
  ],
  vendas: [
    {
      id: "v1", tipo: "perfume", cliente: "Maria Silva", telefone: "(11) 99999-1111",
      perfume: "Sauvage Dior", precoUsd: 120, cotacao: 5.8, precoBrl: 696, margemUsada: 20,
      valorFinal: 890, tipoPagamento: "parcelado", data: "15/01/2026", status: "pendente",
      observacoes: "",
      parcelas: [
        { numero: 1, total: 4, vencimento: "15/02/2026", status: "pago" },
        { numero: 2, total: 4, vencimento: "15/03/2026", status: "pago" },
        { numero: 3, total: 4, vencimento: "15/04/2026", status: "pendente" },
        { numero: 4, total: 4, vencimento: "15/05/2026", status: "pendente" },
      ],
    },
    {
      id: "v2", tipo: "perfume", cliente: "Pedro Alves", telefone: "(51) 95555-5555",
      perfume: "Bleu de Chanel", precoUsd: 105, cotacao: 5.8, precoBrl: 609, margemUsada: 20,
      valorFinal: 720, tipoPagamento: "avista", data: "03/03/2026", status: "pago",
      observacoes: "", parcelas: [],
    },
    {
      id: "v3", tipo: "perfume", cliente: "Ana Costa", telefone: "(31) 97777-3333",
      perfume: "Good Girl", precoUsd: 95, cotacao: 5.8, precoBrl: 551, margemUsada: 20,
      valorFinal: 650, tipoPagamento: "parcelado", data: "10/02/2026", status: "pendente",
      observacoes: "",
      parcelas: [
        { numero: 1, total: 3, vencimento: "10/03/2026", status: "pago" },
        { numero: 2, total: 3, vencimento: "10/04/2026", status: "pendente" },
        { numero: 3, total: 3, vencimento: "10/05/2026", status: "pendente" },
      ],
    },
    {
      id: "v4", tipo: "eletronico", cliente: "Carlos Lima", telefone: "(41) 96666-4444",
      produto: "iPhone 15 Pro", precoCusto: 5800, precoVenda: 7200, lucro: 1400,
      isUsd: false, margemUsada: 20, tipoPagamento: "parcelado", data: "20/01/2026", status: "pendente",
      observacoes: "",
      parcelas: [
        { numero: 1, total: 4, vencimento: "20/02/2026", status: "pago" },
        { numero: 2, total: 4, vencimento: "20/03/2026", status: "pago" },
        { numero: 3, total: 4, vencimento: "20/04/2026", status: "pendente" },
        { numero: 4, total: 4, vencimento: "20/05/2026", status: "pendente" },
      ],
    },
    {
      id: "v5", tipo: "eletronico", cliente: "Lucia Ferreira", telefone: "(21) 97000-0000",
      produto: "Samsung S24 Ultra", precoCusto: 3500, precoVenda: 4500, lucro: 1000,
      isUsd: false, margemUsada: 20, tipoPagamento: "avista", data: "02/03/2026", status: "pago",
      observacoes: "", parcelas: [],
    },
    {
      id: "v6", tipo: "eletronico", cliente: "Roberto Dias", telefone: "(11) 96000-0000",
      produto: "AirPods Pro", precoCusto: 1200, precoVenda: 1600, lucro: 400,
      isUsd: false, margemUsada: 20, tipoPagamento: "avista", data: "25/02/2026", status: "pago",
      observacoes: "", parcelas: [],
    },
  ],
  catalogoPerfumes: [
    { id: "p1", nome: "Sauvage Dior", precoUsd: 120, precoBrl: 696 },
    { id: "p2", nome: "Bleu de Chanel", precoUsd: 105, precoBrl: 609 },
    { id: "p3", nome: "Good Girl", precoUsd: 95, precoBrl: 551 },
    { id: "p4", nome: "212 VIP", precoUsd: 85, precoBrl: 493 },
    { id: "p5", nome: "La Vie Est Belle", precoUsd: 110, precoBrl: 638 },
  ],
  catalogoEletronicos: [
    { id: "e1", nome: "iPhone 15 Pro", precoReferencia: 7200 },
    { id: "e2", nome: "Samsung S24 Ultra", precoReferencia: 4500 },
    { id: "e3", nome: "AirPods Pro", precoReferencia: 1600 },
    { id: "e4", nome: "iPad Air", precoReferencia: 3800 },
  ],
};

// Carrega do localStorage (ou usa o estado padrão na primeira vez)
function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as AppState;
  } catch {
    // Se corrompeu, ignora e usa o padrão
  }
  return defaultState;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_MARGEM"; payload: number }
  | { type: "ADD_CLIENTE"; payload: Omit<Cliente, "id"> }
  | { type: "UPDATE_CLIENTE"; payload: Cliente }
  | { type: "DELETE_CLIENTE"; payload: string }
  | { type: "ADD_VENDA"; payload: Omit<Venda, "id"> }
  | { type: "MARCAR_PARCELA_PAGA"; payload: { vendaId: string; numeroParcela: number } }
  | { type: "MARCAR_VENDA_PAGA"; payload: string }
  | { type: "ADD_PRODUTO_PERFUME"; payload: Omit<ProdutoPerfume, "id"> }
  | { type: "DELETE_PRODUTO_PERFUME"; payload: string }
  | { type: "ADD_PRODUTO_ELETRONICO"; payload: Omit<ProdutoEletronico, "id"> }
  | { type: "DELETE_PRODUTO_ELETRONICO"; payload: string }
  | { type: "RESET_DATA" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_MARGEM":
      return { ...state, margem: action.payload };

    case "ADD_CLIENTE":
      return {
        ...state,
        clientes: [...state.clientes, { ...action.payload, id: crypto.randomUUID() }],
      };

    case "UPDATE_CLIENTE":
      return {
        ...state,
        clientes: state.clientes.map((c) => (c.id === action.payload.id ? action.payload : c)),
      };

    case "DELETE_CLIENTE":
      return { ...state, clientes: state.clientes.filter((c) => c.id !== action.payload) };

    case "ADD_VENDA": {
      const novaVenda = { ...action.payload, id: crypto.randomUUID() } as Venda;
      return { ...state, vendas: [novaVenda, ...state.vendas] };
    }

    case "MARCAR_PARCELA_PAGA":
      return {
        ...state,
        vendas: state.vendas.map((v) => {
          if (v.id !== action.payload.vendaId) return v;
          const novasParcelas = v.parcelas.map((p) =>
            p.numero === action.payload.numeroParcela ? { ...p, status: "pago" as StatusPagamento } : p
          );
          const todasPagas = novasParcelas.every((p) => p.status === "pago");
          return { ...v, parcelas: novasParcelas, status: todasPagas ? "pago" : "pendente" };
        }),
      };

    case "MARCAR_VENDA_PAGA":
      return {
        ...state,
        vendas: state.vendas.map((v) =>
          v.id === action.payload
            ? {
                ...v,
                status: "pago" as StatusPagamento,
                parcelas: v.parcelas.map((p) => ({ ...p, status: "pago" as StatusPagamento })),
              }
            : v
        ),
      };

    case "ADD_PRODUTO_PERFUME":
      return {
        ...state,
        catalogoPerfumes: [
          ...state.catalogoPerfumes,
          { ...action.payload, id: crypto.randomUUID() },
        ],
      };

    case "DELETE_PRODUTO_PERFUME":
      return {
        ...state,
        catalogoPerfumes: state.catalogoPerfumes.filter((p) => p.id !== action.payload),
      };

    case "ADD_PRODUTO_ELETRONICO":
      return {
        ...state,
        catalogoEletronicos: [
          ...state.catalogoEletronicos,
          { ...action.payload, id: crypto.randomUUID() },
        ],
      };

    case "DELETE_PRODUTO_ELETRONICO":
      return {
        ...state,
        catalogoEletronicos: state.catalogoEletronicos.filter((p) => p.id !== action.payload),
      };

    case "RESET_DATA":
      return defaultState;

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  // Salva no localStorage toda vez que o estado muda
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignora erros de quota
    }
  }, [state]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

// ─── Selectors ────────────────────────────────────────────────────────────────

export function useCobrancas() {
  const { state } = useApp();
  const parcelas: {
    vendaId: string;
    cliente: string;
    telefone: string;
    produto: string;
    parcela: string;
    valor: number;
    vencimento: string;
    status: StatusPagamento;
    numeroParcela: number;
  }[] = [];

  for (const venda of state.vendas) {
    if (venda.tipoPagamento !== "parcelado") continue;
    for (const p of venda.parcelas) {
      if (p.status === "pago") continue;
      const produto = venda.tipo === "perfume" ? venda.perfume : venda.produto;
      const valorParcela =
        venda.tipo === "perfume"
          ? venda.valorFinal / venda.parcelas.length
          : venda.precoVenda / venda.parcelas.length;
      parcelas.push({
        vendaId: venda.id,
        cliente: venda.cliente,
        telefone: venda.telefone,
        produto,
        parcela: `${p.numero}/${p.total}`,
        valor: valorParcela,
        vencimento: p.vencimento,
        status: p.status,
        numeroParcela: p.numero,
      });
    }
  }
  return parcelas;
}
