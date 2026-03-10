import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useApp, Cliente } from "@/context/AppContext";
import { toast } from "sonner";

interface FormState { nome: string; telefone: string; email: string; notas: string; }
const emptyForm: FormState = { nome: "", telefone: "", email: "", notas: "" };

function ClienteForm({ form, errors, onChange }: { form: FormState; errors: Partial<FormState>; onChange: (f: keyof FormState, v: string) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Nome *</Label>
        <Input placeholder="Nome completo" value={form.nome} onChange={(e) => onChange("nome", e.target.value)} className={errors.nome ? "border-destructive" : ""} />
        {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome}</p>}
      </div>
      <div>
        <Label>Telefone *</Label>
        <Input placeholder="(00) 00000-0000" value={form.telefone} onChange={(e) => onChange("telefone", e.target.value)} className={errors.telefone ? "border-destructive" : ""} />
        {errors.telefone && <p className="text-xs text-destructive mt-1">{errors.telefone}</p>}
      </div>
      <div>
        <Label>Email</Label>
        <Input type="email" placeholder="email@exemplo.com" value={form.email} onChange={(e) => onChange("email", e.target.value)} />
      </div>
      <div>
        <Label>Observações</Label>
        <Textarea placeholder="Notas sobre o cliente..." value={form.notas} onChange={(e) => onChange("notas", e.target.value)} />
      </div>
    </div>
  );
}

export default function Clientes() {
  const { state, addCliente, updateClienteAction, deleteClienteAction } = useApp();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [openAdd, setOpenAdd] = useState(false);
  const [formAdd, setFormAdd] = useState<FormState>(emptyForm);
  const [errorsAdd, setErrorsAdd] = useState<Partial<FormState>>({});

  const [editando, setEditando] = useState<Cliente | null>(null);
  const [formEdit, setFormEdit] = useState<FormState>(emptyForm);
  const [errorsEdit, setErrorsEdit] = useState<Partial<FormState>>({});

  const filtered = state.clientes.filter((c) => c.nome.toLowerCase().includes(search.toLowerCase()) || c.telefone.includes(search));

  function validate(form: FormState, setErrors: (e: Partial<FormState>) => void) {
    const e: Partial<FormState> = {};
    if (!form.nome.trim()) e.nome = "Nome é obrigatório.";
    if (!form.telefone.trim()) e.telefone = "Telefone é obrigatório.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function changeAdd(field: keyof FormState, value: string) {
    setFormAdd((f) => ({ ...f, [field]: value }));
    if (errorsAdd[field]) setErrorsAdd((e) => ({ ...e, [field]: undefined }));
  }
  function changeEdit(field: keyof FormState, value: string) {
    setFormEdit((f) => ({ ...f, [field]: value }));
    if (errorsEdit[field]) setErrorsEdit((e) => ({ ...e, [field]: undefined }));
  }

  async function handleAdd() {
    if (!validate(formAdd, setErrorsAdd)) return;
    setLoading(true);
    try {
      await addCliente(formAdd);
      toast.success("Cliente cadastrado!");
      setFormAdd(emptyForm); setErrorsAdd({}); setOpenAdd(false);
    } catch { toast.error("Erro ao cadastrar cliente."); }
    finally { setLoading(false); }
  }

  function handleOpenEdit(c: Cliente) {
    setEditando(c);
    setFormEdit({ nome: c.nome, telefone: c.telefone, email: c.email, notas: c.notas });
    setErrorsEdit({});
  }

  async function handleUpdate() {
    if (!validate(formEdit, setErrorsEdit) || !editando) return;
    setLoading(true);
    try {
      await updateClienteAction({ ...editando, ...formEdit });
      toast.success("Cliente atualizado!");
      setEditando(null); setFormEdit(emptyForm);
    } catch { toast.error("Erro ao atualizar cliente."); }
    finally { setLoading(false); }
  }

  async function handleDelete(id: string, nome: string) {
    try {
      await deleteClienteAction(id);
      toast.success(`Cliente "${nome}" removido.`);
    } catch { toast.error("Erro ao remover cliente."); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">{state.clientes.length} clientes cadastrados</p>
        </div>
        <Dialog open={openAdd} onOpenChange={(o) => { setOpenAdd(o); if (!o) { setFormAdd(emptyForm); setErrorsAdd({}); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Novo Cliente</DialogTitle></DialogHeader>
            <ClienteForm form={formAdd} errors={errorsAdd} onChange={changeAdd} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenAdd(false)}>Cancelar</Button>
              <Button onClick={handleAdd} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou telefone..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead><TableHead>Telefone</TableHead>
              <TableHead>Email</TableHead><TableHead>Observações</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell className="text-sm">{c.telefone}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.email || "—"}</TableCell>
                <TableCell>{c.notas ? <Badge variant="secondary" className="text-xs">{c.notas}</Badge> : "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(c.id, c.nome)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum cliente encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editando} onOpenChange={(o) => { if (!o) { setEditando(null); setFormEdit(emptyForm); setErrorsEdit({}); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Editar Cliente</DialogTitle></DialogHeader>
          <ClienteForm form={formEdit} errors={errorsEdit} onChange={changeEdit} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}