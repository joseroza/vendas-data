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

// ─── Tipos explícitos para update (sem 'any') ─────────────────────────────────

type UpdateVendaPerfumeFields = Partial<Omit<VendaPerfume, "id" | "tipo">>;
type UpdateVendaEletronicoFields = Partial<Omit<VendaEletronico, "id" | "tipo">>;
export type UpdateVendaFields = UpdateVendaPerfumeFields | UpdateVendaEletronicoFields;

// ─── Mapeamento DB → Venda ────────────────────────────────────────────────────

type DbRow = Record<string, unknown> & { parcelas?: Record<string, unknown>[] };

function dbToVenda(v: DbRow): Venda {
  const parcelas: Parcela[] = (v.parcelas ?? []).map((p) => ({
    valorPago: (p.valor_pago ?? 0) as number,
    numero: p.numero as number,
    total: p.total as number,
    vencimento: p.vencimento as string,
    status: p.status as StatusPagamento,
  }));

  if (v.tipo === "perfume") {
    return {
      id: v.id as string, tipo: "perfume",
      cliente: v.cliente as string,
      telefone: (v.telefone ?? "") as string,
      vendedor: (v.vendedor ?? "") as string,
      perfume: (v.perfume ?? "") as string,
      precoUsd: (v.preco_usd ?? 0) as number,
      cotacao: (v.cotacao ?? 0) as number,
      precoBrl: (v.preco_brl ?? 0) as number,
      margemUsada: (v.margem_usada ?? 20) as number,
      valorFinal: (v.valor_final ?? 0) as number,
      valorEntrada: (v.valor_entrada ?? 0) as number,
      tipoPagamento: v.tipo_pagamento as TipoPagamento,
      parcelas,
      observacoes: (v.observacoes ?? "") as string,
      data: v.data as string,
      status: v.status as StatusPagamento,
    };
  }

  return {
    id: v.id as string, tipo: "eletronico",
    cliente: v.cliente as string,
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
    parcelas,
    observacoes: (v.observacoes ?? "") as string,
    data: v.data as string,
    status: v.status as StatusPagamento,
  };
}

// ─── Context type ─────────────────────────────────────────────────────────────

interface AppContextType {
  state: AppState;
  addCliente: (c: Omit<Cliente, "id">) => Promise<void>;
  updateClienteAction: (c: Cliente) => Promise<void>;
  deleteClienteAction: (id: string) => Promise<void>;
  addVenda: (v: Omit<VendaPerfume, "id"> | Omit<VendaEletronico, "id">) => Promise<void>;
  updateVendaAction: (id: string, fields: UpdateVendaFields) => Promise<void>;
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

// ─── Provider ─────────────────────────────────────────────────────────────────

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
      const [margem, clientes, vendasRaw, catalogoPerfumes, catalogoEletronicos] =
        await Promise.all([
          fetchMargem(),
          fetchClientes(),
          fetchVendas(),
          fetchCatalogoPerfumes(),
          fetchCatalogoEletronicos(),
        ]);

      // Vendedores com fallback caso tabela não exista ainda
      let vendedores: { id: string; nome: string; email: string; ativo: boolean }[] = [];
      try { vendedores = await fetchVendedores(); } catch { /* tabela opcional */ }

      const vendas = vendasRaw.map((v) => dbToVenda(v as DbRow));

