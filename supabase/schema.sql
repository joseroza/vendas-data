-- ============================================================
-- SALES VIEW — Schema Supabase
-- Cole este SQL no SQL Editor do seu projeto Supabase
-- ============================================================

-- Extensão para UUID
create extension if not exists "pgcrypto";

-- ── Configurações (margem global) ────────────────────────────
create table if not exists configuracoes (
  id uuid primary key default gen_random_uuid(),
  margem numeric not null default 20,
  updated_at timestamptz default now()
);

-- Insere linha padrão
insert into configuracoes (margem) values (20)
on conflict do nothing;

-- ── Clientes ─────────────────────────────────────────────────
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  email text default '',
  notas text default '',
  created_at timestamptz default now()
);

-- ── Catálogo de Perfumes ──────────────────────────────────────
create table if not exists catalogo_perfumes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  preco_usd numeric not null default 0,
  preco_brl numeric not null default 0,
  created_at timestamptz default now()
);

-- ── Catálogo de Eletrônicos ───────────────────────────────────
create table if not exists catalogo_eletronicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  preco_referencia numeric not null default 0,
  created_at timestamptz default now()
);

-- ── Vendas ────────────────────────────────────────────────────
create table if not exists vendas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('perfume', 'eletronico')),
  cliente text not null,
  telefone text not null,
  -- Campos de perfume
  perfume text,
  preco_usd numeric,
  cotacao numeric,
  preco_brl numeric,
  margem_usada numeric not null default 20,
  valor_final numeric,
  -- Campos de eletrônico
  produto text,
  preco_custo numeric,
  preco_venda numeric,
  lucro numeric,
  is_usd boolean default false,
  -- Campos comuns
  tipo_pagamento text not null check (tipo_pagamento in ('avista', 'parcelado')),
  observacoes text default '',
  data text not null,
  status text not null default 'pendente' check (status in ('pago', 'pendente', 'atrasado')),
  created_at timestamptz default now()
);

-- ── Parcelas ─────────────────────────────────────────────────
create table if not exists parcelas (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references vendas(id) on delete cascade,
  numero int not null,
  total int not null,
  vencimento text not null,
  status text not null default 'pendente' check (status in ('pago', 'pendente', 'atrasado')),
  created_at timestamptz default now()
);

-- ── Row Level Security (RLS) ─────────────────────────────────
-- Habilita RLS em todas as tabelas (segurança)
alter table configuracoes enable row level security;
alter table clientes enable row level security;
alter table catalogo_perfumes enable row level security;
alter table catalogo_eletronicos enable row level security;
alter table vendas enable row level security;
alter table parcelas enable row level security;

-- Políticas: permite tudo para usuários autenticados
create policy "Authenticated full access" on configuracoes
  for all using (auth.role() = 'authenticated');

create policy "Authenticated full access" on clientes
  for all using (auth.role() = 'authenticated');

create policy "Authenticated full access" on catalogo_perfumes
  for all using (auth.role() = 'authenticated');

create policy "Authenticated full access" on catalogo_eletronicos
  for all using (auth.role() = 'authenticated');

create policy "Authenticated full access" on vendas
  for all using (auth.role() = 'authenticated');

create policy "Authenticated full access" on parcelas
  for all using (auth.role() = 'authenticated');
