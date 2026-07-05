import { LoaderCircle } from "lucide-react";

export function LoadingSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid min-h-32 place-items-center p-6">
      <div className="grid justify-items-center gap-3 text-muted">
        <LoaderCircle className="h-12 w-12 animate-spin text-mint" strokeWidth={2.5} />
        <span className="text-sm font-semibold">{label}</span>
      </div>
    </div>
  );
}
