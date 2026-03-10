import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, CheckCircle2, X } from "lucide-react";
import { ImportCSV } from "@/components/ImportCSV";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

type StatusFiltro = "todos" | "pago" | "pendente";

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function EletronicosVendas() {
  const { state, marcarVendaPaga, addVenda } = useApp();

  const [search,       setSearch]       = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("todos");
  const [filtroData,   setFiltroData]   = useState("");

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

        const matchStatus =
          filtroStatus === "todos" || v.status === filtroStatus;

        const matchData =
          !filtroData || v.data.includes(filtroData);

        return matchSearch && matchStatus && matchData;
      });
  }, [state.vendas, search, filtroStatus, filtroData]);

  const temFiltro = search || filtroStatus !== "todos" || filtroData;

  const totalGeral    = vendas.reduce((s, v) => v.tipo === "eletronico" ? s + v.precoVenda : s, 0);
  const totalPago     = vendas.filter((v) => v.status === "pago")
                              .reduce((s, v) => v.tipo === "eletronico" ? s + v.precoVenda : s, 0);
  const totalPendente = vendas.filter((v) => v.status === "pendente")
                              .reduce((s, v) => v.tipo === "eletronico" ? s + v.precoVenda : s, 0);
  const totalLucro    = vendas.reduce((s, v) => v.tipo === "eletronico" ? s + v.lucro : s, 0);


  const CSV_COLS_VENDA_ELET = [
    { key: "cliente",          label: "Nome do Cliente",     required: true,  example: "Maria Souza" },
    { key: "telefone",         label: "Telefone",            required: false, example: "11988880000", hint: "Opcional" },
    { key: "produto",          label: "Produto Vendido",     required: true,  example: "iPhone 15 Pro" },
    { key: "preco_custo",      label: "Preço de Custo (R$)", required: true,  example: "3800.00" },
    { key: "preco_venda",      label: "Preço de Venda (R$)", required: true,  example: "4500.00" },
    { key: "pagamento",        label: "Forma Pagamento",     required: true,  example: "credito",    hint: "pix | credito | entrada" },
    { key: "parcelas",         label: "Nº Parcelas",         required: false, example: "6",          hint: "Preencher se parcelado" },
    { key: "data",             label: "Data",                required: true,  example: "15/03/2026", hint: "Formato dd/mm/aaaa" },
    { key: "status",           label: "Status",              required: true,  example: "pago",       hint: "pago | pendente" },
    { key: "observacoes",      label: "Observações",         required: false, example: "WhatsApp" },
  ];

  async function handleImportVendas(rows: Record<string, string>[]) {
    let ok = 0;
    const errors: string[] = [];
    for (const [i, row] of rows.entries()) {
      const linha      = i + 2;
      const cliente    = row["cliente"]?.trim();
      const produto    = row["produto"]?.trim();
      const precoCusto = parseFloat(row["preco_custo"]);
      const precoVenda = parseFloat(row["preco_venda"]);
      const data       = row["data"]?.trim();
      const status     = row["status"]?.trim() as "pago" | "pendente";
      const pagamento  = row["pagamento"]?.trim();
      const parcelas   = parseInt(row["parcelas"]) || 0;
      if (!cliente)                          { errors.push(`Linha ${linha}: cliente obrigatório.`); continue; }
      if (!produto)                          { errors.push(`Linha ${linha}: produto obrigatório.`); continue; }
      if (isNaN(precoCusto) || precoCusto<=0){ errors.push(`Linha ${linha}: preco_custo inválido.`); continue; }
      if (isNaN(precoVenda) || precoVenda<=0){ errors.push(`Linha ${linha}: preco_venda inválido.`); continue; }
      if (!data)                             { errors.push(`Linha ${linha}: data obrigatória.`); continue; }
      if (!["pago","pendente"].includes(status)) { errors.push(`Linha ${linha}: status inválido (pago|pendente).`); continue; }
      const lucro    = precoVenda - precoCusto;
      const parcelado = pagamento !== "pix" && parcelas > 1;
      try {
        await addVenda({
          tipo: "eletronico", cliente, telefone: row["telefone"]?.trim() ?? "",
          produto, precoCusto, precoVenda, lucro,
          isUsd: false, margemUsada: 0,
          tipoPagamento: parcelado ? "parcelado" : "avista",
          parcelas: [], observacoes: row["observacoes"]?.trim() ?? "",
          data, status,
        });
        ok++;
      } catch { errors.push(`Linha ${linha}: erro ao salvar venda de "${cliente}".`); }
    }
    return { ok, errors };
  }

  async function handlePagar(id: string, cliente: string) {
    try {
      await marcarVendaPaga(id);
      toast.success(`Venda de ${cliente} marcada como paga!`);
    } catch { toast.error("Erro ao atualizar."); }
  }

  function limpar() {
    setSearch(""); setFiltroStatus("todos"); setFiltroData("");
  }

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
            title="Vendas de Eletrônicos"
            columns={CSV_COLS_VENDA_ELET}
            onImport={handleImportVendas}
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
            <SelectItem value="pago">✅ Pagos</SelectItem>
            <SelectItem value="pendente">⏳ Pendentes</SelectItem>
          </SelectContent>
        </Select>

        <Input type="date" className="w-[160px]" value={filtroData}
          onChange={(e) => setFiltroData(e.target.value)} title="Filtrar por data" />

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
                <TableHead>Produto</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Preço de Venda</TableHead>
                <TableHead>Lucro</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendas.map((v) => {
                if (v.tipo !== "eletronico") return null;
                const pagas = v.parcelas.filter((p) => p.status === "pago").length;
                return (
                  <TableRow key={v.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{v.data}</TableCell>
                    <TableCell className="font-medium">{v.cliente}</TableCell>
                    <TableCell className="text-sm">{v.produto}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {fmtBRL(v.precoCusto)}
                    </TableCell>
                    <TableCell className="font-semibold whitespace-nowrap">
                      {fmtBRL(v.precoVenda)}
                    </TableCell>
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
                      {v.status !== "pago" && (
                        <Button size="sm" variant="ghost"
                          onClick={() => handlePagar(v.id, v.cliente)}
                          className="text-success hover:text-success">
                          <CheckCircle2 className="h-4 w-4 mr-1" />Pagar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {vendas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                    {temFiltro ? "Nenhuma venda encontrada com esses filtros." : "Nenhuma venda registrada ainda."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}