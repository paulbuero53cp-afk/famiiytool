import { useState, type KeyboardEvent } from "react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  placeholder?: string;
}

export function TagInput({ value, onChange, suggestions, placeholder = "Tag eingeben und Enter drücken" }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || value.includes(tag)) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  }

  const filteredSuggestions = suggestions.filter(
    (s) => !value.includes(s) && s.toLowerCase().includes(draft.trim().toLowerCase()),
  );

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1.5 focus-within:border-neutral-900">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-700"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-neutral-400 hover:text-neutral-900"
              aria-label={`Tag "${tag}" entfernen`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm outline-none"
        />
      </div>

      {showSuggestions && draft.trim() && filteredSuggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
          {filteredSuggestions.slice(0, 6).map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(s)}
              className="block w-full px-3 py-1.5 text-left text-xs text-neutral-600 hover:bg-neutral-100"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
