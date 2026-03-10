import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, Trash2, Package, Loader2, Calculator } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

interface FormState {
  marca: string;
  nome: string;
  quantidade: string;
  precoUsd: string;
  cotacao: string;
}

const emptyForm: FormState = { marca: "", nome: "", quantidade: "", precoUsd: "", cotacao: "" };

function EstoqueForm({
  form,
  errors,
  onChange,
  precoBrlCalculado,
  precoVendaCalculado,
}: {
  form: FormState;
  errors: Partial<Record<keyof FormState, string>>;
  onChange: (k: keyof FormState, v: string) => void;
  precoBrlCalculado: number;
  precoVendaCalculado: number;
}) {
  return (
    <div className="space-y-4">
      {/* Marca e Nome */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Marca *</Label>
          <Input
            placeholder="Ex: Dior, Chanel, YSL"
            value={form.marca}
            onChange={(e) => onChange("marca", e.target.value)}
            className={errors.marca ? "border-destructive" : ""}
          />
          {errors.marca && <p className="text-xs text-destructive mt-1">{errors.marca}</p>}
        </div>
        <div>
          <Label>Nome do Perfume *</Label>
          <Input
            placeholder="Ex: Sauvage, Bleu..."
            value={form.nome}
            onChange={(e) => onChange("nome", e.target.value)}
            className={errors.nome ? "border-destructive" : ""}
          />
          {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome}</p>}
        </div>
      </div>

      {/* Quantidade */}
      <div>
        <Label>Quantidade em Estoque *</Label>
        <Input
          type="number"
          min={0}
          placeholder="0"
          value={form.quantidade}
          onChange={(e) => onChange("quantidade", e.target.value)}
          className={errors.quantidade ? "border-destructive" : ""}
        />
        {errors.quantidade && <p className="text-xs text-destructive mt-1">{errors.quantidade}</p>}
      </div>

      {/* Preço USD e Cotação */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Preço de Custo (USD) *</Label>
          <Input
            type="number"
            placeholder="0.00"
            value={form.precoUsd}
            onChange={(e) => onChange("precoUsd", e.target.value)}
            className={errors.precoUsd ? "border-destructive" : ""}
          />
          {errors.precoUsd && <p className="text-xs text-destructive mt-1">{errors.precoUsd}</p>}
        </div>
        <div>
          <Label>Cotação USD/BRL *</Label>
          <Input
            type="number"
            placeholder="Ex: 5.80"
            value={form.cotacao}
            onChange={(e) => onChange("cotacao", e.target.value)}
            className={errors.cotacao ? "border-destructive" : ""}
          />
          {errors.cotacao && <p className="text-xs text-destructive mt-1">{errors.cotacao}</p>}
        </div>
      </div>

      {/* Valores calculados automaticamente */}
      {precoBrlCalculado > 0 && (
        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Calculator className="h-3.5 w-3.5" /> Calculado automaticamente
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Custo em BRL</p>
              <p className="text-lg font-bold font-display">
                R$ {precoBrlCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">USD × cotação</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Preço de Venda (+20%)</p>
              <p className="text-lg font-bold font-display text-primary">
                R$ {precoVendaCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">Custo BRL + 20% margem</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PerfumesCatalogo() {
  const { state, addProdutoPerfume, deleteProdutoPerfumeAction } = useApp();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading, setLoading] = useState(false);

  // Cálculos automáticos
  const usd = parseFloat(form.precoUsd) || 0;
  const cotacao = parseFloat(form.cotacao) || 0;
  const precoBrlCalculado = usd * cotacao;
  const precoVendaCalculado = precoBrlCalculado * 1.2;

  const filtered = state.catalogoPerfumes.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.nome.toLowerCase().includes(q) ||
      (p.marca ?? "").toLowerCase().includes(q)
    );
  });

  const totalItens = state.catalogoPerfumes.reduce((s, p) => s + (p.quantidade ?? 0), 0);

  function onChange(k: keyof FormState, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.marca.trim()) e.marca = "Marca é obrigatória.";
    if (!form.nome.trim()) e.nome = "Nome é obrigatório.";
    const qtd = parseInt(form.quantidade);
    if (isNaN(qtd) || qtd < 0) e.quantidade = "Informe a quantidade.";
    if (!usd || usd <= 0) e.precoUsd = "Informe o preço USD.";
    if (!cotacao || cotacao <= 0) e.cotacao = "Informe a cotação.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleAdd() {
    if (!validate()) return;
    setLoading(true);
    try {
      await addProdutoPerfume({
        marca: form.marca.trim(),
        nome: form.nome.trim(),
        quantidade: parseInt(form.quantidade),
        precoUsd: usd,
        precoBrl: precoVendaCalculado, // salva o preço de venda (com margem)
      });
      toast.success("Perfume adicionado ao estoque!");
      setForm(emptyForm);
      setErrors({});
      setOpen(false);
    } catch {
      toast.error("Erro ao adicionar perfume.");
    } finally {
      setLoading(false);
    }
  }



  async function handleDelete(id: string, nome: string) {
    try {
      await deleteProdutoPerfumeAction(id);
      toast.success(`"${nome}" removido do estoque.`);
    } catch {
      toast.error("Erro ao remover.");
    }
  }

  function estoqueLabel(qtd: number) {
    if (qtd === 0) return <Badge variant="destructive">Sem estoque</Badge>;
    if (qtd <= 2) return <Badge variant="outline" className="text-warning border-warning">{qtd} un — Baixo</Badge>;
    return <Badge variant="secondary">{qtd} un</Badge>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Package className="h-6 w-6" />
            Estoque — Perfumes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {state.catalogoPerfumes.length} perfumes · {totalItens} unidades em estoque
          </p>
        </div>

          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setForm(emptyForm); setErrors({}); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Perfume</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Adicionar ao Estoque</DialogTitle>
              </DialogHeader>
              <EstoqueForm
                form={form}
                errors={errors}
                onChange={onChange}
                precoBrlCalculado={precoBrlCalculado}
                precoVendaCalculado={precoVendaCalculado}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleAdd} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por marca ou nome..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tabela */}
      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marca</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead>Custo USD</TableHead>
              <TableHead>Preço de Venda (BRL)</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <span className="font-semibold text-primary">{p.marca ?? "—"}</span>
                </TableCell>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell>{estoqueLabel(p.quantidade ?? 0)}</TableCell>
                <TableCell className="text-sm">${p.precoUsd.toFixed(2)}</TableCell>
                <TableCell className="text-sm font-semibold">
                  R$ {p.precoBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(p.id, `${p.marca} ${p.nome}`)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Nenhum perfume no estoque.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}