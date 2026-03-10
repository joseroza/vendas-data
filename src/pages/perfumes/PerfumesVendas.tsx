import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, CheckCircle2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

type StatusFiltro = "todos" | "pago" | "pendente";

export default function PerfumesVendas() {
  const { state, marcarVendaPaga } = useApp();

  const [search,        setSearch]        = useState("");
  const [filtroStatus,  setFiltroStatus]  = useState<StatusFiltro>("todos");
  const [filtroMarca,   setFiltroMarca]   = useState("todos");
  const [filtroData,    setFiltroData]    = useState("");

  // Marcas únicas do estoque de perfumes
  const marcas = useMemo(() => {
    const set = new Set(state.catalogoPerfumes.map((p) => p.marca).filter(Boolean));
    return Array.from(set).sort();
  }, [state.catalogoPerfumes]);

  const vendas = useMemo(() => {
    return state.vendas
      .filter((v) => v.tipo === "perfume")
      .filter((v) => {
        if (v.tipo !== "perfume") return false;
        const q = search.toLowerCase();

        // busca por cliente, perfume ou telefone
        const matchSearch =
          !search ||
          v.cliente.toLowerCase().includes(q) ||
          v.perfume.toLowerCase().includes(q) ||
          (v.telefone ?? "").toLowerCase().includes(q);

        // filtro status
        const matchStatus =
          filtroStatus === "todos" || v.status === filtroStatus;

        // filtro data (dd/mm/aaaa contém o trecho digitado)
        const matchData =
          !filtroData || v.data.includes(filtroData);

        // filtro marca: procura no estoque se o perfume vendido pertence a essa marca
        const matchMarca =
          filtroMarca === "todos" ||
          state.catalogoPerfumes.some(
            (p) =>
              p.marca === filtroMarca &&
              v.perfume.toLowerCase().includes(p.nome.toLowerCase())
          );

        return matchSearch && matchStatus && matchData && matchMarca;
      });
  }, [state.vendas, state.catalogoPerfumes, search, filtroStatus, filtroMarca, filtroData]);

  const temFiltro = search || filtroStatus !== "todos" || filtroMarca !== "todos" || filtroData;

  const totalGeral    = vendas.reduce((s, v) => v.tipo === "perfume" ? s + v.valorFinal : s, 0);
  const totalPendente = vendas.filter((v) => v.status === "pendente")
                              .reduce((s, v) => v.tipo === "perfume" ? s + v.valorFinal : s, 0);
  const totalPago     = vendas.filter((v) => v.status === "pago")
                              .reduce((s, v) => v.tipo === "perfume" ? s + v.valorFinal : s, 0);
  const totalLucro    = vendas.reduce((s, v) => v.tipo === "perfume" ? s + (v.valorFinal - v.precoBrl) : s, 0);




  async function handlePagar(id: string, cliente: string) {
    try {
      await marcarVendaPaga(id);
      toast.success(`Venda de ${cliente} marcada como paga!`);
    } catch { toast.error("Erro ao atualizar."); }
  }

  function limpar() {
    setSearch(""); setFiltroStatus("todos"); setFiltroMarca("todos"); setFiltroData("");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Vendas — Perfumes</h1>
          <p className="text-muted-foreground text-sm mt-1">{vendas.length} venda(s) encontrada(s)</p>
        </div>
          <Button asChild>
            <Link to="/perfumes/nova-venda"><Plus className="h-4 w-4 mr-2" />Nova Venda</Link>
          </Button>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-bold text-lg mt-0.5">{totalGeral.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Recebido</p>
          <p className="font-bold text-lg mt-0.5 text-success">{totalPago.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Pendente</p>
          <p className="font-bold text-lg mt-0.5 text-destructive">{totalPendente.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Lucro Total</p>
          <p className={`font-bold text-lg mt-0.5 ${totalLucro >= 0 ? "text-success" : "text-destructive"}`}>
            {totalLucro.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente, perfume..." className="pl-9"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {/* Filtro Status (pendente / pago) */}
        <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as StatusFiltro)}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pago">✅ Pagos</SelectItem>
            <SelectItem value="pendente">⏳ Pendentes</SelectItem>
          </SelectContent>
        </Select>

        {/* Filtro Marca */}
        {marcas.length > 0 && (
          <Select value={filtroMarca} onValueChange={setFiltroMarca}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Marca" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as marcas</SelectItem>
              {marcas.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {/* Filtro Data */}
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
                <TableHead>Perfume</TableHead>
                <TableHead>Preço de Venda</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendas.map((v) => {
                if (v.tipo !== "perfume") return null;
                const pagas = v.parcelas.filter((p) => p.status === "pago").length;
                return (
                  <TableRow key={v.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{v.data}</TableCell>
                    <TableCell className="font-medium">{v.cliente}</TableCell>
                    <TableCell className="text-sm">{v.perfume}</TableCell>
                    <TableCell className="font-semibold whitespace-nowrap">
                      R$ {v.valorFinal.toLocaleString("pt-BR",{minimumFractionDigits:2})}
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
                      <Badge
                        variant={v.status === "pago" ? "default" : "destructive"}
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
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
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