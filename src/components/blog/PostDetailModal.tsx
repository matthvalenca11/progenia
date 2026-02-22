import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { InstagramPost } from "@/pages/BlogNoticias";

interface PostDetailModalProps {
  post: InstagramPost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PostDetailModal({ post, open, onOpenChange }: PostDetailModalProps) {
  const imageUrl = post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Post do Instagram</h2>
            {post.permalink && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(post.permalink, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver no Instagram
              </Button>
            )}
          </div>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-6">
          {imageUrl && (
            <div className="w-full">
              <img
                src={imageUrl}
                alt={post.caption || "Post do Instagram"}
                className="w-full h-auto rounded-lg"
              />
            </div>
          )}
          <div className="flex flex-col">
            {post.caption && (
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Legenda</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{post.caption}</p>
              </div>
            )}
            {post.timestamp && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  {new Date(post.timestamp).toLocaleDateString("pt-BR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
