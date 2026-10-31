interface DesignSectionProps {
  readonly title: string;
  readonly children: React.ReactNode;
}

export function DesignSection({ title, children }: DesignSectionProps): React.JSX.Element {
  return (
    <section className="flex flex-col gap-4 border-t border-line py-10">
      <h2 className="text-sm text-fg-subtle">{title}</h2>
      {children}
    </section>
  );
}
