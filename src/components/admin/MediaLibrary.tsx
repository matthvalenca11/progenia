import { useState, useEffect } from "react";
import { storageService, StorageBucket } from "@/services/storageService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Download, Trash2, Search, Filter, Image, Video, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface MediaFile {
  name: string;
  path: string;
  bucket: StorageBucket;
  size?: number;
  created_at?: string;
}

export function MediaLibrary() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBucket, setSelectedBucket] = useState<StorageBucket>("lesson-videos");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const buckets: StorageBucket[] = [
    "lesson-videos",
    "lesson-assets",
    "lab-assets",
    "public-marketing",
    "partner-logos",
    "team-photos",
  ];

  const bucketLabels: Record<StorageBucket, string> = {
    "lesson-videos": "Vídeos de Aulas",
    "lesson-assets": "Materiais de Aulas",
    "lab-assets": "Assets de Laboratórios",
    "public-marketing": "Marketing Público",
    "partner-logos": "Logos de Parceiros",
    "team-photos": "Fotos da Equipe",
  };

  useEffect(() => {
    loadFiles();
  }, [selectedBucket]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const result = await storageService.listFiles(selectedBucket);
      const mappedFiles: MediaFile[] = result.map(file => ({
        name: file.name,
        path: file.name,
        bucket: selectedBucket,
        size: file.metadata?.size,
        created_at: file.created_at,
      }));
      setFiles(mappedFiles);
    } catch (error) {
      console.error("Erro ao carregar arquivos:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyPath = (file: MediaFile) => {
    const fullPath = `${file.bucket}/${file.path}`;
    navigator.clipboard.writeText(fullPath);
    toast({
      title: "Path copiado",
      description: "O caminho do arquivo foi copiado para a área de transferência",
    });
  };

  const copyUrl = async (file: MediaFile) => {
    try {
      let url: string;
      if (["public-marketing", "partner-logos", "team-photos"].includes(file.bucket)) {
        url = storageService.getPublicUrl(file.bucket, file.path);
      } else {
        url = await storageService.getSignedUrl(file.bucket, file.path, 3600);
      }
      navigator.clipboard.writeText(url);
      toast({
        title: "URL copiada",
        description: "A URL do arquivo foi copiada para a área de transferência",
      });
    } catch (error) {
      console.error("Erro ao copiar URL:", error);
    }
  };

  const deleteFile = async (file: MediaFile) => {
    if (!confirm(`Tem certeza que deseja excluir "${file.name}"?`)) return;
    
    try {
      await storageService.deleteFile(file.bucket, file.path);
      loadFiles();
    } catch (error) {
      console.error("Erro ao deletar arquivo:", error);
    }
  };

  const getFileType = (fileName: string): string => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (["mp4", "webm", "mov", "avi"].includes(ext || "")) return "video";
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "")) return "image";
    if (["pdf", "doc", "docx", "txt", "md"].includes(ext || "")) return "document";
    return "other";
  };

  const FileIcon = ({ type }: { type: string }) => {
    switch (type) {
      case "video":
        return <Video className="h-5 w-5" />;
      case "image":
        return <Image className="h-5 w-5" />;
      case "document":
        return <FileText className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "—";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase());
    const fileType = getFileType(file.name);
    const matchesFilter = filterType === "all" || fileType === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Biblioteca de Mídia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedBucket} onValueChange={(v) => setSelectedBucket(v as StorageBucket)}>
            <SelectTrigger className="w-full sm:w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {buckets.map(bucket => (
                <SelectItem key={bucket} value={bucket}>
                  {bucketLabels[bucket]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar arquivos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="video">Vídeos</SelectItem>
              <SelectItem value="image">Imagens</SelectItem>
              <SelectItem value="document">Documentos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando arquivos...
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum arquivo encontrado
          </div>
        ) : (
          <div className="border rounded-lg">
            <div className="max-h-[500px] overflow-y-auto">
              {filteredFiles.map((file, index) => {
                const fileType = getFileType(file.name);
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileIcon type={fileType} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatSize(file.size)}</span>
                          {file.created_at && (
                            <>
                              <span>•</span>
                              <span>{new Date(file.created_at).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className="hidden sm:inline-flex">
                        {fileType}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyPath(file)}
                        title="Copiar path"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyUrl(file)}
                        title="Copiar URL"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteFile(file)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Button onClick={loadFiles} variant="outline" className="w-full">
          Atualizar lista
        </Button>
      </CardContent>
    </Card>
  );
}
