import { KpiCard } from "@/components/KpiCard";
import {
  DollarSign, TrendingUp, Calendar, Clock, AlertTriangle,
  CheckCircle2, ArrowUpRight, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useState, useMemo } from "react";
import { useApp, useCobrancas } from "@/context/AppContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

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

function parseData(data: string): Date {
  const [d, m, y] = data.split("/");
  return new Date(+y, +m - 1, +d);
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Dashboard() {
  const { state } = useApp();
  const cobrancas = useCobrancas();
  const [mes, setMes] = useState("marco");

  const mesNum = MESES.find((m) => m.value === mes)?.num ?? 3;

  const stats = useMemo(() => {
    const hoje = new Date();
    let totalGeral = 0;
    let totalMes = 0;
    let totalSemana = 0;
    let totalHoje = 0;
    let totalRecebido = 0;
    let totalPendente = 0;

    for (const venda of state.vendas) {
      const data = parseData(venda.data);
      const valor = venda.tipo === "perfume" ? venda.valorFinal : venda.precoVenda;

      totalGeral += valor;

      if (data.getMonth() + 1 === mesNum && data.getFullYear() === hoje.getFullYear()) {
        totalMes += valor;
      }

      const diffDias = (hoje.getTime() - data.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDias <= 7) totalSemana += valor;
      if (diffDias < 1) totalHoje += valor;

      if (venda.status === "pago") totalRecebido += valor;
      else totalPendente += valor;
    }

    const totalAReceber = cobrancas.reduce((s, c) => s + c.valor, 0);

    return { totalGeral, totalMes, totalSemana, totalHoje, totalRecebido, totalPendente, totalAReceber };
  }, [state.vendas, cobrancas, mesNum]);

  const vendasRecentes = useMemo(() => {
    return [...state.vendas]
      .sort((a, b) => parseData(b.data).getTime() - parseData(a.data).getTime())
      .slice(0, 5);
  }, [state.vendas]);

  const cobrancasRecentes = cobrancas.slice(0, 4);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral das suas vendas</p>
        </div>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar mês" />
          </SelectTrigger>
          <SelectContent>
            {MESES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Venda Total" value={formatBRL(stats.totalGeral)} subtitle="Acumulado geral" icon={DollarSign} />
        <KpiCard title="Venda Mensal" value={formatBRL(stats.totalMes)} subtitle={`${MESES.find((m) => m.value === mes)?.label ?? mes} ${new Date().getFullYear()}`} icon={TrendingUp} />
        <KpiCard title="Venda Semanal" value={formatBRL(stats.totalSemana)} subtitle="Últimos 7 dias" icon={Calendar} />
        <KpiCard title="Venda Diária" value={formatBRL(stats.totalHoje)} subtitle="Hoje" icon={ArrowUpRight} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard title="Total a Receber" value={formatBRL(stats.totalAReceber)} icon={Clock} variant="warning" />
        <KpiCard title="Total Recebido" value={formatBRL(stats.totalRecebido)} icon={CheckCircle2} variant="success" />
        <KpiCard title="Total Pendente" value={formatBRL(stats.totalPendente)} subtitle={`${cobrancas.length} parcelas`} icon={AlertTriangle} variant="destructive" />
      </div>

      {/* Pendências + Vendas Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pendências */}
        <div className="glass-card rounded-xl p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Pendências / Cobranças
            </h2>
            <Badge variant="destructive" className="text-xs">
              {cobrancasRecentes.length} pendentes
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Total a receber:{" "}
            <span className="font-semibold text-foreground">{formatBRL(stats.totalAReceber)}</span>
          </p>
          {cobrancasRecentes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pendência! 🎉</p>
          ) : (
            <div className="space-y-3">
              {cobrancasRecentes.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div>
                    <p className="font-medium text-sm">{c.cliente}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.produto} · Parcela {c.parcela} · Venc: {c.vencimento}
                    </p>
                  </div>
                  <span className="font-semibold text-sm">{formatBRL(c.valor)}</span>
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

        {/* Vendas Recentes */}
        <div className="glass-card rounded-xl p-5 animate-fade-in">
          <h2 className="section-title mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Vendas Recentes
          </h2>
          <div className="space-y-3">
            {vendasRecentes.map((v) => {
              const produto = v.tipo === "perfume" ? v.perfume : v.produto;
              const valor = v.tipo === "perfume" ? v.valorFinal : v.precoVenda;
              return (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-3">
                    <Badge variant={v.tipo === "perfume" ? "default" : "secondary"} className="text-xs">
                      {v.tipo === "perfume" ? "🧴" : "📱"}
                    </Badge>
                    <div>
                      <p className="font-medium text-sm">{v.cliente}</p>
                      <p className="text-xs text-muted-foreground">{produto} · {v.data}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-sm">{formatBRL(valor)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}