// Contratos de la API pública (docs/api.md). La web solo los consume; no hay lógica de negocio.

export type ProjectTeam = 'INDIVIDUAL' | 'GROUP';
export type ProjectOrigin = 'ACADEMIC' | 'PERSONAL' | 'PROFESSIONAL';
export type SkillLevel = 'BASIC' | 'INTERMEDIATE' | 'SOLID';
export type TimelineType = 'EXPERIENCE' | 'EDUCATION' | 'CERTIFICATION';
export type DatePrecision = 'MONTH' | 'YEAR';

export interface Profile {
  fullName: string;
  headline: string;
  valueProp: string;
  summary: string;
  location: string;
  availability: string;
  photoUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  publicEmail: string | null;
}

export interface ProjectCard {
  slug: string;
  title: string;
  summary: string;
  role: string;
  team: ProjectTeam | null;
  origin: ProjectOrigin | null;
  featured: boolean;
  skills: { name: string }[];
  demoUrl: string | null;
  repoUrl: string | null;
  coverUrl: string | null;
  disclaimer: string | null;
}

export interface ProjectDetail extends ProjectCard {
  context: string | null;
  problem: string | null;
  solution: string | null;
  architecture: string | null;
  decisions: string | null;
  challenges: string | null;
  learnings: string | null;
  limitations: string | null;
  startDate: string | null;
  endDate: string | null;
  images: { url: string; alt: string }[];
}

export interface Home {
  locale: string;
  availableLocales: string[];
  profile: Profile;
  cv: { primaryUrl: string | null; profiles: string[] };
  featuredProjects: ProjectCard[];
  sections: Record<'projects' | 'timeline' | 'skills' | 'languages' | 'contact', boolean>;
}

export interface TimelineEntry {
  type: TimelineType;
  title: string;
  organization: string;
  startDate: string;
  endDate: string | null;
  datePrecision: DatePrecision;
  description: string | null;
  credentialUrl: string | null;
  relatedProjectSlug: string | null;
}

export interface SkillGroup {
  category: string;
  skills: { name: string; level: SkillLevel | null; projects: { slug: string; title: string }[] }[];
}

export interface Language {
  code: string;
  name: string;
  level: string;
}
