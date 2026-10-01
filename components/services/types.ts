export type LinkKind =
  | "github"
  | "demo"
  | "website"
  | "behance"
  | "dribbble"
  | "figma"
  | "youtube"
  | "vimeo"
  | "drive"
  | "other";

export type ServiceLink = {
  id?: string;
  kind: LinkKind;
  label: string | null;
  url: string;
};

export type ServiceImage = { id: string; url: string };

export type Service = {
  id: string;
  title: string;
  description: string;
  categoryId: number;
  category: string;
  price: number;
  currency: string;
  deliveryDays: number | null;
  revisions: number | null;
  requirements: string;
  tags: string[];
  deliverables: string[];
  images: ServiceImage[];
  coverUrl: string | null;
  links: ServiceLink[];
  isActive: boolean;
  createdAt: string;
  rating: number | null;
  reviewsCount: number;
};

export type Category = { id: number; name: string };

export type ServiceLimits = {
  images: number;
  links: number;
  tags: number;
  deliverables: number;
};

export const DEFAULT_LIMITS: ServiceLimits = { images: 6, links: 8, tags: 10, deliverables: 10 };

export const LINK_KIND_OPTIONS: { kind: LinkKind; label: string; placeholder: string }[] = [
  { kind: "github", label: "GitHub", placeholder: "https://github.com/you/project" },
  { kind: "demo", label: "Live demo", placeholder: "https://my-project.vercel.app" },
  { kind: "website", label: "Website", placeholder: "https://example.com" },
  { kind: "behance", label: "Behance", placeholder: "https://behance.net/gallery/..." },
  { kind: "dribbble", label: "Dribbble", placeholder: "https://dribbble.com/shots/..." },
  { kind: "figma", label: "Figma", placeholder: "https://figma.com/file/..." },
  { kind: "youtube", label: "YouTube", placeholder: "https://youtube.com/watch?v=..." },
  { kind: "vimeo", label: "Vimeo", placeholder: "https://vimeo.com/..." },
  { kind: "drive", label: "Google Drive", placeholder: "https://drive.google.com/..." },
  { kind: "other", label: "Other link", placeholder: "https://" },
];

/** Guess the kind of a link from its address, so the creator does not have to pick it by hand. */
export function guessLinkKind(url: string): LinkKind | null {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
  const is = (...domains: string[]) => domains.some((d) => host === d || host.endsWith("." + d));
  if (is("github.com", "gitlab.com", "bitbucket.org")) return "github";
  if (is("behance.net")) return "behance";
  if (is("dribbble.com")) return "dribbble";
  if (is("figma.com")) return "figma";
  if (is("youtube.com", "youtu.be")) return "youtube";
  if (is("vimeo.com")) return "vimeo";
  if (is("drive.google.com", "docs.google.com", "dropbox.com")) return "drive";
  if (is("vercel.app", "netlify.app", "herokuapp.com", "github.io", "pages.dev")) return "demo";
  return null;
}

/** The text shown on a link button: the creator's own label, or the name of the link type. */
export function linkText(link: ServiceLink): string {
  if (link.label) return link.label;
  return LINK_KIND_OPTIONS.find((o) => o.kind === link.kind)?.label ?? "Link";
}

export function formatPrice(price: number, currency: string) {
  return `${price.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

export function formatDelivery(days: number | null) {
  if (!days) return null;
  return days === 1 ? "1 day" : `${days} days`;
}

export function formatRevisions(revisions: number | null) {
  if (revisions === null || revisions === undefined) return null;
  if (revisions === 0) return "No revisions";
  return revisions === 1 ? "1 revision" : `${revisions} revisions`;
}
