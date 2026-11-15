export type ToolRoute = 'all' | 'extractor' | 'validator' | 'formatter' | 'domains' | 'utilities';

export interface RouteConfig {
  id: ToolRoute;
  path: string;
  label: string;
  title: string;
}

export const ROUTES: RouteConfig[] = [
  {
    id: 'all',
    path: '/',
    label: 'All Tools',
    title: 'Email Extractor & Address Validator — Free Online Email Tools',
  },
  {
    id: 'extractor',
    path: '/extractor',
    label: 'Email Extractor',
    title: 'Email Extractor — Free Online Email Tools',
  },
  {
    id: 'validator',
    path: '/validator',
    label: 'Address Validator',
    title: 'Email Address Validator — Free Online Email Tools',
  },
  {
    id: 'formatter',
    path: '/formatter',
    label: 'Email Formatter',
    title: 'Email Formatter — Free Online Email Tools',
  },
  {
    id: 'domains',
    path: '/domains',
    label: 'Domain Extractor',
    title: 'Domain Extractor — Free Online Email Tools',
  },
  {
    id: 'utilities',
    path: '/utilities',
    label: 'More Utilities',
    title: 'More Free Email Utilities — Free Online Email Tools',
  },
];

const HASH_TO_PATH: Record<string, string> = {
  '#extractor': '/extractor',
  '#validator': '/validator',
  '#formatter': '/formatter',
  '#domain-extractor': '/domains',
  '#domains': '/domains',
  '#more-tools': '/utilities',
  '#utilities': '/utilities',
};

export function resolveRouteFromLocation(): RouteConfig {
  const { pathname, hash } = window.location;
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';

  if (normalizedPath === '/' && hash && HASH_TO_PATH[hash]) {
    const targetPath = HASH_TO_PATH[hash];
    window.history.replaceState({}, '', targetPath);
    return ROUTES.find((r) => r.path === targetPath) ?? ROUTES[0];
  }

  return ROUTES.find((r) => r.path === normalizedPath) ?? ROUTES[0];
}

export function isModifiedClick(e: React.MouseEvent<HTMLAnchorElement>): boolean {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}
