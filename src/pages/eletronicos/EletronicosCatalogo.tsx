import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import { ImportCSV } from "@/components/ImportCSV";

export default function EletronicosCatalogo() {
  const { state, addProdutoEletronico, deleteProdutoEletronicoAction } = useApp();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [precoRef, setPrecoRef] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = state.catalogoEletronicos.filter((p) =>
    p.nome.toLowerCase().includes(search.toLowerCase())
  );

  function validate() {
    const e: Record<string, string> = {};
    if (!nome.trim()) e.nome = "Nome é obrigatório.";
    if (!parseFloat(precoRef) || parseFloat(precoRef) <= 0) e.precoRef = "Informe o preço de referência.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleAdd() {
    if (!validate()) return;
    try {
      await addProdutoEletronico({ nome: nome.trim(), precoReferencia: parseFloat(precoRef) });
      toast.success("Produto adicionado ao catálogo!");
      setNome(""); setPrecoRef(""); setErrors({});
      setOpen(false);
    } catch { toast.error("Erro ao adicionar produto."); }
  }


  async function handleImportCSV(rows: Record<string, string>[]) {
    let ok = 0;
    const errors: string[] = [];
    for (const [i, row] of rows.entries()) {
      const linha   = i + 2;
      const nome    = row["nome"]?.trim();
      const precoRef = parseFloat(row["preco_referencia"]);
      if (!nome)                           { errors.push(`Linha ${linha}: nome obrigatório.`); continue; }
      if (isNaN(precoRef) || precoRef <= 0){ errors.push(`Linha ${linha}: preco_referencia inválido.`); continue; }
      try {
        await addProdutoEletronico({ nome, precoReferencia: precoRef });
        ok++;
      } catch { errors.push(`Linha ${linha}: erro ao salvar "${nome}".`); }
    }
    return { ok, errors };
  }

  const CSV_COLS_ELET = [
    { key: "nome",             label: "Nome do Produto",   required: true,  example: "iPhone 15 Pro" },
    { key: "preco_referencia", label: "Preço de Referência (R$)", required: true, example: "4500.00", hint: "Número decimal com ponto" },
  ];

  async function handleDelete(id: string, nomeProd: string) {
    try {
      await deleteProdutoEletronicoAction(id);
      toast.success(`"${nomeProd}" removido do catálogo.`);
    } catch { toast.error("Erro ao remover produto."); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Catálogo — Eletrônicos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {state.catalogoEletronicos.length} produtos cadastrados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportCSV
            title="Estoque de Eletrônicos"
            columns={CSV_COLS_ELET}
            onImport={handleImportCSV}
            templateFileName="template_estoque_eletronicos.csv"
          />
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setNome(""); setPrecoRef(""); setErrors({}); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Produto</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Novo Produto</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    placeholder="Ex: iPhone 15 Pro"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className={errors.nome ? "border-destructive" : ""}
                  />
                  {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome}</p>}
                </div>
                <div>
                  <Label>Preço de Referência (BRL) *</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={precoRef}
                    onChange={(e) => setPrecoRef(e.target.value)}
                    className={errors.precoRef ? "border-destructive" : ""}
                  />
                  {errors.precoRef && <p className="text-xs text-destructive mt-1">{errors.precoRef}</p>}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleAdd}>Adicionar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produto..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Preço de Referência</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell>
                  R$ {p.precoReferencia.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(p.id, p.nome)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}