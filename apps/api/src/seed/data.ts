import type {
  DatePrecision,
  LanguageLevel,
  ProjectOrigin,
  ProjectTeam,
  SkillLevel,
  TimelineType,
} from '../generated/prisma/enums.js';

/*
 * Contenido inicial, confirmado por el titular. Sin datos personales sensibles (DNI,
 * teléfono, dirección). Lo que no está confirmado queda vacío o en null y no se muestra.
 */

export const profile = {
  fullName: 'David Saghatelyan',
  location: 'CABA, Argentina',
  linkedinUrl: 'https://www.linkedin.com/in/david-saghatelyan',
  githubUrl: 'https://github.com/DavoSagha',
  publicEmail: 'saghatelyandsm@gmail.com',
  showEmail: true,
  es: {
    headline: 'Desarrollador Backend Jr | JavaScript, TypeScript, Go, COBOL',
    valueProp:
      'Desarrollo backend con JavaScript y Go, y tengo formación en COBOL para entornos mainframe.',
    summary:
      'Estudiante de Ingeniería en Sistemas de Información (UTN FRBA) orientado a backend. Desarrollé un módulo de CPU en Go y el inicio de sesión con Google de una PWA, y participé en una plataforma con Express y Zod. También tengo certificación en COBOL. Busco mi primera posición como desarrollador.',
    availability:
      'Busco mi primera posición en IT. Flexible en jornada y modalidad, en Argentina o remoto.',
  },
};

const SOLID: SkillLevel = 'SOLID';
const INTERMEDIATE: SkillLevel = 'INTERMEDIATE';
const BASIC: SkillLevel = 'BASIC';

/** Skills con su nivel confirmado, en el orden en que se muestran. Todas publicadas. */
export const skillCategories: { name: string; skills: [name: string, level: SkillLevel][] }[] = [
  {
    name: 'Backend',
    skills: [
      ['JavaScript', INTERMEDIATE],
      ['TypeScript', INTERMEDIATE],
      ['Node.js', BASIC],
      ['Express', BASIC],
      ['Zod', INTERMEDIATE],
      ['Go', INTERMEDIATE],
      ['Java', INTERMEDIATE],
      ['Spring Boot', INTERMEDIATE],
      ['APIs REST', INTERMEDIATE],
      ['POO', SOLID],
      ['MVC', BASIC],
    ],
  },
  {
    name: 'Mainframe',
    skills: [
      ['COBOL (z/OS, OS/390, Batch, CICS)', SOLID],
      ['JCL', SOLID],
      ['SORT', SOLID],
      ['IDCAMS', SOLID],
      ['TSO/ISPF', SOLID],
      ['QSAM', SOLID],
      ['VSAM', SOLID],
    ],
  },
  {
    name: 'Frontend',
    skills: [
      ['React', INTERMEDIATE],
      ['Next.js', INTERMEDIATE],
    ],
  },
  {
    name: 'Bases de datos',
    skills: [
      ['SQL', INTERMEDIATE],
      ['MySQL', INTERMEDIATE],
      ['DB2', INTERMEDIATE],
      ['PostgreSQL', BASIC],
      ['Supabase', BASIC],
    ],
  },
  {
    name: 'Lenguajes de sistemas y scripting',
    skills: [
      ['C', INTERMEDIATE],
      ['C++', INTERMEDIATE],
      ['Python', INTERMEDIATE],
    ],
  },
  {
    name: 'Análisis y modelado',
    skills: [
      ['UML', BASIC],
      ['DER', INTERMEDIATE],
      ['Cursogramas', INTERMEDIATE],
      ['Especificación de requerimientos', INTERMEDIATE],
    ],
  },
  {
    name: 'Herramientas y soporte',
    skills: [
      ['Git', INTERMEDIATE],
      ['Linux/Bash', BASIC],
      ['Docker', BASIC],
      ['Scrum', BASIC],
      ['Excel', INTERMEDIATE],
      ['Armado y mantenimiento de PC', SOLID],
    ],
  },
  {
    name: 'Contenido y diseño',
    skills: [
      ['Canva', INTERMEDIATE],
      ['CapCut', INTERMEDIATE],
    ],
  },
];

