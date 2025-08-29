import { FC, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader } from "../../../components/ui/dialog";
import { DialogDescription, DialogProps, DialogTitle } from "@radix-ui/react-dialog";
import { Button } from "../../../components/ui/button";
import { SectionIndex } from "@/hooks/use-file-reader";
import { cn } from "@/lib/utils";

interface StartFromPopUpProps extends Omit<DialogProps, "onOpenChange"> {
  sections: SectionIndex[];
  source: "pdf" | "docx" | "text";
  fullText: string;
  initialSelectedId?: string;
  /** Return a character offset + optional match length (for highlight) */
  onConfirm: (args: { startAt: number; matchLength?: number }) => void;
  /** Close handler for the surrounding dialog */
  onClose: (open: boolean) => void;
}

type Item = {
  id: string;
  label: string;
  start: number;
  end: number;
  /** HTML with optional <mark> highlighting */
  previewHTML?: string;
  kind: "page" | "hit";
};

const escapeHTML = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const makeSnippet = (text: string, center: number, radius = 90) => {
  const from = Math.max(0, center - radius);
  const to = Math.min(text.length, center + radius);
  let snip = text.slice(from, to);
  if (from > 0) snip = "…" + snip;
  if (to < text.length) snip = snip + "…";
  return snip;
};

const toRegex = (q: string) => new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");

const highlightHTML = (snippet: string, query: string) => {
  if (!query) return escapeHTML(snippet);
  const re = toRegex(query);
  return escapeHTML(snippet).replace(
    re,
    (m) =>
      `<mark style="background:rgba(250,204,21,.45);border-radius:4px;padding:0 .2rem">${escapeHTML(
        m
      )}</mark>`
  );
};

