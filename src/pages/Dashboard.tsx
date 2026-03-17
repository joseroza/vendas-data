import { KpiCard } from "@/components/KpiCard";
import {
  DollarSign, TrendingUp, Calendar, Clock, AlertTriangle,
  CheckCircle2, ArrowUpRight, Users, Droplets, Smartphone, ShoppingBag,
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
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

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

const mesAtualValue = MESES[new Date().getMonth()].value;

function parseData(data: string): Date {
  const [d, m, y] = data.split("/");
  return new Date(+y, +m - 1, +d);
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getLucro(venda: any): number {
  if (venda.tipo === "perfume") return venda.valorFinal - venda.precoBrl;
  return venda.lucro ?? (venda.precoVenda - venda.precoCusto);
}

function getCusto(venda: any): number {
  if (venda.tipo === "perfume") return venda.precoBrl ?? 0;
  return venda.precoCusto ?? 0;
}

function calcRecebidoAReceber(venda: any) {
  const valor      = venda.tipo === "perfume" ? venda.valorFinal : venda.precoVenda;
  const entradaVal = venda.valorEntrada || 0;

  if (venda.tipoPagamento === "parcelado" && venda.parcelas.length > 0) {
    const parcelasNorm = venda.parcelas.filter((p: any) => p.numero > 0);
    const valorParc    = parcelasNorm.length > 0 ? (valor - entradaVal) / parcelasNorm.length : 0;
    let recebido = 0;
    for (const p of venda.parcelas) {
      if (p.status === "pago") {
        const vPago = p.valorPago && p.valorPago > 0 ? p.valorPago : (p.numero === 0 ? entradaVal : valorParc);
        recebido += vPago;
      }
    }
    return { recebido, aReceber: Math.max(0, valor - recebido) };
  }
  if (venda.status === "pago") return { recebido: valor, aReceber: 0 };
  return { recebido: 0, aReceber: valor };
}

export default function Dashboard() {
  const { state } = useApp();
  const cobrancas  = useCobrancas();
  const [mes, setMes] = useState(mesAtualValue);

  const mesNum = MESES.find((m) => m.value === mes)?.num ?? new Date().getMonth() + 1;

  const stats = useMemo(() => {
    const hoje = new Date();

    let totalGeral    = 0; let custoGeral  = 0; let lucroGeral  = 0;
    let totalMes      = 0; let custoMes    = 0; let lucroMes    = 0;
    let totalRecebido = 0; let totalAReceber = 0;
    let totalSemana   = 0; let totalHoje   = 0;
    let numVendasTotal = 0; let numVendasMes = 0;

    // Por categoria
    let perfumeFaturamento = 0; let perfumeAReceber = 0; let perfumeRecebido = 0;
    let eletronicoFaturamento = 0; let eletronicoAReceber = 0; let eletronicoRecebido = 0;

    for (const venda of state.vendas) {
      const data  = parseData(venda.data);
      const valor = venda.tipo === "perfume" ? venda.valorFinal : venda.precoVenda;
      const custo = getCusto(venda);
      const lucro = getLucro(venda);
      const { recebido, aReceber } = calcRecebidoAReceber(venda);

      totalGeral += valor; custoGeral += custo; lucroGeral += lucro;
      totalRecebido += recebido; totalAReceber += aReceber;
      numVendasTotal++;

      if (data.getMonth() + 1 === mesNum && data.getFullYear() === hoje.getFullYear()) {
        totalMes += valor; custoMes += custo; lucroMes += lucro; numVendasMes++;
      }

      const diffDias = (hoje.getTime() - data.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDias <= 7) totalSemana += valor;
      if (diffDias < 1)  totalHoje   += valor;

      if (venda.tipo === "perfume") {
        perfumeFaturamento += valor; perfumeRecebido += recebido; perfumeAReceber += aReceber;
      } else {
        eletronicoFaturamento += valor; eletronicoRecebido += recebido; eletronicoAReceber += aReceber;
      }
    }

    return {
      totalGeral, custoGeral, lucroGeral,
      totalMes, custoMes, lucroMes,
      totalRecebido, totalAReceber,
      totalSemana, totalHoje,
      numVendasTotal, numVendasMes,
      perfumeFaturamento, perfumeAReceber, perfumeRecebido,
      eletronicoFaturamento, eletronicoAReceber, eletronicoRecebido,
    };
  }, [state.vendas, mesNum]);

  // Gráfico: vendas por mês (últimos 6 meses)
  const dadosGrafico = useMemo(() => {
    const hoje = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d   = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1);
      const m   = d.getMonth() + 1;
      const y   = d.getFullYear();
      const label = MESES[d.getMonth()].label.slice(0, 3);
      let perfumes = 0; let eletronicos = 0;
      for (const venda of state.vendas) {
        const vd = parseData(venda.data);
        if (vd.getMonth() + 1 === m && vd.getFullYear() === y) {
          if (venda.tipo === "perfume") perfumes    += venda.valorFinal;
          else                          eletronicos += venda.precoVenda;
        }
      }
      return { mes: label, Perfumes: +perfumes.toFixed(2), Eletrônicos: +eletronicos.toFixed(2) };
    });
  }, [state.vendas]);

  const vendasRecentes  = useMemo(() =>
    [...state.vendas].sort((a, b) => parseData(b.data).getTime() - parseData(a.data).getTime()).slice(0, 5),
    [state.vendas]
  );
  const cobrancasRecentes = cobrancas.slice(0, 4);
  const mesLabel = MESES.find((m) => m.value === mes)?.label ?? mes;

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral das suas vendas</p>
        </div>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MESES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* ── BLOCO 1: Totais gerais ─────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Acumulado Geral</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

          <div className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShoppingBag className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground">Total de Vendas</p>
            </div>
            <p className="text-2xl font-bold">{stats.numVendasTotal}</p>
            <p className="text-xs text-muted-foreground">vendas realizadas</p>
          </div>

          <div className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground">Faturamento</p>
            </div>
            <p className="text-xl font-bold">{formatBRL(stats.totalGeral)}</p>
            <p className="text-xs text-muted-foreground">Custo: {formatBRL(stats.custoGeral)}</p>
          </div>

          <div className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-success" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground">Lucro Total</p>
            </div>
            <p className={`text-xl font-bold ${stats.lucroGeral >= 0 ? "text-success" : "text-destructive"}`}>
              {formatBRL(stats.lucroGeral)}
            </p>
            <p className="text-xs text-muted-foreground">
              Margem: {stats.totalGeral > 0 ? ((stats.lucroGeral / stats.totalGeral) * 100).toFixed(1) : 0}%
            </p>
          </div>

          <div className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground">Total Recebido</p>
            </div>
            <p className="text-xl font-bold text-success">{formatBRL(stats.totalRecebido)}</p>
            <p className="text-xs text-muted-foreground">A receber: {formatBRL(stats.totalAReceber)}</p>
          </div>

        </div>
      </div>

      {/* ── BLOCO 2: A receber por categoria ──────────────────── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">A Receber por Categoria</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* Perfumes */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Droplets className="h-3.5 w-3.5 text-purple-500" />
              </div>
              <p className="text-sm font-semibold">Perfumes</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Faturamento</p>
                <p className="font-semibold text-sm">{formatBRL(stats.perfumeFaturamento)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Recebido</p>
                <p className="font-semibold text-sm text-success">{formatBRL(stats.perfumeRecebido)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">A Receber</p>
                <p className="font-semibold text-sm text-warning">{formatBRL(stats.perfumeAReceber)}</p>
              </div>
            </div>
            {stats.perfumeFaturamento > 0 && (
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${(stats.perfumeRecebido / stats.perfumeFaturamento) * 100}%` }} />
              </div>
            )}
          </div>

          {/* Eletrônicos */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Smartphone className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <p className="text-sm font-semibold">Eletrônicos</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Faturamento</p>
                <p className="font-semibold text-sm">{formatBRL(stats.eletronicoFaturamento)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Recebido</p>
                <p className="font-semibold text-sm text-success">{formatBRL(stats.eletronicoRecebido)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">A Receber</p>
                <p className="font-semibold text-sm text-warning">{formatBRL(stats.eletronicoAReceber)}</p>
              </div>
            </div>
            {stats.eletronicoFaturamento > 0 && (
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${(stats.eletronicoRecebido / stats.eletronicoFaturamento) * 100}%` }} />
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── BLOCO 3: Gráfico de vendas ────────────────────────── */}
      <div className="glass-card rounded-xl p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Vendas Realizadas — Últimos 6 Meses</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dadosGrafico} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => formatBRL(v)} />
            <Legend />
            <Bar dataKey="Perfumes"    fill="#a855f7" radius={[4,4,0,0]} />
            <Bar dataKey="Eletrônicos" fill="#3b82f6" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── BLOCO 4: Mês selecionado ──────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{mesLabel} {new Date().getFullYear()}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <ShoppingBag className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground">Vendas no Mês</p>
            </div>
            <p className="text-2xl font-bold">{stats.numVendasMes}</p>
            <p className="text-xs text-muted-foreground">vendas em {mesLabel}</p>
          </div>
          <div className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground">Faturamento</p>
            </div>
            <p className="text-xl font-bold">{formatBRL(stats.totalMes)}</p>
            <p className="text-xs text-muted-foreground">Custo: {formatBRL(stats.custoMes)}</p>
          </div>
          <div className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-success" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground">Lucro do Mês</p>
            </div>
            <p className={`text-xl font-bold ${stats.lucroMes >= 0 ? "text-success" : "text-destructive"}`}>
              {formatBRL(stats.lucroMes)}
            </p>
            <p className="text-xs text-muted-foreground">
              Margem: {stats.totalMes > 0 ? ((stats.lucroMes / stats.totalMes) * 100).toFixed(1) : 0}%
            </p>
          </div>
          <div className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-warning/10 flex items-center justify-center">
                <ArrowUpRight className="h-3.5 w-3.5 text-warning" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground">Venda Semanal</p>
            </div>
            <p className="text-xl font-bold">{formatBRL(stats.totalSemana)}</p>
            <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
          </div>
        </div>
      </div>

      {/* ── BLOCO 5: Pendências + Recentes ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Cobranças pendentes */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" /> Cobranças Pendentes
            </h2>
            <Badge variant="destructive" className="text-xs">{cobrancas.length} parcelas</Badge>
          </div>
          {cobrancasRecentes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pendência! 🎉</p>
          ) : (
            <div className="space-y-2">
              {cobrancasRecentes.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{c.cliente}</p>
                    <p className="text-xs text-muted-foreground">Parcela {c.parcela} · Venc: {c.vencimento}</p>
                  </div>
                  <span className="font-semibold text-sm ml-2 shrink-0">{formatBRL(c.valor)}</span>
                </div>
              ))}
            </div>
          )}
          {cobrancas.length > 4 && (
            <Button variant="ghost" size="sm" className="mt-3 w-full" asChild>
              <Link to="/cobrancas">Ver todas ({cobrancas.length})</Link>
            </Button>
          )}
        </div>

        {/* Vendas recentes */}
        <div className="glass-card rounded-xl p-5">
          <h2 className="section-title mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Vendas Recentes
          </h2>
          <div className="space-y-2">
            {vendasRecentes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma venda registrada.</p>
            ) : vendasRecentes.map((v) => {
              const valor   = v.tipo === "perfume" ? v.valorFinal : v.precoVenda;
              const lucro   = getLucro(v);
              const produto = v.tipo === "perfume"
                ? v.perfume.replace(/\|/g, " ").split(",")[0]
                : v.produto.replace(/\|/g, " ").split(",")[0];
              return (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-base shrink-0">{v.tipo === "perfume" ? "🧴" : "📱"}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{v.cliente}</p>
                      <p className="text-xs text-muted-foreground truncate">{produto} · {v.data}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-semibold text-sm">{formatBRL(valor)}</p>
                    <p className={`text-xs font-medium ${lucro >= 0 ? "text-success" : "text-destructive"}`}>
                      lucro: {formatBRL(lucro)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}