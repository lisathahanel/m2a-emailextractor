import { useMemo, useRef, useState } from 'react';
import {
  Globe,
  LayoutGrid,
  MailCheck,
  MailSearch,
  Wand2,
  Wrench,
} from 'lucide-react';
import { AdSenseUnit } from './components/AdSenseUnit';
import { DomainExtractor } from './components/DomainExtractor';
import { EmailExtractor } from './components/EmailExtractor';
import { EmailFormatter } from './components/EmailFormatter';
import { EmailValidator } from './components/EmailValidator';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { MoreEmailTools } from './components/MoreEmailTools';
import { PrivacyNotice } from './components/PrivacyNotice';
import { extractDomainsFromEmails } from './utils/emailTools';

type WorkspaceTab = 'all' | 'extractor' | 'validator' | 'formatter' | 'domains' | 'utilities';

export default function App() {
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('all');
  const [extractedEmails, setExtractedEmails] = useState<string[]>([]);
  const [formattedCount, setFormattedCount] = useState<number>(0);
  const [validatorRequest, setValidatorRequest] = useState<{
    email: string;
    triggerId: number;
  } | null>(null);
  const [bulkValidatorRequest, setBulkValidatorRequest] = useState<{
    emails: string[];
    triggerId: number;
  } | null>(null);
  const validatorContainerRef = useRef<HTMLDivElement>(null);

  const uniqueDomainsCount = useMemo(
    () => extractDomainsFromEmails(extractedEmails).length,
    [extractedEmails]
  );

  const scrollToValidator = (focusSingleInput = true) => {
    if (activeWorkspaceTab !== 'all' && activeWorkspaceTab !== 'validator') {
      setActiveWorkspaceTab('validator');
    }
    setTimeout(() => {
      validatorContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (focusSingleInput) {
        setTimeout(() => {
          const input = document.getElementById('validator-email-input') as HTMLInputElement | null;
          input?.focus({ preventScroll: true });
        }, 300);
      }
    }, 40);
  };

  const handleSendToValidator = (email: string) => {
    setValidatorRequest({ email, triggerId: Date.now() });
    scrollToValidator(true);
  };

  const handleValidateAll = (emails: string[]) => {
    if (emails.length === 0) return;
    setBulkValidatorRequest({ emails, triggerId: Date.now() });
    scrollToValidator(false);
  };

  const workspaceTabs: Array<{
    id: WorkspaceTab;
    label: string;
    Icon: typeof LayoutGrid;
  }> = [
    { id: 'all', label: 'All Tools', Icon: LayoutGrid },
    { id: 'extractor', label: 'Email Extractor', Icon: MailSearch },
    { id: 'validator', label: 'Address Validator', Icon: MailCheck },
    { id: 'formatter', label: 'Email Formatter', Icon: Wand2 },
    { id: 'domains', label: 'Domain Extractor', Icon: Globe },
    { id: 'utilities', label: 'More Utilities', Icon: Wrench },
  ];

  const showSection = (section: Exclude<WorkspaceTab, 'all'>) =>
    activeWorkspaceTab === 'all' || activeWorkspaceTab === section;

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F4F6F8] text-slate-900">
      <Header
        onJumpToValidator={() => scrollToValidator(true)}
        onSelectWorkspaceTab={(tab) => setActiveWorkspaceTab(tab)}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        {/* Compact App Hero & Workspace Bar */}
        <section className="rounded-xl border border-slate-200/90 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Email Extraction, Formatting &amp; Verification Suite
              </h1>
              <p className="text-sm text-slate-600 max-w-2xl">
                Extract unique addresses, normalize messy lists, inspect domains, and verify
                deliverability discreetly in real time.
              </p>
            </div>

            {/* Live Session Counters (purely real state) */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 tabular-nums shrink-0 border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0">
              <div>
                <span className="block text-slate-400">Extracted</span>
                <strong className="font-mono text-sm font-semibold text-slate-900">
                  {extractedEmails.length}
                </strong>
              </div>
              <div className="h-6 w-px bg-slate-200" aria-hidden="true" />
              <div>
                <span className="block text-slate-400">Domains</span>
                <strong className="font-mono text-sm font-semibold text-slate-900">
                  {uniqueDomainsCount}
                </strong>
              </div>
              <div className="h-6 w-px bg-slate-200" aria-hidden="true" />
              <div>
                <span className="block text-slate-400">Formatted</span>
                <strong className="font-mono text-sm font-semibold text-slate-900">
                  {formattedCount}
                </strong>
              </div>
            </div>
          </div>

          <PrivacyNotice />

          {/* App Workspace Tool Switcher */}
          <div
            role="tablist"
            aria-label="Workspace tool filter"
            className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5"
          >
            {workspaceTabs.map(({ id, label, Icon }) => {
              const active = activeWorkspaceTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveWorkspaceTab(id)}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Main 2-Column App Workspace: Tools on Left, Sticky Advertisement & Quick Jump Rail on Right */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Primary Tool Workbench */}
          <div className="min-w-0 flex-1 space-y-8 order-2 lg:order-1">
            {showSection('extractor') && (
              <EmailExtractor
                onValidateEmail={handleSendToValidator}
                onValidateAll={handleValidateAll}
                onExtractedChange={setExtractedEmails}
              />
            )}

            {showSection('validator') && (
              <div ref={validatorContainerRef}>
                <EmailValidator
                  externalEmailRequest={validatorRequest}
                  externalBulkRequest={bulkValidatorRequest}
                  extractedEmails={extractedEmails}
                />
              </div>
            )}

            {showSection('formatter') && (
              <EmailFormatter
                extractedEmails={extractedEmails}
                onFormattedCountChange={setFormattedCount}
              />
            )}

            {showSection('domains') && <DomainExtractor extractedEmails={extractedEmails} />}

            {showSection('utilities') && <MoreEmailTools />}
          </div>

          {/* Sticky Right Rail: Keeps Advertisement positioned high and visible across every action */}
          <div className="w-full shrink-0 space-y-4 order-1 lg:order-2 lg:w-[290px] xl:w-[310px] lg:sticky lg:top-[76px]">
            <AdSenseUnit />

            <div className="hidden lg:block rounded-xl border border-slate-200/90 bg-white p-4 space-y-3">
              <h2 className="text-xs font-semibold text-slate-900">Quick Tool Jump</h2>
              <div className="divide-y divide-slate-100 text-xs">
                {[
                  { id: 'extractor' as const, name: 'Email Extractor', note: 'Up to 100k chars' },
                  { id: 'validator' as const, name: 'Address Validator', note: 'Single & Bulk CSV' },
                  { id: 'formatter' as const, name: 'Email Formatter', note: 'Clean & sort A–Z' },
                  { id: 'domains' as const, name: 'Domain Extractor', note: 'Count unique hosts' },
                  { id: 'utilities' as const, name: 'More Utilities', note: 'Shield & Mailto' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveWorkspaceTab(item.id)}
                    className={`flex w-full items-center justify-between py-2 text-left transition-colors cursor-pointer ${
                      activeWorkspaceTab === item.id
                        ? 'font-semibold text-sky-700'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <span>{item.name}</span>
                    <span className="text-slate-400">{item.note}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
