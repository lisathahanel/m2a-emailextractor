import { MailCheck } from 'lucide-react';

interface HeaderProps {
  onJumpToValidator: () => void;
  onSelectWorkspaceTab: (tab: 'all' | 'extractor' | 'validator' | 'formatter' | 'domains') => void;
}

export function Header({ onJumpToValidator, onSelectWorkspaceTab }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-900 text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3 sm:px-6">
        <a
          href="#top"
          onClick={() => onSelectWorkspaceTab('all')}
          className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400 rounded"
        >
          EmailVerify Suite
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
        >
          <a
            href="#extractor"
            onClick={() => onSelectWorkspaceTab('all')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Extractor
          </a>
          <a
            href="#validator"
            onClick={() => onSelectWorkspaceTab('all')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Validator
          </a>
          <a
            href="#formatter"
            onClick={() => onSelectWorkspaceTab('all')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Formatter
          </a>
          <a
            href="#domain-extractor"
            onClick={() => onSelectWorkspaceTab('all')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Domains
          </a>
          <a
            href="#more-tools"
            onClick={() => onSelectWorkspaceTab('all')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Utilities
          </a>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onJumpToValidator}
            className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MailCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Validate Email
          </button>
        </div>
      </div>
    </header>
  );
}
