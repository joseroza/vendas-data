import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, CheckCircle2, X, Pencil, TrendingUp, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import type { VendaPerfume } from "@/context/AppContext";
import { toast } from "sonner";
import { ImportCSV } from "@/components/ImportCSV";
import type { CSVColumn } from "@/components/ImportCSV";

type StatusFiltro = "todos" | "pago" | "pendente";

const COLUNAS_CSV: CSVColumn[] = [
  { key: "data",        label: "Data",                required: true,  example: "15/06/2025",  hint: "Formato DD/MM/AAAA" },
  { key: "cliente",     label: "Cliente",             required: true,  example: "Maria Silva" },
  { key: "telefone",    label: "Telefone",            required: false, example: "11999998888" },
  { key: "marca",       label: "Marca",               required: true,  example: "LATAFFA" },
  { key: "perfume",     label: "Nome do Perfume",     required: true,  example: "Pride 1910" },
  { key: "preco_usd",   label: "Preco USD",           required: true,  example: "27.00",       hint: "Use ponto como decimal" },
  { key: "cotacao",     label: "Cotacao (R$)",        required: true,  example: "5.80",        hint: "Cotacao do dolar usada" },
  { key: "preco_venda", label: "Preco de Venda (R$)", required: true,  example: "390.00",      hint: "Valor cobrado do cliente" },
  { key: "pagamento",   label: "Pagamento",           required: false, example: "pix",         hint: "pix, credito ou entrada. Padrao: pix" },
  { key: "status",      label: "Status",              required: false, example: "pago",        hint: "pago ou pendente. Padrao: pendente" },
];

interface EditItem { marca: string; perfume: string; precoUsd: string; cotacao: string; precoVenda: string; }
interface EditForm { cliente: string; telefone: string; data: string; itens: EditItem[]; }

