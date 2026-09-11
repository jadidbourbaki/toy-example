import { Heading } from "@radix-ui/themes";
import { WorkflowCard } from "@/panels/WorkflowCard";
import { useStore } from "@/store";

/** The patterns a new workflow can start from. Opening one makes a copy. */
export function TemplatesPage() {
  const templates = useStore((s) => s.templates);
  const createFromTemplate = useStore((s) => s.createFromTemplate);
  return (
    <>
      <Heading size="8" mb="6">
        Templates
      </Heading>
      <div className="card-grid">
        {templates.map((template) => (
          <WorkflowCard
            key={template.id}
            graph={template}
            onOpen={() => void createFromTemplate(template)}
          />
        ))}
      </div>
    </>
  );
}