const StartFromPopUp: FC<StartFromPopUpProps> = ({
  open,
  onClose,
  onConfirm,
  sections,
  fullText,
  initialSelectedId,
  source,
  ...props
}) => {
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(initialSelectedId);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Pages (default list)
  const pageItems: Item[] = useMemo(
    () =>
      sections.map((s) => ({
        id: s.id,
        label: s.label,
        start: s.start,
        end: s.end,
        previewHTML: escapeHTML(fullText.slice(s.start, s.end).slice(0, 220)),
        kind: "page",
      })),
    [sections, fullText]
  );

  // Exact text matches (when user types a query)
  const hitItems: Item[] = useMemo(() => {
    const t = q.trim();
    if (!t) return [];
    const lower = fullText.toLowerCase();
    const needle = t.toLowerCase();
    const hits: Item[] = [];

    let from = 0;
    let idx = lower.indexOf(needle, from);
    while (idx !== -1 && hits.length < 500) {
      const snippet = makeSnippet(fullText, idx + Math.floor(needle.length / 2));
      const sectionIdx = sections.findIndex((s) => idx >= s.start && idx < s.end);
      const pageLabel = sectionIdx >= 0 ? sections[sectionIdx].label : "Match";

      hits.push({
        id: `hit_${idx}`,
        label: `${pageLabel} — Match`,
        start: idx,
        end: idx + needle.length,
        previewHTML: highlightHTML(snippet, t),
        kind: "hit",
      });

      from = idx + needle.length;
      idx = lower.indexOf(needle, from);
    }
    return hits;
  }, [q, fullText, sections]);

  const items: Item[] = q.trim() ? hitItems : pageItems;

  useEffect(() => {
    if (!items.length) {
      setSelectedId(undefined);
      return;
    }
    if (!selectedId || !items.some((i) => i.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const selected = items.find((i) => i.id === selectedId) || null;

  const onOpenChange = (next: boolean) => {
    if (!next) onClose(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!items.length) return;
    const idx = selected ? items.findIndex((i) => i.id === selected.id) : 0;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = items[Math.min(idx + 1, items.length - 1)];
      setSelectedId(next.id);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = items[Math.max(idx - 1, 0)];
      setSelectedId(prev.id);
    } else if (e.key === "Enter" && selected) {
      e.preventDefault();
      handleStartFromSelected();
    }
  };

  const handleStartFromSelected = () => {
    if (!selected) return;
    const query = q.trim();

    // If exact text search is active and a hit is selected, highlight the matched phrase length.
    if (query && selected.kind === "hit") {
      onConfirm({ startAt: selected.start, matchLength: selected.end - selected.start });
      return;
    }

    // Otherwise (page selection), highlight the page preview we show in the list (up to 220 chars).
    const previewLen = Math.max(
      0,
      Math.min(selected.end - selected.start, 220)
    );
    onConfirm({ startAt: selected.start, matchLength: previewLen });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} {...props}>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        className="
          gpt:bg-gray-100 dark:bg-gray-900
          gpt:border-none
          gpt:w-[95vw] gpt:max-w-[95vw]
          gpt:sm:w-[95vw] gpt:sm:max-w-[620px]
          gpt:md:w-[80vw] gpt:md:max-w-[750px]
          lg:gpt:w-[60vw] lg:gpt:max-w-[800px] xl:gpt:max-w-[900px]
          gpt:rounded-2xl
        "
      >
        <DialogHeader className="gpt:sr-only">
          <DialogTitle className="gpt:inline-flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-2">
            Start from…
          </DialogTitle>
          <DialogDescription className="gpt:sr-only">
            Choose where the reading should begin
          </DialogDescription>
        </DialogHeader>

        <div className="gpt:w-full gpt:flex gpt:flex-col gpt:gap-6 gpt:justify-center gpt:items-center">
          <section className="gpt:flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-4 gpt:w-full">
            <h1 className="gpt:text-xl gpt:font-medium gpt:text-center gpt:text-gray-900 dark:text-gray-100">
              Select a starting point
            </h1>

            {/* Search input */}
            <div className="gpt:w-full gpt:max-w-[720px] gpt:flex gpt:gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Search text (shows exact matches)…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                className="
                  gpt:flex-1 gpt:h-9 gpt:px-3
                  gpt:rounded-full
                  gpt:border gpt:border-gray-500 dark:border-gray-700
                  gpt:bg-gray-100 dark:bg-gray-800
                  gpt:text-sm gpt:text-gray-900 dark:text-gray-100
                  placeholder:gpt:text-gray-500 dark:placeholder:text-gray-400
                "
              />
            </div>

            {/* Results panel — same border as input */}
            <div
              className="
                gpt:w-full gpt:max-w-[720px]
                gpt:border gpt:border-gray-500 dark:border-gray-700
                gpt:bg-gray-100 dark:bg-gray-800
                gpt:rounded-lg gpt:p-2
              "
            >
              <div
                className="
                  gpt:max-h-80 gpt:overflow-auto
                  gpt:space-y-1
                "
                onKeyDown={onKeyDown}
                tabIndex={-1}
              >
                {items.map((it, idx) => (
                  <div key={it.id}>
                    <button
                      className={cn(
                        "gpt:w-full gpt:text-left gpt:px-3 gpt:py-2 gpt:rounded gpt:cursor-pointer",
                        "gpt:hover:bg-gray-200 dark:hover:bg-gray-700",
                        it.id === selected?.id &&
                          "gpt:bg-gray-200 dark:bg-gray-700 gpt:border gpt:border-gray-200 dark:border-gray-700"
                      )}
                      onClick={() => setSelectedId(it.id)}
                    >
                      <div className="gpt:text-sm gpt:font-medium gpt:text-gray-900 dark:text-gray-100">
                        {it.label}
                      </div>
                      {it.previewHTML && (
                        <div
                          className="gpt:mt-1 gpt:text-xs gpt:text-gray-700 dark:text-gray-300 gpt:line-clamp-3"
                          dangerouslySetInnerHTML={{ __html: it.previewHTML }}
                        />
                      )}
                    </button>
                    {idx < items.length - 1 && (
                      <div className="gpt:h-px gpt:bg-gray-200 dark:bg-gray-700" />
                    )}
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="gpt:text-sm gpt:text-center gpt:py-6 gpt:text-gray-600 dark:text-gray-400">
                    No matches
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Footer buttons */}
          <footer className="gpt:flex gpt:items-end gpt:justify-center gpt:gap-4">
            <Button
              variant="ghost"
              size="lg"
              className="
                gpt:rounded-full
                gpt:border gpt:border-gray-500 dark:border-gray-700
                gpt:bg-gray-100 dark:bg-gray-800
                gpt:text-gray-900 dark:text-gray-100
                gpt:[&_svg]:size-6 gpt:transition-all
              "
              onClick={() => onConfirm({ startAt: 0, matchLength: 0 })}
            >
              Start from beginning
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="
                gpt:rounded-full
                gpt:border gpt:border-gray-500 dark:border-gray-700
                gpt:bg-gray-100 dark:bg-gray-800
                gpt:text-gray-900 dark:text-gray-100
                gpt:[&_svg]:size-6 gpt:transition-all
                aria-disabled:opacity-50 aria-disabled:cursor-not-allowed
              "
              onClick={handleStartFromSelected}
              disabled={!selected}
            >
              Start from selection
            </Button>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StartFromPopUp;
