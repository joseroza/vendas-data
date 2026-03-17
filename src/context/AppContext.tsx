import {
  createContext, useContext, ReactNode,
  useEffect, useState, useCallback, useRef,
} from "react";
import {
  supabase,
  fetchClientes, insertCliente, updateCliente, deleteCliente,
  fetchVendas, insertVenda, updateVenda, deleteVenda, updateParcelaStatus, updateVendaStatus, recriarParcelas,
  registrarPagamentoParcela, desfazerPagamentoParcela,
  fetchCatalogoPerfumes, insertProdutoPerfume, deleteProdutoPerfume,
  fetchCatalogoEletronicos, insertProdutoEletronico, deleteProdutoEletronico,
  fetchMargem, saveMargem,
  fetchVendedores, insertVendedor, deleteVendedor,
} from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

export type StatusPagamento = "pago" | "pendente" | "atrasado";
export type TipoPagamento   = "avista" | "parcelado";

export interface Parcela {
  numero: number; total: number; vencimento: string; status: StatusPagamento; valorPago?: number;
}
export interface VendaPerfume {
  id: string; tipo: "perfume"; cliente: string; telefone: string;
  vendedor: string;
  perfume: string; precoUsd: number; cotacao: number; precoBrl: number;
  margemUsada: number; valorFinal: number; tipoPagamento: TipoPagamento;
  valorEntrada?: number;
  parcelas: Parcela[]; observacoes: string; data: string; status: StatusPagamento;
}
export interface VendaEletronico {
  id: string; tipo: "eletronico"; cliente: string; telefone: string;
  vendedor: string;
  produto: string; precoCusto: number; precoVenda: number; lucro: number;
  isUsd: boolean; precoUsd?: number; cotacao?: number; margemUsada: number;
  tipoPagamento: TipoPagamento; valorEntrada?: number; parcelas: Parcela[];
  observacoes: string; data: string; status: StatusPagamento;
}
export type Venda = VendaPerfume | VendaEletronico;
export interface Cliente    { id: string; nome: string; telefone: string; email: string; notas: string; }
export interface Vendedor   { id: string; nome: string; email: string; ativo: boolean; }
export interface ProdutoPerfume    { id: string; marca: string; nome: string; quantidade: number; precoUsd: number; precoBrl: number; }
export interface ProdutoEletronico { id: string; nome: string; precoReferencia: number; }

export interface AppState {
  margem: number;
  clientes: Cliente[];
  vendas: Venda[];
  vendedores: Vendedor[];
  catalogoPerfumes: ProdutoPerfume[];
  catalogoEletronicos: ProdutoEletronico[];
  loading: boolean;
  session: Session | null;
}

type DbRow = Record<string, unknown> & { parcelas?: Record<string, unknown>[] };

function dbToVenda(v: DbRow): Venda {
  const parcelas: Parcela[] = (v.parcelas ?? []).map((p) => ({
    valorPago: (p.valor_pago ?? 0) as number,
    numero: p.numero as number, total: p.total as number,
    vencimento: p.vencimento as string, status: p.status as StatusPagamento,
  }));
  if (v.tipo === "perfume") {
    return {
      id: v.id as string, tipo: "perfume", cliente: v.cliente as string,
      telefone: (v.telefone ?? "") as string,
      vendedor: (v.vendedor ?? "") as string,
      perfume: (v.perfume ?? "") as string,
      precoUsd: (v.preco_usd ?? 0) as number,
      cotacao: (v.cotacao ?? 0) as number,
      precoBrl: (v.preco_brl ?? 0) as number,
      margemUsada: (v.margem_usada ?? 20) as number,
      valorFinal: (v.valor_final ?? 0) as number,
      tipoPagamento: v.tipo_pagamento as TipoPagamento,
      valorEntrada: (v.valor_entrada ?? 0) as number,
      parcelas, observacoes: (v.observacoes ?? "") as string,
      data: v.data as string, status: v.status as StatusPagamento,
    };
  }
  return {
    id: v.id as string, tipo: "eletronico", cliente: v.cliente as string,
    telefone: (v.telefone ?? "") as string,
    vendedor: (v.vendedor ?? "") as string,
    produto: (v.produto ?? "") as string,
    precoCusto: (v.preco_custo ?? 0) as number,
    precoVenda: (v.preco_venda ?? 0) as number,
    lucro: (v.lucro ?? 0) as number,
    isUsd: (v.is_usd ?? false) as boolean,
    precoUsd: v.preco_usd as number | undefined,
    cotacao: v.cotacao as number | undefined,
    margemUsada: (v.margem_usada ?? 20) as number,
    tipoPagamento: v.tipo_pagamento as TipoPagamento,
    valorEntrada: (v.valor_entrada ?? 0) as number,
    parcelas, observacoes: (v.observacoes ?? "") as string,
    data: v.data as string, status: v.status as StatusPagamento,
  };
}