interface SeedProject {
  slug: string;
  /** Destacado en el inicio. */
  featured: boolean;
  /** "En desarrollo". */
  inProgress: boolean;
  team: ProjectTeam;
  origin: ProjectOrigin;
  startDate: string | null;
  endDate: string | null;
  /** Tecnologías que se muestran en la tarjeta (texto libre). */
  stack: string[];
  repoUrl: string | null;
  /** Skills del perfil vinculadas al proyecto ("Usada en …" en la sección de skills). */
  skills: string[];
  es: {
    title: string;
    summary: string;
    /** Aporte propio. Vacío = no se muestra. */
    role: string;
    context?: string;
    problem?: string;
    solution?: string;
    architecture?: string;
    decisions?: string;
    challenges?: string;
    learnings?: string;
    limitations?: string;
    disclaimer?: string;
  };
}

/**
 * En el orden en que se muestran; los destacados salen en el inicio en este mismo orden.
 * Las secciones del detalle sin contenido confirmado se omiten y no se muestran.
 * Ningún proyecto tiene demo por ahora: demoUrl queda en null.
 */
export const projects: SeedProject[] = [
  {
    slug: 'appfut',
    featured: true,
    inProgress: true,
    team: 'GROUP',
    origin: 'PERSONAL',
    startDate: null,
    endDate: null,
    stack: [
      'Next.js 16',
      'React 19',
      'TypeScript',
      'Tailwind',
      'Supabase (Postgres, Auth, Storage, RLS)',
      'Vitest',
    ],
    repoUrl: 'https://github.com/DavoSagha/appfut',
    skills: ['TypeScript', 'React', 'Next.js', 'PostgreSQL', 'Supabase'],
    es: {
      title: 'appFut',
      summary:
        'PWA mobile first para organizar partidos de fútbol, con gestión de jugadores, pagos y suplentes.',
      role: 'Desarrollé la interfaz, la creación de partidos con código y link de invitación, y el inicio de sesión con Google. El flujo para sumarse, darse de baja o cambiar de equipo lo hicimos en conjunto.',
    },
  },
  {
    slug: 'carta-digital-catedral-del-pisco',
    featured: true,
    inProgress: false,
    team: 'GROUP',
    origin: 'PERSONAL',
    startDate: null,
    endDate: null,
    stack: ['React 19', 'Vite', 'Express', 'Supabase', 'API de Gemini'],
    repoUrl: 'https://github.com/DavoSagha/menucatedralpisco',
    skills: ['React', 'Express', 'Supabase'],
    es: {
      title: 'Carta digital para La Catedral del Pisco',
      summary:
        'Carta digital en español, inglés, portugués y ruso, con panel de administración y asistente de chat con IA.',
      role: '',
      disclaimer:
        'Proyecto personal ofrecido al restaurante. No fue contratado ni implementado, y no tiene afiliación con La Catedral del Pisco.',
    },
  },
  {
    slug: 'sweet-medical',
    featured: false,
    inProgress: false,
    team: 'GROUP',
    origin: 'ACADEMIC',
    startDate: '2026-03-01',
    endDate: '2026-07-01',
    stack: ['Express', 'Arquitectura por capas', 'Zod', 'Endpoints REST'],
    repoUrl: null,
    skills: ['Express', 'Zod', 'APIs REST'],
    es: {
      title: 'Sweet Medical',
      summary: 'Plataforma de gestión de turnos médicos.',
      role: 'Implementé la paginación de turnos, que antes se cargaban en una lista interminable, y una vista de administración para agregar o eliminar doctores y pacientes.',
      context: 'Proyecto académico de UTN FRBA, de marzo a julio de 2026.',
    },
  },
  {
    slug: 'simulador-sistema-operativo',
    featured: false,
    inProgress: false,
    team: 'GROUP',
    origin: 'ACADEMIC',
    startDate: '2025-03-01',
    endDate: '2025-07-01',
    stack: ['Go'],
    repoUrl: null,
    skills: ['Go'],
    es: {
      title: 'Simulador de sistema operativo',
      summary: 'Simulador de un sistema operativo desarrollado en Go.',
      role: 'Desarrollé el módulo de CPU que interpreta y ejecuta instrucciones assembler, y resolví la deserialización de las instrucciones enviadas por el scheduler.',
      context: 'Proyecto académico de UTN, de marzo a julio de 2025.',
    },
  },
  {
    slug: 'formacion-mainframe',
    featured: true,
    inProgress: false,
    team: 'INDIVIDUAL',
    origin: 'ACADEMIC',
    startDate: '2025-05-01',
    endDate: '2025-11-01',
    stack: ['COBOL', 'CICS', 'JCL', 'SORT', 'IDCAMS', 'QSAM', 'VSAM'],
    repoUrl: null,
    skills: ['COBOL (z/OS, OS/390, Batch, CICS)', 'JCL', 'SORT', 'IDCAMS', 'QSAM', 'VSAM'],
    es: {
      title: 'Formación mainframe',
      summary:
        'Rutinas COBOL Batch y CICS, reportes por consola y spool, JCL con SORT/IDCAMS y control de MAXCC, y archivos QSAM/VSAM.',
      role: 'Diseñé rutinas en COBOL (Batch y CICS) con reportes por consola y spool. Ejecuté JCL con los utilitarios SORT e IDCAMS y control de MAXCC, gestionando archivos QSAM y VSAM.',
      context: 'Formación de Codeki y UBA, de mayo a noviembre de 2025.',
    },
  },
];

