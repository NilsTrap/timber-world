import { Badge } from "@timber/ui";
import { PERSONA_SHORT_LABEL, type ProjectPersona } from "../personas";

/**
 * Persona chips for an organisation (the viewer's own, or a party on a deal).
 *
 * Labels only: personas describe which hat an organisation wears, they never
 * decide what is shown — that is modules + RLS + the field wall. An org with no
 * flags renders nothing at all rather than a default label.
 */
export function PersonaBadges({
  personas,
  className,
}: {
  personas: readonly ProjectPersona[];
  className?: string;
}) {
  if (personas.length === 0) return null;
  return (
    <span className={className ? `flex flex-wrap gap-1 ${className}` : "flex flex-wrap gap-1"}>
      {personas.map((p) => (
        <Badge key={p} variant="secondary">
          {PERSONA_SHORT_LABEL[p]}
        </Badge>
      ))}
    </span>
  );
}
