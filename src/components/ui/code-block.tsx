import { CopyButton } from "@/components/ui/copy-button";
import type { CodeSnippet } from "@/types/project";

type TokenType = "plain" | "comment" | "string" | "keyword";

// Combined tokenizer: comments, then string literals, then reserved keywords.
const TOKEN_PATTERN =
  /(\/\/.*)|("[^"]*"|'[^']*')|\b(const|let|var|function|return|if|else|import|export|from|async|await|class|new|val|fun|suspend|object|override|private|public|internal|true|false|null|void|while|delay|fun|interface|type|default)\b/g;

const TOKEN_CLASS: Record<TokenType, string> = {
  plain: "text-foreground",
  comment: "text-muted-foreground/70 italic",
  string: "text-green-600 dark:text-green-400",
  keyword: "text-primary",
};

/** Split a single line into colored tokens as React nodes (no innerHTML). */
function tokenize(line: string): { text: string; type: TokenType }[] {
  const tokens: { text: string; type: TokenType }[] = [];
  TOKEN_PATTERN.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_PATTERN.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, match.index), type: "plain" });
    }
    const type: TokenType = match[1] ? "comment" : match[2] ? "string" : "keyword";
    tokens.push({ text: match[0], type });
    lastIndex = TOKEN_PATTERN.lastIndex;
  }

  if (lastIndex < line.length) {
    tokens.push({ text: line.slice(lastIndex), type: "plain" });
  }
  return tokens;
}

interface CodeBlockProps {
  snippet: CodeSnippet;
}

/**
 * Minimal syntax-highlighted code block with a filename header, language badge,
 * and a copy-to-clipboard action (reusing the existing CopyButton client leaf).
 * Tokenizing produces React nodes rather than HTML strings, so no XSS surface.
 */
export function CodeBlock({ snippet }: CodeBlockProps) {
  const lines = snippet.code.split("\n");

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <span className="font-mono text-xs text-muted-foreground">
          {snippet.filename}
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground">
            {snippet.language}
          </span>
          <CopyButton value={snippet.code} label="Copy" className="px-2 py-1 text-xs" />
        </div>
      </div>

      <pre className="overflow-x-auto px-3 py-3 text-xs leading-relaxed">
        <code className="font-mono">
          {lines.map((line, i) => {
            const tokens = tokenize(line);
            return (
              <div key={i} className="whitespace-pre">
                {tokens.length === 0 ? (
                  "\u00A0"
                ) : (
                  tokens.map((token, j) => (
                    <span key={j} className={TOKEN_CLASS[token.type]}>
                      {token.text}
                    </span>
                  ))
                )}
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
}