interface AppContextType {
  state: AppState;
  addCliente: (c: Omit<Cliente, "id">) => Promise<void>;
  updateClienteAction: (c: Cliente) => Promise<void>;
  deleteClienteAction: (id: string) => Promise<void>;
  addVenda: (v: Omit<VendaPerfume, "id"> | Omit<VendaEletronico, "id">) => Promise<void>;
  updateVendaAction: (id: string, fields: Partial<Omit<VendaPerfume, "id"> | Omit<VendaEletronico, "id">>) => Promise<void>;
  deleteVendaAction: (id: string) => Promise<void>;
  marcarParcelaPaga: (vendaId: string, numeroParcela: number) => Promise<void>;
  desmarcarParcelaPaga: (vendaId: string, numeroParcela: number) => Promise<void>;
  registrarPagamento: (vendaId: string, numeroParcela: number, valorPago: number) => Promise<void>;
  desfazerPagamento: (vendaId: string, numeroParcela: number) => Promise<void>;
  marcarVendaPaga: (vendaId: string) => Promise<void>;
  addProdutoPerfume: (p: Omit<ProdutoPerfume, "id">) => Promise<void>;
  deleteProdutoPerfumeAction: (id: string) => Promise<void>;
  addProdutoEletronico: (p: Omit<ProdutoEletronico, "id">) => Promise<void>;
  deleteProdutoEletronicoAction: (id: string) => Promise<void>;
  setMargemAction: (m: number) => Promise<void>;
  addVendedorAction: (v: Omit<Vendedor, "id">) => Promise<void>;
  deleteVendedorAction: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    margem: 20, clientes: [], vendas: [], vendedores: [],
    catalogoPerfumes: [], catalogoEletronicos: [],
    loading: true, session: null,
  });

  const dataLoaded = useRef(false);

  const loadData = useCallback(async () => {
    if (dataLoaded.current) return;
    dataLoaded.current = true;
    setState((s) => ({ ...s, loading: true }));
    try {
      // Busca tudo em paralelo — vendedores tem fallback caso tabela não exista
      const [margem, clientes, vendasRaw, catalogoPerfumes, catalogoEletronicos] =
        await Promise.all([
          fetchMargem(),
          fetchClientes(),
          fetchVendas(),
          fetchCatalogoPerfumes(),
          fetchCatalogoEletronicos(),
        ]);

      // Vendedores com fallback seguro
      let vendedoresRaw: { id: string; nome: string; email: string; ativo: boolean }[] = [];
      try {
        vendedoresRaw = await fetchVendedores();
      } catch (e) {
        console.warn("Tabela vendedores não disponível:", e);
      }

      setState((s) => ({
        ...s,
        margem,
        clientes: clientes.map((c) => ({
          id: c.id, nome: c.nome, telefone: c.telefone, email: c.email, notas: c.notas,
        })),
        vendas: vendasRaw.map(dbToVenda),
        vendedores: vendedoresRaw.map((v) => ({
          id: v.id, nome: v.nome, email: v.email, ativo: v.ativo,
        })),
        catalogoPerfumes: catalogoPerfumes.map((p) => ({
          id: p.id, marca: p.marca, nome: p.nome, quantidade: p.quantidade,
          precoUsd: p.preco_usd, precoBrl: p.preco_brl,
        })),
        catalogoEletronicos: catalogoEletronicos.map((p) => ({
          id: p.id, nome: p.nome, precoReferencia: p.preco_referencia,
        })),
        loading: false,
      }));
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      dataLoaded.current = false; // permite retry
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const [margem, clientes, vendasRaw, catalogoPerfumes, catalogoEletronicos] =
        await Promise.all([
          fetchMargem(), fetchClientes(), fetchVendas(),
          fetchCatalogoPerfumes(), fetchCatalogoEletronicos(),
        ]);
      let vendedoresRaw: { id: string; nome: string; email: string; ativo: boolean }[] = [];
      try { vendedoresRaw = await fetchVendedores(); } catch { /* ignorar */ }

      setState((s) => ({
        ...s, margem,
        clientes: clientes.map((c) => ({ id: c.id, nome: c.nome, telefone: c.telefone, email: c.email, notas: c.notas })),
        vendas: vendasRaw.map(dbToVenda),
        vendedores: vendedoresRaw.map((v) => ({ id: v.id, nome: v.nome, email: v.email, ativo: v.ativo })),
        catalogoPerfumes: catalogoPerfumes.map((p) => ({ id: p.id, marca: p.marca, nome: p.nome, quantidade: p.quantidade, precoUsd: p.preco_usd, precoBrl: p.preco_brl })),
        catalogoEletronicos: catalogoEletronicos.map((p) => ({ id: p.id, nome: p.nome, precoReferencia: p.preco_referencia })),
        loading: false,
      }));
    } catch (err) {
      console.error("Erro ao recarregar dados:", err);
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState((s) => ({ ...s, session: data.session }));
      if (data.session) loadData();
      else setState((s) => ({ ...s, loading: false }));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({ ...s, session }));
      if (session) {
        loadData();
      } else {
        dataLoaded.current = false;
        setState((s) => ({
          ...s, loading: false,
          clientes: [], vendas: [], vendedores: [],
          catalogoPerfumes: [], catalogoEletronicos: [],
        }));
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadData]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  async function addCliente(c: Omit<Cliente, "id">) {
    const novo = await insertCliente(c);
    setState((s) => ({ ...s, clientes: [{ id: novo.id, nome: novo.nome, telefone: novo.telefone, email: novo.email, notas: novo.notas }, ...s.clientes] }));
  }

  async function updateClienteAction(c: Cliente) {
    await updateCliente(c);
    setState((s) => ({ ...s, clientes: s.clientes.map((x) => x.id === c.id ? c : x) }));
  }

  async function deleteClienteAction(id: string) {
    await deleteCliente(id);
    setState((s) => ({ ...s, clientes: s.clientes.filter((c) => c.id !== id) }));
  }

  async function addVenda(venda: Omit<VendaPerfume, "id"> | Omit<VendaEletronico, "id">) {
    const base = {
      tipo: venda.tipo,
      cliente: venda.cliente,
      telefone: venda.telefone,
      vendedor: venda.vendedor ?? "",
      tipo_pagamento: venda.tipoPagamento,
      valor_entrada: (venda as any).valorEntrada ?? 0,
      observacoes: venda.observacoes,
      data: venda.data,
      status: venda.status,
      margem_usada: venda.margemUsada,
    };
    const dbVenda = venda.tipo === "perfume"
      ? { ...base, tipo: "perfume" as const, perfume: venda.perfume, preco_usd: venda.precoUsd, cotacao: venda.cotacao, preco_brl: venda.precoBrl, valor_final: venda.valorFinal }
      : { ...base, tipo: "eletronico" as const, produto: venda.produto, preco_custo: venda.precoCusto, preco_venda: venda.precoVenda, lucro: venda.lucro, is_usd: venda.isUsd, preco_usd: venda.precoUsd, cotacao: venda.cotacao };
    const dbParcelas = venda.parcelas.map((p) => ({ numero: p.numero, total: p.total, vencimento: p.vencimento, status: p.status, valor_pago: p.valorPago ?? 0 }));
    await insertVenda(dbVenda as Parameters<typeof insertVenda>[0], dbParcelas);
    await reload();
  }

  async function updateVendaAction(id: string, fields: Partial<Omit<VendaPerfume, "id"> | Omit<VendaEletronico, "id">>) {
    // Mapeia campos camelCase → snake_case para o banco
    const dbFields: Record<string, unknown> = {};
    if ("cliente"      in fields) dbFields.cliente       = fields.cliente;
    if ("telefone"     in fields) dbFields.telefone      = fields.telefone;
    if ("vendedor"     in fields) dbFields.vendedor      = fields.vendedor;
    if ("observacoes"  in fields) dbFields.observacoes   = fields.observacoes;
    if ("data"         in fields) dbFields.data          = fields.data;
    if ("status"       in fields) dbFields.status        = fields.status;
    // Perfume
    if ("perfume"      in fields) dbFields.perfume       = (fields as Partial<VendaPerfume>).perfume;
    if ("precoUsd"     in fields) dbFields.preco_usd     = (fields as Partial<VendaPerfume>).precoUsd;
    if ("cotacao"      in fields) dbFields.cotacao       = (fields as Partial<VendaPerfume>).cotacao;
    if ("precoBrl"     in fields) dbFields.preco_brl     = (fields as Partial<VendaPerfume>).precoBrl;
    if ("valorFinal"   in fields) dbFields.valor_final   = (fields as Partial<VendaPerfume>).valorFinal;
    if ("margemUsada"  in fields) dbFields.margem_usada  = (fields as Partial<VendaPerfume>).margemUsada;
    // Eletrônico
    if ("produto"      in fields) dbFields.produto       = (fields as Partial<VendaEletronico>).produto;
    if ("precoCusto"   in fields) dbFields.preco_custo   = (fields as Partial<VendaEletronico>).precoCusto;
    if ("precoVenda"   in fields) dbFields.preco_venda   = (fields as Partial<VendaEletronico>).precoVenda;
    if ("lucro"        in fields) dbFields.lucro         = (fields as Partial<VendaEletronico>).lucro;
    // tipoPagamento e entrada também vão para o banco
    if ("tipoPagamento" in fields) dbFields.tipo_pagamento = (fields as any).tipoPagamento;
    if ("valorEntrada"  in fields) dbFields.valor_entrada  = (fields as any).valorEntrada;

    await updateVenda(id, dbFields);

    // Se parcelas foram passadas, recria no banco
    if ("parcelas" in fields) {
      const parcelas = (fields as any).parcelas as Parcela[];
      await recriarParcelas(id, parcelas.map((p) => ({
        numero: p.numero, total: p.total, vencimento: p.vencimento, status: p.status,
      })));
    }

    await reload();
  }

  async function deleteVendaAction(id: string) {
    await deleteVenda(id);
    setState((s) => ({ ...s, vendas: s.vendas.filter((v) => v.id !== id) }));
  }

  async function registrarPagamento(vendaId: string, numeroParcela: number, valorPago: number) {
    await registrarPagamentoParcela(vendaId, numeroParcela, valorPago);
    setState((s) => ({
      ...s,
      vendas: s.vendas.map((v) => {
        if (v.id !== vendaId) return v;
        const novasParcelas = v.parcelas.map((p) =>
          p.numero === numeroParcela ? { ...p, status: "pago" as StatusPagamento, valorPago } : p
        );
        const todasPagas = novasParcelas.every((p) => p.status === "pago");
        return { ...v, parcelas: novasParcelas, status: todasPagas ? "pago" as StatusPagamento : "pendente" as StatusPagamento };
      }),
    }));
  }

  async function desfazerPagamento(vendaId: string, numeroParcela: number) {
    await desfazerPagamentoParcela(vendaId, numeroParcela);
    setState((s) => ({
      ...s,
      vendas: s.vendas.map((v) => {
        if (v.id !== vendaId) return v;
        const novasParcelas = v.parcelas.map((p) =>
          p.numero === numeroParcela ? { ...p, status: "pendente" as StatusPagamento, valorPago: 0 } : p
        );
        return { ...v, parcelas: novasParcelas, status: "pendente" as StatusPagamento };
      }),
    }));
  }

  async function desmarcarParcelaPaga(vendaId: string, numeroParcela: number) {
    await updateParcelaStatus(vendaId, numeroParcela, "pendente");
    setState((s) => ({
      ...s,
      vendas: s.vendas.map((v) => {
        if (v.id !== vendaId) return v;
        const novasParcelas = v.parcelas.map((p) =>
          p.numero === numeroParcela ? { ...p, status: "pendente" as StatusPagamento } : p
        );
        return { ...v, parcelas: novasParcelas, status: "pendente" as StatusPagamento };
      }),
    }));
  }

  async function marcarParcelaPaga(vendaId: string, numeroParcela: number) {
    await updateParcelaStatus(vendaId, numeroParcela, "pago");
    setState((s) => ({
      ...s,
      vendas: s.vendas.map((v) => {
        if (v.id !== vendaId) return v;
        const novasParcelas = v.parcelas.map((p) => p.numero === numeroParcela ? { ...p, status: "pago" as StatusPagamento } : p);
        const todasPagas = novasParcelas.every((p) => p.status === "pago");
        return { ...v, parcelas: novasParcelas, status: todasPagas ? "pago" as StatusPagamento : "pendente" as StatusPagamento };
      }),
    }));
  }

  async function marcarVendaPaga(vendaId: string) {
    await updateVendaStatus(vendaId, "pago");
    setState((s) => ({
      ...s,
      vendas: s.vendas.map((v) => v.id === vendaId
        ? { ...v, status: "pago" as StatusPagamento, parcelas: v.parcelas.map((p) => ({ ...p, status: "pago" as StatusPagamento })) }
        : v),
    }));
  }

  async function addProdutoPerfume(p: Omit<ProdutoPerfume, "id">) {
    const novo = await insertProdutoPerfume({ marca: p.marca, nome: p.nome, quantidade: p.quantidade, preco_usd: p.precoUsd, preco_brl: p.precoBrl });
    setState((s) => ({ ...s, catalogoPerfumes: [...s.catalogoPerfumes, { id: novo.id, marca: novo.marca, nome: novo.nome, quantidade: novo.quantidade, precoUsd: novo.preco_usd, precoBrl: novo.preco_brl }] }));
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

  async function addVendedorAction(v: Omit<Vendedor, "id">) {
    const novo = await insertVendedor({ nome: v.nome, email: v.email, ativo: v.ativo });
    setState((s) => ({ ...s, vendedores: [...s.vendedores, { id: novo.id, nome: novo.nome, email: novo.email, ativo: novo.ativo }] }));
  }

  async function deleteVendedorAction(id: string) {
    await deleteVendedor(id);
    setState((s) => ({ ...s, vendedores: s.vendedores.filter((v) => v.id !== id) }));
  }

  return (
    <AppContext.Provider value={{
      state,
      addCliente, updateClienteAction, deleteClienteAction,
      addVenda, updateVendaAction, deleteVendaAction,
      marcarParcelaPaga, desmarcarParcelaPaga, marcarVendaPaga,
      registrarPagamento, desfazerPagamento,
      addProdutoPerfume, deleteProdutoPerfumeAction,
      addProdutoEletronico, deleteProdutoEletronicoAction,
      setMargemAction, addVendedorAction, deleteVendedorAction,
      reload,
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
  return state.vendas.flatMap((venda) => {
    if (venda.tipoPagamento !== "parcelado") return [];
    return venda.parcelas
      .filter((p) => p.status !== "pago")
      .map((p) => ({
        vendaId: venda.id,
        cliente: venda.cliente,
        telefone: venda.telefone,
        vendedor: venda.vendedor,
        produto: venda.tipo === "perfume" ? venda.perfume : venda.produto,
        parcela: `${p.numero}/${p.total}`,
        valor: venda.tipo === "perfume" ? venda.valorFinal / (venda.parcelas.length || 1) : venda.precoVenda / (venda.parcelas.length || 1),
        vencimento: p.vencimento,
        status: p.status,
      }));
  });
}