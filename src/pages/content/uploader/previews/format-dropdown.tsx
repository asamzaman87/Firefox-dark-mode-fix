import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import { ChevronDown, FileIcon } from "lucide-react";

interface FormatDropdownProps {
  format: string;
  setFormat: (format: string) => void;
}

const formatOptions = [
  { value: "txt", label: "Text (.txt)" },
  { value: "pdf", label: "PDF (.pdf)" },
  // Add more formats here if needed
];

const FormatDropdown = ({ format, setFormat }: FormatDropdownProps) => {
  const currentLabel =
    formatOptions.find((opt) => opt.value === format)?.label || "Choose format";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gpt:sm:w-auto gpt:flex gpt:items-center gpt:gap-2 gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:text-gray-800 gpt:dark:text-gray-100 gpt:transition-all gpt:[&_svg]:size-5"
        >
          <FileIcon strokeWidth={2.5} className="gpt:size-6" />
          {currentLabel}
          <ChevronDown className="gpt:w-4 gpt:h-4 gpt:opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="gpt:bg-[#E3E3E3] gpt:dark:bg-[#212121] gpt:px-4 gpt:py-2">
        {formatOptions.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => setFormat(opt.value)}
            className={`gpt:cursor-pointer gpt:transition-colors
          ${format === opt.value ? "gpt:font-semibold gpt:bg-accent" : ""}
          gpt:hover:bg-gray-300 gpt:dark:hover:bg-gray-700
        `}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default FormatDropdown;
