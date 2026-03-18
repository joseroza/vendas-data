import {
  DollarSign, TrendingUp, Calendar, AlertTriangle, CheckCircle2,
  ArrowUpRight, Users, Droplets, Smartphone, ShoppingBag, UserCheck,
  CreditCard, Clock, BarChart2, Percent, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useState, useMemo } from "react";
import { useApp, useCobrancas } from "@/context/AppContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line,
} from "recharts";

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES = [
  { value: "janeiro",   label: "Janeiro",   num: 1  },
  { value: "fevereiro", label: "Fevereiro", num: 2  },
  { value: "marco",     label: "Março",     num: 3  },
  { value: "abril",     label: "Abril",     num: 4  },
  { value: "maio",      label: "Maio",      num: 5  },
  { value: "junho",     label: "Junho",     num: 6  },
  { value: "julho",     label: "Julho",     num: 7  },
  { value: "agosto",    label: "Agosto",    num: 8  },
  { value: "setembro",  label: "Setembro",  num: 9  },
  { value: "outubro",   label: "Outubro",   num: 10 },
  { value: "novembro",  label: "Novembro",  num: 11 },
  { value: "dezembro",  label: "Dezembro",  num: 12 },
];

const VENDEDOR_COLORS = ["#a855f7","#3b82f6","#10b981","#f59e0b","#ef4444","#06b6d4","#ec4899","#84cc16"];
const mesAtualValue   = MESES[new Date().getMonth()].value;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseData(data: string): Date {
  const [d, m, y] = data.split("/");
  return new Date(+y, +m - 1, +d);
}
function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtK(v: number) {
  if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
  return formatBRL(v);
}
function getLucro(venda: any): number {
  if (venda.tipo === "perfume") return venda.valorFinal - venda.precoBrl;
  return venda.lucro ?? (venda.precoVenda - venda.precoCusto);
}
function getCusto(venda: any): number {
  return venda.tipo === "perfume" ? (venda.precoBrl ?? 0) : (venda.precoCusto ?? 0);
}
function getValor(venda: any): number {
  return venda.tipo === "perfume" ? venda.valorFinal : venda.precoVenda;
}
function calcFinanceiro(venda: any) {
  const valor      = getValor(venda);
  const entradaVal = venda.valorEntrada || 0;
  if (venda.tipoPagamento === "parcelado" && venda.parcelas.length > 0) {
    const norm     = venda.parcelas.filter((p: any) => p.numero > 0);
    const valorPar = norm.length > 0 ? (valor - entradaVal) / norm.length : 0;
    let recebido   = 0;
    for (const p of venda.parcelas) {
      if (p.status === "pago") {
        recebido += p.valorPago && p.valorPago > 0 ? p.valorPago : p.numero === 0 ? entradaVal : valorPar;
      }
    }
    return { recebido, aReceber: Math.max(0, valor - recebido) };
  }
  return venda.status === "pago" ? { recebido: valor, aReceber: 0 } : { recebido: 0, aReceber: valor };
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
      {children}
    </p>
  );
}