      setState((s) => ({
        ...s,
        margem, clientes, vendas, vendedores,
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
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  const reload = useCallback(async () => {
    dataLoaded.current = false;
    await loadData();
  }, [loadData]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({ ...s, session }));
      if (session && !dataLoaded.current) loadData();
      if (!session) {
        dataLoaded.current = false;
        setState((s) => ({
          ...s, session: null, loading: false,
          clientes: [], vendas: [], vendedores: [],
          catalogoPerfumes: [], catalogoEletronicos: [],
        }));
      }
    });
    return () => subscription.unsubscribe();
  }, [loadData]);

  // ─── Clientes ───────────────────────────────────────────────────────────────

  async function addCliente(c: Omit<Cliente, "id">) {
    const novo = await insertCliente(c);
    setState((s) => ({ ...s, clientes: [{ ...novo }, ...s.clientes] }));
  }

  async function updateClienteAction(c: Cliente) {
    await updateCliente(c);
    setState((s) => ({ ...s, clientes: s.clientes.map((x) => x.id === c.id ? c : x) }));
  }

  async function deleteClienteAction(id: string) {
    await deleteCliente(id);
    setState((s) => ({ ...s, clientes: s.clientes.filter((c) => c.id !== id) }));
  }

  // ─── Vendas ─────────────────────────────────────────────────────────────────

  async function addVenda(venda: Omit<VendaPerfume, "id"> | Omit<VendaEletronico, "id">) {
    const base = {
      cliente: venda.cliente,
      telefone: venda.telefone ?? "",
      vendedor: venda.vendedor ?? "",
      tipo_pagamento: venda.tipoPagamento,
      observacoes: venda.observacoes,
      data: venda.data,
      status: venda.status,
      margem_usada: venda.margemUsada,
      valor_entrada: (venda as VendaPerfume).valorEntrada ?? 0,
    };
    const dbVenda = venda.tipo === "perfume"
      ? { ...base, tipo: "perfume" as const, perfume: (venda as VendaPerfume).perfume, preco_usd: (venda as VendaPerfume).precoUsd, cotacao: (venda as VendaPerfume).cotacao, preco_brl: (venda as VendaPerfume).precoBrl, valor_final: (venda as VendaPerfume).valorFinal }
      : { ...base, tipo: "eletronico" as const, produto: (venda as VendaEletronico).produto, preco_custo: (venda as VendaEletronico).precoCusto, preco_venda: (venda as VendaEletronico).precoVenda, lucro: (venda as VendaEletronico).lucro, is_usd: (venda as VendaEletronico).isUsd, preco_usd: (venda as VendaEletronico).precoUsd, cotacao: (venda as VendaEletronico).cotacao };
    const dbParcelas = venda.parcelas.map((p) => ({ numero: p.numero, total: p.total, vencimento: p.vencimento, status: p.status }));
    const nova = await insertVenda(dbVenda as Parameters<typeof insertVenda>[0], dbParcelas);

    // Atualiza estado local sem reload completo
    const novaVenda = dbToVenda({ ...nova, parcelas: dbParcelas.map((p, i) => ({ ...p, id: `tmp-${i}`, venda_id: nova.id, valor_pago: 0 })) } as DbRow);
    setState((s) => ({ ...s, vendas: [novaVenda, ...s.vendas] }));
  }

  async function updateVendaAction(id: string, fields: UpdateVendaFields) {
    const dbFields: Record<string, unknown> = {};

    // Mapeamento explícito de campos — sem 'any'
    if ("cliente"       in fields && fields.cliente       !== undefined) dbFields.cliente        = fields.cliente;
    if ("telefone"      in fields && fields.telefone      !== undefined) dbFields.telefone       = fields.telefone;
    if ("vendedor"      in fields && fields.vendedor      !== undefined) dbFields.vendedor       = fields.vendedor;
    if ("observacoes"   in fields && fields.observacoes   !== undefined) dbFields.observacoes    = fields.observacoes;
    if ("data"          in fields && fields.data          !== undefined) dbFields.data           = fields.data;
    if ("status"        in fields && fields.status        !== undefined) dbFields.status         = fields.status;
    if ("margemUsada"   in fields && fields.margemUsada   !== undefined) dbFields.margem_usada   = fields.margemUsada;
    if ("tipoPagamento" in fields && fields.tipoPagamento !== undefined) dbFields.tipo_pagamento = fields.tipoPagamento;
    if ("valorEntrada"  in fields && (fields as UpdateVendaPerfumeFields).valorEntrada !== undefined) dbFields.valor_entrada = (fields as UpdateVendaPerfumeFields).valorEntrada;

    // Campos de perfume
    if ("perfume"    in fields && (fields as UpdateVendaPerfumeFields).perfume    !== undefined) dbFields.perfume     = (fields as UpdateVendaPerfumeFields).perfume;
    if ("precoUsd"   in fields && (fields as UpdateVendaPerfumeFields).precoUsd   !== undefined) dbFields.preco_usd   = (fields as UpdateVendaPerfumeFields).precoUsd;
    if ("cotacao"    in fields && (fields as UpdateVendaPerfumeFields).cotacao    !== undefined) dbFields.cotacao     = (fields as UpdateVendaPerfumeFields).cotacao;
    if ("precoBrl"   in fields && (fields as UpdateVendaPerfumeFields).precoBrl   !== undefined) dbFields.preco_brl   = (fields as UpdateVendaPerfumeFields).precoBrl;
    if ("valorFinal" in fields && (fields as UpdateVendaPerfumeFields).valorFinal !== undefined) dbFields.valor_final = (fields as UpdateVendaPerfumeFields).valorFinal;

    // Campos de eletrônico
    if ("produto"    in fields && (fields as UpdateVendaEletronicoFields).produto    !== undefined) dbFields.produto     = (fields as UpdateVendaEletronicoFields).produto;
    if ("precoCusto" in fields && (fields as UpdateVendaEletronicoFields).precoCusto !== undefined) dbFields.preco_custo = (fields as UpdateVendaEletronicoFields).precoCusto;
    if ("precoVenda" in fields && (fields as UpdateVendaEletronicoFields).precoVenda !== undefined) dbFields.preco_venda = (fields as UpdateVendaEletronicoFields).precoVenda;
    if ("lucro"      in fields && (fields as UpdateVendaEletronicoFields).lucro      !== undefined) dbFields.lucro       = (fields as UpdateVendaEletronicoFields).lucro;
    if ("isUsd"      in fields && (fields as UpdateVendaEletronicoFields).isUsd      !== undefined) dbFields.is_usd      = (fields as UpdateVendaEletronicoFields).isUsd;

    await updateVenda(id, dbFields as Parameters<typeof updateVenda>[1]);

    // Recria parcelas no banco se foram passadas
    if ("parcelas" in fields && fields.parcelas !== undefined) {
      const parcelas = fields.parcelas as Parcela[];
      await recriarParcelas(id, parcelas.map((p) => ({
        numero: p.numero, total: p.total, vencimento: p.vencimento, status: p.status,
      })));
    }

    // Atualiza estado local otimisticamente — sem reload completo
    setState((s) => ({
      ...s,
      vendas: s.vendas.map((v) => {
        if (v.id !== id) return v;
        const parcelasAtualizadas = ("parcelas" in fields && fields.parcelas !== undefined)
          ? (fields.parcelas as Parcela[])
          : v.parcelas;
        return { ...v, ...fields, parcelas: parcelasAtualizadas };
      }),
    }));
  }

  async function deleteVendaAction(id: string) {
    await deleteVenda(id);
    setState((s) => ({ ...s, vendas: s.vendas.filter((v) => v.id !== id) }));
  }

  // ─── Parcelas ───────────────────────────────────────────────────────────────

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
        const novasParcelas = v.parcelas.map((p) =>
          p.numero === numeroParcela ? { ...p, status: "pago" as StatusPagamento } : p
        );
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

  // ─── Catálogos ──────────────────────────────────────────────────────────────

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

  // ─── Configurações ──────────────────────────────────────────────────────────

  async function setMargemAction(m: number) {
    await saveMargem(m);
    setState((s) => ({ ...s, margem: m }));
  }

  // ─── Vendedores ─────────────────────────────────────────────────────────────

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
  if (!ctx) throw new Error("useApp deve ser usado dentro do AppProvider");
  return ctx;
}

