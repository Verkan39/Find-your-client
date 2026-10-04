import { Fragment, type ReactNode } from "react";

/** Minimal, safe markdown renderer for research notes: headings, lists, bold, links. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={i++} className="font-semibold text-fg">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("[")) {
      const [, label, href] = tok.match(/\[([^\]]+)\]\(([^)]+)\)/)!;
      out.push(<a key={i++} href={href} target="_blank" rel="noreferrer" className="text-cyan hover:underline">{label}</a>);
    } else {
      let host = tok;
      try { host = new URL(tok).hostname.replace(/^www\./, ""); } catch {}
      out.push(<a key={i++} href={tok} target="_blank" rel="noreferrer" className="text-cyan/80 hover:underline">{host}</a>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={blocks.length} className="my-2 space-y-1.5 pl-1">
          {list.map((l, i) => (
            <li key={i} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-violet" /><span>{inline(l)}</span></li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const li = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (li) { list.push(li[1]); continue; }
    flush();
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) blocks.push(<h4 key={blocks.length} className="mt-5 mb-1 font-display text-sm font-semibold text-fg first:mt-0">{inline(h[2])}</h4>);
    else if (line.trim()) blocks.push(<p key={blocks.length} className="my-2">{inline(line)}</p>);
  }
  flush();
  return <div className="text-sm leading-relaxed text-fg-muted">{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
