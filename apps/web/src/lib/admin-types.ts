import type { DatePrecision, ProjectOrigin, ProjectTeam, SkillLevel, TimelineType } from './types';

// Contratos de la API del panel (docs/api.md).

export interface AdminProfile {
  fullName: string;
  location: string;
  linkedinUrl: string | null;
  githubUrl: string | null;
  publicEmail: string | null;
  showEmail: boolean;
  photoUrl: string | null;
  translations: {
    es?: { headline: string; valueProp: string; summary: string; availability: string };
  };
}

export interface ProjectTexts {
  title: string;
  summary: string;
  role: string;
  context: string | null;
  problem: string | null;
  solution: string | null;
  architecture: string | null;
  decisions: string | null;
  challenges: string | null;
  learnings: string | null;
  limitations: string | null;
  disclaimer: string | null;
  demoNote: string | null;
}

export interface AdminProject {
  id: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED';
  featured: boolean;
  inProgress: boolean;
  team: ProjectTeam | null;
  origin: ProjectOrigin | null;
  startDate: string | null;
  endDate: string | null;
  stack: string[];
  demoUrl: string | null;
  repoUrl: string | null;
  coverUrl: string | null;
  skillIds: string[];
  translations: { es?: ProjectTexts };
  images: { id: string; url: string; translations: { es?: { alt: string } } }[];
}

export interface AdminTimelineEntry {
  id: string;
  type: TimelineType;
  organization: string;
  startDate: string;
  endDate: string | null;
  datePrecision: DatePrecision;
  credentialUrl: string | null;
  relatedProjectId: string | null;
  published: boolean;
  translations: { es?: { title: string; description: string | null } };
}

export interface AdminCategory {
  id: string;
  published: boolean;
  translations: { es?: { name: string } };
}

export interface AdminSkill {
  id: string;
  categoryId: string;
  name: string;
  level: SkillLevel | null;
  published: boolean;
}

export interface AdminLanguage {
  id: string;
  code: string;
  level: string;
  published: boolean;
  translations: { es?: { name: string } };
}

export interface AdminCv {
  primaryProfile: string;
  profiles: {
    profile: string;
    currentVersionId: string | null;
    versions: { id: string; label: string; uploadedAt: string; size: number }[];
  }[];
}
