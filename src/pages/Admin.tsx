import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Plus, Trash2, RefreshCw, Loader2, UserCog } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

type Role = "admin" | "vendedor" | "visualizador";

const ROLES: Record<Role, { label: string; desc: string; color: string }> = {
  admin:        { label: "Administrador", desc: "Acesso total, incluindo painel admin",        color: "bg-primary text-primary-foreground" },
  vendedor:     { label: "Vendedor",      desc: "Registra vendas e gerencia clientes",         color: "bg-success/20 text-success" },
  visualizador: { label: "Visualizador",  desc: "Apenas visualiza relatórios e histórico",     color: "bg-muted text-muted-foreground" },
};

interface UsuarioForm { email: string; password: string; role: Role; }
const EMPTY: UsuarioForm = { email: "", password: "", role: "vendedor" };

interface Usuario { id: string; email: string; role: Role; created_at: string; }

export default function Admin() {
  const { state } = useApp();
  const [usuarios, setUsuarios]   = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [openAdd, setOpenAdd]     = useState(false);
  const [form, setForm]           = useState<UsuarioForm>(EMPTY);
  const [errors, setErrors]       = useState<Partial<UsuarioForm>>({});
  const [salvando, setSalvando]   = useState(false);

  async function carregar() {
    setCarregando(true);
    try {
      const { data, error } = await supabaseAdmin?.auth.admin.listUsers();
      if (error) throw error;
      setUsuarios((data.users ?? []).map((u) => ({
        id: u.id,
        email: u.email ?? "",
        role: (u.user_metadata?.role as Role) ?? "vendedor",
        created_at: new Date(u.created_at).toLocaleDateString("pt-BR"),
      })));
    } catch {
      toast.error("Erro ao carregar. Use a service_role key no Supabase.");
    } finally { setCarregando(false); }
  }

  function validate() {
    const e: Partial<UsuarioForm> = {};
    if (!form.email.includes("@"))      e.email    = "Email inválido.";
    if (form.password.length < 6)       e.password = "Mínimo 6 caracteres.";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleCriar() {
    if (!validate()) return;
    setSalvando(true);
    try {
      const { error } = await supabaseAdmin?.auth.admin.createUser({
        email: form.email,
        password: form.password,
        email_confirm: true,
        user_metadata: { role: form.role },
      });
      if (error) throw error;
      toast.success(`Usuário ${form.email} criado!`);
      setForm(EMPTY); setOpenAdd(false); carregar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar usuário.");
    } finally { setSalvando(false); }
  }

  async function handleRemover(id: string, email: string) {
    if (!confirm(`Remover ${email}?`)) return;
    try {
      const { error } = await supabaseAdmin?.auth.admin.deleteUser(id);
      if (error) throw error;
      toast.success(`${email} removido.`);
      setUsuarios((u) => u.filter((x) => x.id !== id));
    } catch { toast.error("Erro ao remover usuário."); }
  }

  const meuEmail = state.session?.user?.email;
  const semServiceKey = !supabaseAdmin;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Shield className="h-6 w-6" /> Painel Administrativo
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie usuários e permissões do sistema</p>
      </div>

      {/* Conta atual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCog className="h-4 w-4" /> Sua conta
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-medium">{meuEmail}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sessão ativa</p>
          </div>
          <Badge className={ROLES.admin.color}>Administrador</Badge>
        </CardContent>
      </Card>

      {/* Funções disponíveis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funções do Sistema</CardTitle>
          <CardDescription>Permissões disponíveis para atribuição</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(Object.entries(ROLES) as [Role, typeof ROLES[Role]][]).map(([key, r]) => (
              <div key={key} className="glass-card rounded-xl p-4">
                <Badge className={`${r.color} mb-2`}>{r.label}</Badge>
                <p className="text-xs text-muted-foreground">{r.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Usuários */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Usuários</CardTitle>
            <CardDescription className="mt-1">Quem tem acesso ao Sales View</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={carregar} disabled={carregando}>
              {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>

            <Dialog open={openAdd} onOpenChange={(o) => { setOpenAdd(o); if (!o) { setForm(EMPTY); setErrors({}); }}}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Usuário</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Usuário</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Email *</Label>
                    <Input type="email" placeholder="usuario@email.com"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className={errors.email ? "border-destructive" : ""} />
                    {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <Label>Senha *</Label>
                    <Input type="password" placeholder="Mínimo 6 caracteres"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className={errors.password ? "border-destructive" : ""} />
                    {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
                  </div>
                  <div>
                    <Label>Função</Label>
                    <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.entries(ROLES) as [Role, typeof ROLES[Role]][]).map(([key, r]) => (
                          <SelectItem key={key} value={key}>
                            <div className="py-0.5">
                              <p className="font-medium">{r.label}</p>
                              <p className="text-xs text-muted-foreground">{r.desc}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenAdd(false)}>Cancelar</Button>
                  <Button onClick={handleCriar} disabled={salvando}>
                    {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Criar Usuário
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {usuarios.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <UserCog className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Clique em atualizar para listar os usuários</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={carregar}>
                <RefreshCw className="h-4 w-4 mr-2" />Carregar usuários
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Cadastrado em</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>
                        <Badge className={ROLES[u.role]?.color ?? ""}>{ROLES[u.role]?.label ?? u.role}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.created_at}</TableCell>
                      <TableCell>
                        {u.email !== meuEmail && (
                          <Button variant="ghost" size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemover(u.id, u.email)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="pt-5">
          <p className="text-sm font-medium text-warning mb-1">⚠️ Aviso técnico</p>
          <p className="text-xs text-muted-foreground">
            Listar e remover usuários requer a <strong>service_role key</strong> do Supabase (nunca exponha no frontend em produção). 
            Criar usuários funciona com a anon key. Para gestão completa, configure um endpoint seguro no backend.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}