import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, CheckCircle2, X, Pencil, Trash2, Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import type { VendaEletronico } from "@/context/AppContext";
import { toast } from "sonner";
import { ParcelasModal } from "@/components/ParcelasModal";
import { ImportCSV } from "@/components/ImportCSV";
import type { CSVColumn } from "@/components/ImportCSV";

type StatusFiltro = "todos" | "pago" | "pendente";

const COLUNAS_ELET_CSV: CSVColumn[] = [
  { key: "data",        label: "Data",                required: true,  example: "15/06/2025",  hint: "Formato DD/MM/AAAA" },
  { key: "cliente",     label: "Cliente",             required: true,  example: "Joao Silva" },
  { key: "telefone",    label: "Telefone",            required: false, example: "11999998888" },
  { key: "marca",       label: "Marca",               required: true,  example: "Samsung" },
  { key: "produto",     label: "Nome do Produto",     required: true,  example: "Galaxy A55" },
  { key: "preco_custo", label: "Custo (R$)",          required: true,  example: "1200.00",     hint: "Custo de aquisicao" },
  { key: "preco_venda", label: "Preco de Venda (R$)", required: true,  example: "1500.00",     hint: "Valor cobrado do cliente" },
  { key: "pagamento",   label: "Pagamento",           required: false, example: "pix",         hint: "pix, credito ou entrada. Padrao: pix" },
  { key: "status",      label: "Status",              required: false, example: "pago",        hint: "pago ou pendente. Padrao: pendente" },
];

interface EditForm {
  cliente:       string;
  telefone:      string;
  marca:         string;
  produto:       string;
  precoCusto:    string;
  precoVenda:    string;
  data:          string;
  observacoes:   string;
  tipoPagamento: "avista" | "parcelado";
  formaPag:      "pix" | "credito";
  numParcelas:   string;
  valorEntrada:  string;
  status:        "pago" | "pendente";
  usarMargem:    boolean;
}

