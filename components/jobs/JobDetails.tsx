"use client";

import { fieldsFor } from "@/components/hire/fields";
import { budgetLabel, type JobRow } from "@/lib/job-types";

const small = "px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D9CFC5] bg-white hover:border-[#C86C29] transition";

/** Everything the client wrote in a job, as labelled rows, links and downloads. */
export default function JobDetails({ job }: { job: JobRow }) {
  const details: { label: string; value: string }[] = [];
  for (const spec of fieldsFor(job.category.name)) {
    const v = job.details[spec.key];
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    details.push({ label: spec.label, value: Array.isArray(v) ? v.join(", ") : v === true ? "Yes" : String(v) });
  }
  const rows = [
    { label: "Description", value: job.summary },
    ...(job.brief ? [{ label: "Detailed brief", value: job.brief }] : []),
    ...details,
    { label: "Budget", value: budgetLabel(job.budget) },
    { label: "Needed by", value: job.deadline ?? "Flexible" },
  ];

  return (
    <div className="space-y-4">
      <dl className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-1 gap-0.5 sm:grid-cols-3 sm:gap-3">
            <dt className="text-xs font-semibold text-[#7D6E65]">{row.label}</dt>
            <dd className="whitespace-pre-line break-words text-sm sm:col-span-2">{row.value}</dd>
          </div>
        ))}
      </dl>
      {job.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {job.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className={small}>
              {l.label || l.url.replace(/^https?:\/\//, "").slice(0, 40)}
            </a>
          ))}
        </div>
      )}
      {job.files.length > 0 && (
        <ul className="space-y-1.5">
          {job.files.map((f) => (
            <li key={f.id}>
              <a href={`/api/jobs/files/${f.id}?download=1`} className="text-sm font-medium text-[#C86C29] hover:underline">
                {f.name}
              </a>{" "}
              <span className="text-xs text-[#7D6E65]">
                ({f.size < 1048576 ? `${Math.max(1, Math.round(f.size / 1024))} KB` : `${(f.size / 1048576).toFixed(1)} MB`})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
