import type {
  DatePrecision,
  LanguageLevel,
  ProjectOrigin,
  ProjectTeam,
  TimelineType,
} from '../generated/prisma/enums.js';
import { todo } from './placeholder.js';

/*
 * Contenido inicial. Solo datos confirmados; lo que falta va como `todo(...)` o null
 * (ver docs/pendientes.md). Sin datos personales sensibles (DNI, teléfono, dirección).
 */

export const profile = {
  fullName: 'David Saghatelyan',
  location: 'CABA, Argentina',
  linkedinUrl: 'https://www.linkedin.com/in/david-saghatelyan',
  githubUrl: 'https://github.com/DavoSagha',
  publicEmail: null,
  showEmail: false,
  es: {
    headline: 'Backend Developer Jr · JavaScript/TypeScript · Go · COBOL',
    valueProp: todo('frase de valor'),
    summary: todo('resumen profesional'),
    availability: todo('disponibilidad'),
  },
};

/** Las skills se cargan sin nivel y ocultas hasta que se confirme cada una. */
export const skillCategories: { name: string; skills: string[] }[] = [
  {
    name: 'Backend',
    skills: [
      'JavaScript',
      'TypeScript',
      'Node.js',
      'Express',
      'Zod',
      'Go',
      'Java',
      'Spring Boot',
      'APIs REST',
      'POO',
      'MVC',
    ],
  },
  {
    name: 'Mainframe',
    skills: ['COBOL (z/OS, OS/390, Batch, CICS)', 'JCL', 'TSO/ISPF', 'QSAM', 'VSAM'],
  },
  { name: 'Bases de datos', skills: ['SQL', 'MySQL', 'DB2'] },
  { name: 'Lenguajes de sistemas y scripting', skills: ['C', 'Python'] },
  {
    name: 'Análisis y modelado',
    skills: ['UML', 'DER', 'Cursogramas', 'Especificación de requerimientos'],
  },
  {
    name: 'Herramientas y soporte',
    skills: ['Linux/Bash', 'Git', 'Docker', 'Scrum', 'Diagnóstico y mantenimiento de hardware'],
  },
];

interface SeedProject {
  slug: string;
  team: ProjectTeam | null;
  origin: ProjectOrigin | null;
  startDate: string | null;
  endDate: string | null;
  skills: string[];
  es: {
    title: string;
    summary: string;
    role: string;
    context: string;
    problem: string;
    solution: string;
    architecture: string;
    decisions: string;
    challenges: string;
    learnings: string;
    limitations?: string;
    disclaimer?: string;
  };
}

const pendingDetail = {
  problem: todo('problema'),
  solution: todo('solución'),
  architecture: todo('arquitectura'),
  decisions: todo('decisiones'),
  challenges: todo('dificultades'),
  learnings: todo('aprendizajes'),
};

/** En el orden en que se muestran. demoUrl y repoUrl quedan en null hasta tenerlos. */
export const projects: SeedProject[] = [
  {
    slug: 'appfut',
    team: 'GROUP',
    origin: null,
    startDate: null,
    endDate: null,
    skills: [],
    es: {
      ...pendingDetail,
      title: 'appFut',
      summary:
        'PWA mobile first para organizar partidos de fútbol, con gestión de jugadores, pagos y suplentes.',
      role: 'Desarrollada con un amigo. Mi aporte: la interfaz, la creación de partidos con código y link de invitación, el acceso solo con el nombre para sumarse, darse de baja o cambiar de equipo desde cualquier dispositivo, y el inicio de sesión con Google.',
      context: todo('contexto y stack'),
      decisions:
        'Acceso solo con el nombre: una decisión para reducir la fricción al sumarse a un partido.',
      challenges: 'El inicio de sesión con Google fue la parte más compleja.',
      limitations: 'El acceso solo con el nombre no verifica la identidad de quien se suma.',
    },
  },
  {
    slug: 'menu-digital',
    team: null,
    origin: 'PERSONAL',
    startDate: null,
    endDate: null,
    skills: [],
    es: {
      ...pendingDetail,
      title: 'Menú digital',
      summary: 'PWA de menú digital con soporte multilenguaje y asistente de chat con IA.',
      role: 'Lo desarrollé y se lo ofrecí a la cadena por iniciativa propia.',
      context: todo('contexto y stack'),
      disclaimer:
        'Proyecto personal sin afiliación con ninguna marca. No fue contratado ni implementado por ninguna empresa.',
    },
  },
  {
    slug: 'sweet-medical',
    team: null,
    origin: 'ACADEMIC',
    startDate: '2026-03-01',
    endDate: '2026-07-01',
    skills: ['Express', 'Zod', 'APIs REST'],
    es: {
      ...pendingDetail,
      title: 'Sweet Medical',
      summary: 'Plataforma de gestión de turnos médicos.',
      role: 'Controladores y servicios en Express, arquitectura por capas, validaciones con Zod y endpoints REST.',
      context: 'Proyecto académico de UTN FRBA, de marzo a julio de 2026.',
    },
  },
  {
    slug: 'simulador-sistema-operativo',
    team: null,
    origin: 'ACADEMIC',
    startDate: '2025-03-01',
    endDate: '2025-07-01',
    skills: ['Go'],
    es: {
      ...pendingDetail,
      title: 'Simulador de sistema operativo',
      summary: 'Simulador de un sistema operativo desarrollado en Go.',
      role: 'Módulo de CPU que interpreta y ejecuta instrucciones assembler, incluida la deserialización de las instrucciones enviadas por el scheduler.',
      context: 'Proyecto académico de UTN, de marzo a julio de 2025.',
    },
  },
  {
    slug: 'formacion-mainframe',
    team: null,
    origin: 'ACADEMIC',
    startDate: '2025-05-01',
    endDate: '2025-11-01',
    skills: ['COBOL (z/OS, OS/390, Batch, CICS)', 'JCL', 'QSAM', 'VSAM'],
    es: {
      ...pendingDetail,
      title: 'Formación mainframe',
      summary:
        'Rutinas COBOL Batch y CICS, reportes por consola y spool, JCL con SORT/IDCAMS y control de MAXCC, y archivos QSAM/VSAM.',
      role: todo('rol'),
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
        'Recolección, depuración y estructuración de datasets académicos; documentación técnica y apoyo en dinámicas ágiles.',
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
        'Scripts en Python para recopilar unos 10.000 comentarios y sortear entre los participantes de un concurso, sin pagar una herramienta externa; integración de catálogos entre Meta Business y plataformas de eCommerce; contenido para redes.',
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
      description: 'Digitalización, control de consistencia y carga de registros en Excel.',
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
    es: { title: 'Desarrollador COBOL (Batch y CICS)', description: null },
  },
  {
    type: 'CERTIFICATION',
    organization: 'Argentina Programa 4.0',
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
