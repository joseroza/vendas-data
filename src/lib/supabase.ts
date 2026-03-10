import { createClient } from "@supabase/supabase-js";

// ─── Configuração ─────────────────────────────────────────────────────────────
// Substitua pelos valores do seu projeto Supabase:
// Project Settings → API → Project URL e anon public key

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Cliente Admin (usa service_role key — só para painel admin) ──────────────
const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY as string;
export const supabaseAdmin = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

// ─── Tipos do banco (snake_case → camelCase) ──────────────────────────────────

export type DbCliente = {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  notas: string;
};

export type DbVenda = {
  id: string;
  tipo: "perfume" | "eletronico";
  cliente: string;
  telefone: string;
  perfume?: string;
  preco_usd?: number;
  cotacao?: number;
  preco_brl?: number;
  margem_usada: number;
  valor_final?: number;
  produto?: string;
  preco_custo?: number;
  preco_venda?: number;
  lucro?: number;
  is_usd?: boolean;
  tipo_pagamento: "avista" | "parcelado";
  observacoes: string;
  data: string;
  status: "pago" | "pendente" | "atrasado";
};

export type DbParcela = {
  id: string;
  venda_id: string;
  numero: number;
  total: number;
  vencimento: string;
  status: "pago" | "pendente" | "atrasado";
};

export type DbProdutoPerfume = {
  id: string;
  marca: string;
  nome: string;
  quantidade: number;
  preco_usd: number;
  preco_brl: number;
};

export type DbProdutoEletronico = {
  id: string;
  nome: string;
  preco_referencia: number;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ─── Configurações ────────────────────────────────────────────────────────────

export async function fetchMargem(): Promise<number> {
  const { data, error } = await supabase
    .from("configuracoes")
    .select("margem")
    .limit(1)
    .single();
  if (error) throw error;
  return data.margem;
}

export async function saveMargem(margem: number): Promise<void> {
  const { error } = await supabase
    .from("configuracoes")
    .update({ margem, updated_at: new Date().toISOString() })
    .neq("id", "00000000-0000-0000-0000-000000000000"); // atualiza todas as linhas
  if (error) throw error;
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

export async function fetchClientes(): Promise<DbCliente[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function insertCliente(cliente: Omit<DbCliente, "id">): Promise<DbCliente> {
  const { data, error } = await supabase
    .from("clientes")
    .insert(cliente)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCliente(cliente: DbCliente): Promise<void> {
  const { error } = await supabase
    .from("clientes")
    .update({ nome: cliente.nome, telefone: cliente.telefone, email: cliente.email, notas: cliente.notas })
    .eq("id", cliente.id);
  if (error) throw error;
}

export async function deleteCliente(id: string): Promise<void> {
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) throw error;
}

// ─── Vendas ───────────────────────────────────────────────────────────────────

export async function fetchVendas(): Promise<(DbVenda & { parcelas: DbParcela[] })[]> {
  const { data, error } = await supabase
    .from("vendas")
    .select("*, parcelas(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function insertVenda(
  venda: Omit<DbVenda, "id">,
  parcelas: Omit<DbParcela, "id" | "venda_id">[]
): Promise<DbVenda> {
  const { data, error } = await supabase
    .from("vendas")
    .insert(venda)
    .select()
    .single();
  if (error) throw error;

  if (parcelas.length > 0) {
    const { error: pError } = await supabase
      .from("parcelas")
      .insert(parcelas.map((p) => ({ ...p, venda_id: data.id })));
    if (pError) throw pError;
  }

  return data;
}

export async function updateParcelaStatus(
  parcelaVendaId: string,
  numeroParcela: number,
  status: "pago" | "pendente"
): Promise<void> {
  const { error } = await supabase
    .from("parcelas")
    .update({ status })
    .eq("venda_id", parcelaVendaId)
    .eq("numero", numeroParcela);
  if (error) throw error;
}

export async function updateVendaStatus(
  vendaId: string,
  status: "pago" | "pendente"
): Promise<void> {
  const { error } = await supabase
    .from("vendas")
    .update({ status })
    .eq("id", vendaId);
  if (error) throw error;

  if (status === "pago") {
    const { error: pError } = await supabase
      .from("parcelas")
      .update({ status: "pago" })
      .eq("venda_id", vendaId);
    if (pError) throw pError;
  }
}

// ─── Catálogo Perfumes ────────────────────────────────────────────────────────

export async function fetchCatalogoPerfumes(): Promise<DbProdutoPerfume[]> {
  const { data, error } = await supabase
    .from("catalogo_perfumes")
    .select("*")
    .order("nome");
  if (error) throw error;
  return data;
}

export async function insertProdutoPerfume(p: Omit<DbProdutoPerfume, "id">): Promise<DbProdutoPerfume> {
  const { data, error } = await supabase
    .from("catalogo_perfumes")
    .insert(p)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProdutoPerfume(id: string): Promise<void> {
  const { error } = await supabase.from("catalogo_perfumes").delete().eq("id", id);
  if (error) throw error;
}

// ─── Catálogo Eletrônicos ─────────────────────────────────────────────────────

export async function fetchCatalogoEletronicos(): Promise<DbProdutoEletronico[]> {
  const { data, error } = await supabase
    .from("catalogo_eletronicos")
    .select("*")
    .order("nome");
  if (error) throw error;
  return data;
}

export async function insertProdutoEletronico(p: Omit<DbProdutoEletronico, "id">): Promise<DbProdutoEletronico> {
  const { data, error } = await supabase
    .from("catalogo_eletronicos")
    .insert(p)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProdutoEletronico(id: string): Promise<void> {
  const { error } = await supabase.from("catalogo_eletronicos").delete().eq("id", id);
  if (error) throw error;
}