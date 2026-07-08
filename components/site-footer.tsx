import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const TECH_STACK = [
  "Next.js",
  "React",
  "TypeScript",
  "Tailwind CSS",
  "shadcn/ui",
  "yt-dlp",
  "ffmpeg.wasm",
] as const;

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-2xl px-4 pb-10">
      <Separator className="mb-6" />
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {TECH_STACK.map((tech) => (
            <Badge key={tech} variant="outline">
              {tech}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Open_YTDLP is built on top of{" "}
          <span className="font-medium text-foreground">yt-dlp</span> for
          extraction and{" "}
          <span className="font-medium text-foreground">ffmpeg.wasm</span>{" "}
          for in-browser rendering — all credit to those projects for making
          this possible.
        </p>
        <p className="text-xs text-muted-foreground">
          Made by <span className="font-medium text-foreground">KunRansu</span>
        </p>
      </div>
    </footer>
  );
}
