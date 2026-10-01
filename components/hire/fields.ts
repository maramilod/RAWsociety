// =====================================================================
// The questions of the custom-request form ("Hire me").
//
// Every field is described here as plain data, and the form draws itself from it. To change a question,
// add one, or add a new specialty, edit this file only: the form itself does not need to change.
// Fields are grouped by the creator's specialty (the same names as the categories in the database).
// =====================================================================

export type FieldSpec = { key: string; label: string; help?: string; required?: boolean } & (
  | { type: "select"; options: string[] }
  | { type: "multi"; options: string[] }
  | { type: "text"; placeholder?: string }
  | { type: "textarea"; placeholder?: string }
  | { type: "number"; unit?: string; min?: number; max?: number; placeholder?: string }
  | { type: "date" }
  | { type: "toggle" }
  | { type: "chips"; placeholder?: string; max?: number }
  | { type: "list"; placeholder?: string; max?: number }
);

export type FieldValue = string | string[] | boolean;

const LANGUAGES = "Arabic (right-to-left)";

// ---- Graphic design and branding ----
const GRAPHIC: FieldSpec[] = [
  {
    key: "projectType", label: "What do you need designed?", type: "select", required: true,
    options: ["Logo design", "Full brand identity", "Packaging design", "Social media kit", "Poster or flyer", "Brochure or catalogue", "Business cards and stationery", "Illustration", "Other"],
  },
  { key: "style", label: "Style keywords", type: "chips", max: 8, placeholder: "e.g. minimal, bold, vintage. Press Enter", help: "Words that describe the look you want." },
  { key: "colors", label: "Preferred colours", type: "text", placeholder: "e.g. warm orange and dark brown, or avoid red" },
  {
    key: "startingPoint", label: "What do you already have?", type: "select",
    options: ["Nothing, starting from scratch", "A logo", "A logo and brand colours", "A full brand guide"],
  },
  { key: "concepts", label: "How many concepts to choose from?", type: "select", options: ["1", "2", "3", "5", "Let the creator decide"] },
  { key: "medium", label: "Where will it be used?", type: "multi", options: ["Print", "Social media", "Website", "Packaging", "Signage", "Presentation"] },
  { key: "formats", label: "File formats you need", type: "multi", options: ["AI", "SVG", "PNG", "JPG", "PDF", "PSD", "Figma"] },
  { key: "sizes", label: "Sizes or dimensions", type: "text", placeholder: "e.g. A4 poster, 1080x1080 post. Leave empty if not sure" },
];

// ---- UI / UX design ----
const UIUX: FieldSpec[] = [
  {
    key: "projectType", label: "What are we designing?", type: "select", required: true,
    options: ["Mobile app", "Website", "Web app or SaaS", "Dashboard or admin panel", "E-commerce store", "Design system", "Redesign of an existing product", "Other"],
  },
  { key: "platforms", label: "Platforms", type: "multi", options: ["iOS", "Android", "Web (desktop)", "Web (mobile)", "Tablet"] },
  { key: "screens", label: "How many screens?", type: "select", options: ["1 to 5", "6 to 10", "11 to 20", "21 to 40", "More than 40", "Not sure yet"] },
  { key: "deliverables", label: "What should be delivered?", type: "multi", options: ["Wireframes", "High-fidelity screens", "Clickable prototype", "Design system", "Developer hand-off", "User research or testing"] },
  { key: "tool", label: "Design tool", type: "select", options: ["Figma", "Adobe XD", "Sketch", "No preference"] },
  { key: "brandAssets", label: "Brand", type: "select", options: ["I have brand guidelines", "I have a logo and colours only", "No brand yet, please suggest one"] },
  { key: "examples", label: "Products you like or compete with", type: "textarea", placeholder: "Names or links of apps and websites that inspire you." },
];

// ---- Video editing and motion ----
const VIDEO: FieldSpec[] = [
  {
    key: "projectType", label: "What kind of video?", type: "select", required: true,
    options: ["Promo or advert", "Social media reel", "YouTube video", "Product video", "Explainer or animation", "Motion graphics", "Event or wedding", "Interview or podcast", "Other"],
  },
  { key: "videosCount", label: "How many videos?", type: "number", min: 1, max: 100, unit: "videos", placeholder: "1" },
  { key: "duration", label: "Length of each video", type: "select", options: ["Under 30 seconds", "30 to 60 seconds", "1 to 3 minutes", "3 to 10 minutes", "More than 10 minutes"] },
  { key: "aspect", label: "Video format", type: "multi", options: ["16:9 (landscape)", "9:16 (reels, stories)", "1:1 (square)", "4:5"] },
  {
    key: "footage", label: "Footage", type: "select",
    options: ["I will provide the footage", "The creator should film it", "Stock footage is fine", "Animation only, no footage"],
  },
  { key: "extras", label: "Extras", type: "multi", options: ["Subtitles", "Voice-over", "Music", "Colour grading", "Sound design", "Logo animation", "Thumbnails"] },
  { key: "videoLanguages", label: "Language of the video", type: "text", placeholder: "e.g. Arabic with English subtitles" },
  { key: "resolution", label: "Quality", type: "select", options: ["Full HD (1080p)", "4K", "No preference"] },
];

