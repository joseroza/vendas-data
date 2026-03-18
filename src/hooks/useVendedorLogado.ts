import { useMemo } from "react";
import { useApp } from "@/context/AppContext";

/**
 * Retorna o nome do vendedor correspondente ao usuário logado.
 *
 * Prioridade:
 * 1. Busca na tabela de vendedores pelo email (vendedor cadastrado)
 * 2. Usa user_metadata.full_name se disponível
 * 3. Usa a parte antes do @ do email como fallback (ex: "jose@..." → "jose")
 *
 * Isso garante que o admin também seja identificado como vendedor
 * mesmo não estando na tabela de vendedores.
 */
export function useVendedorLogado(): string {
  const { state } = useApp();

  return useMemo(() => {
    const user  = state.session?.user;
    if (!user) return "";

    const email = user.email?.toLowerCase().trim() ?? "";

    // 1. Tenta achar na tabela de vendedores pelo email
    const vendedor = (state.vendedores ?? []).find(
      (v) => v.email.toLowerCase().trim() === email
    );
    if (vendedor?.nome) return vendedor.nome.trim();

    // 2. Usa full_name do user_metadata se existir
    const fullName = user.user_metadata?.full_name as string | undefined;
    if (fullName?.trim()) return fullName.trim();

    // 3. Fallback: parte antes do @ do email, capitalizada
    if (email) {
      const nome = email.split("@")[0];
      return nome.charAt(0).toUpperCase() + nome.slice(1);
    }

    return "";
  }, [state.session, state.vendedores]);
}