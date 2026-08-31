import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";
import { Search } from "lucide-react";

export function PackagesSearch({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
}) {
  return (
    <search className="mt-6 block">
      <InputGroup className="bg-card dark:bg-card h-10">
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={query}
          placeholder="Search packages"
          aria-label="Search packages"
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </InputGroup>
    </search>
  );
}
