export default function RoleCard({
  title,
  description,
  active = false,
  onClick,
}: {
  title: string;
  description?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        relative 
        cursor-pointer
        rounded-2xl 
        p-4 
        lg:p-6 
        border-2
        transition
        ${
          active
            ? "border-[var(--brand-orange)]"
            : "border-[var(--border-default)]"
        }
      `}
    >

      <div
        className={`
          absolute 
          right-4 
          top-4 
          h-5 
          w-5 
          rounded-full 
          border
          ${
            active
              ? "border-[var(--brand-orange)] flex items-center justify-center"
              : "border-[var(--border-default)]"
          }
        `}
      >
        {active && (
          <div
            className="
              h-2 
              w-2 
              rounded-full 
              bg-[var(--brand-orange)]
            "
          />
        )}
      </div>


      <div
        className="
          mb-4
          h-12
          w-12
          rounded-xl
          bg-[var(--profile-logo-bg)]
        "
      />


      <h3 className="font-semibold">
        {title}
      </h3>


      <p className="mt-2 text-sm text-[var(--text-muted)]">
        {description}
      </p>

    </div>
  );
}