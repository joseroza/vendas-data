import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, TrendingUp, CalendarDays, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { Parcela, Venda } from "@/context/AppContext";

function fmtBRL(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function mesAno(vencimento: string): string {
  const p = vencimento.split("/");
  return p.length === 3 ? `${p[1]}/${p[2]}` : vencimento;
}

function mesLabel(mesAnoStr: string): string {
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const [m, y] = mesAnoStr.split("/");
  const idx = parseInt(m) - 1;
  return `${meses[idx] ?? m} ${y}`;
}

function mesKey(vencimento: string): string {
  const p = vencimento.split("/");
  return p.length === 3 ? `${p[2]}-${p[1]}` : vencimento;
}

interface ParcelaItem {
  venda:   Venda;
  parcela: Parcela;
  valor:   number;
}

/** Calcula o valor correto de uma parcela, considerando entrada e valorPago já registrado */
function calcularValorParcela(venda: Venda, parcela: Parcela): number {
  // Se já há valor pago registrado, usa ele
  if (parcela.valorPago && parcela.valorPago > 0) return parcela.valorPago;

  const valorTotal   = venda.tipo === "perfume" ? venda.valorFinal : venda.precoVenda;
  const valorEntrada = venda.valorEntrada ?? 0;

  // Parcela de entrada (numero === 0)
  if (parcela.numero === 0) return valorEntrada;

  // Parcelas normais: divide o restante (após entrada) pelo número de parcelas normais
  const parcelasNormais = venda.parcelas.filter((p) => p.numero > 0);
  const numNormais      = parcelasNormais.length;
  return numNormais > 0 ? (valorTotal - valorEntrada) / numNormais : 0;
}

export default function Cobrancas() {
  const { state, marcarParcelaPaga } = useApp();
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  const todasParcelas = useMemo((): ParcelaItem[] => {
    const items: ParcelaItem[] = [];
    for (const venda of state.vendas) {
      if (venda.tipoPagamento !== "parcelado" || venda.parcelas.length === 0) continue;
      for (const parcela of venda.parcelas) {
        items.push({ venda, parcela, valor: calcularValorParcela(venda, parcela) });
      }
    }
    return items;
  }, [state.vendas]);

  const pendentes = todasParcelas.filter((i) => i.parcela.status === "pendente");
  const pagas     = todasParcelas.filter((i) => i.parcela.status === "pago");

  const porMes = useMemo(() => {
    const map = new Map<string, ParcelaItem[]>();
    for (const item of pendentes) {
      const key = mesKey(item.parcela.vencimento);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, itens]) => ({
        key,
        label:  mesLabel(mesAno(itens[0].parcela.vencimento)),
        itens,
        total:  itens.reduce((s, i) => s + i.valor, 0),
      }));
  }, [pendentes]);

  const hoje       = new Date();
  const mesAtual   = `${String(hoje.getFullYear())}-${String(hoje.getMonth()+1).padStart(2,"0")}`;
  const totalPend  = pendentes.reduce((s, i) => s + i.valor, 0);
  const totalMesAt = porMes.find((m) => m.key === mesAtual)?.total ?? 0;
  const totalPago  = pagas.reduce((s, i) => s + i.valor, 0);
  const atrasadas  = pendentes.filter((i) => {
    const [d, m, y] = i.parcela.vencimento.split("/").map(Number);
    return new Date(y, m - 1, d) < hoje;
  });

  async function handlePagar(venda: Venda, parcela: Parcela) {
    try {
      await marcarParcelaPaga(venda.id, parcela.numero);
      toast.success(`Parcela ${parcela.numero}/${parcela.total} de ${venda.cliente} marcada como paga!`);
    } catch { toast.error("Erro ao atualizar parcela."); }
  }

  function toggleMes(key: string) {
    setExpandido((e) => ({ ...e, [key]: !e[key] }));
  }

  const nomeProduto = (v: Venda) => v.tipo === "perfume"
    ? v.perfume.replace(/\|/g, " ").replace(/,/g, " / ")
    : v.produto.replace(/\|/g, " ").replace(/,/g, " / ");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <AlertCircle className="h-5 w-5" /> Cobranças
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Parcelas pendentes e histórico de recebimentos</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 text-destructive" /> Total pendente
          </p>
          <p className="font-bold text-lg mt-0.5 text-destructive">{fmtBRL(totalPend)}</p>
          <p className="text-[11px] text-muted-foreground">{pendentes.length} parcela(s)</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5 text-warning" /> Mês atual
          </p>
          <p className="font-bold text-lg mt-0.5 text-warning">{fmtBRL(totalMesAt)}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 text-destructive" /> Atrasadas
          </p>
          <p className="font-bold text-lg mt-0.5 text-destructive">{atrasadas.length}</p>
          <p className="text-[11px] text-muted-foreground">{fmtBRL(atrasadas.reduce((s, i) => s + i.valor, 0))}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-success" /> Total recebido
          </p>
          <p className="font-bold text-lg mt-0.5 text-success">{fmtBRL(totalPago)}</p>
          <p className="text-[11px] text-muted-foreground">{pagas.length} parcela(s)</p>
        </div>
      </div>

      {/* Pendentes agrupadas por mês */}
      <div>
        <h2 className="section-title mb-3">Pendentes por mês</h2>
        {pendentes.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
            Nenhuma parcela pendente. Tudo em dia!
          </div>
        ) : (
          <div className="space-y-3">
            {porMes.map((mes) => {
              const isAberto = expandido[mes.key] ?? false;
              const isMesAt  = mes.key === mesAtual;
              return (
                <div key={mes.key} className={`glass-card rounded-xl overflow-hidden ${isMesAt ? "ring-2 ring-primary/30" : ""}`}>
                  <button
                    type="button"
                    onClick={() => toggleMes(mes.key)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${isMesAt ? "bg-primary" : "bg-muted-foreground/40"}`} />
                      <div className="text-left">
                        <p className="font-semibold text-sm flex items-center gap-2">
                          {mes.label}
                          {isMesAt && <Badge className="text-[10px] h-4 px-1.5">Mês atual</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">{mes.itens.length} parcela(s)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-base text-primary">{fmtBRL(mes.total)}</span>
                      {isAberto
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {isAberto && (
                    <div className="border-t border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead>Parcela</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mes.itens.map((item, idx) => {
                            const [d, m, y] = item.parcela.vencimento.split("/").map(Number);
                            const atrasada  = new Date(y, m - 1, d) < hoje;
                            return (
                              <TableRow key={idx} className={atrasada ? "bg-destructive/5" : ""}>
                                <TableCell className={`text-sm ${atrasada ? "text-destructive font-medium" : ""}`}>
                                  {item.parcela.vencimento}
                                  {atrasada && (
                                    <span className="ml-1 text-[10px] bg-destructive/10 text-destructive px-1 rounded">atrasada</span>
                                  )}
                                </TableCell>
                                <TableCell className="font-medium text-sm">{item.venda.cliente}</TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{nomeProduto(item.venda)}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {item.parcela.numero}/{item.parcela.total}
                                </TableCell>
                                <TableCell className="text-right font-semibold">{fmtBRL(item.valor)}</TableCell>
                                <TableCell>
                                  <Button
                                    size="sm" variant="ghost"
                                    onClick={() => handlePagar(item.venda, item.parcela)}
                                    className="h-7 px-2 text-success hover:text-success text-xs"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Pago
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}