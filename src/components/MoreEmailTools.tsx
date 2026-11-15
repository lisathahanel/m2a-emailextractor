import { useMemo, useState } from 'react';
import { Check, Copy, EyeOff, Link2 } from 'lucide-react';
import {
  buildMailtoUrl,
  defangEmail,
  obfuscateEmailHtmlEntities,
} from '../utils/emailTools';

type ActiveToolTab = 'obfuscator' | 'mailto';

export function MoreEmailTools() {
  const [activeTab, setActiveTab] = useState<ActiveToolTab>('obfuscator');

  // Tool 1: Email Obfuscator
  const [obfuscateInput, setObfuscateInput] = useState('contact@yourdomain.com');
  const [copiedObfKey, setCopiedObfKey] = useState<string | null>(null);

  const entityEncoded = useMemo(
    () => obfuscateEmailHtmlEntities(obfuscateInput.trim()),
    [obfuscateInput]
  );
  const defangedText = useMemo(() => defangEmail(obfuscateInput.trim()), [obfuscateInput]);
  const htmlAnchorSnippet = useMemo(() => {
    if (!obfuscateInput.trim()) return '';
    return `<a href="mailto:${entityEncoded}">${entityEncoded}</a>`;
  }, [obfuscateInput, entityEncoded]);

  // Tool 2: Mailto Link Builder
  const [mailtoTo, setMailtoTo] = useState('hello@company.com');
  const [mailtoCc, setMailtoCc] = useState('');
  const [mailtoBcc, setMailtoBcc] = useState('');
  const [mailtoSubject, setMailtoSubject] = useState('Partnership Inquiry');
  const [mailtoBody, setMailtoBody] = useState('Hi team,\n\nI would like to connect regarding...');
  const [copiedMailto, setCopiedMailto] = useState(false);

  const generatedMailto = useMemo(
    () =>
      buildMailtoUrl({
        to: mailtoTo,
        cc: mailtoCc,
        bcc: mailtoBcc,
        subject: mailtoSubject,
        body: mailtoBody,
      }),
    [mailtoTo, mailtoCc, mailtoBcc, mailtoSubject, mailtoBody]
  );

  const copyText = async (text: string, onSuccess: () => void) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      onSuccess();
    } catch {
      // Ignore clipboard failures in restricted frames
    }
  };

  return (
    <section id="more-tools" aria-labelledby="more-tools-heading" className="scroll-mt-20">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="more-tools-heading"
            className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
          >
            More Free Email Utilities
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Protect published addresses from scraper bots and generate properly encoded mailto
            links.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Additional email utilities"
          className="inline-flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 self-start sm:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'obfuscator'}
            onClick={() => setActiveTab('obfuscator')}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'obfuscator'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            Bot Obfuscator
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'mailto'}
            onClick={() => setActiveTab('mailto')}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'mailto'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            Mailto Builder
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/90 bg-white p-5 sm:p-6">
        {activeTab === 'obfuscator' && (
          <div className="space-y-5">
            <div className="max-w-xl">
              <label
                htmlFor="obfuscate-email-input"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Email Address to Protect from Scraper Bots
              </label>
              <input
                id="obfuscate-email-input"
                type="email"
                value={obfuscateInput}
                onChange={(e) => setObfuscateInput(e.target.value)}
                placeholder="contact@yourdomain.com"
                className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                {
                  key: 'defang',
                  title: 'Human-Readable Safe Text',
                  desc: 'Prevents plain-text email harvesters on blogs or bios.',
                  value: defangedText,
                },
                {
                  key: 'entities',
                  title: 'HTML Decimal Entities',
                  desc: 'Browsers render it normally; basic regex bots miss it.',
                  value: entityEncoded,
                },
                {
                  key: 'anchor',
                  title: 'Obfuscated HTML Link',
                  desc: 'Drop straight into static websites or footer templates.',
                  value: htmlAnchorSnippet,
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">{item.desc}</p>
                    <pre className="mt-3 overflow-x-auto rounded border border-slate-200 bg-white p-2.5 font-mono text-xs text-slate-800 whitespace-pre-wrap break-all">
                      {item.value || 'Enter an email above'}
                    </pre>
                  </div>
                  <button
                    type="button"
                    disabled={!item.value}
                    onClick={() =>
                      copyText(item.value, () => {
                        setCopiedObfKey(item.key);
                        setTimeout(() => setCopiedObfKey(null), 1600);
                      })
                    }
                    className="mt-3 inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-45 cursor-pointer"
                  >
                    {copiedObfKey === item.key ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                        Copy Snippet
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'mailto' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="mailto-to" className="block text-xs font-semibold text-slate-700 mb-1">
                  Recipient (To)
                </label>
                <input
                  id="mailto-to"
                  type="text"
                  value={mailtoTo}
                  onChange={(e) => setMailtoTo(e.target.value)}
                  placeholder="hello@company.com"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="mailto-cc" className="block text-xs font-semibold text-slate-700 mb-1">
                  CC (optional)
                </label>
                <input
                  id="mailto-cc"
                  type="text"
                  value={mailtoCc}
                  onChange={(e) => setMailtoCc(e.target.value)}
                  placeholder="team@company.com"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="mailto-bcc" className="block text-xs font-semibold text-slate-700 mb-1">
                  BCC (optional)
                </label>
                <input
                  id="mailto-bcc"
                  type="text"
                  value={mailtoBcc}
                  onChange={(e) => setMailtoBcc(e.target.value)}
                  placeholder="archive@company.com"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:bg-white focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="mailto-subject"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Subject Line
                </label>
                <input
                  id="mailto-subject"
                  type="text"
                  value={mailtoSubject}
                  onChange={(e) => setMailtoSubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900 focus:border-sky-600 focus:bg-white focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="mailto-body"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Message Body
                </label>
                <textarea
                  id="mailto-body"
                  rows={4}
                  value={mailtoBody}
                  onChange={(e) => setMailtoBody(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-900 focus:border-sky-600 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div>
                <h3 className="text-xs font-semibold text-slate-800">
                  Generated URI-Encoded Mailto Link
                </h3>
                <pre className="mt-2.5 max-h-52 overflow-y-auto rounded border border-slate-200 bg-white p-3 font-mono text-xs text-slate-800 whitespace-pre-wrap break-all">
                  {generatedMailto}
                </pre>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={!mailtoTo.trim()}
                  onClick={() =>
                    copyText(generatedMailto, () => {
                      setCopiedMailto(true);
                      setTimeout(() => setCopiedMailto(false), 1600);
                    })
                  }
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-45 cursor-pointer"
                >
                  {copiedMailto ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Copied URL
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      Copy Mailto Link
                    </>
                  )}
                </button>
                <a
                  href={generatedMailto}
                  className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Open in Mail App
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
