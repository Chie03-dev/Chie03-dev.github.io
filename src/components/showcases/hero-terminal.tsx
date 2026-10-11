"use client";

import { useEffect, useRef, useState } from "react";

import { site } from "@/lib/site";
import { getFeaturedProjects } from "@/lib/projects";
import { getSkillCategories } from "@/lib/experience";
import { useHeroLock } from "@/context/hero-lock-context";
import { cn } from "@/lib/utils";

interface TerminalLine {
  id: number;
  kind: "input" | "output" | "error";
  text: string;
}

type OutputLine = { kind: "output" | "error"; text: string };

const WELCOME: TerminalLine[] = [
  { id: 0, kind: "output", text: "Welcome to my interactive terminal." },
  { id: 1, kind: "output", text: 'Type "help" to see available commands.' },
];

const UNLOCK_SUCCESS = "[SUCCESS] Chains broken. Unbound mode activated.";

function resolveCommand(
  command: string,
  isLocked: boolean,
): OutputLine[] | { action: "unlock" } {
  switch (command.toLowerCase()) {
    case "help":
      return [
        { kind: "output", text: "Available commands:" },
        { kind: "output", text: "  help      Show this help" },
        { kind: "output", text: "  skills    List my primary stack" },
        { kind: "output", text: "  projects  Highlight top projects" },
        { kind: "output", text: "  contact   Show my email" },
        { kind: "output", text: "  unlock    Break the chains" },
        { kind: "output", text: "  clear     Clear the terminal" },
      ];
    case "unlock":
      return isLocked
        ? { action: "unlock" }
        : [{ kind: "output", text: "Already unbound. The chains are gone." }];
    case "skills": {
      const lines: OutputLine[] = [{ kind: "output", text: "Primary stack:" }];
      for (const category of getSkillCategories()) {
        const primary = category.skills
          .filter((skill) => skill.highlight)
          .map((skill) => skill.name);
        if (primary.length > 0) {
          lines.push({
            kind: "output",
            text: `  ${category.category}: ${primary.join(", ")}`,
          });
        }
      }
      return lines;
    }
    case "projects": {
      const lines: OutputLine[] = [{ kind: "output", text: "Featured projects:" }];
      for (const project of getFeaturedProjects()) {
        lines.push({ kind: "output", text: `  - ${project.title}` });
        lines.push({
          kind: "output",
          text: `    ${project.role} | ${project.timeline}`,
        });
      }
      return lines;
    }
    case "contact":
      return [
        { kind: "output", text: `Email: ${site.email}` },
        { kind: "output", text: `GitHub: ${site.github}` },
      ];
    default:
      return [
        {
          kind: "error",
          text: `Command not found: ${command}. Type "help" for options.`,
        },
      ];
  }
}

/**
 * Interactive hero terminal. A client component with a retro/minimalist theme.
 * Supports help, skills, projects, contact, and clear. Auto-focuses the input
 * and auto-scrolls the output on each command.
 */
export function HeroTerminal() {
  const { isLocked, unlockHero } = useHeroLock();
  const [lines, setLines] = useState<TerminalLine[]>(WELCOME);
  const [value, setValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(WELCOME.length);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [lines]);

  function focusInput() {
    inputRef.current?.focus();
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const command = value.trim();
    if (!command) return;

    if (command.toLowerCase() === "clear") {
      setLines([]);
      setValue("");
      return;
    }

    const result = resolveCommand(command, isLocked);
    const outputLines: TerminalLine[] =
      "action" in result
        ? [{ id: idRef.current++, kind: "output", text: UNLOCK_SUCCESS }]
        : result.map((line) => ({
            id: idRef.current++,
            kind: line.kind,
            text: line.text,
          }));

    if ("action" in result) {
      unlockHero();
    }

    const nextLines: TerminalLine[] = [
      { id: idRef.current++, kind: "input", text: command },
      ...outputLines,
    ];
    setLines((prev) => [...prev, ...nextLines]);
    setValue("");
  }

  return (
    <div
      onClick={focusInput}
      className="rounded-lg border border-border/60 bg-[oklch(0.11_0.03_235)] shadow-lg shadow-primary/5"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-500/80" />
        <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
        <span className="h-3 w-3 rounded-full bg-primary/60" />
        <span className="ml-2 text-xs text-muted-foreground">~/portfolio</span>
      </div>

      {/* Output */}
      <div
        ref={scrollRef}
        className="h-64 space-y-1 overflow-y-auto px-4 py-4 font-mono text-sm leading-relaxed"
      >
        {lines.map((line) => (
          <p
            key={line.id}
            className={cn(
              "break-words whitespace-pre-wrap",
              line.kind === "input" && "text-foreground",
              line.kind === "output" && "text-[oklch(0.82_0.02_200)]",
              line.kind === "error" && "text-[oklch(0.7_0.18_25)]",
            )}
          >
            {line.kind === "input" ? `> ${line.text}` : line.text}
          </p>
        ))}

        {/* Input row */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-1">
          <span className="font-mono text-sm text-primary">$</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-label="Terminal command input"
            autoComplete="off"
            spellCheck={false}
            placeholder="type a command, e.g. help"
            className="w-full bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
          />
        </form>
      </div>
    </div>
  );
}
