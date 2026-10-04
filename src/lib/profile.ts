import { z } from "zod";

/** "About you" fields: collected at signup, editable on the Profile page. */

export const EXPERIENCE_LEVELS = [
  { value: "student", label: "Student" },
  { value: "junior", label: "Junior (0-2 yrs)" },
  { value: "mid", label: "Mid-level (2-5 yrs)" },
  { value: "senior", label: "Senior (5+ yrs)" },
  { value: "agency", label: "Agency / team" },
] as const;

export const SKILL_SUGGESTIONS = [
  "React", "Next.js", "Vue", "Angular", "Node.js", "Python", "Django", "Laravel", "WordPress", "Shopify",
  "Webflow", "Flutter", "React Native", "UI/UX design", "Figma", "SEO", "Tailwind CSS", "TypeScript",
  "PHP", "Firebase", "Supabase", "AWS", "Copywriting", "Social media", "Branding", "Automation",
];

export const INTEREST_SUGGESTIONS = [
  "Restaurants & cafés", "Healthcare", "Salons & beauty", "Fitness", "Retail", "Real estate", "Education",
  "Hospitality", "Legal & finance", "Automotive", "Home services", "E-commerce", "Non-profits", "Startups",
];

const tag = z.string().trim().min(1).max(40);
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const ProfileSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().max(40).regex(/^[+()\d\s.-]*$/, "Use digits, spaces, + ( ) - only").optional().or(z.literal("")),
  contactEmail: z.string().trim().max(200).email("Enter a valid email").optional().or(z.literal("")),
  headline: optionalText(120),
  location: optionalText(120),
  experienceLevel: z.enum(["student", "junior", "mid", "senior", "agency"]).optional().or(z.literal("")),
  portfolioUrl: z.string().trim().max(300).url("Enter a full URL, e.g. https://…").optional().or(z.literal("")),
  bio: optionalText(1000),
  skills: z.array(tag).max(30).default([]),
  interests: z.array(tag).max(30).default([]),
});

export type ProfileInput = z.infer<typeof ProfileSchema>;

export interface Profile extends ProfileInput {
  email: string;
}

/** profile row <-> API shape */
export function profileFromRow(r: Record<string, unknown>, email: string): Profile {
  return {
    email,
    fullName: (r.full_name as string) ?? "",
    phone: (r.phone as string) ?? "",
    contactEmail: (r.contact_email as string) ?? "",
    headline: (r.headline as string) ?? "",
    location: (r.location as string) ?? "",
    experienceLevel: ((r.experience_level as string) ?? "") as ProfileInput["experienceLevel"],
    portfolioUrl: (r.portfolio_url as string) ?? "",
    bio: (r.bio as string) ?? "",
    skills: (r.skills as string[]) ?? [],
    interests: (r.interests as string[]) ?? [],
  };
}

export function profileToRow(p: ProfileInput) {
  const blank = (v: string | undefined) => (v ? v : null);
  return {
    full_name: p.fullName,
    phone: blank(p.phone),
    contact_email: blank(p.contactEmail),
    headline: blank(p.headline),
    location: blank(p.location),
    experience_level: blank(p.experienceLevel),
    portfolio_url: blank(p.portfolioUrl),
    bio: blank(p.bio),
    skills: p.skills,
    interests: p.interests,
  };
}
