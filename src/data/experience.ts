interface ExperienceEntry {
  role: string;
  organization?: string;
  period: string;
  description: readonly string[];
  stack?: readonly string[];
}

export const experience: readonly ExperienceEntry[] = [
  {
    role: 'Independent developer (freelance)',
    organization: 'madebygio.dev',
    period: '2026 - now',
    description: ['Design, build and deploy my own products, each live on its own domain.'],
  },
  {
    role: 'Full-stack developer',
    organization: 'An online booking platform for sports venues',
    period: 'Feb 2025 - Sep 2026',
    description: [
      'Worked on a Georgian platform for booking football pitches, tennis courts and bowling lanes online, with live availability, card payment and SMS confirmation.',
      'Built landing pages and popup modals, worked on backend features and fixed bugs across the stack.',
    ],
    stack: ['Next.js', 'MUI', 'Laravel', 'PHP'],
  },
  {
    role: 'Developer under senior mentorship',
    period: '2024',
    description: ['Completed web development tasks with guidance and review from a senior developer.'],
  },
];

interface EducationEntry {
  name: string;
  detail: string;
  href?: string;
}

export const education: readonly EducationEntry[] = [
  {
    name: 'The Complete 2024 Web Development Bootcamp',
    detail: 'Udemy, Dr. Angela Yu, 61.5 hours, Jul 2024',
    href: 'https://ude.my/UC-830e1231-341a-42cf-b090-92af0cb4b624',
  },
  {
    name: 'Mziuri programming school',
    detail: 'C++, algorithms, programming contests, from 2019',
  },
];
