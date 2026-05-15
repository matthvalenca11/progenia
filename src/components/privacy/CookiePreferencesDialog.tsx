import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConsent, type ConsentCategories } from "@/contexts/ConsentContext";

export const CookiePreferencesDialog = () => {
  const { preferences, isPreferencesOpen, closePreferences, savePreferences } = useConsent();
  const [localCategories, setLocalCategories] = useState<ConsentCategories>(preferences.categories);

  useEffect(() => {
    setLocalCategories(preferences.categories);
  }, [preferences.categories, isPreferencesOpen]);

  return (
    <Dialog open={isPreferencesOpen} onOpenChange={(open) => (!open ? closePreferences() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Preferencias de cookies</DialogTitle>
          <DialogDescription>
            Ajuste quais categorias podem ser usadas. Cookies essenciais sao sempre ativos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium">Essenciais</p>
              <p className="text-xs text-muted-foreground">Necessarios para autenticacao e funcionamento do site.</p>
            </div>
            <Switch checked disabled />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium">Analytics</p>
              <p className="text-xs text-muted-foreground">Mede uso para melhoria da plataforma.</p>
            </div>
            <Switch
              checked={localCategories.analytics}
              onCheckedChange={(checked) => setLocalCategories((prev) => ({ ...prev, analytics: checked }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium">Marketing</p>
              <p className="text-xs text-muted-foreground">Personalizacao de campanhas e remarketing.</p>
            </div>
            <Switch
              checked={localCategories.marketing}
              onCheckedChange={(checked) => setLocalCategories((prev) => ({ ...prev, marketing: checked }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closePreferences}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              void savePreferences(localCategories).then(() => {
                closePreferences();
              })
            }
          >
            Salvar preferencias
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

