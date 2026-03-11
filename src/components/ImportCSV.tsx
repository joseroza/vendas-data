import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, Download, AlertCircle, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";

export interface CSVColumn {
  key:      string;
  label:    string;
  required: boolean;
  example:  string;
  hint?:    string;
}

interface ImportCSVProps {
  title:            string;
  columns:          CSVColumn[];
  onImport:         (rows: Record<string, string>[]) => Promise<{ ok: number; errors: string[] }>;
  templateFileName: string;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  function parseLine(line: string): string[] {
    const values: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; continue; }
        inQ = !inQ; continue;
      }
      if (ch === "," && !inQ) { values.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    values.push(cur.trim());
    return values;
  }

  const headers = parseLine(lines[0]).map((h) => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? "").replace(/^"|"$/g, ""); });
    return row;
  });
}


export function ImportCSV({ title, columns, onImport, templateFileName }: ImportCSVProps) {
  const [open,     setOpen]     = useState(false);
  const [rows,     setRows]     = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [result,   setResult]   = useState<{ ok: number; errors: string[] } | null>(null);
  const [loading,  setLoading]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const header  = columns.map((c) => c.key).join(",");
    const example = columns.map((c) => `"${c.example}"`).join(",");
    const blob = new Blob([header + "\n" + example], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = templateFileName;
    a.click(); URL.revokeObjectURL(url);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text   = ev.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  }

  async function handleImport() {
    if (!rows.length) return;
    setLoading(true);
    try {
      const res = await onImport(rows);
      setResult(res);
      if (res.ok > 0)       toast.success(`${res.ok} registro(s) importado(s) com sucesso!`);
      if (res.errors.length) toast.error(`${res.errors.length} erro(s) encontrado(s).`);
    } catch {
      toast.error("Erro ao importar.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setOpen(false); setRows([]); setFileName(""); setResult(null);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-2" />Importar CSV
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> Importar CSV — {title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Colunas esperadas */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Colunas esperadas no CSV
              </div>
              <div className="divide-y divide-border">
                {columns.map((c) => (
                  <div key={c.key} className="px-4 py-2.5 flex items-start gap-3">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">{c.key}</code>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{c.label}</span>
                      {c.required && <span className="ml-1 text-xs text-destructive">*obrigatório</span>}
                      {c.hint && <p className="text-xs text-muted-foreground mt-0.5">{c.hint}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono shrink-0">ex: {c.example}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Baixar template */}
            <button onClick={downloadTemplate}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition-colors">
              <Download className="h-4 w-4 shrink-0" />
              Baixar template CSV preenchido com exemplo
            </button>

            {/* Upload */}
            <div onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-all">
              <Upload className="h-6 w-6 text-muted-foreground" />
              {fileName
                ? <p className="text-sm font-medium">{fileName} — {rows.length} linha(s)</p>
                : <p className="text-sm text-muted-foreground">Clique para selecionar o arquivo CSV</p>
              }
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </div>

            {/* Preview */}
            {rows.length > 0 && !result && (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Preview — primeiras 3 linhas
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        {Object.keys(rows[0]).map((k) => (
                          <th key={k} className="px-3 py-2 text-left font-medium text-muted-foreground">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 3).map((r, i) => (
                        <tr key={i} className="border-b border-border/50">
                          {Object.values(r).map((v, j) => (
                            <td key={j} className="px-3 py-2 max-w-[120px] truncate">{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 3 && (
                  <p className="px-4 py-2 text-xs text-muted-foreground">...e mais {rows.length - 3} linha(s)</p>
                )}
              </div>
            )}

            {/* Resultado */}
            {result && (
              <div className="space-y-2">
                {result.ok > 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 text-success text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {result.ok} registro(s) importado(s) com sucesso
                  </div>
                )}
                {result.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    {e}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleClose}>
              <X className="h-4 w-4 mr-1" />Fechar
            </Button>
            {rows.length > 0 && !result && (
              <Button onClick={handleImport} disabled={loading}>
                <Upload className="h-4 w-4 mr-2" />
                {loading ? "Importando..." : `Importar ${rows.length} registro(s)`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}