function toInputDate(dataBR: string): string {
  const parts = dataBR.split("/");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dataBR;
}
function fromInputDate(dateISO: string): string {
  const parts = dateISO.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateISO;
}
function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function EletronicosVendas() {
  const { state, marcarVendaPaga, updateVendaAction, deleteVendaAction, addVenda } = useApp();

  const [search,       setSearch]       = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("todos");
  const [filtroData,   setFiltroData]   = useState("");

  // Modal parcelas
  const [vendaParcelas, setVendaParcelas] = useState<VendaEletronico | null>(null);

  // Modal edição
  const [editando,   setEditando]   = useState<VendaEletronico | null>(null);
  const [form,       setForm]       = useState<EditForm | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<EditForm>>({});

  const vendas = useMemo(() => {
    return state.vendas
      .filter((v) => v.tipo === "eletronico")
      .filter((v) => {
        if (v.tipo !== "eletronico") return false;
        const q = search.toLowerCase();
        const matchSearch =
          !search ||
          v.cliente.toLowerCase().includes(q) ||
          v.produto.toLowerCase().includes(q) ||
          (v.telefone ?? "").toLowerCase().includes(q);
        const matchStatus = filtroStatus === "todos" || v.status === filtroStatus;
        const matchData   = !filtroData || v.data.includes(filtroData);
        return matchSearch && matchStatus && matchData;
      }) as VendaEletronico[];
  }, [state.vendas, search, filtroStatus, filtroData]);

  const temFiltro = search || filtroStatus !== "todos" || filtroData;

  const totalGeral    = vendas.reduce((s, v) => s + v.precoVenda, 0);
  const totalLucro    = vendas.reduce((s, v) => s + v.lucro, 0);
  const { totalPago, totalPendente } = useMemo(() => {
    let recebido = 0; let pendente = 0;
    for (const v of vendas) {
      const valor      = v.precoVenda;
      const entradaVal = (v as any).valorEntrada || 0;
      if (v.tipoPagamento === "parcelado" && v.parcelas.length > 0) {
        const parcelasNorm = v.parcelas.filter((p) => p.numero > 0);
        const valorParc    = parcelasNorm.length > 0 ? (valor - entradaVal) / parcelasNorm.length : 0;
        let rec = 0;
        for (const p of v.parcelas) {
          if (p.status === "pago") rec += ((p as any).valorPago > 0 ? (p as any).valorPago : (p.numero === 0 ? entradaVal : valorParc));
        }
        recebido += rec; pendente += Math.max(0, valor - rec);
      } else {
        if (v.status === "pago") recebido += valor; else pendente += valor;
      }
    }
    return { totalPago: recebido, totalPendente: pendente };
  }, [vendas]);

  async function handlePagar(id: string, cliente: string) {
    try {
      await marcarVendaPaga(id);
      toast.success(`Venda de ${cliente} marcada como paga!`);
    } catch { toast.error("Erro ao atualizar."); }
  }

  function limpar() {
    setSearch(""); setFiltroStatus("todos"); setFiltroData("");
  }

  // ── Edição ──────────────────────────────────────────────────────────────────

  function abrirEdicao(v: VendaEletronico) {
    setEditando(v);
    setFormErrors({});
    const primeiroItem = v.produto.split(",")[0].trim();
    const pipeIdx      = primeiroItem.indexOf("|");
    const marcaEdit    = pipeIdx !== -1 ? primeiroItem.slice(0, pipeIdx).trim() : primeiroItem.split(" ")[0];
    const nomeEdit     = pipeIdx !== -1 ? primeiroItem.slice(pipeIdx + 1).trim() : primeiroItem.split(" ").slice(1).join(" ");
    const temEntrada = v.parcelas.some((p) => p.numero === 0);
    const parcelasNorm = v.parcelas.filter((p) => p.numero > 0);
    const numParc = temEntrada ? parcelasNorm.length : (v.parcelas.length || 2);
    const totalVal = v.precoVenda ?? 0;
    const valorParc = (temEntrada && numParc + 1 > 0) ? totalVal / (numParc + 1) : 0;
    const entradaStr = temEntrada ? valorParc.toFixed(2) : "";
    // Detecta se tinha margem: custo * (1+margem%) ≈ precoVenda salvo como precoCusto
    const margem = state.margem;
    const custoBase = v.precoCusto ?? 0;
    const custoComMargem = custoBase * (1 + margem / 100);
    // Se o custo salvo é próximo de custo*margem, tinha margem ativa
    const tinhaMargemAtiva = false; // na edição, sempre começa desmarcado — usuário decide
    setForm({
      cliente:       v.cliente,
      telefone:      v.telefone ?? "",
      marca:         marcaEdit,
      produto:       nomeEdit,
      precoCusto:    String(v.precoCusto ?? ""),
      precoVenda:    String(v.precoVenda ?? ""),
      data:          toInputDate(v.data),
      observacoes:   v.observacoes ?? "",
      tipoPagamento: v.tipoPagamento,
      formaPag:      "credito",
      numParcelas:   String(numParc),
      valorEntrada:  entradaStr,
      status:        v.status as "pago" | "pendente",
      usarMargem:    tinhaMargemAtiva,
    });
  }

  function fecharEdicao() {
    setEditando(null); setForm(null); setFormErrors({});
  }

  function setF(key: keyof EditForm, val: string) {
    setForm((f) => f ? { ...f, [key]: val } : f);
  }

  function validate(): boolean {
    if (!form) return false;
    const e: Partial<EditForm> = {};
    if (!form.cliente.trim())            e.cliente    = "Obrigatório.";
    if (!form.marca.trim())              e.marca      = "Obrigatório.";
    if (!form.produto.trim())            e.produto    = "Obrigatório.";
    if (!(parseFloat(form.precoVenda) > 0)) e.precoVenda = "Informe o preço de venda.";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSalvar() {
    if (!editando || !form || !validate()) return;
    setSaving(true);
    const custoBase = parseFloat(form.precoCusto) || 0;
    const margem    = state.margem;
    const custo     = form.usarMargem ? custoBase * (1 + margem / 100) : custoBase;
    const venda     = parseFloat(form.precoVenda) || 0;
    try {
      const entradaVal = parseFloat(form.valorEntrada) || 0;
      const temEntradaEdit = entradaVal > 0 && form.tipoPagamento === "parcelado";
      let novasParcelas = editando.parcelas;
      if (form.tipoPagamento === "parcelado") {
        const num = parseInt(form.numParcelas) || 1;
        const [d, m2, y] = fromInputDate(form.data).split("/");
        const parcelaEntrada = temEntradaEdit ? [{
          numero: 0, total: num + 1,
          vencimento: `${d.padStart(2,"0")}/${m2.padStart(2,"0")}/${y}`,
          status: "pago" as const, valorPago: entradaVal,
        }] : [];
        const restantes = Array.from({ length: num }, (_, i) => {
          const offset = temEntradaEdit ? 1 : 0;
          const dt = new Date(parseInt(y), parseInt(m2) - 1 + i + offset, parseInt(d));
          return {
            numero: i + 1, total: temEntradaEdit ? num + 1 : num,
            vencimento: `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`,
            status: "pendente" as const, valorPago: 0,
          };
        });
        novasParcelas = [...parcelaEntrada, ...restantes];
      } else {
        novasParcelas = [];
      }
      await updateVendaAction(editando.id, {
        cliente:       form.cliente.trim(),
        telefone:      form.telefone.trim(),
        produto:       `${form.marca.trim()}|${form.produto.trim()}`,
        precoCusto:    custo,
        precoVenda:    venda,
        lucro:         venda - custo,
        data:          fromInputDate(form.data),
        observacoes:   form.observacoes.trim(),
        tipoPagamento: form.tipoPagamento,
        valorEntrada:  entradaVal,
        status:        form.status,
        parcelas:      novasParcelas,
      });
      toast.success("Venda atualizada com sucesso!");
      fecharEdicao();
    } catch { toast.error("Erro ao salvar alterações."); }
    finally  { setSaving(false); }
  }

  async function handleImportEletronicos(rows: Record<string, string>[]) {
    let ok = 0;
    const errors: string[] = [];
    const m = state.margem;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const linha = i + 2;
      if (!r.cliente?.trim()) { errors.push(`Linha ${linha}: cliente obrigatorio.`); continue; }
      if (!r.data?.trim())    { errors.push(`Linha ${linha}: data obrigatoria.`);    continue; }
      if (!r.marca?.trim())   { errors.push(`Linha ${linha}: marca obrigatoria.`);   continue; }
      if (!r.produto?.trim()) { errors.push(`Linha ${linha}: produto obrigatorio.`); continue; }
      const custo = parseFloat(r.preco_custo?.replace(",", ".")) || 0;
      const venda = parseFloat(r.preco_venda?.replace(",", ".")) || 0;
      const lucro = venda - custo;
      const nomeProduto = `${r.marca.trim()}|${r.produto.trim()}`;
      const tipoPag = (r.pagamento?.toLowerCase() === "credito" || r.pagamento?.toLowerCase() === "entrada")
        ? "parcelado" as const : "avista" as const;
      const status = r.status?.toLowerCase() === "pago" ? "pago" as const : "pendente" as const;
      try {
        await addVenda({
          tipo: "eletronico",
          cliente: r.cliente.trim(),
          telefone: (r.telefone ?? "").trim(),
          vendedor: "",
          produto: nomeProduto,
          precoCusto: custo,
          precoVenda: venda,
          lucro,
          isUsd: false,
          margemUsada: m,
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

  const err = (k: keyof EditForm) =>
    formErrors[k] ? <p className="text-xs text-destructive mt-1">{formErrors[k]}</p> : null;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Vendas — Eletrônicos</h1>
          <p className="text-muted-foreground text-sm mt-1">{vendas.length} venda(s) encontrada(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportCSV
            title="Eletronicos"
            columns={COLUNAS_ELET_CSV}
            onImport={handleImportEletronicos}
            templateFileName="template_vendas_eletronicos.csv"
          />
          <Button asChild>
            <Link to="/eletronicos/nova-venda"><Plus className="h-4 w-4 mr-2" />Nova Venda</Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-bold text-lg mt-0.5">{fmtBRL(totalGeral)}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Recebido</p>
          <p className="font-bold text-lg mt-0.5 text-success">{fmtBRL(totalPago)}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Pendente</p>
          <p className="font-bold text-lg mt-0.5 text-destructive">{fmtBRL(totalPendente)}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Lucro Total</p>
          <p className={`font-bold text-lg mt-0.5 ${totalLucro >= 0 ? "text-success" : "text-destructive"}`}>
            {fmtBRL(totalLucro)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente, produto..." className="pl-9"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as StatusFiltro)}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pago">Pagos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
          </SelectContent>
        </Select>

        <Input type="date" className="w-[160px]" value={filtroData}
          onChange={(e) => setFiltroData(e.target.value)} />

        {temFiltro && (
          <Button variant="ghost" size="sm" onClick={limpar} className="text-muted-foreground">
            <X className="h-3.5 w-3.5 mr-1" />Limpar
          </Button>
        )}
      </div>

      {/* Tabela */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Preço de Venda</TableHead>
                <TableHead>Lucro</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendas.map((v) => {
                const pagas = v.parcelas.filter((p) => p.status === "pago").length;
                const marca = v.produto.includes(" ") ? v.produto.split(" ")[0] : "—";
                const nome  = v.produto.includes(" ") ? v.produto.split(" ").slice(1).join(" ") : v.produto;
                return (
                  <TableRow key={v.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{v.data}</TableCell>
                    <TableCell className="font-medium">{v.cliente}</TableCell>
                    <TableCell className="text-sm font-medium text-primary align-top">
                      {v.produto.split(",").map((item, i) => {
                        const t = item.trim(), pi = t.indexOf("|");
                        const marca = pi !== -1 ? t.slice(0, pi).trim() : t.split(" ")[0];
                        return <div key={i} className={v.produto.includes(",") ? "py-0.5 border-b border-border/30 last:border-0" : ""}>{marca || "—"}</div>;
                      })}
                    </TableCell>
                    <TableCell className="text-sm align-top">
                      {v.produto.split(",").map((item, i) => {
                        const t = item.trim(), pi = t.indexOf("|");
                        const nome = pi !== -1 ? t.slice(pi + 1).trim() : t.split(" ").slice(1).join(" ");
                        return <div key={i} className={v.produto.includes(",") ? "py-0.5 border-b border-border/30 last:border-0" : ""}>{nome || t}</div>;
                      })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtBRL(v.precoCusto)}</TableCell>
                    <TableCell className="font-semibold whitespace-nowrap">{fmtBRL(v.precoVenda)}</TableCell>
                    <TableCell className={`font-medium whitespace-nowrap ${v.lucro >= 0 ? "text-success" : "text-destructive"}`}>
                      {fmtBRL(v.lucro)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {v.tipoPagamento === "parcelado" ? "Parcelado" : "À Vista"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {v.tipoPagamento === "parcelado" ? `${pagas}/${v.parcelas.length}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={v.status === "pago" ? "default" : "destructive"}
                        className={v.status === "pago" ? "bg-success/20 text-success border-0" : ""}>
                        {v.status === "pago" ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost"
                          onClick={() => abrirEdicao(v)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost"
                          onClick={() => { if (confirm(`Excluir venda de ${v.cliente}?`)) { deleteVendaAction(v.id).then(() => toast.success("Venda excluída.")).catch(() => toast.error("Erro ao excluir.")); } }}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        {v.tipoPagamento === "parcelado" && v.parcelas.length > 0 ? (
                          <Button size="sm" variant="ghost"
                            onClick={() => setVendaParcelas(v)}
                            className="h-8 px-2 text-primary hover:text-primary text-xs">
                            <Receipt className="h-3.5 w-3.5 mr-1" />Parcelas
                          </Button>
                        ) : v.status !== "pago" ? (
                          <Button size="sm" variant="ghost"
                            onClick={() => handlePagar(v.id, v.cliente)}
                            className="h-8 px-2 text-success hover:text-success text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Pagar
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {vendas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                    {temFiltro ? "Nenhuma venda encontrada com esses filtros." : "Nenhuma venda registrada ainda."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Modal de Parcelas ──────────────────────────────────────────────── */}
      <ParcelasModal
        venda={vendaParcelas}
        onClose={() => setVendaParcelas(null)}
      />

      {/* ── Modal de Edição ─────────────────────────────────────────────────── */}
      <Dialog open={!!editando} onOpenChange={(open) => { if (!open) fecharEdicao(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pencil className="h-4 w-4" /> Editar Venda
            </DialogTitle>
          </DialogHeader>

          {form && (
            <div className="space-y-4 py-1">

              {/* Cliente + Telefone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cliente *</Label>
                  <Input className={`h-10 ${formErrors.cliente ? "border-destructive" : ""}`}
                    value={form.cliente} onChange={(e) => setF("cliente", e.target.value)} />
                  {err("cliente")}
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input className="h-10"
                    value={form.telefone} onChange={(e) => setF("telefone", e.target.value)} />
                </div>
              </div>

              {/* Marca + Produto */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Marca *</Label>
                  <Input className={`h-10 ${formErrors.marca ? "border-destructive" : ""}`}
                    placeholder="Ex: Apple, Samsung..."
                    value={form.marca} onChange={(e) => setF("marca", e.target.value)} />
                  {err("marca")}
                </div>
                <div>
                  <Label>Produto *</Label>
                  <Input className={`h-10 ${formErrors.produto ? "border-destructive" : ""}`}
                    placeholder="Ex: iPhone 15 Pro..."
                    value={form.produto} onChange={(e) => setF("produto", e.target.value)} />
                  {err("produto")}
                </div>
              </div>

              {/* Valores */}
              <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valores</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Preço de Custo (R$)</Label>
                    <Input className="h-10" type="number" inputMode="decimal" placeholder="0.00"
                      value={form.precoCusto}
                      onChange={(e) => setF("precoCusto", e.target.value)} />
                  </div>
                  <div>
                    <Label>Preço de Venda (R$) *</Label>
                    <Input className={`h-10 ${formErrors.precoVenda ? "border-destructive" : ""}`}
                      type="number" inputMode="decimal"
                      value={form.precoVenda} onChange={(e) => setF("precoVenda", e.target.value)} />
                    {err("precoVenda")}
                  </div>
                </div>

                {/* Checkbox margem */}
                <button
                  type="button"
                  onClick={() => setForm((f) => f ? { ...f, usarMargem: !f.usarMargem } : f)}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg border text-sm transition-all
                    ${form.usarMargem
                      ? "border-primary/40 bg-primary/5 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/30"}`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all
                    ${form.usarMargem ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                    {form.usarMargem && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span>Aplicar margem de +{state.margem}% sobre o custo</span>
                </button>

                {/* Lucro calculado */}
                {parseFloat(form.precoVenda) > 0 && parseFloat(form.precoCusto) > 0 && (() => {
                  const c = parseFloat(form.precoCusto);
                  const custoFinal = form.usarMargem ? c * (1 + state.margem / 100) : c;
                  const lucro = parseFloat(form.precoVenda) - custoFinal;
                  return (
                    <div className="rounded-md bg-background border border-border/50 px-3 py-2 flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        Lucro calculado {form.usarMargem ? `(custo +${state.margem}%: ${fmtBRL(custoFinal)})` : ""}
                      </span>
                      <span className={`text-sm font-bold ${lucro >= 0 ? "text-green-600" : "text-destructive"}`}>
                        {fmtBRL(lucro)}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Data */}
              <div>
                <Label>Data da Venda</Label>
                <Input className="h-10 max-w-[180px]" type="date"
                  value={form.data} onChange={(e) => setF("data", e.target.value)} />
              </div>

              {/* Observações */}
              <div>
                <Label>Observações</Label>
                <textarea
                  className="w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.observacoes}
                  onChange={(e) => setF("observacoes", e.target.value)}
                  placeholder="Anotações adicionais..."
                />
              </div>

              {/* Pagamento & Status */}
              <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pagamento</p>

                <div className="grid grid-cols-2 gap-2">
                  {(["avista", "parcelado"] as const).map((t) => (
                    <button key={t} type="button"
                      onClick={() => setF("tipoPagamento", t)}
                      className={`h-10 rounded-lg border text-sm font-medium transition-all
                        ${form.tipoPagamento === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                      {t === "avista" ? "À Vista" : "Parcelado"}
                    </button>
                  ))}
                </div>

                {form.tipoPagamento === "parcelado" && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Forma do parcelamento</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {(["pix", "credito"] as const).map((f) => (
                          <button key={f} type="button"
                            onClick={() => setF("formaPag", f)}
                            className={`h-9 rounded-lg border text-sm font-medium transition-all
                              ${form.formaPag === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                            {f === "pix" ? "PIX Parcelado" : "Cartão de Crédito"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Entrada (R$) <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                        <Input className="h-10" type="number" inputMode="decimal" placeholder="0,00"
                          value={form.valorEntrada}
                          onChange={(e) => setF("valorEntrada", e.target.value)} />
                      </div>
                      <div>
                        <Label>Nº de Parcelas</Label>
                        <Input className="h-10" type="number" min="1" max="24"
                          value={form.numParcelas}
                          onChange={(e) => setF("numParcelas", e.target.value)} />
                      </div>
                    </div>
                    {(() => {
                      const total = parseFloat(form.precoVenda) || 0;
                      const entrada = parseFloat(form.valorEntrada) || 0;
                      const num = parseInt(form.numParcelas) || 1;
                      const valorParc = num > 0 ? (total - entrada) / num : 0;
                      if (total <= 0) return null;
                      return (
                        <div className="rounded-lg bg-muted/40 p-2.5 text-xs space-y-1">
                          {entrada > 0 && <p className="text-muted-foreground">Entrada: <span className="font-semibold text-foreground">{entrada.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span></p>}
                          <p className="text-muted-foreground">{num}x de: <span className="font-semibold text-foreground">{valorParc.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span></p>
                          {entrada > 0 && <p className="text-muted-foreground">Total: <span className="font-semibold text-foreground">{total.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span></p>}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="flex items-center justify-between py-1 border-t border-border/50 pt-3">
                  <div>
                    <p className="text-sm font-medium">Status da venda</p>
                    <p className="text-xs text-muted-foreground">{form.status === "pago" ? "Marcado como pago" : "Pendente de pagamento"}</p>
                  </div>
                  <Switch
                    checked={form.status === "pago"}
                    onCheckedChange={(checked) => setF("status", checked ? "pago" : "pendente")}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={fecharEdicao} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}