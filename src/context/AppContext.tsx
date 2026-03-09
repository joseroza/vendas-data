import {
  createContext, useContext, ReactNode,
  useEffect, useState, useCallback,
} from "react";
import {
  supabase,
  fetchClientes, insertCliente, updateCliente, deleteCliente,
  fetchVendas, insertVenda, updateParcelaStatus, updateVendaStatus,
  fetchCatalogoPerfumes, insertProdutoPerfume, deleteProdutoPerfume,
  fetchCatalogoEletronicos, insertProdutoEletronico, deleteProdutoEletronico,
  fetchMargem, saveMargem,
} from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

export type StatusPagamento = "pago" | "pendente" | "atrasado";
export type TipoPagamento = "avista" | "parcelado";

export interface Parcela {
  numero: number; total: number; vencimento: string; status: StatusPagamento;
}
export interface VendaPerfume {
  id: string; tipo: "perfume"; cliente: string; telefone: string;
  perfume: string; precoUsd: number; cotacao: number; precoBrl: number;
  margemUsada: number; valorFinal: number; tipoPagamento: TipoPagamento;
  parcelas: Parcela[]; observacoes: string; data: string; status: StatusPagamento;
}
export interface VendaEletronico {
  id: string; tipo: "eletronico"; cliente: string; telefone: string;
  produto: string; precoCusto: number; precoVenda: number; lucro: number;
  isUsd: boolean; precoUsd?: number; cotacao?: number; margemUsada: number;
  tipoPagamento: TipoPagamento; parcelas: Parcela[];
  observacoes: string; data: string; status: StatusPagamento;
}
export type Venda = VendaPerfume | VendaEletronico;
export interface Cliente { id: string; nome: string; telefone: string; email: string; notas: string; }
export interface ProdutoPerfume { id: string; nome: string; precoUsd: number; precoBrl: number; }
export interface ProdutoEletronico { id: string; nome: string; precoReferencia: number; }

export interface AppState {
  margem: number; clientes: Cliente[]; vendas: Venda[];
  catalogoPerfumes: ProdutoPerfume[]; catalogoEletronicos: ProdutoEletronico[];
  loading: boolean; session: Session | null;
}

function dbToVenda(v: any): Venda {
  const parcelas: Parcela[] = (v.parcelas ?? []).map((p: any) => ({
    numero: p.numero, total: p.total, vencimento: p.vencimento, status: p.status,
  }));
  if (v.tipo === "perfume") {
    return {
      id: v.id, tipo: "perfume", cliente: v.cliente, telefone: v.telefone,
      perfume: v.perfume ?? "", precoUsd: v.preco_usd ?? 0, cotacao: v.cotacao ?? 0,
      precoBrl: v.preco_brl ?? 0, margemUsada: v.margem_usada, valorFinal: v.valor_final ?? 0,
      tipoPagamento: v.tipo_pagamento, parcelas, observacoes: v.observacoes ?? "",
      data: v.data, status: v.status,
    } as VendaPerfume;
  }
  return {
    id: v.id, tipo: "eletronico", cliente: v.cliente, telefone: v.telefone,
    produto: v.produto ?? "", precoCusto: v.preco_custo ?? 0, precoVenda: v.preco_venda ?? 0,
    lucro: v.lucro ?? 0, isUsd: v.is_usd ?? false, precoUsd: v.preco_usd, cotacao: v.cotacao,
    margemUsada: v.margem_usada, tipoPagamento: v.tipo_pagamento, parcelas,
    observacoes: v.observacoes ?? "", data: v.data, status: v.status,
  } as VendaEletronico;
}