// ---- 3D and animation ----
const THREE_D: FieldSpec[] = [
  {
    key: "projectType", label: "What do you need?", type: "select", required: true,
    options: ["3D model", "Product render", "Character design", "Animation", "Architectural visualisation", "Game asset", "3D logo", "Other"],
  },
  { key: "output", label: "Output you need", type: "multi", options: ["Still images", "Video or turntable", "GLB / glTF", "FBX", "OBJ", "STL (3D printing)", "Blender file"] },
  { key: "quality", label: "Level of detail", type: "select", options: ["Low-poly, game ready", "Medium", "High detail, realistic"] },
  { key: "reference", label: "Reference material", type: "select", options: ["I have images or drawings", "I have exact measurements", "I have both", "Nothing yet"] },
  { key: "rigging", label: "The model must be rigged for animation", type: "toggle" },
  { key: "animationLength", label: "Animation length (if any)", type: "select", options: ["No animation", "Under 10 seconds", "10 to 30 seconds", "30 to 60 seconds", "Longer"] },
  { key: "software", label: "Software", type: "select", options: ["Blender", "Maya", "3ds Max", "Cinema 4D", "No preference"] },
];

// ---- Software and web development ----
const DEV: FieldSpec[] = [
  {
    key: "projectType", label: "What do you want built?", type: "select", required: true,
    options: ["Website", "Landing page", "Web application", "Mobile app", "E-commerce store", "API or backend", "Bug fixing or code review", "Automation or script", "Other"],
  },
  { key: "features", label: "Main features", type: "list", max: 12, placeholder: "e.g. Users can sign up and log in", help: "One feature per line. The clearer the list, the better the offer." },
  { key: "stack", label: "Preferred technologies", type: "chips", max: 10, placeholder: "e.g. Next.js, MySQL, Flutter. Press Enter", help: "Leave empty to let the creator choose." },
  { key: "designStatus", label: "Design", type: "select", options: ["I have designs ready", "The creator should design it too", "Use a ready-made template"] },
  { key: "integrations", label: "Integrations", type: "multi", options: ["Payments", "User accounts and login", "Email", "Maps", "Analytics", "Admin dashboard", "Chat", "Other APIs"] },
  { key: "siteLanguages", label: "Languages of the product", type: "multi", options: [LANGUAGES, "English"] },
  { key: "codebase", label: "Existing code or repository", type: "text", placeholder: "https://github.com/... (if you already have code)" },
  { key: "hosting", label: "Hosting", type: "select", options: ["I already have hosting", "The creator should set it up", "Not sure"] },
  { key: "support", label: "Support after delivery", type: "select", options: ["Not needed", "1 month", "3 months", "6 months"] },
  { key: "ownership", label: "Source code", type: "select", options: ["I must own the full source code", "A licence to use it is enough"] },
];

// ---- Photography and videography ----
const PHOTO: FieldSpec[] = [
  {
    key: "projectType", label: "What kind of shoot?", type: "select", required: true,
    options: ["Product photography", "Portrait", "Event", "Wedding", "Real estate", "Food", "Fashion", "Corporate or headshots", "Video shoot", "Other"],
  },
  { key: "location", label: "City and place", type: "text", placeholder: "e.g. Zuwara, at my shop" },
  { key: "shootDate", label: "Preferred shoot date", type: "date", help: "Leave empty if flexible." },
  { key: "hours", label: "How long is the shoot?", type: "number", min: 1, max: 72, unit: "hours", placeholder: "2" },
  { key: "people", label: "Number of people or products", type: "number", min: 1, max: 1000, placeholder: "1" },
  { key: "photosCount", label: "Edited photos you need", type: "select", options: ["Up to 10", "10 to 30", "30 to 60", "60 to 100", "More than 100"] },
  { key: "editing", label: "Editing level", type: "select", options: ["Basic colour correction", "Standard retouching", "Advanced retouching"] },
  { key: "venue", label: "Where?", type: "select", options: ["In a studio", "On location in the creator's city", "The creator travels to me"] },
  { key: "equipment", label: "Extra equipment", type: "multi", options: ["Studio lighting", "Drone", "Backdrop", "Props", "Makeup artist"] },
];

/** A single question for specialties that are not listed above. */
const GENERIC: FieldSpec[] = [{ key: "projectType", label: "What kind of project is it?", type: "text", required: true, placeholder: "e.g. A logo, a website, a video" }];

const BY_CATEGORY: Record<string, FieldSpec[]> = {
  "Graphic Design & Branding": GRAPHIC,
  "UI/UX Design": UIUX,
  "Video Editing & Motion": VIDEO,
  "3D & Animation": THREE_D,
  "Software & Web Development": DEV,
  "Photography & Videography": PHOTO,
};

/** The project-specific questions for a creator's specialty. */
export function fieldsFor(category: string): FieldSpec[] {
  return BY_CATEGORY[category] ?? GENERIC;
}

// ---- Questions every request has, whatever the specialty ----
export const LANGUAGE_OPTIONS = ["Arabic", "English", "Arabic and English", "Another language"];
export const USAGE_RIGHTS = [
  "Personal use only",
  "Commercial use (my business)",
  "Full rights, the work becomes mine",
];
export const REVISION_OPTIONS = ["0", "1", "2", "3", "5"];
export const CONTACT_OPTIONS = ["In-site messages only", "In-site messages, and a call if needed"];

// ---- Limits of the form ----
export const MAX_REQUEST_FILES = 5;
export const MAX_REQUEST_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const MAX_REQUEST_LINKS = 6;
