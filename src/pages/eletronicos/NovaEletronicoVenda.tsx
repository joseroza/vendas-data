import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, TrendingUp, Calculator } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

type PlataformaVenda = "instagram" | "whatsapp" | "indicacao" | "loja" | "outro";
type FormaPagamento  = "pix" | "credito" | "entrada";
interface EntradaConfig {
  valorEntrada: string;
  formaRestante: "pix_parcelado" | "credito";
  parcelasRestante: string;
}

function gerarParcelas(num: number, dataVenda: string) {
  const [y, m, d] = dataVenda.split("-").map(Number);
  return Array.from({ length: num }, (_, i) => {
    const dt = new Date(y, m - 1 + i, d);
    return {
      numero: i + 1, total: num,
      vencimento: `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`,
      status: "pendente" as const,
    };
  });
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const PLATAFORMAS: { value: PlataformaVenda; label: string; emoji: string }[] = [
  { value: "instagram", label: "Instagram",   emoji: "📸" },
  { value: "whatsapp",  label: "WhatsApp",    emoji: "💬" },
  { value: "indicacao", label: "Indicação",   emoji: "🤝" },
  { value: "loja",      label: "Loja física", emoji: "🏪" },
  { value: "outro",     label: "Outro",       emoji: "📦" },
];

export default function NovaEletronicoVenda() {
  const { state, addVenda } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Cliente
  const [cliente,   setCliente]   = useState("");
  const [telefone,  setTelefone]  = useState("");

  // Produto — eletrônico tem custo + venda manuais (não é USD automático)
  const [produto,    setProduto]    = useState("");
  const [precoCusto, setPrecoCusto] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  // Opcional: venda em USD
  const [isUsd,     setIsUsd]     = useState(false);
  const [precoUsd,  setPrecoUsd]  = useState("");
  const [cotacao,   setCotacao]   = useState("");

  // Plataforma
  const [plataformas, setPlataformas] = useState<PlataformaVenda[]>([]);

  // Pagamento
  const [formasPag, setFormasPag]         = useState<FormaPagamento[]>([]);
  const [parcelasCredito, setParcelasCredito] = useState("3");
  const [entrada, setEntrada] = useState<EntradaConfig>({
    valorEntrada: "", formaRestante: "pix_parcelado", parcelasRestante: "3",
  });

  const [dataVenda,   setDataVenda]   = useState(() => new Date().toISOString().split("T")[0]);
  const [observacoes, setObservacoes] = useState("");
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const margem      = state.margem;
  const custoNum    = parseFloat(precoCusto) || 0;
  const vendaNum    = parseFloat(precoVenda) || 0;
  const usdNum      = parseFloat(precoUsd)   || 0;
  const cotacaoNum  = parseFloat(cotacao)    || 0;
  const custoBrlUsd = usdNum * cotacaoNum;
  const vendaBrlUsd = custoBrlUsd * (1 + margem / 100);
  const lucro       = isUsd ? vendaBrlUsd - custoBrlUsd : vendaNum - custoNum;
  const totalVenda  = isUsd ? vendaBrlUsd : vendaNum;
  const showCalc    = isUsd ? usdNum > 0 && cotacaoNum > 0 : custoNum > 0 && vendaNum > 0;

  const entradaNum      = parseFloat(entrada.valorEntrada) || 0;
  const restante        = totalVenda - entradaNum;
  const parcelasNum     = parseInt(parcelasCredito) || 1;
  const parcelasRestNum = parseInt(entrada.parcelasRestante) || 1;

  function togglePlataforma(p: PlataformaVenda) {
    setPlataformas((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }

  function toggleForma(f: FormaPagamento) {
    setFormasPag((prev) => {
      if (prev.includes(f)) return prev.filter((x) => x !== f);
      if (f === "entrada") return ["entrada"];
      return prev.filter((x) => x !== "entrada").concat(f);
    });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!cliente.trim())  e.cliente = "Nome do cliente é obrigatório.";
    if (!produto.trim())  e.produto = "Informe o produto.";
    if (isUsd) {
      if (!usdNum || usdNum <= 0)         e.precoUsd  = "Informe o preço em USD.";
      if (!cotacaoNum || cotacaoNum <= 0) e.cotacao   = "Informe a cotação do dólar.";
    } else {
      if (!custoNum || custoNum <= 0)     e.precoCusto = "Informe o preço de custo.";
      if (!vendaNum || vendaNum <= 0)     e.precoVenda = "Informe o preço de venda.";
    }
    if (formasPag.length === 0)           e.pagamento = "Selecione ao menos uma forma de pagamento.";
    if (formasPag.includes("credito") && parcelasNum < 1) e.parcelas = "Informe as parcelas.";
    if (formasPag.includes("entrada")) {
      if (!entradaNum || entradaNum <= 0)   e.entrada          = "Informe o valor da entrada.";
      if (entradaNum >= totalVenda)          e.entrada          = "Entrada não pode ser maior que o total.";
      if (parcelasRestNum < 1)               e.parcelasRestante = "Informe as parcelas.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSalvar() {
    if (!validate()) return;
    setLoading(true);
    const [y, m, d] = dataVenda.split("-");
    const dataFmt = `${d}/${m}/${y}`;

    const descPag: string[] = [];
    if (formasPag.includes("pix"))     descPag.push("PIX");
    if (formasPag.includes("credito")) descPag.push(`Crédito ${parcelasNum}x`);
    if (formasPag.includes("entrada")) {
      const fr = entrada.formaRestante === "credito" ? `Crédito ${parcelasRestNum}x` : `PIX Parcelado ${parcelasRestNum}x`;
      descPag.push(`Entrada ${fmtBRL(entradaNum)} + ${fr}`);
    }
    const descPlat = plataformas.length > 0 ? `Plataforma: ${plataformas.join(", ")}. ` : "";
    const obsCompleto = `${descPlat}Pagamento: ${descPag.join(" + ")}. ${observacoes}`.trim();

    const parcelado = formasPag.includes("credito") || formasPag.includes("entrada");
    let parcelas: ReturnType<typeof gerarParcelas> = [];
    if (formasPag.includes("credito"))      parcelas = gerarParcelas(parcelasNum, dataVenda);
    else if (formasPag.includes("entrada")) parcelas = gerarParcelas(parcelasRestNum, dataVenda);

    try {
      await addVenda({
        tipo: "eletronico",
        cliente: cliente.trim(),
        telefone: telefone.trim(),
        produto: produto.trim(),
        precoCusto: isUsd ? custoBrlUsd : custoNum,
        precoVenda: isUsd ? vendaBrlUsd : vendaNum,
        lucro,
        isUsd,
        ...(isUsd ? { precoUsd: usdNum, cotacao: cotacaoNum } : {}),
        margemUsada: margem,
        tipoPagamento: parcelado ? "parcelado" : "avista",
        parcelas,
        observacoes: obsCompleto,
        data: dataFmt,
        status: parcelado ? "pendente" : "pago",
      });
      toast.success("Venda registrada com sucesso!");
      navigate("/eletronicos/vendas");
    } catch { toast.error("Erro ao salvar venda."); }
    finally  { setLoading(false); }
  }

  const err = (k: string) => errors[k]
    ? <p className="text-xs text-destructive mt-1">{errors[k]}</p> : null;

  function SelBtn({ active, onClick, emoji, label, sub }:
    { active: boolean; onClick: () => void; emoji: string; label: string; sub?: string }) {
    return (
      <button type="button" onClick={onClick}
        className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all active:scale-95
          ${active ? "border-primary bg-primary/10 text-foreground" : "border-border bg-muted/30 text-muted-foreground"}`}>
        <span className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-colors
          ${active ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
          {active && <span className="text-primary-foreground text-xs font-bold">✓</span>}
        </span>
        <span className="text-xl shrink-0">{emoji}</span>
        <span>
          <span className="font-medium text-sm block">{label}</span>
          {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 py-1">
        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" asChild>
          <Link to="/eletronicos/vendas"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Nova Venda — Eletrônicos</h1>
          <p className="text-muted-foreground text-sm">Registre uma nova venda de eletrônico</p>
        </div>
      </div>

      {/* ── 1. CLIENTE ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">👤 Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input className={`h-12 text-base ${errors.cliente ? "border-destructive" : ""}`}
              placeholder="Nome completo" value={cliente}
              onChange={(e) => setCliente(e.target.value)} />
            {err("cliente")}
          </div>
          <div>
            <Label>Telefone <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Input className="h-12 text-base" placeholder="(00) 00000-0000"
              type="tel" inputMode="numeric" value={telefone}
              onChange={(e) => setTelefone(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* ── 2. PRODUTO E VALORES ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Produto e Valores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Produto Vendido *</Label>
            <Input className={`h-12 text-base ${errors.produto ? "border-destructive" : ""}`}
              placeholder="Ex: iPhone 15 Pro, Samsung S24..." value={produto}
              onChange={(e) => setProduto(e.target.value)} />
            {err("produto")}
          </div>

          {/* Toggle USD */}
          <button type="button" onClick={() => setIsUsd((v) => !v)}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all active:scale-95
              ${isUsd ? "border-primary bg-primary/10" : "border-border bg-muted/30 text-muted-foreground"}`}>
            <span className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0
              ${isUsd ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
              {isUsd && <span className="text-primary-foreground text-xs font-bold">✓</span>}
            </span>
            <span className="text-xl shrink-0">💵</span>
            <span>
              <span className="font-medium text-sm block">Venda em Dólar (USD)</span>
              <span className="text-xs text-muted-foreground">Calcular automaticamente com cotação</span>
            </span>
          </button>

          {/* Campos USD */}
          {isUsd ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Preço USD *</Label>
                  <Input className={`h-12 text-base ${errors.precoUsd ? "border-destructive" : ""}`}
                    type="number" inputMode="decimal" placeholder="0.00"
                    value={precoUsd} onChange={(e) => setPrecoUsd(e.target.value)} />
                  {err("precoUsd")}
                </div>
                <div>
                  <Label>Cotação R$ *</Label>
                  <Input className={`h-12 text-base ${errors.cotacao ? "border-destructive" : ""}`}
                    type="number" inputMode="decimal" placeholder="5.80"
                    value={cotacao} onChange={(e) => setCotacao(e.target.value)} />
                  {err("cotacao")}
                </div>
              </div>
              {showCalc && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="grid grid-cols-2 divide-x divide-y divide-border">
                    <div className="p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground">Preço USD</p>
                      <p className="font-semibold">${usdNum.toFixed(2)}</p>
                    </div>
                    <div className="p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground">Cotação</p>
                      <p className="font-semibold">R$ {cotacaoNum.toFixed(2)}</p>
                    </div>
                    <div className="p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground">Custo BRL</p>
                      <p className="font-semibold">{fmtBRL(custoBrlUsd)}</p>
                    </div>
                    <div className="p-3 bg-primary/10">
                      <p className="text-xs text-muted-foreground">Venda +{margem}%</p>
                      <p className="font-bold text-primary text-lg leading-tight">{fmtBRL(vendaBrlUsd)}</p>
                      <p className="text-xs text-success flex items-center gap-0.5 mt-0.5">
                        <TrendingUp className="h-3 w-3" />+{fmtBRL(vendaBrlUsd - custoBrlUsd)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Preço de Custo (R$) *</Label>
                  <Input className={`h-12 text-base ${errors.precoCusto ? "border-destructive" : ""}`}
                    type="number" inputMode="decimal" placeholder="0.00"
                    value={precoCusto} onChange={(e) => setPrecoCusto(e.target.value)} />
                  {err("precoCusto")}
                </div>
                <div>
                  <Label>Preço de Venda (R$) *</Label>
                  <Input className={`h-12 text-base ${errors.precoVenda ? "border-destructive" : ""}`}
                    type="number" inputMode="decimal" placeholder="0.00"
                    value={precoVenda} onChange={(e) => setPrecoVenda(e.target.value)} />
                  {err("precoVenda")}
                </div>
              </div>
              {showCalc && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="grid grid-cols-2 divide-x divide-border">
                    <div className="p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground">Custo</p>
                      <p className="font-semibold">{fmtBRL(custoNum)}</p>
                    </div>
                    <div className="p-3 bg-primary/10">
                      <p className="text-xs text-muted-foreground">Lucro</p>
                      <p className={`font-bold text-lg leading-tight ${lucro >= 0 ? "text-success" : "text-destructive"}`}>
                        {fmtBRL(lucro)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── 3. PLATAFORMA ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">📣 Plataforma de Venda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {PLATAFORMAS.map((p) => {
              const ativo = plataformas.includes(p.value);
              return (
                <button key={p.value} type="button"
                  onClick={() => togglePlataforma(p.value)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-sm font-medium transition-all active:scale-95
                    ${ativo ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground"}`}>
                  <span className="text-2xl">{p.emoji}</span>
                  <span className="text-xs text-center leading-tight">{p.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── 4. PAGAMENTO ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">💰 Forma de Pagamento *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {err("pagamento")}

          <div className="space-y-2">
            <SelBtn active={formasPag.includes("pix") && !formasPag.includes("entrada")}
              onClick={() => toggleForma("pix")} emoji="💸" label="PIX" sub="Pagamento à vista" />
            <SelBtn active={formasPag.includes("credito") && !formasPag.includes("entrada")}
              onClick={() => toggleForma("credito")} emoji="💳" label="Crédito" sub="Parcelado no cartão" />
            <SelBtn active={formasPag.includes("entrada")}
              onClick={() => toggleForma("entrada")} emoji="🤝" label="Entrada + Restante" sub="Sinal + parcelamento" />
          </div>

          {/* Sub: Crédito */}
          {formasPag.includes("credito") && !formasPag.includes("entrada") && (
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
              <p className="text-sm font-medium">Parcelamento no Crédito</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantas vezes?</Label>
                  <Input className={`h-12 text-base ${errors.parcelas ? "border-destructive" : ""}`}
                    type="number" inputMode="numeric" min={1} max={24}
                    value={parcelasCredito} onChange={(e) => setParcelasCredito(e.target.value)} />
                  {err("parcelas")}
                </div>
                {showCalc && parcelasNum > 0 && (
                  <div className="flex flex-col justify-end pb-1">
                    <p className="text-xs text-muted-foreground">Valor por parcela</p>
                    <p className="font-bold text-primary text-lg">{fmtBRL(totalVenda / parcelasNum)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sub: Entrada */}
          {formasPag.includes("entrada") && (
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
              <p className="text-sm font-medium">Configurar Entrada</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor da Entrada (R$)</Label>
                  <Input className={`h-12 text-base ${errors.entrada ? "border-destructive" : ""}`}
                    type="number" inputMode="decimal" placeholder="0.00"
                    value={entrada.valorEntrada}
                    onChange={(e) => setEntrada((x) => ({ ...x, valorEntrada: e.target.value }))} />
                  {err("entrada")}
                </div>
                {showCalc && entradaNum > 0 && entradaNum < totalVenda && (
                  <div className="flex flex-col justify-end pb-1">
                    <p className="text-xs text-muted-foreground">Restante</p>
                    <p className="font-bold text-destructive text-lg">{fmtBRL(restante)}</p>
                  </div>
                )}
              </div>

              <div>
                <Label className="mb-2 block">Restante via</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "pix_parcelado", label: "PIX Parcelado", emoji: "💸" },
                    { value: "credito",       label: "Crédito",       emoji: "💳" },
                  ].map((op) => (
                    <button key={op.value} type="button"
                      onClick={() => setEntrada((x) => ({ ...x, formaRestante: op.value as EntradaConfig["formaRestante"] }))}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all active:scale-95
                        ${entrada.formaRestante === op.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/20 text-muted-foreground"}`}>
                      {op.emoji} {op.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Em quantas vezes?</Label>
                  <Input className={`h-12 text-base ${errors.parcelasRestante ? "border-destructive" : ""}`}
                    type="number" inputMode="numeric" min={1} max={24}
                    value={entrada.parcelasRestante}
                    onChange={(e) => setEntrada((x) => ({ ...x, parcelasRestante: e.target.value }))} />
                  {err("parcelasRestante")}
                </div>
                {showCalc && restante > 0 && parcelasRestNum > 0 && (
                  <div className="flex flex-col justify-end pb-1">
                    <p className="text-xs text-muted-foreground">Valor por parcela</p>
                    <p className="font-bold text-primary text-lg">{fmtBRL(restante / parcelasRestNum)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <Label>Data da Venda</Label>
            <Input className="h-12 text-base" type="date" value={dataVenda}
              onChange={(e) => setDataVenda(e.target.value)} />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea className="text-base" placeholder="Notas adicionais..."
              value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* ── RESUMO FINAL ─────────────────────────────────────────────────────── */}
      {showCalc && formasPag.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Valor total da venda</p>
          <p className="font-bold text-3xl text-primary">{fmtBRL(totalVenda)}</p>
          {formasPag.includes("credito") && !formasPag.includes("entrada") && (
            <p className="text-sm text-muted-foreground mt-1">
              {parcelasNum}x de <strong className="text-foreground">{fmtBRL(totalVenda / parcelasNum)}</strong>
            </p>
          )}
          {formasPag.includes("entrada") && entradaNum > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              Entrada <strong className="text-foreground">{fmtBRL(entradaNum)}</strong>
              {" "}+ {parcelasRestNum}x de{" "}
              <strong className="text-foreground">{fmtBRL(restante / parcelasRestNum)}</strong>
            </p>
          )}
          {formasPag.includes("pix") && !formasPag.includes("entrada") && (
            <p className="text-sm text-success mt-1">✅ À vista no PIX</p>
          )}
        </div>
      )}

      {/* ── BOTÕES ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 pb-8">
        <Button variant="outline" className="h-12 text-base sm:flex-1" asChild>
          <Link to="/eletronicos/vendas">Cancelar</Link>
        </Button>
        <Button className="h-12 text-base sm:flex-1" onClick={handleSalvar} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? "Salvando..." : "Salvar Venda"}
        </Button>
      </div>
    </div>
  );
}