interface AppContextType {
  state: AppState;
  addCliente: (c: Omit<Cliente, "id">) => Promise<void>;
  updateClienteAction: (c: Cliente) => Promise<void>;
  deleteClienteAction: (id: string) => Promise<void>;
  addVenda: (v: Omit<Venda, "id">) => Promise<void>;
  marcarParcelaPaga: (vendaId: string, numeroParcela: number) => Promise<void>;
  marcarVendaPaga: (vendaId: string) => Promise<void>;
  addProdutoPerfume: (p: Omit<ProdutoPerfume, "id">) => Promise<void>;
  deleteProdutoPerfumeAction: (id: string) => Promise<void>;
  addProdutoEletronico: (p: Omit<ProdutoEletronico, "id">) => Promise<void>;
  deleteProdutoEletronicoAction: (id: string) => Promise<void>;
  setMargemAction: (m: number) => Promise<void>;
  reload: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    margem: 20, clientes: [], vendas: [],
    catalogoPerfumes: [], catalogoEletronicos: [],
    loading: true, session: null,
  });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const [margem, clientes, vendasRaw, catalogoPerfumes, catalogoEletronicos] =
        await Promise.all([
          fetchMargem(), fetchClientes(), fetchVendas(),
          fetchCatalogoPerfumes(), fetchCatalogoEletronicos(),
        ]);
      setState((s) => ({
        ...s, margem,
        clientes: clientes.map((c) => ({ id: c.id, nome: c.nome, telefone: c.telefone, email: c.email, notas: c.notas })),
        vendas: vendasRaw.map(dbToVenda),
        catalogoPerfumes: catalogoPerfumes.map((p) => ({ id: p.id, nome: p.nome, precoUsd: p.preco_usd, precoBrl: p.preco_brl })),
        catalogoEletronicos: catalogoEletronicos.map((p) => ({ id: p.id, nome: p.nome, precoReferencia: p.preco_referencia })),
        loading: false,
      }));
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState((s) => ({ ...s, session: data.session }));
      if (data.session) reload();
      else setState((s) => ({ ...s, loading: false }));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({ ...s, session }));
      if (session) reload();
      else setState((s) => ({ ...s, loading: false, clientes: [], vendas: [] }));
    });
    return () => listener.subscription.unsubscribe();
  }, [reload]);

  async function addCliente(c: Omit<Cliente, "id">) {
    const novo = await insertCliente(c);
    setState((s) => ({ ...s, clientes: [{ id: novo.id, nome: novo.nome, telefone: novo.telefone, email: novo.email, notas: novo.notas }, ...s.clientes] }));
  }
  async function updateClienteAction(c: Cliente) {
    await updateCliente(c);
    setState((s) => ({ ...s, clientes: s.clientes.map((x) => (x.id === c.id ? c : x)) }));
  }
  async function deleteClienteAction(id: string) {
    await deleteCliente(id);
    setState((s) => ({ ...s, clientes: s.clientes.filter((c) => c.id !== id) }));
  }

  async function addVenda(venda: Omit<Venda, "id">) {
    const dbVenda = venda.tipo === "perfume"
      ? { tipo: "perfume" as const, cliente: venda.cliente, telefone: venda.telefone, perfume: venda.perfume, preco_usd: venda.precoUsd, cotacao: venda.cotacao, preco_brl: venda.precoBrl, margem_usada: venda.margemUsada, valor_final: venda.valorFinal, tipo_pagamento: venda.tipoPagamento, observacoes: venda.observacoes, data: venda.data, status: venda.status }
      : { tipo: "eletronico" as const, cliente: venda.cliente, telefone: venda.telefone, produto: venda.produto, preco_custo: venda.precoCusto, preco_venda: venda.precoVenda, lucro: venda.lucro, is_usd: venda.isUsd, preco_usd: venda.precoUsd, cotacao: venda.cotacao, margem_usada: venda.margemUsada, tipo_pagamento: venda.tipoPagamento, observacoes: venda.observacoes, data: venda.data, status: venda.status };
    const dbParcelas = venda.parcelas.map((p) => ({ numero: p.numero, total: p.total, vencimento: p.vencimento, status: p.status }));
    await insertVenda(dbVenda as any, dbParcelas);
    await reload();
  }

  async function marcarParcelaPaga(vendaId: string, numeroParcela: number) {
    await updateParcelaStatus(vendaId, numeroParcela, "pago");
    setState((s) => ({
      ...s,
      vendas: s.vendas.map((v) => {
        if (v.id !== vendaId) return v;
        const novasParcelas = v.parcelas.map((p) => p.numero === numeroParcela ? { ...p, status: "pago" as StatusPagamento } : p);
        const todasPagas = novasParcelas.every((p) => p.status === "pago");
        return { ...v, parcelas: novasParcelas, status: todasPagas ? "pago" : "pendente" };
      }),
    }));
  }

  async function marcarVendaPaga(vendaId: string) {
    await updateVendaStatus(vendaId, "pago");
    setState((s) => ({
      ...s,
      vendas: s.vendas.map((v) => v.id === vendaId ? { ...v, status: "pago" as StatusPagamento, parcelas: v.parcelas.map((p) => ({ ...p, status: "pago" as StatusPagamento })) } : v),
    }));
  }

  async function addProdutoPerfume(p: Omit<ProdutoPerfume, "id">) {
    const novo = await insertProdutoPerfume({ nome: p.nome, preco_usd: p.precoUsd, preco_brl: p.precoBrl });
    setState((s) => ({ ...s, catalogoPerfumes: [...s.catalogoPerfumes, { id: novo.id, nome: novo.nome, precoUsd: novo.preco_usd, precoBrl: novo.preco_brl }] }));
  }
  async function deleteProdutoPerfumeAction(id: string) {
    await deleteProdutoPerfume(id);
    setState((s) => ({ ...s, catalogoPerfumes: s.catalogoPerfumes.filter((p) => p.id !== id) }));
  }
  async function addProdutoEletronico(p: Omit<ProdutoEletronico, "id">) {
    const novo = await insertProdutoEletronico({ nome: p.nome, preco_referencia: p.precoReferencia });
    setState((s) => ({ ...s, catalogoEletronicos: [...s.catalogoEletronicos, { id: novo.id, nome: novo.nome, precoReferencia: novo.preco_referencia }] }));
  }
  async function deleteProdutoEletronicoAction(id: string) {
    await deleteProdutoEletronico(id);
    setState((s) => ({ ...s, catalogoEletronicos: s.catalogoEletronicos.filter((p) => p.id !== id) }));
  }
  async function setMargemAction(m: number) {
    await saveMargem(m);
    setState((s) => ({ ...s, margem: m }));
  }

  return (
    <AppContext.Provider value={{
      state, addCliente, updateClienteAction, deleteClienteAction,
      addVenda, marcarParcelaPaga, marcarVendaPaga,
      addProdutoPerfume, deleteProdutoPerfumeAction,
      addProdutoEletronico, deleteProdutoEletronicoAction,
      setMargemAction, reload,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function useCobrancas() {
  const { state } = useApp();
  const parcelas: { vendaId: string; cliente: string; telefone: string; produto: string; parcela: string; valor: number; vencimento: string; status: StatusPagamento; numeroParcela: number; }[] = [];
  for (const venda of state.vendas) {
    if (venda.tipoPagamento !== "parcelado") continue;
    for (const p of venda.parcelas) {
      if (p.status === "pago") continue;
      const produto = venda.tipo === "perfume" ? venda.perfume : venda.produto;
      const valor = venda.tipo === "perfume" ? venda.valorFinal / venda.parcelas.length : venda.precoVenda / venda.parcelas.length;
      parcelas.push({ vendaId: venda.id, cliente: venda.cliente, telefone: venda.telefone, produto, parcela: `${p.numero}/${p.total}`, valor, vencimento: p.vencimento, status: p.status, numeroParcela: p.numero });
    }
  }
  return parcelas;
}