// ─── useCobrancas com cálculo correto de valor por parcela ───────────────────

export function useCobrancas() {
  const { state } = useApp();
  return state.vendas.flatMap((venda) => {
    if (venda.tipoPagamento !== "parcelado") return [];

    const valorTotal   = venda.tipo === "perfume" ? venda.valorFinal : venda.precoVenda;
    const valorEntrada = venda.valorEntrada ?? 0;
    // Parcelas normais (número > 0) — exclui a entrada
    const parcelasNormais  = venda.parcelas.filter((p) => p.numero > 0);
    const numNormais       = parcelasNormais.length;
    const valorParcNormal  = numNormais > 0 ? (valorTotal - valorEntrada) / numNormais : 0;

    return venda.parcelas
      .filter((p) => p.status !== "pago")
      .map((p) => ({
        vendaId:   venda.id,
        cliente:   venda.cliente,
        telefone:  venda.telefone,
        vendedor:  venda.vendedor,
        produto:   venda.tipo === "perfume" ? venda.perfume : venda.produto,
        parcela:   `${p.numero}/${p.total}`,
        // Usa valorPago se já registrado, senão calcula corretamente
        valor:     p.valorPago && p.valorPago > 0
          ? p.valorPago
          : p.numero === 0 ? valorEntrada : valorParcNormal,
        vencimento: p.vencimento,
        status:    p.status,
      }));
  });
}