function toInputDate(d: string) { const p = d.split("/"); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : d; }
function fromInputDate(d: string) { const p = d.split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; }
function fmtBRL(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function parsePerfumes(raw: string): EditItem[] {
  return raw.split(",").map((seg) => {
    const trimmed = seg.trim();
    const pipeIdx = trimmed.indexOf("|");
    if (pipeIdx !== -1) {
      return { marca: trimmed.slice(0, pipeIdx).trim(), perfume: trimmed.slice(pipeIdx + 1).trim(), precoUsd: "", cotacao: "", precoVenda: "" };
    }
    // fallback para formato antigo (primeira palavra = marca)
    const p = trimmed.split(" ");
    return { marca: p[0] || "", perfume: p.slice(1).join(" ") || "", precoUsd: "", cotacao: "", precoVenda: "" };
  });
}

const ITEM_VAZIO: EditItem = { marca: "", perfume: "", precoUsd: "", cotacao: "", precoVenda: "" };

function calcItem(it: EditItem, margem: number) {
  const usd = parseFloat(it.precoUsd) || 0;
  const cot = parseFloat(it.cotacao)  || 0;
  const custo     = usd * cot;
  const custoMais = custo * (1 + margem / 100);
  const venda     = parseFloat(it.precoVenda) || 0;
  return { usd, cot, custo, custoMais, venda, lucro: venda > 0 ? venda - custoMais : 0 };
}

export default function PerfumesVendas() {
  const { state, marcarVendaPaga, updateVendaAction, deleteVendaAction, addVenda } = useApp();
  const margem = state.margem;

  const [search,       setSearch]       = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("todos");
  const [filtroMarca,  setFiltroMarca]  = useState("todos");
  const [filtroData,   setFiltroData]   = useState("");
  const [editando,     setEditando]     = useState<VendaPerfume | null>(null);
  const [form,         setForm]         = useState<EditForm | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [erros,        setErros]        = useState<Record<string, string>>({});

  const marcas = useMemo(() => {
    const set = new Set(state.catalogoPerfumes.map((p) => p.marca).filter(Boolean));
    return Array.from(set).sort();
  }, [state.catalogoPerfumes]);

  const vendas = useMemo(() => state.vendas.filter((v) => {
    if (v.tipo !== "perfume") return false;
    const q = search.toLowerCase();
    return (
      (!search || v.cliente.toLowerCase().includes(q) || v.perfume.toLowerCase().includes(q) || (v.telefone ?? "").toLowerCase().includes(q)) &&
      (filtroStatus === "todos" || v.status === filtroStatus) &&
      (!filtroData || v.data.includes(filtroData)) &&
      (filtroMarca === "todos" || state.catalogoPerfumes.some((p) => p.marca === filtroMarca && v.perfume.toLowerCase().includes(p.nome.toLowerCase())))
    );
  }) as VendaPerfume[], [state.vendas, state.catalogoPerfumes, search, filtroStatus, filtroMarca, filtroData]);

  const temFiltro   = search || filtroStatus !== "todos" || filtroMarca !== "todos" || filtroData;
  const totalGeral   = vendas.reduce((s, v) => s + v.valorFinal, 0);
  const totalPago    = vendas.filter((v) => v.status === "pago").reduce((s, v) => s + v.valorFinal, 0);
  const totalPend    = vendas.filter((v) => v.status === "pendente").reduce((s, v) => s + v.valorFinal, 0);
  const totalLucro   = vendas.reduce((s, v) => s + (v.valorFinal - v.precoBrl), 0);

  async function handlePagar(id: string, cliente: string) {
    try { await marcarVendaPaga(id); toast.success(`Venda de ${cliente} marcada como paga!`); }
    catch { toast.error("Erro ao atualizar."); }
  }

  function abrirEdicao(v: VendaPerfume) {
    setEditando(v); setErros({});
    const itensParsed = parsePerfumes(v.perfume);
    const numItens    = itensParsed.length;
    // Distribui valores totais igualmente entre os itens
    const usdPorItem   = numItens > 0 ? (v.precoUsd   / numItens) : 0;
    const vendaPorItem = numItens > 0 ? (v.valorFinal  / numItens) : 0;
    const itensComDados = itensParsed.map((it) => ({
      ...it,
      precoUsd:   usdPorItem   > 0 ? usdPorItem.toFixed(2)   : "",
      cotacao:    v.cotacao    > 0 ? String(v.cotacao)        : "",
      precoVenda: vendaPorItem > 0 ? vendaPorItem.toFixed(2)  : "",
    }));
    setForm({ cliente: v.cliente, telefone: v.telefone ?? "", data: toInputDate(v.data), itens: itensComDados });
  }
  function fecharEdicao() { setEditando(null); setForm(null); setErros({}); }
  function setF<K extends keyof Omit<EditForm,"itens">>(k: K, val: string) { setForm((f) => f ? { ...f, [k]: val } : f); }
  function setIt(idx: number, k: keyof EditItem, val: string) {
    setForm((f) => f ? { ...f, itens: f.itens.map((it, i) => i === idx ? { ...it, [k]: val } : it) } : f);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form?.cliente.trim()) e.cliente = "Obrigatório.";
    form?.itens.forEach((it, i) => {
      if (!it.marca.trim())   e[`marca_${i}`]   = "Obrigatório.";
      if (!it.perfume.trim()) e[`perfume_${i}`] = "Obrigatório.";
    });
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function handleSalvar() {
    if (!editando || !form || !validate()) return;
    setSaving(true);
    const m = editando.margemUsada ?? margem;
    const nomePerfumes = form.itens.map((it) => `${it.marca.trim()}|${it.perfume.trim()}`).join(", ");
    const totalVenda   = form.itens.reduce((s, it) => s + (parseFloat(it.precoVenda) || 0), 0);
    const totalCusto   = form.itens.reduce((s, it) => s + calcItem(it, m).custoMais, 0);
    const totalUsd     = form.itens.reduce((s, it) => s + (parseFloat(it.precoUsd) || 0), 0);
    const cotMedia     = form.itens.reduce((s, it) => s + (parseFloat(it.cotacao) || editando.cotacao), 0) / form.itens.length;
    try {
      await updateVendaAction(editando.id, {
        cliente: form.cliente.trim(), telefone: form.telefone.trim(),
        perfume: nomePerfumes,
        precoUsd:   totalUsd   || editando.precoUsd,
        cotacao:    cotMedia   || editando.cotacao,
        precoBrl:   totalCusto || editando.precoBrl,
        valorFinal: totalVenda || editando.valorFinal,
        data: fromInputDate(form.data),
      });
      toast.success("Venda atualizada!"); fecharEdicao();
    } catch { toast.error("Erro ao salvar."); }
    finally { setSaving(false); }
  }

  async function handleImportPerfumes(rows: Record<string, string>[]) {
    let ok = 0;
    const errors: string[] = [];
    const m = margem;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const linha = i + 2;
      if (!r.cliente?.trim()) { errors.push(`Linha ${linha}: cliente obrigatorio.`); continue; }
      if (!r.data?.trim())    { errors.push(`Linha ${linha}: data obrigatoria.`);    continue; }
      if (!r.marca?.trim())   { errors.push(`Linha ${linha}: marca obrigatoria.`);   continue; }
      if (!r.perfume?.trim()) { errors.push(`Linha ${linha}: perfume obrigatorio.`); continue; }
      const usd   = parseFloat(r.preco_usd?.replace(",", "."))  || 0;
      const cot   = parseFloat(r.cotacao?.replace(",", "."))     || 0;
      const venda = parseFloat(r.preco_venda?.replace(",", ".")) || 0;
      const custo     = usd * cot;
      const custoMais = custo * (1 + m / 100);
      const nomePerfume = `${r.marca.trim()}|${r.perfume.trim()}`;
      const tipoPag = (r.pagamento?.toLowerCase() === "credito" || r.pagamento?.toLowerCase() === "entrada")
        ? "parcelado" as const : "avista" as const;
      const status = r.status?.toLowerCase() === "pago" ? "pago" as const : "pendente" as const;
      try {
        await addVenda({
          tipo: "perfume",
          cliente: r.cliente.trim(),
          telefone: (r.telefone ?? "").trim(),
          vendedor: "",
          perfume: nomePerfume,
          precoUsd: usd,
          cotacao: cot,
          precoBrl: custoMais,
          margemUsada: m,
          valorFinal: venda || custoMais,
          tipoPagamento: tipoPag,
          parcelas: [],
          observacoes: "",
          data: r.data.trim(),
          status,
        });
        ok++;
      } catch (e) {
        errors.push(`Linha ${linha}: erro ao salvar (${String(e).slice(0, 60)})`);
      }
    }
    return { ok, errors };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Vendas — Perfumes</h1>
          <p className="text-muted-foreground text-sm mt-1">{vendas.length} venda(s) encontrada(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportCSV
            title="Perfumes"
            columns={COLUNAS_CSV}
            onImport={handleImportPerfumes}
            templateFileName="template_vendas_perfumes.csv"
          />
          <Button asChild><Link to="/perfumes/nova-venda"><Plus className="h-4 w-4 mr-2" />Nova Venda</Link></Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total",    value: totalGeral, cls: "" },
          { label: "Recebido", value: totalPago,  cls: "text-success" },
          { label: "Pendente", value: totalPend,  cls: "text-destructive" },
          { label: "Lucro Total", value: totalLucro, cls: totalLucro >= 0 ? "text-success" : "text-destructive" },
        ].map((k) => (
          <div key={k.label} className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`font-bold text-lg mt-0.5 ${k.cls}`}>{fmtBRL(k.value)}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente, perfume..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as StatusFiltro)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pago">Pagos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
          </SelectContent>
        </Select>
        {marcas.length > 0 && (
          <Select value={filtroMarca} onValueChange={setFiltroMarca}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Marca" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as marcas</SelectItem>
              {marcas.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Input type="date" className="w-[160px]" value={filtroData} onChange={(e) => setFiltroData(e.target.value)} />
        {temFiltro && <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFiltroStatus("todos"); setFiltroMarca("todos"); setFiltroData(""); }} className="text-muted-foreground"><X className="h-3.5 w-3.5 mr-1" />Limpar</Button>}
      </div>

      {/* Tabela */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead><TableHead>Cliente</TableHead>
                <TableHead>Marca</TableHead><TableHead>Perfume</TableHead>
                <TableHead>Preço de Venda</TableHead><TableHead>Pagamento</TableHead>
                <TableHead>Parcelas</TableHead><TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendas.map((v) => {
                const pagas = v.parcelas.filter((p) => p.status === "pago").length;
                const itens = v.perfume.split(",");
                const multi = itens.length > 1;
                return (
                  <TableRow key={v.id} className={multi ? "align-top" : ""}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{v.data}</TableCell>
                    <TableCell className="font-medium">{v.cliente}</TableCell>
                    <TableCell className="text-sm font-medium text-primary">
                      {itens.map((item, i) => {
                        const trimmed  = item.trim();
                        const pipeIdx  = trimmed.indexOf("|");
                        const marca    = pipeIdx !== -1 ? trimmed.slice(0, pipeIdx).trim() : trimmed.split(" ")[0];
                        return <div key={i} className={multi ? "py-0.5 border-b border-border/30 last:border-0" : ""}>{marca || "—"}</div>;
                      })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {itens.map((item, i) => {
                        const trimmed  = item.trim();
                        const pipeIdx  = trimmed.indexOf("|");
                        const nome     = pipeIdx !== -1 ? trimmed.slice(pipeIdx + 1).trim() : trimmed.split(" ").slice(1).join(" ");
                        return <div key={i} className={multi ? "py-0.5 border-b border-border/30 last:border-0" : ""}>{nome || trimmed}</div>;
                      })}
                    </TableCell>
                    <TableCell className="font-semibold whitespace-nowrap">{fmtBRL(v.valorFinal)}</TableCell>
                    <TableCell><Badge variant="secondary">{v.tipoPagamento === "parcelado" ? "Parcelado" : "À Vista"}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.tipoPagamento === "parcelado" ? `${pagas}/${v.parcelas.length}` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={v.status === "pago" ? "default" : "destructive"} className={v.status === "pago" ? "bg-success/20 text-success border-0" : ""}>
                        {v.status === "pago" ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => abrirEdicao(v)} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost"
                          onClick={() => { if (confirm(`Excluir venda de ${v.cliente}?`)) { deleteVendaAction(v.id).then(() => toast.success("Venda excluída.")).catch(() => toast.error("Erro ao excluir.")); } }}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        {v.status !== "pago" && (
                          <Button size="sm" variant="ghost" onClick={() => handlePagar(v.id, v.cliente)} className="h-8 px-2 text-success hover:text-success text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Pagar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {vendas.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                  {temFiltro ? "Nenhuma venda encontrada com esses filtros." : "Nenhuma venda registrada ainda."}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Modal de Edição ─────────────────────────────────────────────────── */}
      <Dialog open={!!editando} onOpenChange={(o) => { if (!o) fecharEdicao(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><Pencil className="h-4 w-4" /> Editar Venda</DialogTitle>
          </DialogHeader>

          {form && (
            <div className="space-y-4 py-1">
              {/* Cliente + Telefone + Data */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Cliente *</Label>
                  <Input className={`h-10 ${erros.cliente ? "border-destructive" : ""}`} value={form.cliente} onChange={(e) => setF("cliente", e.target.value)} />
                  {erros.cliente && <p className="text-xs text-destructive mt-1">{erros.cliente}</p>}
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input className="h-10" value={form.telefone} onChange={(e) => setF("telefone", e.target.value)} />
                </div>
                <div>
                  <Label>Data</Label>
                  <Input className="h-10" type="date" value={form.data} onChange={(e) => setF("data", e.target.value)} />
                </div>
              </div>

              {/* Itens */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Perfumes da venda</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => f ? { ...f, itens: [...f.itens, { ...ITEM_VAZIO }] } : f)} className="h-7 text-xs gap-1">
                    <Plus className="h-3 w-3" /> Adicionar item
                  </Button>
                </div>

                {form.itens.map((it, idx) => {
                  const m    = editando?.margemUsada ?? margem;
                  const calc = calcItem(it, m);
                  const show = calc.usd > 0 && calc.cot > 0;
                  return (
                    <div key={idx} className="rounded-lg border border-border p-3 space-y-3 relative">
                      {form.itens.length > 1 && (
                        <button type="button" onClick={() => setForm((f) => f && f.itens.length > 1 ? { ...f, itens: f.itens.filter((_, i) => i !== idx) } : f)}
                          className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <p className="text-xs font-semibold text-muted-foreground">Item {idx + 1}</p>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Marca *</Label>
                          <Input className={`h-10 ${erros[`marca_${idx}`] ? "border-destructive" : ""}`}
                            placeholder="Ex: Lataffa, Dior..." value={it.marca} onChange={(e) => setIt(idx, "marca", e.target.value)} />
                          {erros[`marca_${idx}`] && <p className="text-xs text-destructive mt-1">{erros[`marca_${idx}`]}</p>}
                        </div>
                        <div>
                          <Label>Perfume *</Label>
                          <Input className={`h-10 ${erros[`perfume_${idx}`] ? "border-destructive" : ""}`}
                            placeholder="Ex: Pride, Sauvage..." value={it.perfume} onChange={(e) => setIt(idx, "perfume", e.target.value)} />
                          {erros[`perfume_${idx}`] && <p className="text-xs text-destructive mt-1">{erros[`perfume_${idx}`]}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label>Preço USD</Label>
                          <Input className="h-10" type="number" inputMode="decimal" placeholder="0.00"
                            value={it.precoUsd} onChange={(e) => setIt(idx, "precoUsd", e.target.value)} />
                        </div>
                        <div>
                          <Label>Cotação (R$)</Label>
                          <Input className="h-10" type="number" inputMode="decimal" placeholder="5.80"
                            value={it.cotacao} onChange={(e) => setIt(idx, "cotacao", e.target.value)} />
                        </div>
                        <div>
                          <Label>Preço de Venda (R$)</Label>
                          <Input className="h-10" type="number" inputMode="decimal" placeholder="0.00"
                            value={it.precoVenda} onChange={(e) => setIt(idx, "precoVenda", e.target.value)} />
                        </div>
                      </div>

                      {show && (
                        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 border border-border/50">
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Custo BRL</p>
                            <p className="font-semibold text-sm">{fmtBRL(calc.custo)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Custo +{m}%</p>
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
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={fecharEdicao} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}