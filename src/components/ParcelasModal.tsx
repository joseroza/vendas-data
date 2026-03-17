import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Circle, CalendarDays, AlertCircle, Undo2, DollarSign } from "lucide-react";
import { toast } from "sonner";
import type { Venda, Parcela } from "@/context/AppContext";
import { useApp } from "@/context/AppContext";

interface Props {
  venda:   Venda | null;
  onClose: () => void;
}

function fmtBRL(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function isAtrasada(vencimento: string): boolean {
  const [d, m, y] = vencimento.split("/").map(Number);
  return new Date(y, m - 1, d) < new Date(new Date().setHours(0, 0, 0, 0));
}

export function ParcelasModal({ venda: vendaInicial, onClose }: Props) {
  const { state, registrarPagamento, desfazerPagamento } = useApp();

  // Sempre lê a venda atualizada do state — reflete mudanças na hora
  const venda = vendaInicial
    ? (state.vendas.find((v) => v.id === vendaInicial.id) ?? vendaInicial)
    : null;

  const [pagandoNumero, setPagandoNumero] = useState<number | null>(null);
  const [valorDigitado, setValorDigitado] = useState("");
  const [loading,       setLoading]       = useState<number | null>(null);

  if (!venda) return null;

  const valorTotal   = venda.tipo === "perfume" ? venda.valorFinal : venda.precoVenda;
  const valorEntrada = ((venda as any).valorEntrada as number) || 0;

  const parcelasNormais = venda.parcelas.filter((p) => p.numero > 0);
  const numNorm         = parcelasNormais.length;
  const valorParcPadrao = numNorm > 0 ? (valorTotal - valorEntrada) / numNorm : 0;

  // Valor efetivamente pago em cada parcela
  function getValorPago(p: Parcela): number {
    if (p.status !== "pago") return 0;
    return (p.valorPago && p.valorPago > 0) ? p.valorPago : (p.numero === 0 ? valorEntrada : valorParcPadrao);
  }

  const totalPago       = venda.parcelas.reduce((s, p) => s + getValorPago(p), 0);
  const totalPendente   = Math.max(0, valorTotal - totalPago);

  // Recalcula valor sugerido para as parcelas pendentes com base no saldo restante
  const parcelasPendentes = venda.parcelas.filter((p) => p.numero > 0 && p.status !== "pago");
  const numPendentes      = parcelasPendentes.length;
  const valorRecalculado  = numPendentes > 0 ? totalPendente / numPendentes : 0;
  const houvePagamento    = totalPago > 0;

  function sugestaoParaParcela(parcela: Parcela): number {
    if (parcela.numero === 0) return valorEntrada;
    return houvePagamento && valorRecalculado > 0 ? valorRecalculado : valorParcPadrao;
  }

  function valorExibidoParcela(parcela: Parcela): number {
    if (parcela.status === "pago") return getValorPago(parcela);
    return sugestaoParaParcela(parcela);
  }

  function abrirPagamento(numero: number, parcela: Parcela) {
    setValorDigitado(sugestaoParaParcela(parcela).toFixed(2));
    setPagandoNumero(numero);
  }

  async function confirmarPagamento(parcela: Parcela) {
    const vPago = parseFloat(valorDigitado.replace(",", "."));
    if (!vPago || vPago <= 0) { toast.error("Informe um valor válido."); return; }
    setLoading(parcela.numero);
    try {
      await registrarPagamento(venda!.id, parcela.numero, vPago);
      const label = parcela.numero === 0 ? "Entrada" : `Parcela ${parcela.numero}`;
      toast.success(`${label} — ${fmtBRL(vPago)} registrado!`);
      setPagandoNumero(null);
      setValorDigitado("");
    } catch {
      toast.error("Erro ao registrar pagamento.");
    } finally {
      setLoading(null);
    }
  }

  async function handleDesfazer(parcela: Parcela) {
    setLoading(parcela.numero);
    try {
      await desfazerPagamento(venda!.id, parcela.numero);
      toast.success("Pagamento desfeito.");
    } catch {
      toast.error("Erro ao desfazer.");
    } finally {
      setLoading(null);
    }
  }

  const nomeProduto = venda.tipo === "perfume"
    ? venda.perfume.replace(/\|/g, " ").replace(/,/g, " / ")
    : venda.produto.replace(/\|/g, " ").replace(/,/g, " / ");

  const totalParcelas = venda.parcelas.length;
  const totalPagas    = venda.parcelas.filter((p) => p.status === "pago").length;
  const pct           = totalParcelas > 0 ? Math.round((totalPagas / totalParcelas) * 100) : 0;

  return (
    <Dialog open={!!venda} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" /> Parcelas — {venda.cliente}
          </DialogTitle>
        </DialogHeader>

        {/* Resumo */}
        <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-2 text-sm">
          <p className="text-muted-foreground text-xs leading-snug break-words">{nomeProduto}</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-semibold">{fmtBRL(valorTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recebido</p>
              <p className="font-semibold text-success">{fmtBRL(totalPago)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendente</p>
              <p className="font-semibold text-destructive">{fmtBRL(totalPendente)}</p>
            </div>
          </div>

          {/* Saldo recalculado */}
          {numPendentes > 0 && houvePagamento && (
            <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-1.5 text-xs text-primary">
              Saldo restante em {numPendentes}x = <strong>{fmtBRL(valorRecalculado)}</strong> por parcela
            </div>
          )}
        </div>

        {/* Lista de parcelas */}
        <div className="space-y-2">
          {venda.parcelas
          .filter((p) => !(p.numero === 0 && valorEntrada === 0 && (p.valorPago === 0 || !p.valorPago)))
          .map((parcela) => {
            const pago      = parcela.status === "pago";
            const eEntrada  = parcela.numero === 0;
            const atrasada  = !pago && !eEntrada && isAtrasada(parcela.vencimento);
            const carregando = loading === parcela.numero;
            const abrindo   = pagandoNumero === parcela.numero;
            const valorExib = valorExibidoParcela(parcela);
            const numLabel  = eEntrada ? "Entrada" : `Parcela ${parcela.numero}/${parcela.total - (valorEntrada > 0 ? 1 : 0)}`;

            return (
              <div key={parcela.numero}
                className={`rounded-lg border transition-all ${
                  pago       ? "border-success/20 bg-success/5"
                  : atrasada ? "border-destructive/30 bg-destructive/5"
                  : abrindo  ? "border-primary/40 bg-primary/5"
                  :            "border-border bg-background"
                }`}>

                {/* Linha principal */}
                <div className="flex items-center gap-2 p-3">
                  <div className="shrink-0">
                    {pago      ? <CheckCircle2 className="h-5 w-5 text-success" />
                    : atrasada ? <AlertCircle   className="h-5 w-5 text-destructive" />
                    :            <Circle        className="h-5 w-5 text-muted-foreground" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-sm whitespace-nowrap">{numLabel}</span>
                      {pago     && <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-success border-success/40">Pago</Badge>}
                      {atrasada && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Atrasada</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">
                      {eEntrada ? "Pago no ato da venda" : `Venc.: ${parcela.vencimento}`}
                    </p>
                  </div>

                  <div className="text-right shrink-0 mr-1">
                    <p className={`font-semibold text-sm whitespace-nowrap ${pago ? "text-success" : atrasada ? "text-destructive" : ""}`}>
                      {fmtBRL(valorExib)}
                    </p>
                    {/* Mostra valor original riscado quando recalculado */}
                    {!pago && !eEntrada && houvePagamento && Math.abs(valorRecalculado - valorParcPadrao) > 0.01 && (
                      <p className="text-[10px] text-muted-foreground line-through">{fmtBRL(valorParcPadrao)}</p>
                    )}
                  </div>

                  {/* Ações */}
                  {eEntrada && pago ? (
                    <span className="text-xs text-muted-foreground px-2 shrink-0">Entrada</span>
                  ) : pago ? (
                    <Button size="sm" variant="ghost"
                      className="h-7 px-2 text-xs shrink-0 text-muted-foreground hover:text-destructive"
                      disabled={carregando}
                      onClick={() => handleDesfazer(parcela)}>
                      {carregando ? "..." : <><Undo2 className="h-3 w-3 mr-1" />Desfazer</>}
                    </Button>
                  ) : abrindo ? (
                    <Button size="sm" variant="ghost"
                      className="h-7 px-2 text-xs shrink-0 text-muted-foreground"
                      onClick={() => { setPagandoNumero(null); setValorDigitado(""); }}>
                      Cancelar
                    </Button>
                  ) : (
                    <Button size="sm" variant={atrasada ? "destructive" : "outline"}
                      className="h-7 px-2 text-xs shrink-0"
                      disabled={carregando}
                      onClick={() => abrirPagamento(parcela.numero, parcela)}>
                      <DollarSign className="h-3 w-3 mr-1" />Pagar
                    </Button>
                  )}
                </div>

                {/* Input de valor — expande ao clicar Pagar */}
                {abrindo && (
                  <div className="px-3 pb-3 pt-2 border-t border-primary/20 flex gap-2 items-end">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">
                        Valor recebido <span className="text-primary">(sugerido: {fmtBRL(sugestaoParaParcela(parcela))})</span>
                      </p>
                      <Input
                        autoFocus
                        type="number"
                        inputMode="decimal"
                        className="h-9 text-sm"
                        placeholder={sugestaoParaParcela(parcela).toFixed(2)}
                        value={valorDigitado}
                        onChange={(e) => setValorDigitado(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && confirmarPagamento(parcela)}
                      />
                    </div>
                    <Button size="sm" className="h-9 px-4 shrink-0"
                      disabled={carregando}
                      onClick={() => confirmarPagamento(parcela)}>
                      {carregando ? "..." : "Confirmar"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Barra de progresso */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{totalPagas} de {totalParcelas} pagas</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div className="h-full bg-success rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={onClose}>Fechar</Button>
      </DialogContent>
    </Dialog>
  );
}