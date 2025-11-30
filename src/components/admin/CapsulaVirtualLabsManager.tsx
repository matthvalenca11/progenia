import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Beaker } from "lucide-react";
import { toast } from "sonner";
import { capsulaVirtualLabService, CapsulaVirtualLab } from "@/services/capsulaVirtualLabService";
import { virtualLabService, VirtualLab } from "@/services/virtualLabService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CapsulaVirtualLabsManagerProps {
  capsulaId: string;
}

interface LinkedLabWithDetails extends CapsulaVirtualLab {
  lab?: VirtualLab;
}

export function CapsulaVirtualLabsManager({ capsulaId }: CapsulaVirtualLabsManagerProps) {
  const [linkedLabs, setLinkedLabs] = useState<LinkedLabWithDetails[]>([]);
  const [availableLabs, setAvailableLabs] = useState<VirtualLab[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [labToDelete, setLabToDelete] = useState<LinkedLabWithDetails | null>(null);

  useEffect(() => {
    loadData();
  }, [capsulaId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load linked labs
      const links = await capsulaVirtualLabService.getLabsByCapsulaId(capsulaId);
      
      // Load lab details for each link
      const linksWithDetails = await Promise.all(
        links.map(async (link) => {
          const lab = await virtualLabService.getById(link.lab_id);
          return { ...link, lab: lab || undefined };
        })
      );
      
      setLinkedLabs(linksWithDetails);
      
      // Load available labs (published only)
      const labs = await virtualLabService.getPublishedLabs();
      
      // Filter out already linked labs
      const linkedLabIds = new Set(links.map(l => l.lab_id));
      const available = labs.filter(lab => !linkedLabIds.has(lab.id!));
      
      setAvailableLabs(available);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar laboratórios");
    } finally {
      setLoading(false);
    }
  };

  const handleAddLab = async () => {
    if (!selectedLabId) {
      toast.error("Selecione um laboratório");
      return;
    }

    try {
      const nextPosition = linkedLabs.length;
      await capsulaVirtualLabService.addLabToCapsula(capsulaId, selectedLabId, nextPosition);
      toast.success("Laboratório vinculado com sucesso!");
      setSelectedLabId("");
      loadData();
    } catch (error: any) {
      console.error("Error adding lab:", error);
      toast.error("Erro ao vincular laboratório", { description: error.message });
    }
  };

  const handleDeleteClick = (link: LinkedLabWithDetails) => {
    setLabToDelete(link);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!labToDelete?.id) return;

    try {
      await capsulaVirtualLabService.removeLabFromCapsula(labToDelete.id);
      toast.success("Vínculo removido!");
      loadData();
    } catch (error: any) {
      console.error("Error removing lab:", error);
      toast.error("Erro ao remover vínculo");
    } finally {
      setDeleteDialogOpen(false);
      setLabToDelete(null);
    }
  };

  const getLabTypeBadge = (type: string) => {
    const badges = {
      ultrasound: { label: "Ultrassom", variant: "default" as const },
      tens: { label: "TENS", variant: "secondary" as const },
      electrotherapy: { label: "Eletroterapia", variant: "secondary" as const },
      thermal: { label: "Térmico", variant: "outline" as const },
      other: { label: "Outro", variant: "outline" as const },
    };
    const badge = badges[type as keyof typeof badges] || badges.other;
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5" />
            Laboratórios Virtuais
          </CardTitle>
          <CardDescription>
            Vincule laboratórios virtuais a esta cápsula. Eles serão exibidos na ordem definida.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Lab Section */}
          <div className="flex gap-2">
            <Select value={selectedLabId} onValueChange={setSelectedLabId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um laboratório..." />
              </SelectTrigger>
              <SelectContent>
                {availableLabs.map((lab) => (
                  <SelectItem key={lab.id} value={lab.id!}>
                    {lab.name} ({getLabTypeBadge(lab.lab_type)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddLab} disabled={!selectedLabId || loading}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>

          {/* Linked Labs List */}
          {linkedLabs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Beaker className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum laboratório vinculado ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {linkedLabs.map((link, index) => {
                const labName = link.lab?.name || "Lab desconhecido";
                const labType = link.lab?.lab_type;
                
                return (
                  <div
                    key={link.id}
                    className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
                  >
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{labName}</span>
                        {labType && getLabTypeBadge(labType)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Posição {index + 1}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(link)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Vínculo?</AlertDialogTitle>
            <AlertDialogDescription>
              {labToDelete?.lab?.name ? (
                <>
                  Tem certeza que deseja remover o vínculo com o laboratório "{labToDelete.lab.name}"?
                  O laboratório não será excluído, apenas não aparecerá mais nesta cápsula.
                </>
              ) : (
                "Tem certeza que deseja remover este vínculo?"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