interface SeedTimelineEntry {
  type: TimelineType;
  organization: string;
  startDate: string;
  endDate: string | null;
  datePrecision: DatePrecision;
  relatedProjectSlug?: string;
  credentialUrl?: string;
  es: { title: string; description: string | null };
}

export const timeline: SeedTimelineEntry[] = [
  {
    type: 'EXPERIENCE',
    organization: 'UTN FRBA, Grupo de Investigación',
    startDate: '2026-03-01',
    endDate: null,
    datePrecision: 'MONTH',
    es: {
      title: 'Becario de investigación',
      description:
        'Recolección, depuración y estructuración de datasets académicos para su análisis cuantitativo.\nSistematización de documentación técnica y apoyo en la adopción de dinámicas ágiles.',
    },
  },
  {
    type: 'EXPERIENCE',
    organization: 'Nilo Joyería',
    startDate: '2021-01-01',
    endDate: null,
    datePrecision: 'MONTH',
    es: {
      title: 'Community manager y gestión de datos',
      description:
        'Desarrollé scripts en Python para recopilar unos 10.000 comentarios y sortear entre los participantes de un concurso, sin pagar una herramienta externa.\nIntegración y sincronización de catálogos de productos entre Meta Business y plataformas de eCommerce.\nAnálisis, edición y creación de contenido para redes con Canva, CapCut y Nano Banana Pro.',
    },
  },
  {
    type: 'EXPERIENCE',
    organization: 'UTN FRBA, Área Administrativa',
    startDate: '2023-03-01',
    endDate: '2023-12-01',
    datePrecision: 'MONTH',
    es: {
      title: 'Data entry',
      description:
        'Digitalización, control de consistencia e ingreso de registros operativos en planillas de Excel.',
    },
  },
  {
    type: 'EDUCATION',
    organization: 'UTN FRBA',
    startDate: '2021-01-01',
    endDate: null,
    datePrecision: 'YEAR',
    es: { title: 'Ingeniería en Sistemas de Información', description: '3.º año en curso.' },
  },
  {
    type: 'CERTIFICATION',
    organization: 'Codeki y FCE UBA',
    startDate: '2025-01-01',
    endDate: null,
    datePrecision: 'YEAR',
    relatedProjectSlug: 'formacion-mainframe',
    credentialUrl:
      'https://drive.google.com/file/d/1fk_aOGq2wCDEs-UndfYrxwjNYR7OWHsO/view?usp=sharing',
    es: { title: 'Desarrollador COBOL (Batch y CICS)', description: null },
  },
  {
    type: 'CERTIFICATION',
    organization: 'Argentina Programa 4.0',
    credentialUrl:
      'https://drive.google.com/file/d/13-pi0aX3MFWJyRDlJfcQO8mluaVd_qJ_/view?usp=sharing',
    startDate: '2023-01-01',
    endDate: null,
    datePrecision: 'YEAR',
    es: { title: 'Desarrollador Full Stack Junior', description: null },
  },
];

export const languages: { code: string; level: LanguageLevel; name: string }[] = [
  { code: 'es', level: 'NATIVE', name: 'Español' },
  { code: 'fr', level: 'B2', name: 'Francés' },
  { code: 'en', level: 'B1', name: 'Inglés' },
  { code: 'ru', level: 'B1', name: 'Ruso' },
];
