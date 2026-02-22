import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, EyeOff, RefreshCw, Instagram } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface InstagramPost {
  id: string;
  media_type: string;
  media_url: string;
  caption: string;
  permalink: string;
  timestamp: string;
  thumbnail_url?: string;
}

interface PostVisibility {
  instagram_post_id: string;
  is_visible: boolean;
}

export function InstagramPostsManager() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadPosts();
    loadVisibility();
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("get-instagram-posts", {
        body: {},
      });

      if (error) {
        console.error("Erro ao buscar posts:", error);
        toast.error("Erro ao carregar posts do Instagram");
        return;
      }

      if (data?.posts) {
        setPosts(data.posts);
        // Inicializar visibilidade: todos visíveis por padrão
        const initialVisibility: Record<string, boolean> = {};
        data.posts.forEach((post: InstagramPost) => {
          initialVisibility[post.id] = true;
        });
        setVisibility(initialVisibility);
      }
    } catch (err) {
      console.error("Erro ao buscar posts:", err);
      toast.error("Erro ao carregar posts");
    } finally {
      setLoading(false);
    }
  };

  const loadVisibility = async () => {
    try {
      const { data, error } = await supabase
        .from("instagram_posts_visibility")
        .select("instagram_post_id, is_visible");

      if (error) {
        console.error("Erro ao carregar visibilidade:", error);
        return;
      }

      if (data) {
        const visibilityMap: Record<string, boolean> = {};
        data.forEach((item: PostVisibility) => {
          visibilityMap[item.instagram_post_id] = item.is_visible;
        });
        setVisibility((prev) => ({ ...prev, ...visibilityMap }));
      }
    } catch (err) {
      console.error("Erro ao carregar visibilidade:", err);
    }
  };

  const toggleVisibility = async (postId: string, currentValue: boolean) => {
    try {
      setSaving((prev) => ({ ...prev, [postId]: true }));

      const newValue = !currentValue;

      // Verificar se já existe registro
      const { data: existing } = await supabase
        .from("instagram_posts_visibility")
        .select("id")
        .eq("instagram_post_id", postId)
        .single();

      if (existing) {
        // Atualizar
        const { error } = await supabase
          .from("instagram_posts_visibility")
          .update({ is_visible: newValue, updated_at: new Date().toISOString() })
          .eq("instagram_post_id", postId);

        if (error) throw error;
      } else {
        // Criar novo
        const { error } = await supabase
          .from("instagram_posts_visibility")
          .insert({
            instagram_post_id: postId,
            is_visible: newValue,
          });

        if (error) throw error;
      }

      setVisibility((prev) => ({ ...prev, [postId]: newValue }));
      toast.success(newValue ? "Post visível no blog" : "Post oculto do blog");
    } catch (err) {
      console.error("Erro ao atualizar visibilidade:", err);
      toast.error("Erro ao atualizar visibilidade do post");
    } finally {
      setSaving((prev => ({ ...prev, [postId]: false })));
    }
  };

  const getImageUrl = (post: InstagramPost) => {
    return post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url;
  };

  const truncateCaption = (caption: string, maxLength: number = 100) => {
    if (!caption) return "";
    return caption.length > maxLength ? caption.substring(0, maxLength) + "..." : caption;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Instagram className="h-8 w-8" />
            Posts do Instagram
          </h1>
          <p className="text-muted-foreground mt-1">
            Controle quais posts aparecem na página de Blog e Notícias
          </p>
        </div>
        <Button onClick={loadPosts} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar Posts
        </Button>
      </div>

      {/* Posts Grid */}
      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum post encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => {
            const isVisible = visibility[post.id] ?? true;
            const imageUrl = getImageUrl(post);

            return (
              <Card key={post.id} className={!isVisible ? "opacity-60" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {isVisible ? (
                        <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                          <Eye className="h-4 w-4" />
                          Visível
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <EyeOff className="h-4 w-4" />
                          Oculto
                        </span>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`toggle-${post.id}`} className="text-sm">
                        {isVisible ? "Visível" : "Oculto"}
                      </Label>
                      <Switch
                        id={`toggle-${post.id}`}
                        checked={isVisible}
                        onCheckedChange={() => toggleVisibility(post.id, isVisible)}
                        disabled={saving[post.id]}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {imageUrl && (
                    <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted mb-4">
                      <img
                        src={imageUrl}
                        alt={truncateCaption(post.caption)}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {post.caption && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {truncateCaption(post.caption, 120)}
                    </p>
                  )}
                  {post.timestamp && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(post.timestamp).toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
