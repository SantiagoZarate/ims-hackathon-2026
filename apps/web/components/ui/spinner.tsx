import { cn } from "@/lib/utils";
import { Spinner as SpinnerIcon } from "@phosphor-icons/react";

export function Spinner({
  className,
  ...props
}: React.ComponentProps<typeof SpinnerIcon>): React.ReactElement {
  return (
    <SpinnerIcon
      aria-label="Loading"
      className={cn("animate-spin", className)}
      role="status"
      {...props}
    />
  );
}
