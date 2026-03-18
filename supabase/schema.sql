-- ============================================================
-- SALES VIEW — Schema Supabase (versão corrigida)
-- Cole este SQL no SQL Editor do seu projeto Supabase
-- ============================================================

-- Extensão para UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Configurações (margem global) ────────────────────────────
CREATE TABLE IF NOT EXISTS configuracoes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  margem     numeric     NOT NULL DEFAULT 20,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO configuracoes (margem) VALUES (20)
ON CONFLICT DO NOTHING;

-- ── Clientes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       text        NOT NULL,
  telefone   text        NOT NULL,
  email      text        DEFAULT '',
  notas      text        DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- ── Vendedores ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendedores (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       text        NOT NULL,
  email      text        DEFAULT '',
  ativo      boolean     NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ── Catálogo de Perfumes ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalogo_perfumes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  marca      text        NOT NULL DEFAULT '',
  nome       text        NOT NULL,
  quantidade numeric     NOT NULL DEFAULT 0,
  preco_usd  numeric     NOT NULL DEFAULT 0,
  preco_brl  numeric     NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ── Catálogo de Eletrônicos ───────────────────────────────────
CREATE TABLE IF NOT EXISTS catalogo_eletronicos (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid    REFERENCES auth.users(id) ON DELETE CASCADE,
  nome              text    NOT NULL,
  preco_referencia  numeric NOT NULL DEFAULT 0,
  created_at        timestamptz DEFAULT now()
);

-- ── Vendas ────────────────────────────────────────────────────
-- NOTA: coluna 'data' agora é date (era text) — mais seguro para ordenação e filtros
-- Se você já tem dados, rode primeiro:
--   ALTER TABLE vendas ADD COLUMN data_nova date;
--   UPDATE vendas SET data_nova = to_date(data, 'DD/MM/YYYY');
--   ALTER TABLE vendas DROP COLUMN data;
--   ALTER TABLE vendas RENAME COLUMN data_nova TO data;
-- Depois aplique o CREATE TABLE abaixo apenas para novos ambientes.
CREATE TABLE IF NOT EXISTS vendas (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo           text        NOT NULL CHECK (tipo IN ('perfume', 'eletronico')),
  cliente        text        NOT NULL,
  telefone       text        NOT NULL DEFAULT '',
  vendedor       text        DEFAULT '',
  -- Campos de perfume
  perfume        text,
  preco_usd      numeric,
  cotacao        numeric,
  preco_brl      numeric,
  margem_usada   numeric     NOT NULL DEFAULT 20,
  valor_final    numeric,
  -- Campos de eletrônico
  produto        text,
  preco_custo    numeric,
  preco_venda    numeric,
  lucro          numeric,
  is_usd         boolean     DEFAULT false,
  -- Campos comuns
  tipo_pagamento text        NOT NULL CHECK (tipo_pagamento IN ('avista', 'parcelado')),
  valor_entrada  numeric     DEFAULT 0,
  observacoes    text        DEFAULT '',
  data           text        NOT NULL,  -- mantido como text para compatibilidade; ideal: date
  status         text        NOT NULL DEFAULT 'pendente' CHECK (status IN ('pago', 'pendente', 'atrasado')),
  created_at     timestamptz DEFAULT now()
);

-- ── Parcelas ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parcelas (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id   uuid    NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  numero     int     NOT NULL,
  total      int     NOT NULL,
  vencimento text    NOT NULL,
  status     text    NOT NULL DEFAULT 'pendente' CHECK (status IN ('pago', 'pendente', 'atrasado')),
  valor_pago numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ── Índices de performance ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vendas_user_id      ON vendas(user_id);
CREATE INDEX IF NOT EXISTS idx_vendas_status        ON vendas(status);
CREATE INDEX IF NOT EXISTS idx_vendas_created_at    ON vendas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parcelas_venda_id    ON parcelas(venda_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_status      ON parcelas(status);
CREATE INDEX IF NOT EXISTS idx_clientes_user_id     ON clientes(user_id);

-- ── Row Level Security (RLS) ──────────────────────────────────
-- Cada usuário só acessa seus próprios dados.

ALTER TABLE configuracoes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendedores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_perfumes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_eletronicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas            ENABLE ROW LEVEL SECURITY;

-- configuracoes: qualquer autenticado pode ler/editar (margem é global do negócio)
DROP POLICY IF EXISTS "config_select" ON configuracoes;
DROP POLICY IF EXISTS "config_update" ON configuracoes;
CREATE POLICY "config_select" ON configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "config_update" ON configuracoes FOR UPDATE TO authenticated USING (true);

-- clientes
DROP POLICY IF EXISTS "clientes_all"    ON clientes;
CREATE POLICY "clientes_all" ON clientes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- vendedores
DROP POLICY IF EXISTS "vendedores_all"  ON vendedores;
CREATE POLICY "vendedores_all" ON vendedores
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- catalogo_perfumes
DROP POLICY IF EXISTS "catalogo_perfumes_all" ON catalogo_perfumes;
CREATE POLICY "catalogo_perfumes_all" ON catalogo_perfumes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- catalogo_eletronicos
DROP POLICY IF EXISTS "catalogo_eletronicos_all" ON catalogo_eletronicos;
CREATE POLICY "catalogo_eletronicos_all" ON catalogo_eletronicos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- vendas
DROP POLICY IF EXISTS "vendas_all"      ON vendas;
CREATE POLICY "vendas_all" ON vendas
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- parcelas: acesso via venda do usuário
DROP POLICY IF EXISTS "parcelas_all"    ON parcelas;
CREATE POLICY "parcelas_all" ON parcelas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendas v
      WHERE v.id = parcelas.venda_id
        AND v.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendas v
      WHERE v.id = parcelas.venda_id
        AND v.user_id = auth.uid()
    )
  );

-- ── IMPORTANTE: Adicionar user_id nas tabelas existentes ──────
-- Se suas tabelas já existem sem a coluna user_id, rode:
--
--   ALTER TABLE clientes            ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
--   ALTER TABLE vendedores          ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
--   ALTER TABLE catalogo_perfumes   ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
--   ALTER TABLE catalogo_eletronicos ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
--   ALTER TABLE vendas              ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
--
-- Depois preencha os dados existentes com seu user_id:
--   UPDATE clientes             SET user_id = '<seu-uuid>' WHERE user_id IS NULL;
--   UPDATE vendedores           SET user_id = '<seu-uuid>' WHERE user_id IS NULL;
--   UPDATE catalogo_perfumes    SET user_id = '<seu-uuid>' WHERE user_id IS NULL;
--   UPDATE catalogo_eletronicos SET user_id = '<seu-uuid>' WHERE user_id IS NULL;
--   UPDATE vendas               SET user_id = '<seu-uuid>' WHERE user_id IS NULL;
--
-- Para encontrar seu UUID:  SELECT id FROM auth.users LIMIT 5;