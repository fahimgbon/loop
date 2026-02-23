import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ markdown }: { markdown: string }) {
  return (
    <article className="prose max-w-none prose-headings:tracking-tight prose-a:text-blue-500">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </article>
  );
}
