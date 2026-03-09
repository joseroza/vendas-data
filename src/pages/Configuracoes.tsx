import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, Percent, Users, Shield, LogOut } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function Configuracoes() {
  const { state, setMargemAction } = useApp();
  const [margem, setMargem] = useState(String(state.margem));
  const [saving, setSaving] = useState(false);

  async function salvarMargem() {
    const num = parseFloat(margem);
    if (isNaN(num) || num < 0 || num > 100) {
      toast.error("Informe uma margem entre 0 e 100%.");
      return;
    }
    setSaving(true);
    try {
      await setMargemAction(num);
      toast.success(`Margem global atualizada para ${num}%`);
    } catch {
      toast.error("Erro ao salvar margem.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada.");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <SettingsIcon className="h-6 w-6" />
          Configurações
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie as configurações do sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" />
            Margem Padrão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs">
            <Label>Margem global (%)</Label>
            <Input
              type="number"
              value={margem}
              onChange={(e) => setMargem(e.target.value)}
              min={0} max={100}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Margem atual: <span className="font-semibold text-foreground">{state.margem}%</span>
          </p>
          <Button onClick={salvarMargem} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Margem"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Conta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">
                  {state.session?.user?.email?.[0]?.toUpperCase() ?? "U"}
                </span>
              </div>
              <div>
                <p className="font-medium text-sm">{state.session?.user?.email ?? "Usuário"}</p>
                <p className="text-xs text-muted-foreground">Logado</p>
              </div>
            </div>
            <Badge className="flex items-center gap-1"><Shield className="h-3 w-3" />Admin</Badge>
          </div>
          <Button variant="outline" className="flex items-center gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