function StatCard({
  icon: Icon, label, value, sub, color = "primary", large = false,
}: {
  icon: any; label: string; value: string; sub?: string;
  color?: "primary" | "success" | "warning" | "destructive" | "purple" | "blue";
  large?: boolean;
}) {
  const colorMap: Record<string, string> = {
    primary:     "bg-primary/10 text-primary",
    success:     "bg-success/10 text-success",
    warning:     "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
    purple:      "bg-purple-500/10 text-purple-500",
    blue:        "bg-blue-500/10 text-blue-500",
  };
  const textMap: Record<string, string> = {
    primary: "", success: "text-success", warning: "text-warning",
    destructive: "text-destructive", purple: "text-purple-500", blue: "text-blue-500",
  };
  return (
    <div className="glass-card rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      </div>
      <p className={`font-bold ${large ? "text-2xl" : "text-xl"} ${textMap[color]}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ProgressRow({
  label, recebido, total, color,
}: { label: string; recebido: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, (recebido / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Recebido: {formatBRL(recebido)}</span>
        <span>Total: {formatBRL(total)}</span>
      </div>
    </div>
  );
}

// ─── Dashboard principal ──────────────────────────────────────────────────────

export default function Dashboard() {
  const { state }  = useApp();
  const cobrancas  = useCobrancas();
  const [mes, setMes]                   = useState(mesAtualValue);
  const [vendedorFiltro, setVendedorFiltro] = useState("todos");

  const mesNum = MESES.find((m) => m.value === mes)?.num ?? new Date().getMonth() + 1;

  // Lista de vendedores únicos — todos, incluindo o admin se ele for vendedor
  const vendedoresNomes = useMemo(() => {
    const nomes = new Set<string>();
    for (const v of state.vendas) {
      const n = v.vendedor?.trim();
      if (n) nomes.add(n);
    }
    for (const v of (state.vendedores ?? [])) {
      if (v.nome?.trim()) nomes.add(v.nome.trim());
    }
    return Array.from(nomes).sort();
  }, [state.vendas, state.vendedores]);

  // Vendas filtradas
  const vendasFiltradas = useMemo(() =>
    vendedorFiltro === "todos"
      ? state.vendas
      : state.vendas.filter((v) => (v.vendedor ?? "").trim() === vendedorFiltro),
    [state.vendas, vendedorFiltro]
  );

  // ── Stats gerais (filtradas) ──────────────────────────────────────
  const stats = useMemo(() => {
    const hoje = new Date();
    let totalGeral = 0, custoGeral = 0, lucroGeral = 0;
    let totalMes = 0, custoMes = 0, lucroMes = 0;
    let totalRecebido = 0, totalAReceber = 0, totalSemana = 0;
    let numTotal = 0, numMes = 0, numPagas = 0, numPendentes = 0;
    let perfFat = 0, perfRec = 0, perfAR = 0, perfLucro = 0;
    let eletFat = 0, eletRec = 0, eletAR = 0, eletLucro = 0;

    for (const venda of vendasFiltradas) {
      const dt    = parseData(venda.data);
      const val   = getValor(venda);
      const custo = getCusto(venda);
      const lucro = getLucro(venda);
      const { recebido, aReceber } = calcFinanceiro(venda);

      totalGeral += val; custoGeral += custo; lucroGeral += lucro;
      totalRecebido += recebido; totalAReceber += aReceber; numTotal++;
      if (venda.status === "pago") numPagas++; else numPendentes++;

      if (dt.getMonth() + 1 === mesNum && dt.getFullYear() === hoje.getFullYear()) {
        totalMes += val; custoMes += custo; lucroMes += lucro; numMes++;
      }
      const dias = (hoje.getTime() - dt.getTime()) / 86400000;
      if (dias <= 7) totalSemana += val;

      if (venda.tipo === "perfume") {
        perfFat += val; perfRec += recebido; perfAR += aReceber; perfLucro += lucro;
      } else {
        eletFat += val; eletRec += recebido; eletAR += aReceber; eletLucro += lucro;
      }
    }

    return {
      totalGeral, custoGeral, lucroGeral, totalMes, custoMes, lucroMes,
      totalRecebido, totalAReceber, totalSemana, numTotal, numMes, numPagas, numPendentes,
      perfFat, perfRec, perfAR, perfLucro,
      eletFat, eletRec, eletAR, eletLucro,
      margemGeral: totalGeral > 0 ? (lucroGeral / totalGeral) * 100 : 0,
      margemMes:   totalMes   > 0 ? (lucroMes   / totalMes  ) * 100 : 0,
      txRecebimento: totalGeral > 0 ? (totalRecebido / totalGeral) * 100 : 0,
    };
  }, [vendasFiltradas, mesNum]);

  // ── Stats por vendedor — todos, incluindo admin se for vendedor ──
  const statsPorVendedor = useMemo(() => {
    const mapa: Record<string, {
      nome: string; total: number; recebido: number; pendente: number;
      lucro: number; numVendas: number;
    }> = {};
    for (const venda of state.vendas) {
      const nome = venda.vendedor?.trim();
      if (!nome) continue;
      const val  = getValor(venda);
      const { recebido, aReceber } = calcFinanceiro(venda);
      if (!mapa[nome]) mapa[nome] = { nome, total: 0, recebido: 0, pendente: 0, lucro: 0, numVendas: 0 };
      mapa[nome].total += val;
      mapa[nome].recebido += recebido;
      mapa[nome].pendente += aReceber;
      mapa[nome].lucro += getLucro(venda);
      mapa[nome].numVendas++;
    }
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [state.vendas]);

  const totalTodosVendedores = statsPorVendedor.reduce((s, v) => s + v.total, 0);

  // ── Gráfico barras — últimos 6 meses ─────────────────────────────
  const dadosBarras = useMemo(() => {
    const hoje = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1);
      const m = d.getMonth() + 1, y = d.getFullYear();
      let perfumes = 0, eletronicos = 0, lucro = 0;
      for (const venda of vendasFiltradas) {
        const vd = parseData(venda.data);
        if (vd.getMonth() + 1 === m && vd.getFullYear() === y) {
          if (venda.tipo === "perfume") perfumes += venda.valorFinal;
          else eletronicos += venda.precoVenda;
          lucro += getLucro(venda);
        }
      }
      return {
        mes: MESES[d.getMonth()].label.slice(0, 3),
        Perfumes: +perfumes.toFixed(2),
        Eletrônicos: +eletronicos.toFixed(2),
        Lucro: +lucro.toFixed(2),
      };
    });
  }, [vendasFiltradas]);

  // ── Gráfico linha — evolução acumulada ────────────────────────────
  const dadosLinha = useMemo(() => {
    const hoje = new Date();
    let acumulado = 0;
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1);
      const m = d.getMonth() + 1, y = d.getFullYear();
      let mes = 0;
      for (const venda of vendasFiltradas) {
        const vd = parseData(venda.data);
        if (vd.getMonth() + 1 === m && vd.getFullYear() === y) mes += getValor(venda);
      }
      acumulado += mes;
      return { mes: MESES[d.getMonth()].label.slice(0, 3), Acumulado: +acumulado.toFixed(2) };
    });
  }, [vendasFiltradas]);

  // ── Recentes ──────────────────────────────────────────────────────
  const vendasRecentes = useMemo(() =>
    [...vendasFiltradas].sort((a, b) => parseData(b.data).getTime() - parseData(a.data).getTime()).slice(0, 6),
    [vendasFiltradas]
  );

  const mesLabel = MESES.find((m) => m.value === mes)?.label ?? mes;
  const anoAtual = new Date().getFullYear();

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 max-w-7xl pb-10">

      {/* ══════════════════════════════════════
          HEADER
      ══════════════════════════════════════ */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {vendedorFiltro === "todos"
              ? `Visão completa · ${anoAtual}`
              : `Vendas de ${vendedorFiltro} · ${anoAtual}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {vendedoresNomes.length > 0 && (
            <Select value={vendedorFiltro} onValueChange={setVendedorFiltro}>
              <SelectTrigger className="w-[180px]">
                <UserCheck className="h-3.5 w-3.5 mr-1 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os vendedores</SelectItem>
                {vendedoresNomes.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[148px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* badge filtro ativo */}
      {vendedorFiltro !== "todos" && (
        <div className="flex items-center gap-2 -mt-4">
          <Badge variant="secondary" className="gap-1.5 text-xs py-1">
            <UserCheck className="h-3 w-3" />
            Filtrando: <strong>{vendedorFiltro}</strong>
          </Badge>
          <button onClick={() => setVendedorFiltro("todos")}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <X className="h-3 w-3" /> Limpar
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════
          SEÇÃO 1 — KPIs FINANCEIROS GERAIS
      ══════════════════════════════════════ */}
      <section>
        <SectionLabel><DollarSign className="h-3.5 w-3.5" /> Resumo Financeiro Geral</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={ShoppingBag} label="Total de Vendas"  value={String(stats.numTotal)}        sub="vendas realizadas"                  large />
          <StatCard icon={DollarSign}  label="Faturamento"      value={formatBRL(stats.totalGeral)}   sub={`Custo: ${formatBRL(stats.custoGeral)}`} />
          <StatCard icon={TrendingUp}  label="Lucro Total"      value={formatBRL(stats.lucroGeral)}   sub={`Margem: ${stats.margemGeral.toFixed(1)}%`} color="success" />
          <StatCard icon={CheckCircle2} label="Total Recebido"  value={formatBRL(stats.totalRecebido)} sub={`A receber: ${formatBRL(stats.totalAReceber)}`} color="success" />
        </div>

        {/* Segunda linha — indicadores secundários */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <StatCard icon={Percent}     label="Taxa de Recebimento" value={`${stats.txRecebimento.toFixed(1)}%`} sub="do faturado já recebido" color="blue" />
          <StatCard icon={CreditCard}  label="Vendas Pagas"        value={String(stats.numPagas)}               sub={`${stats.numPendentes} pendentes`} color="success" />
          <StatCard icon={Clock}       label="Últimos 7 dias"      value={formatBRL(stats.totalSemana)}         sub="faturamento semanal" color="warning" />
          <StatCard icon={BarChart2}   label="Ticket Médio"        value={stats.numTotal > 0 ? formatBRL(stats.totalGeral / stats.numTotal) : "R$ 0"} sub="por venda" />
        </div>
      </section>

      {/* ══════════════════════════════════════
          SEÇÃO 2 — POR VENDEDOR
      ══════════════════════════════════════ */}
      {statsPorVendedor.length > 0 && (
        <section>
          <SectionLabel><Users className="h-3.5 w-3.5" /> Performance por Vendedor</SectionLabel>

          {/* Totalizador */}
          <div className="glass-card rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <p className="text-sm font-semibold text-muted-foreground">Consolidado — todos os vendedores</p>
              <div className="flex gap-6 text-sm">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Faturamento</p>
                  <p className="font-bold">{formatBRL(totalTodosVendedores)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Recebido</p>
                  <p className="font-bold text-success">{formatBRL(statsPorVendedor.reduce((s, v) => s + v.recebido, 0))}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Pendente</p>
                  <p className="font-bold text-warning">{formatBRL(statsPorVendedor.reduce((s, v) => s + v.pendente, 0))}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Lucro</p>
                  <p className="font-bold text-success">{formatBRL(statsPorVendedor.reduce((s, v) => s + v.lucro, 0))}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Cards clicáveis por vendedor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {statsPorVendedor.map((v, idx) => {
              const cor    = VENDEDOR_COLORS[idx % VENDEDOR_COLORS.length];
              const pct    = totalTodosVendedores > 0 ? (v.total / totalTodosVendedores) * 100 : 0;
              const pctRec = v.total > 0 ? (v.recebido / v.total) * 100 : 0;
              const isAtivo = vendedorFiltro === v.nome;
              return (
                <button
                  key={v.nome}
                  onClick={() => setVendedorFiltro(isAtivo ? "todos" : v.nome)}
                  className={`glass-card rounded-xl p-4 space-y-3 text-left w-full transition-all border-2 ${
                    isAtivo ? "border-primary/60 ring-1 ring-primary/20" : "border-transparent hover:border-border"
                  }`}
                >
                  {/* Cabeçalho */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                        style={{ backgroundColor: cor }}
                      >
                        {v.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight">{v.nome}</p>
                        <p className="text-[11px] text-muted-foreground">{v.numVendas} venda{v.numVendas !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{pct.toFixed(0)}% do total</Badge>
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Faturado</p>
                      <p className="text-[11px] font-semibold">{fmtK(v.total)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Recebido</p>
                      <p className="text-[11px] font-semibold text-success">{fmtK(v.recebido)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Pendente</p>
                      <p className="text-[11px] font-semibold text-warning">{fmtK(v.pendente)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Lucro</p>
                      <p className={`text-[11px] font-semibold ${v.lucro >= 0 ? "text-success" : "text-destructive"}`}>{fmtK(v.lucro)}</p>
                    </div>
                  </div>

                  {/* Barra de recebimento */}
                  <div className="space-y-1">
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pctRec}%`, backgroundColor: cor }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-right">{pctRec.toFixed(0)}% recebido</p>
                  </div>

                  {isAtivo && (
                    <p className="text-[10px] text-primary text-center font-medium">Clique para remover filtro</p>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════
          SEÇÃO 3 — MÊS SELECIONADO
      ══════════════════════════════════════ */}
      <section>
        <SectionLabel><Calendar className="h-3.5 w-3.5" /> {mesLabel} {anoAtual}</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={ShoppingBag} label="Vendas no Mês"   value={String(stats.numMes)}        sub={`em ${mesLabel}`}                       large color="blue" />
          <StatCard icon={DollarSign}  label="Faturamento"     value={formatBRL(stats.totalMes)}   sub={`Custo: ${formatBRL(stats.custoMes)}`}  color="blue" />
          <StatCard icon={TrendingUp}  label="Lucro do Mês"    value={formatBRL(stats.lucroMes)}   sub={`Margem: ${stats.margemMes.toFixed(1)}%`} color="success" />
          <StatCard icon={ArrowUpRight} label="Ticket Médio"   value={stats.numMes > 0 ? formatBRL(stats.totalMes / stats.numMes) : "R$ 0"} sub="por venda no mês" color="warning" />
        </div>
      </section>

      {/* ══════════════════════════════════════
          SEÇÃO 4 — POR CATEGORIA
      ══════════════════════════════════════ */}
      <section>
        <SectionLabel><BarChart2 className="h-3.5 w-3.5" /> Resultado por Categoria</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* Perfumes */}
          <div className="glass-card rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Droplets className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Perfumes</p>
                  <p className="text-xs text-muted-foreground">Lucro: <span className="text-success font-medium">{formatBRL(stats.perfLucro)}</span></p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs" style={{ borderColor: "#a855f7", color: "#a855f7" }}>
                {stats.perfFat > 0 ? ((stats.perfLucro / stats.perfFat) * 100).toFixed(1) : 0}% margem
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="glass-card rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground mb-1">Faturamento</p>
                <p className="font-semibold text-sm">{formatBRL(stats.perfFat)}</p>
              </div>
              <div className="glass-card rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground mb-1">Recebido</p>
                <p className="font-semibold text-sm text-success">{formatBRL(stats.perfRec)}</p>
              </div>
              <div className="glass-card rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground mb-1">A Receber</p>
                <p className="font-semibold text-sm text-warning">{formatBRL(stats.perfAR)}</p>
              </div>
            </div>
            <ProgressRow label="Recebimento" recebido={stats.perfRec} total={stats.perfFat} color="#a855f7" />
          </div>

          {/* Eletrônicos */}
          <div className="glass-card rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Smartphone className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Eletrônicos</p>
                  <p className="text-xs text-muted-foreground">Lucro: <span className="text-success font-medium">{formatBRL(stats.eletLucro)}</span></p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs" style={{ borderColor: "#3b82f6", color: "#3b82f6" }}>
                {stats.eletFat > 0 ? ((stats.eletLucro / stats.eletFat) * 100).toFixed(1) : 0}% margem
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="glass-card rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground mb-1">Faturamento</p>
                <p className="font-semibold text-sm">{formatBRL(stats.eletFat)}</p>
              </div>
              <div className="glass-card rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground mb-1">Recebido</p>
                <p className="font-semibold text-sm text-success">{formatBRL(stats.eletRec)}</p>
              </div>
              <div className="glass-card rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground mb-1">A Receber</p>
                <p className="font-semibold text-sm text-warning">{formatBRL(stats.eletAR)}</p>
              </div>
            </div>
            <ProgressRow label="Recebimento" recebido={stats.eletRec} total={stats.eletFat} color="#3b82f6" />
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════
          SEÇÃO 5 — GRÁFICOS
      ══════════════════════════════════════ */}
      <section>
        <SectionLabel><TrendingUp className="h-3.5 w-3.5" /> Evolução — Últimos 6 Meses</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Barras por categoria */}
          <div className="glass-card rounded-xl p-5">
            <p className="text-xs font-semibold text-muted-foreground mb-4">Vendas por Categoria</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dadosBarras} barGap={4} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtK} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => formatBRL(v)}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Perfumes"    fill="#a855f7" radius={[4,4,0,0]} />
                <Bar dataKey="Eletrônicos" fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Linha de lucro */}
          <div className="glass-card rounded-xl p-5">
            <p className="text-xs font-semibold text-muted-foreground mb-4">Faturamento Acumulado</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dadosLinha}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtK} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => formatBRL(v)}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="Acumulado" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: "#10b981" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Lucro por mês */}
          <div className="glass-card rounded-xl p-5 lg:col-span-2">
            <p className="text-xs font-semibold text-muted-foreground mb-4">Lucro por Mês</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dadosBarras} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtK} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => formatBRL(v)}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="Lucro" fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════
          SEÇÃO 6 — COBRANÇAS + RECENTES
      ══════════════════════════════════════ */}
      <section>
        <SectionLabel><AlertTriangle className="h-3.5 w-3.5" /> Pendências e Atividade Recente</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Cobranças pendentes */}
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" /> Cobranças Pendentes
              </h2>
              <Badge variant="destructive" className="text-xs">{cobrancas.length}</Badge>
            </div>
            {cobrancas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-success mb-2 opacity-60" />
                <p className="text-sm text-muted-foreground">Nenhuma pendência!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cobrancas.slice(0, 5).map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50 hover:bg-muted/70 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{c.cliente}</p>
                      <p className="text-xs text-muted-foreground">
                        Parcela {c.parcela} · Venc: {c.vencimento}
                        {c.vendedor && <span className="ml-1 opacity-60">· {c.vendedor}</span>}
                      </p>
                    </div>
                    <span className="font-semibold text-sm ml-3 shrink-0 text-warning">{formatBRL(c.valor)}</span>
                  </div>
                ))}
              </div>
            )}
            {cobrancas.length > 5 && (
              <Button variant="ghost" size="sm" className="mt-3 w-full text-xs" asChild>
                <Link to="/cobrancas">Ver todas as cobranças ({cobrancas.length})</Link>
              </Button>
            )}
          </div>

          {/* Vendas recentes */}
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-primary" /> Vendas Recentes
              </h2>
              {vendedorFiltro !== "todos" && (
                <Badge variant="secondary" className="text-xs">{vendedorFiltro}</Badge>
              )}
            </div>
            <div className="space-y-2">
              {vendasRecentes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground mb-2 opacity-40" />
                  <p className="text-sm text-muted-foreground">Nenhuma venda registrada.</p>
                </div>
              ) : vendasRecentes.map((v) => {
                const valor   = getValor(v);
                const lucro   = getLucro(v);
                const produto = v.tipo === "perfume"
                  ? v.perfume.replace(/\|/g, " ").split(",")[0]
                  : v.produto.replace(/\|/g, " ").split(",")[0];
                const statusColor = v.status === "pago" ? "text-success" : v.status === "atrasado" ? "text-destructive" : "text-warning";
                return (
                  <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50 hover:bg-muted/70 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="text-base shrink-0">{v.tipo === "perfume" ? "🧴" : "📱"}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{v.cliente}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {produto} · {v.data}
                          {v.vendedor && <span className="ml-1 opacity-60">· {v.vendedor}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="font-semibold text-sm">{formatBRL(valor)}</p>
                      <p className={`text-[11px] font-medium ${lucro >= 0 ? "text-success" : "text-destructive"}`}>
                        +{formatBRL(lucro)}
                      </p>
                      <p className={`text-[10px] capitalize ${statusColor}`}>{v.status}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}