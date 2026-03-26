import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookText, Plus, Save, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TranslationGlossaryManagerProps {
  onSaved?: () => void;
}

type GlossaryRow = {
  id: string;
  source_lang: string;
  target_lang: string;
  source_text: string;
  target_text: string;
  is_active: boolean;
  updated_at?: string | null;
};

type NewTermForm = {
  source_lang: string;
  target_lang: string;
  source_text: string;
  target_text: string;
  is_active: boolean;
};

const defaultNewTerm: NewTermForm = {
  source_lang: "pt",
  target_lang: "en",
  source_text: "",
  target_text: "",
  is_active: true,
};

export const TranslationGlossaryManager = ({ onSaved }: TranslationGlossaryManagerProps) => {
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [rows, setRows] = useState<GlossaryRow[]>([]);
  const [newTerm, setNewTerm] = useState<NewTermForm>(defaultNewTerm);

  useEffect(() => {
    void loadGlossary();
  }, []);

  const loadGlossary = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("translation_glossary")
        .select("id, source_lang, target_lang, source_text, target_text, is_active, updated_at")
        .order("source_text", { ascending: true });

      if (error) throw error;
      setRows((data ?? []) as GlossaryRow[]);
    } catch (error) {
      console.error("Erro ao carregar glossario:", error);
      toast.error("Erro ao carregar glossario");
    } finally {
      setLoading(false);
    }
  };

  const updateLocalRow = (id: string, patch: Partial<GlossaryRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleSaveRow = async (row: GlossaryRow) => {
    try {
      if (!row.source_text.trim() || !row.target_text.trim()) {
        toast.error("Preencha termo origem e traducao");
        return;
      }

      setSavingId(row.id);
      const { error } = await supabase
        .from("translation_glossary")
        .update({
          source_lang: row.source_lang.trim().toLowerCase(),
          target_lang: row.target_lang.trim().toLowerCase(),
          source_text: row.source_text.trim(),
          target_text: row.target_text.trim(),
          is_active: row.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (error) throw error;
      toast.success("Termo atualizado com sucesso");

      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem("progenia_translation_cache_en");
        } catch {
          // ignore
        }
        window.dispatchEvent(new Event("progenia_translation_glossary_updated"));
      }

      onSaved?.();
      await loadGlossary();
    } catch (error: unknown) {
      console.error("Erro ao salvar termo:", error);
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Erro ao salvar termo";

      if (message.includes("duplicate key value")) {
        toast.error("Ja existe um termo com esse idioma e texto de origem");
        return;
      }

      if (message.includes("relation") && message.includes("translation_glossary")) {
        toast.error("Tabela translation_glossary nao existe. Rode: supabase db push");
        return;
      }

      toast.error(message);
    } finally {
      setSavingId(null);
    }
  };

  const handleAddTerm = async () => {
    try {
      if (!newTerm.source_text.trim() || !newTerm.target_text.trim()) {
        toast.error("Preencha termo origem e traducao");
        return;
      }

      setAdding(true);
      const { error } = await supabase.from("translation_glossary").insert({
        source_lang: newTerm.source_lang.trim().toLowerCase(),
        target_lang: newTerm.target_lang.trim().toLowerCase(),
        source_text: newTerm.source_text.trim(),
        target_text: newTerm.target_text.trim(),
        is_active: newTerm.is_active,
      });

      if (error) throw error;

      toast.success("Termo adicionado com sucesso");
      setNewTerm(defaultNewTerm);

      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem("progenia_translation_cache_en");
        } catch {
          // ignore
        }
        window.dispatchEvent(new Event("progenia_translation_glossary_updated"));
      }

      onSaved?.();
      await loadGlossary();
    } catch (error: unknown) {
      console.error("Erro ao adicionar termo:", error);
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Erro ao adicionar termo";

      if (message.includes("duplicate key value")) {
        toast.error("Ja existe um termo com esse idioma e texto de origem");
        return;
      }

      if (message.includes("relation") && message.includes("translation_glossary")) {
        toast.error("Tabela translation_glossary nao existe. Rode: supabase db push");
        return;
      }

      toast.error(message);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteRow = async (row: GlossaryRow) => {
    try {
      setDeletingId(row.id);
      const { error } = await supabase.from("translation_glossary").delete().eq("id", row.id);
      if (error) throw error;

      setRows((prev) => prev.filter((item) => item.id !== row.id));
      toast.success("Termo removido com sucesso");

      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem("progenia_translation_cache_en");
        } catch {
          // ignore
        }
        window.dispatchEvent(new Event("progenia_translation_glossary_updated"));
      }
    } catch (error: unknown) {
      console.error("Erro ao remover termo:", error);
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Erro ao remover termo";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BookText className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Glossario de Traducao</h2>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Estes termos priorizam traducao tecnica (ex.: termos medicos), melhorando qualidade no modo EN.
        </AlertDescription>
      </Alert>

      <Card className="space-y-4 p-6">
        <h3 className="text-lg font-semibold">Adicionar termo</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1">
            <Label htmlFor="glossary-source-lang">Origem</Label>
            <Input
              id="glossary-source-lang"
              value={newTerm.source_lang}
              onChange={(e) => setNewTerm((prev) => ({ ...prev, source_lang: e.target.value }))}
              placeholder="pt"
              maxLength={10}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="glossary-target-lang">Destino</Label>
            <Input
              id="glossary-target-lang"
              value={newTerm.target_lang}
              onChange={(e) => setNewTerm((prev) => ({ ...prev, target_lang: e.target.value }))}
              placeholder="en"
              maxLength={10}
            />
          </div>
          <div className="space-y-1 lg:col-span-2">
            <Label htmlFor="glossary-source-text">Termo origem</Label>
            <Input
              id="glossary-source-text"
              value={newTerm.source_text}
              onChange={(e) => setNewTerm((prev) => ({ ...prev, source_text: e.target.value }))}
              placeholder="ressonancia magnetica"
            />
          </div>
          <div className="space-y-1 lg:col-span-2">
            <Label htmlFor="glossary-target-text">Traducao</Label>
            <Input
              id="glossary-target-text"
              value={newTerm.target_text}
              onChange={(e) => setNewTerm((prev) => ({ ...prev, target_text: e.target.value }))}
              placeholder="magnetic resonance imaging"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex items-end justify-between rounded-md border p-3">
            <span className="text-sm font-medium">Termo ativo</span>
            <Switch
              checked={newTerm.is_active}
              onCheckedChange={(checked) => setNewTerm((prev) => ({ ...prev, is_active: checked }))}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleAddTerm} disabled={adding}>
            <Plus className="mr-2 h-4 w-4" />
            {adding ? "Adicionando..." : "Adicionar termo"}
          </Button>
        </div>
      </Card>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Origem</TableHead>
              <TableHead className="w-20">Destino</TableHead>
              <TableHead>Termo origem</TableHead>
              <TableHead>Traducao</TableHead>
              <TableHead className="w-24 text-center">Ativo</TableHead>
              <TableHead className="w-40 text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum termo cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Input
                      value={row.source_lang}
                      onChange={(e) => updateLocalRow(row.id, { source_lang: e.target.value })}
                      maxLength={10}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.target_lang}
                      onChange={(e) => updateLocalRow(row.id, { target_lang: e.target.value })}
                      maxLength={10}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.source_text}
                      onChange={(e) => updateLocalRow(row.id, { source_text: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.target_text}
                      onChange={(e) => updateLocalRow(row.id, { target_text: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      <Switch
                        checked={row.is_active}
                        onCheckedChange={(checked) => updateLocalRow(row.id, { is_active: checked })}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => void handleSaveRow(row)}
                        disabled={savingId === row.id || deletingId === row.id}
                      >
                        <Save className="mr-1 h-4 w-4" />
                        Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => void handleDeleteRow(row)}
                        disabled={savingId === row.id || deletingId === row.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
