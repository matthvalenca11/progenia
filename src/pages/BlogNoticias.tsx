import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { PostCard } from "@/components/blog/PostCard";
import { PostDetailModal } from "@/components/blog/PostDetailModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

interface InstagramPost {
  id: string;
  media_type: string;
  media_url: string;
  caption: string;
  permalink: string;
  timestamp: string;
  thumbnail_url?: string;
}

export default function BlogNoticias() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase.functions.invoke("get-instagram-posts", {
        body: {},
      });

      if (fetchError) {
        console.error("Erro ao buscar posts:", fetchError);
        setError("Não foi possível carregar os posts. Tente novamente mais tarde.");
        return;
      }

      if (data?.posts) {
        setPosts(data.posts);
      } else {
        setError("Nenhum post encontrado.");
      }
    } catch (err) {
      console.error("Erro ao buscar posts:", err);
      setError("Erro ao carregar posts. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="ProGenia" className="h-10 progenia-logo" />
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link to="/">
              <Button variant="ghost">Home</Button>
            </Link>
            <Link to="/sobre">
              <Button variant="ghost">Sobre</Button>
            </Link>
            <Link to="/contato">
              <Button variant="ghost">Contato</Button>
            </Link>
            <Link to="/auth">
              <Button variant="ghost">Entrar</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">Blog e Notícias</h1>
            <p className="text-muted-foreground text-lg">
              Acompanhe as últimas novidades e conteúdos da ProGenia
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={loadPosts}>Tentar novamente</Button>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground">Nenhum post disponível no momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onClick={() => setSelectedPost(post)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal de detalhes do post */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          open={!!selectedPost}
          onOpenChange={(open) => !open && setSelectedPost(null)}
        />
      )}
    </div>
  );
}
