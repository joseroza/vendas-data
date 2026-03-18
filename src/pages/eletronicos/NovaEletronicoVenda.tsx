import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, TrendingUp, Plus, Trash2, Calculator, User, Megaphone, CreditCard, Calendar, DollarSign } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { useVendedorLogado } from "@/hooks/useVendedorLogado";
import { ClienteAutocomplete } from "@/components/ClienteAutocomplete";
import { toast } from "sonner";

type PlataformaVenda = "instagram" | "whatsapp" | "indicacao" | "loja" | "outro";
type FormaPagamento  = "pix" | "credito" | "entrada";
interface EntradaConfig {
  valorEntrada: string;
  formaRestante: "pix_parcelado" | "credito";
  parcelasRestante: string;
}
interface ItemEletronico {
  marca: string;
  nome: string;
  precoCusto: string;
  precoVenda: string;
  isUsd: boolean;
  precoUsd: string;
  cotacao: string;
  usarMargem: boolean;
}

const ITEM_VAZIO: ItemEletronico = {
  marca: "", nome: "", precoCusto: "", precoVenda: "",
  isUsd: false, precoUsd: "", cotacao: "", usarMargem: false,
};

function gerarParcelas(num: number, dataVenda: string, entrada?: number) {
  const [y, m, d] = dataVenda.split("-").map(Number);
  const temEntrada = entrada && entrada > 0;
  const parcelaEntrada = temEntrada ? [{
    numero: 0, total: num + 1,
    vencimento: `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}/${y}`,
    status: "pago" as const,
    isEntrada: true,
  }] : [];
  const totalParcelas = temEntrada ? num + 1 : num;
  const restantes = Array.from({ length: num }, (_, i) => {
    const dt = new Date(y, m - 1 + i + 1, d);
    return {
      numero: i + 1, total: totalParcelas,
      vencimento: `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`,
      status: "pendente" as const,
      isEntrada: false,
    };
  });
  return [...parcelaEntrada, ...restantes];
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

export default function NovaEletronicoVenda() {
  const { state, addVenda, addCliente } = useApp();
  const vendedorLogado = useVendedorLogado();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [cliente,     setCliente]     = useState("");
  const [telefone,    setTelefone]    = useState("");
  const [itens,       setItens]       = useState<ItemEletronico[]>([{ ...ITEM_VAZIO }]);
  const [plataformas, setPlataformas] = useState<PlataformaVenda[]>([]);
  const [formasPag,   setFormasPag]   = useState<FormaPagamento[]>([]);
  const [parcelasCredito, setParcelasCredito] = useState("3");
  const [entrada, setEntrada] = useState<EntradaConfig>({
    valorEntrada: "", formaRestante: "pix_parcelado", parcelasRestante: "3",
  });
  const [dataVenda,   setDataVenda]   = useState(() => new Date().toISOString().split("T")[0]);
  const [observacoes, setObservacoes] = useState("");
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  const margem = state.margem;

  const itensCalc = itens.map((item) => {
    const cotNum = parseFloat(item.cotacao) || 0;
    const usd    = parseFloat(item.precoUsd) || 0;
    const custo  = item.isUsd ? usd * cotNum : parseFloat(item.precoCusto) || 0;
    const vendaBrl = item.usarMargem && !item.isUsd
      ? custo * (1 + margem / 100)
      : parseFloat(item.precoVenda) || 0;
    const venda  = item.isUsd ? custo * (1 + margem / 100) : vendaBrl;
    return { ...item, custoCalc: custo, vendaCalc: venda, lucroCalc: venda - custo, usdCalc: usd, cotCalc: cotNum };
  });

  const totalVenda = itensCalc.reduce((s, i) => s + i.vendaCalc, 0);
  const totalCusto = itensCalc.reduce((s, i) => s + i.custoCalc, 0);
  const totalLucro = itensCalc.reduce((s, i) => s + i.lucroCalc, 0);
  const showCalc   = itens.some((item) => {
    if (item.isUsd) return parseFloat(item.precoUsd) > 0 && parseFloat(item.cotacao) > 0;
    return parseFloat(item.precoCusto) > 0 && parseFloat(item.precoVenda) > 0;
  });

  const entradaNum      = parseFloat(entrada.valorEntrada) || 0;
  const parcelasNum     = parseInt(parcelasCredito) || 1;
  const parcelasRestNum = parseInt(entrada.parcelasRestante) || 1;

  function updateItem(idx: number, campo: keyof ItemEletronico, valor: string | boolean) {
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
    if (!cliente.trim()) e.cliente = "Nome do cliente é obrigatório.";
    itens.forEach((item, idx) => {
      if (!item.marca.trim()) e[`marca_${idx}`] = "Informe a marca.";
      if (!item.nome.trim())  e[`nome_${idx}`]  = "Informe o produto.";
      if (item.isUsd) {
        if (!(parseFloat(item.precoUsd) > 0))  e[`precoUsd_${idx}`] = "Informe o preço USD.";
        if (!(parseFloat(item.cotacao) > 0))    e[`cotacao_${idx}`]  = "Informe a cotação.";
      } else {
        if (!(parseFloat(item.precoCusto) > 0)) e[`custo_${idx}`] = "Informe o custo.";
        if (!(parseFloat(item.precoVenda) > 0)) e[`venda_${idx}`] = "Informe o preço de venda.";
      }
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
      .map((i) => i.isUsd
        ? `${i.marca} ${i.nome} (USD ${i.usdCalc.toFixed(2)} → ${fmtBRL(i.vendaCalc)})`
        : `${i.marca} ${i.nome} (Custo ${fmtBRL(i.custoCalc)} → Venda ${fmtBRL(i.vendaCalc)})`)
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
    else if (formasPag.includes("entrada")) parcelas = gerarParcelas(parcelasRestNum, dataVenda, entradaNum);

    const nomeProdutos  = itens.map((i) => `${i.marca.trim()}|${i.nome.trim()}`).join(", ");
    const primeiroItem  = itensCalc[0];

    try {
      const jaExiste = state.clientes.some(
        (c) => c.nome.trim().toLowerCase() === cliente.trim().toLowerCase()
      );
      if (!jaExiste && cliente.trim()) {
        try { await addCliente({ nome: cliente.trim(), telefone: telefone.trim(), email: "", notas: "" }); } catch {}
      }
      await addVenda({
        tipo: "eletronico",
        cliente: cliente.trim(),
        telefone: telefone.trim(),
        vendedor: vendedorLogado,
        produto: nomeProdutos,
        precoCusto: totalCusto,
        precoVenda: totalVenda,
        lucro: totalLucro,
        isUsd: primeiroItem.isUsd,
        ...(primeiroItem.isUsd ? { precoUsd: primeiroItem.usdCalc, cotacao: primeiroItem.cotCalc } : {}),
        margemUsada: margem,
        tipoPagamento: parcelado ? "parcelado" : "avista",
        valorEntrada: formasPag.includes("entrada") ? entradaNum : 0,
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

  return (
    <div className="space-y-4 pb-10">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/eletronicos/vendas"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="page-title">Nova Venda — Eletrônicos</h1>
          <p className="text-muted-foreground text-sm mt-1">Registre uma nova venda de eletrônico</p>
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
          <ClienteAutocomplete
            value={cliente}
            telefone={telefone}
            onChange={(nome, tel) => { setCliente(nome); if (tel !== telefone) setTelefone(tel); }}
            error={errors.cliente}
          />
          <div>
            <Label>Telefone <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Input className="h-10" placeholder="(00) 00000-0000"
              type="tel" inputMode="numeric" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* 2. ITENS */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Produtos Vendidos
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
            const showItemCalc = item.isUsd
              ? calc.usdCalc > 0 && calc.cotCalc > 0
              : calc.custoCalc > 0 && calc.vendaCalc > 0;

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
                      placeholder="Ex: Apple, Samsung..." value={item.marca}
                      onChange={(e) => updateItem(idx, "marca", e.target.value)} />
                    {err(`marca_${idx}`)}
                  </div>
                  <div>
                    <Label>Produto *</Label>
                    <Input className={`h-10 ${errors[`nome_${idx}`] ? "border-destructive" : ""}`}
                      placeholder="Ex: iPhone 15 Pro..." value={item.nome}
                      onChange={(e) => updateItem(idx, "nome", e.target.value)} />
                    {err(`nome_${idx}`)}
                  </div>
                </div>

                {/* Toggle USD */}
                <button type="button" onClick={() => updateItem(idx, "isUsd", !item.isUsd)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all text-sm
                    ${item.isUsd ? "border-primary bg-primary/5 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0
                    ${item.isUsd ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                    {item.isUsd && <span className="text-primary-foreground text-[10px] font-bold leading-none">✓</span>}
                  </div>
                  <DollarSign className="h-4 w-4 shrink-0" />
                  <span>
                    <span className="font-medium block">Venda em Dólar (USD)</span>
                    <span className="text-xs text-muted-foreground">Calcular automaticamente com cotação</span>
                  </span>
                </button>

                {item.isUsd ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Preço USD *</Label>
                      <Input className={`h-10 ${errors[`precoUsd_${idx}`] ? "border-destructive" : ""}`}
                        type="number" inputMode="decimal" placeholder="0.00"
                        value={item.precoUsd} onChange={(e) => updateItem(idx, "precoUsd", e.target.value)} />
                      {err(`precoUsd_${idx}`)}
                    </div>
                    <div>
                      <Label>Cotação R$ *</Label>
                      <Input className={`h-10 ${errors[`cotacao_${idx}`] ? "border-destructive" : ""}`}
                        type="number" inputMode="decimal" placeholder="5.80"
                        value={item.cotacao} onChange={(e) => updateItem(idx, "cotacao", e.target.value)} />
                      {err(`cotacao_${idx}`)}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Preço de Custo (R$) *</Label>
                        <Input className={`h-10 ${errors[`custo_${idx}`] ? "border-destructive" : ""}`}
                          type="number" inputMode="decimal" placeholder="0.00"
                          value={item.precoCusto} onChange={(e) => updateItem(idx, "precoCusto", e.target.value)} />
                        {err(`custo_${idx}`)}
                      </div>
                      <div>
                        <Label>
                          Preço de Venda (R$) *
                          {item.usarMargem && parseFloat(item.precoCusto) > 0 && (
                            <span className="ml-1 text-xs text-muted-foreground font-normal">
                              (automático +{margem}%)
                            </span>
                          )}
                        </Label>
                        <Input
                          className={`h-10 ${errors[`venda_${idx}`] ? "border-destructive" : ""} ${item.usarMargem ? "bg-muted/50 text-muted-foreground" : ""}`}
                          type="number" inputMode="decimal" placeholder="0.00"
                          readOnly={item.usarMargem}
                          value={
                            item.usarMargem && parseFloat(item.precoCusto) > 0
                              ? (parseFloat(item.precoCusto) * (1 + margem / 100)).toFixed(2)
                              : item.precoVenda
                          }
                          onChange={(e) => !item.usarMargem && updateItem(idx, "precoVenda", e.target.value)}
                        />
                        {err(`venda_${idx}`)}
                      </div>
                    </div>
                    {/* Checkbox margem */}
                    <button
                      type="button"
                      onClick={() => updateItem(idx, "usarMargem", !item.usarMargem)}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg border text-sm transition-all
                        ${item.usarMargem
                          ? "border-primary/40 bg-primary/5 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/30"}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all
                        ${item.usarMargem ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                        {item.usarMargem && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span>Aplicar margem de +{margem}% sobre o custo</span>
                    </button>
                  </div>
                )}

                {showItemCalc && (
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 border border-border/50">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Custo</p>
                      <p className="font-semibold text-sm">{fmtBRL(calc.custoCalc)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Venda</p>
                      <p className="font-bold text-sm text-primary">{fmtBRL(calc.vendaCalc)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Lucro</p>
                      <p className="font-semibold text-sm text-green-600 flex items-center gap-0.5">
                        <TrendingUp className="h-3 w-3" />{fmtBRL(calc.lucroCalc)}
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

      {/* 3. PLATAFORMA */}
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

      {/* 4. PAGAMENTO */}
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

      {/* 5. DATA + OBSERVAÇÕES */}
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