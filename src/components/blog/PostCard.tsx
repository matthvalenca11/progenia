import { InstagramPost } from "@/pages/BlogNoticias";

interface PostCardProps {
  post: InstagramPost;
  onClick: () => void;
}

export function PostCard({ post, onClick }: PostCardProps) {
  const imageUrl = post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url;
  const truncatedCaption = post.caption
    ? post.caption.length > 120
      ? post.caption.substring(0, 120) + "..."
      : post.caption
    : "";

  return (
    <div
      className="bg-card border border-border rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      {imageUrl && (
        <div className="aspect-square w-full overflow-hidden bg-muted">
          <img
            src={imageUrl}
            alt={truncatedCaption || "Post do Instagram"}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      {truncatedCaption && (
        <div className="p-4">
          <p className="text-sm text-muted-foreground line-clamp-3">{truncatedCaption}</p>
        </div>
      )}
    </div>
  );
}
