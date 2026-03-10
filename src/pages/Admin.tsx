import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Plus, Trash2, RefreshCw, Loader2, UserCog, Users } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

type Role = "admin" | "vendedor" | "visualizador";

const ROLES: Record<Role, { label: string; desc: string; color: string }> = {
  admin:        { label: "Administrador", desc: "Acesso total, incluindo painel admin",    color: "bg-primary text-primary-foreground" },
  vendedor:     { label: "Vendedor",      desc: "Registra vendas e gerencia clientes",     color: "bg-success/20 text-success" },
  visualizador: { label: "Visualizador",  desc: "Apenas visualiza relatórios e histórico", color: "bg-muted text-muted-foreground" },
};

interface VendedorForm { nome: string; email: string; }
const EMPTY: VendedorForm = { nome: "", email: "" };

export default function Admin() {
  const { state, addVendedorAction, deleteVendedorAction } = useApp();
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm]       = useState<VendedorForm>(EMPTY);
  const [errors, setErrors]   = useState<Partial<VendedorForm>>({});
  const [salvando, setSalvando] = useState(false);

  function validate() {
    const e: Partial<VendedorForm> = {};
    if (!form.nome.trim()) e.nome = "Nome é obrigatório.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSalvar() {
    if (!validate()) return;
    setSalvando(true);
    try {
      await addVendedorAction({ nome: form.nome.trim(), email: form.email.trim(), ativo: true });
      toast.success("Vendedor adicionado!");
      setForm(EMPTY);
      setOpenAdd(false);
    } catch {
      toast.error("Erro ao adicionar vendedor.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleDeletar(id: string, nome: string) {
    if (!confirm(`Remover "${nome}"?`)) return;
    try {
      await deleteVendedorAction(id);
      toast.success("Vendedor removido.");
    } catch {
      toast.error("Erro ao remover vendedor.");
    }
  }

  const userEmail = state.session?.user?.email ?? "";
  const isAdmin   = state.session?.user?.user_metadata?.role === "admin";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Painel Admin
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie os vendedores da equipe</p>
      </div>

      {/* Info do usuário logado */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCog className="h-4 w-4 text-primary" /> Sua conta
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">{userEmail}</p>
            <p className="text-xs text-muted-foreground">Logado</p>
          </div>
          <Badge className={isAdmin ? ROLES.admin.color : ROLES.vendedor.color}>
            {isAdmin ? "Administrador" : "Vendedor"}
          </Badge>
        </CardContent>
      </Card>

      {/* Vendedores */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Vendedores
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Vendedores cadastrados no sistema
            </CardDescription>
          </div>
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-1">
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Vendedor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    placeholder="Nome completo"
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    className={errors.nome ? "border-destructive" : ""}
                  />
                  {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome}</p>}
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenAdd(false)}>Cancelar</Button>
                <Button onClick={handleSalvar} disabled={salvando}>
                  {salvando ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {state.vendedores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum vendedor cadastrado ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.vendedores.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{v.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={v.ativo ? "default" : "secondary"}>
                        {v.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeletar(v.id, v.nome)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}