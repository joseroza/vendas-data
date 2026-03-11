import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, TrendingUp, Plus, Trash2, Calculator, DollarSign, User, Megaphone, CreditCard, Calendar } from "lucide-react";
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
interface ItemPerfume {
  marca: string;
  nome: string;
  precoUsd: string;
  precoVenda: string;
}

const ITEM_VAZIO: ItemPerfume = { marca: "", nome: "", precoUsd: "", precoVenda: "" };

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

const PLATAFORMAS: { value: PlataformaVenda; label: string }[] = [
  { value: "instagram", label: "Instagram"   },
  { value: "whatsapp",  label: "WhatsApp"    },
  { value: "indicacao", label: "Indicação"   },
  { value: "loja",      label: "Loja física" },
  { value: "outro",     label: "Outro"       },
];

export default function NovaPerfumeVenda() {
  const { state, addVenda } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [cliente,     setCliente]     = useState("");
  const [telefone,    setTelefone]    = useState("");
  const [cotacao,     setCotacao]     = useState("");
  const [itens,       setItens]       = useState<ItemPerfume[]>([{ ...ITEM_VAZIO }]);
  const [plataformas, setPlataformas] = useState<PlataformaVenda[]>([]);
  const [formasPag,   setFormasPag]   = useState<FormaPagamento[]>([]);
  const [parcelasCredito, setParcelasCredito] = useState("3");
  const [entrada, setEntrada] = useState<EntradaConfig>({
    valorEntrada: "", formaRestante: "pix_parcelado", parcelasRestante: "3",
  });
  const [dataVenda,   setDataVenda]   = useState(() => new Date().toISOString().split("T")[0]);
  const [observacoes, setObservacoes] = useState("");
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  const margem     = state.margem;
  const cotacaoNum = parseFloat(cotacao) || 0;

  const itensCalc = itens.map((item) => {
    const usd        = parseFloat(item.precoUsd) || 0;
    const custo      = usd * cotacaoNum;                        // custo BRL puro
    const custoMais  = custo * (1 + margem / 100);             // custo + 20% transporte
    const venda      = parseFloat(item.precoVenda) || 0;       // preço que você cobrou
    const lucro      = venda > 0 ? venda - custoMais : 0;
    return { ...item, usd, custo, custoMais, venda, lucro };
  });

  const totalVenda  = itensCalc.reduce((s, i) => s + i.venda, 0);
  const totalLucro  = itensCalc.reduce((s, i) => s + i.lucro, 0);
  const totalCusto  = itensCalc.reduce((s, i) => s + i.custoMais, 0);
  const totalUsd    = itensCalc.reduce((s, i) => s + i.usd, 0);
  const showCalc    = cotacaoNum > 0 && itens.some((i) => parseFloat(i.precoUsd) > 0);

  const entradaNum      = parseFloat(entrada.valorEntrada) || 0;
  const parcelasNum     = parseInt(parcelasCredito) || 1;
  const parcelasRestNum = parseInt(entrada.parcelasRestante) || 1;

  function updateItem(idx: number, campo: keyof ItemPerfume, valor: string) {
    setItens((prev) => prev.map((it, i) => i === idx ? { ...it, [campo]: valor } : it));
  }

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
    if (!cliente.trim())               e.cliente = "Nome do cliente é obrigatório.";
    if (!cotacaoNum || cotacaoNum <= 0) e.cotacao = "Informe a cotação do dólar.";
    itens.forEach((item, idx) => {
      if (!item.marca.trim()) e[`marca_${idx}`] = "Informe a marca.";
      if (!item.nome.trim())  e[`nome_${idx}`]  = "Informe o nome.";
      const usd = parseFloat(item.precoUsd);
      if (!usd || usd <= 0)   e[`preco_${idx}`] = "Informe o preço USD.";
      const venda = parseFloat(item.precoVenda);
      if (!venda || venda <= 0) e[`venda_${idx}`] = "Informe o preço de venda.";
    });
    if (formasPag.length === 0) e.pagamento = "Selecione ao menos uma forma de pagamento.";
    if (formasPag.includes("credito") && parcelasNum < 1) e.parcelas = "Informe as parcelas.";
    if (formasPag.includes("entrada")) {
      if (!entradaNum || entradaNum <= 0) e.entrada = "Informe o valor da entrada.";
      if (entradaNum >= totalVenda)        e.entrada = "Entrada não pode ser maior que o total.";
      if (parcelasRestNum < 1)             e.parcelasRestante = "Informe as parcelas.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSalvar() {
    if (!validate()) return;
    setLoading(true);
    const [y, m, d] = dataVenda.split("-");
    const dataFmt = `${d}/${m}/${y}`;

    const descItens = itensCalc
      .map((i) => `${i.marca} ${i.nome} (USD ${i.usd.toFixed(2)} → ${fmtBRL(i.venda)})`)
      .join(" | ");
    const descPag: string[] = [];
    if (formasPag.includes("pix"))     descPag.push("PIX");
    if (formasPag.includes("credito")) descPag.push(`Crédito ${parcelasNum}x`);
    if (formasPag.includes("entrada")) {
      const fr = entrada.formaRestante === "credito" ? `Crédito ${parcelasRestNum}x` : `PIX Parcelado ${parcelasRestNum}x`;
      descPag.push(`Entrada ${fmtBRL(entradaNum)} + ${fr}`);
    }
    const descPlat    = plataformas.length > 0 ? `Plataforma: ${plataformas.join(", ")}. ` : "";
    const obsCompleto = `Itens: ${descItens}. ${descPlat}Pagamento: ${descPag.join(" + ")}. ${observacoes}`.trim();

    const parcelado = formasPag.includes("credito") || formasPag.includes("entrada");
    let parcelas: ReturnType<typeof gerarParcelas> = [];
    if (formasPag.includes("credito"))      parcelas = gerarParcelas(parcelasNum, dataVenda);
    else if (formasPag.includes("entrada")) parcelas = gerarParcelas(parcelasRestNum, dataVenda);

    const nomePerfumes = itens.map((i) => `${i.marca.trim()}|${i.nome.trim()}`).join(", ");

    try {
      await addVenda({
        tipo: "perfume",
        cliente: cliente.trim(),
        telefone: telefone.trim(),
        vendedor: "",
        perfume: nomePerfumes,
        precoUsd: totalUsd,
        cotacao: cotacaoNum,
        precoBrl: itensCalc.reduce((s, i) => s + i.custoMais, 0),
        margemUsada: margem,
        valorFinal: totalVenda,
        tipoPagamento: parcelado ? "parcelado" : "avista",
        parcelas,
        observacoes: obsCompleto,
        data: dataFmt,
        status: parcelado ? "pendente" : "pago",
      });
      toast.success("Venda registrada com sucesso!");
      navigate("/perfumes/vendas");
    } catch { toast.error("Erro ao salvar venda."); }
    finally  { setLoading(false); }
  }

  const err = (k: string) => errors[k]
    ? <p className="text-xs text-destructive mt-1">{errors[k]}</p> : null;

  return (
    <div className="space-y-4 pb-10">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/perfumes/vendas"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="page-title">Nova Venda — Perfumes</h1>
          <p className="text-muted-foreground text-sm mt-1">Registre uma nova venda de perfume</p>
        </div>
      </div>

      {/* 1. CLIENTE */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <User className="h-4 w-4" /> Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Nome *</Label>
            <Input className={`h-10 ${errors.cliente ? "border-destructive" : ""}`}
              placeholder="Nome completo" value={cliente} onChange={(e) => setCliente(e.target.value)} />
            {err("cliente")}
          </div>
          <div>
            <Label>Telefone <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Input className="h-10" placeholder="(00) 00000-0000"
              type="tel" inputMode="numeric" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* 2. COTAÇÃO */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Cotação do Dólar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label>Cotação USD → R$ *</Label>
            <Input className={`h-10 ${errors.cotacao ? "border-destructive" : ""}`}
              type="number" inputMode="decimal" placeholder="Ex: 5.80"
              value={cotacao} onChange={(e) => setCotacao(e.target.value)} />
            {err("cotacao")}
          </div>
        </CardContent>
      </Card>

      {/* 3. ITENS */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Perfumes Vendidos
          </CardTitle>
          <Button type="button" variant="outline" size="sm"
            onClick={() => setItens((p) => [...p, { ...ITEM_VAZIO }])}
            className="flex items-center gap-1 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> Adicionar item
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {itens.map((item, idx) => {
            const calc = itensCalc[idx];
            const showItemCalc = cotacaoNum > 0 && calc.usd > 0;
            return (
              <div key={idx} className="rounded-lg border border-border p-4 space-y-3 relative">
                {itens.length > 1 && (
                  <button type="button"
                    onClick={() => setItens((p) => p.filter((_, i) => i !== idx))}
                    className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item {idx + 1}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Marca *</Label>
                    <Input className={`h-10 ${errors[`marca_${idx}`] ? "border-destructive" : ""}`}
                      placeholder="Ex: Dior, Chanel..." value={item.marca}
                      onChange={(e) => updateItem(idx, "marca", e.target.value)} />
                    {err(`marca_${idx}`)}
                  </div>
                  <div>
                    <Label>Perfume *</Label>
                    <Input className={`h-10 ${errors[`nome_${idx}`] ? "border-destructive" : ""}`}
                      placeholder="Ex: Sauvage, Bleu..." value={item.nome}
                      onChange={(e) => updateItem(idx, "nome", e.target.value)} />
                    {err(`nome_${idx}`)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Preço USD *</Label>
                    <Input className={`h-10 ${errors[`preco_${idx}`] ? "border-destructive" : ""}`}
                      type="number" inputMode="decimal" placeholder="0.00"
                      value={item.precoUsd} onChange={(e) => updateItem(idx, "precoUsd", e.target.value)} />
                    {err(`preco_${idx}`)}
                  </div>
                  <div>
                    <Label>Preço de Venda (R$) *</Label>
                    <Input className={`h-10 ${errors[`venda_${idx}`] ? "border-destructive" : ""}`}
                      type="number" inputMode="decimal" placeholder="0.00"
                      value={item.precoVenda}
                      onChange={(e) => updateItem(idx, "precoVenda", e.target.value)} />
                    {err(`venda_${idx}`)}
                  </div>
                </div>
                {showItemCalc && (
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 border border-border/50">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Custo BRL</p>
                      <p className="font-semibold text-sm">{fmtBRL(calc.custo)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Custo +{margem}%</p>
                      <p className="font-semibold text-sm text-orange-500">{fmtBRL(calc.custoMais)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Lucro</p>
                      <p className={`font-semibold text-sm flex items-center gap-0.5 ${calc.lucro >= 0 ? "text-green-600" : "text-destructive"}`}>
                        <TrendingUp className="h-3 w-3" />{calc.venda > 0 ? fmtBRL(calc.lucro) : "—"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {showCalc && itens.length > 1 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Total da Venda</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Custo total</p>
                  <p className="font-semibold text-sm">{fmtBRL(totalCusto)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Venda total</p>
                  <p className="font-bold text-primary">{fmtBRL(totalVenda)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Lucro total</p>
                  <p className="font-bold text-green-600">{fmtBRL(totalLucro)}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. PLATAFORMA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Megaphone className="h-4 w-4" /> Canal de Venda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PLATAFORMAS.map((p) => (
              <button key={p.value} type="button" onClick={() => togglePlataforma(p.value)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all
                  ${plataformas.includes(p.value)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 5. PAGAMENTO */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Forma de Pagamento *
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {err("pagamento")}
          <div className="flex flex-wrap gap-2">
            {[
              { f: "pix" as FormaPagamento,    label: "PIX" },
              { f: "credito" as FormaPagamento, label: "Crédito" },
              { f: "entrada" as FormaPagamento, label: "Entrada + Restante" },
            ].map(({ f, label }) => (
              <button key={f} type="button" onClick={() => toggleForma(f)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all
                  ${formasPag.includes(f) && !(f !== "entrada" && formasPag.includes("entrada"))
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40"}`}>
                {label}
              </button>
            ))}
          </div>

          {formasPag.includes("credito") && !formasPag.includes("entrada") && (
            <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
              <p className="text-sm font-medium">Parcelamento no Crédito</p>
              <div className="flex items-end gap-4">
                <div>
                  <Label>Número de parcelas</Label>
                  <Input className={`h-10 w-32 ${errors.parcelas ? "border-destructive" : ""}`}
                    type="number" inputMode="numeric" min={1} max={24}
                    value={parcelasCredito} onChange={(e) => setParcelasCredito(e.target.value)} />
                  {err("parcelas")}
                </div>
                {showCalc && parcelasNum > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Valor por parcela</p>
                    <p className="font-bold text-primary">{fmtBRL(totalVenda / parcelasNum)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {formasPag.includes("entrada") && (
            <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-4">
              <p className="text-sm font-medium">Entrada + Parcelamento</p>
              <div className="flex items-end gap-4 flex-wrap">
                <div>
                  <Label>Valor da entrada (R$)</Label>
                  <Input className={`h-10 w-40 ${errors.entrada ? "border-destructive" : ""}`}
                    type="number" inputMode="decimal" placeholder="0.00"
                    value={entrada.valorEntrada}
                    onChange={(e) => setEntrada((x) => ({ ...x, valorEntrada: e.target.value }))} />
                  {err("entrada")}
                </div>
                {showCalc && entradaNum > 0 && entradaNum < totalVenda && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Restante</p>
                    <p className="font-bold text-destructive">{fmtBRL(totalVenda - entradaNum)}</p>
                  </div>
                )}
              </div>
              <div>
                <Label className="mb-2 block">Restante via</Label>
                <div className="flex gap-2">
                  {[
                    { value: "pix_parcelado", label: "PIX Parcelado" },
                    { value: "credito",       label: "Crédito" },
                  ].map((op) => (
                    <button key={op.value} type="button"
                      onClick={() => setEntrada((x) => ({ ...x, formaRestante: op.value as EntradaConfig["formaRestante"] }))}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all
                        ${entrada.formaRestante === op.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40"}`}>
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-end gap-4 flex-wrap">
                <div>
                  <Label>Número de parcelas</Label>
                  <Input className={`h-10 w-32 ${errors.parcelasRestante ? "border-destructive" : ""}`}
                    type="number" inputMode="numeric" min={1} max={24}
                    value={entrada.parcelasRestante}
                    onChange={(e) => setEntrada((x) => ({ ...x, parcelasRestante: e.target.value }))} />
                  {err("parcelasRestante")}
                </div>
                {showCalc && parcelasRestNum > 0 && entradaNum > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Valor por parcela</p>
                    <p className="font-bold text-primary">{fmtBRL((totalVenda - entradaNum) / parcelasRestNum)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6. DATA + OBSERVAÇÕES */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Data e Observações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-xs">
            <Label>Data da Venda</Label>
            <Input className="h-10" type="date"
              value={dataVenda} onChange={(e) => setDataVenda(e.target.value)} />
          </div>
          <div>
            <Label>Observações <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Textarea className="min-h-[80px]" placeholder="Anotações adicionais..."
              value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Button className="w-full h-12 text-sm font-semibold" onClick={handleSalvar} disabled={loading}>
        {loading ? "Salvando..." : <><Save className="h-4 w-4 mr-2" /> Registrar Venda</>}
      </Button>
    </div>
  );
}