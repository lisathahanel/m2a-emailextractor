import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import nodemailer from 'nodemailer';
import dns from 'node:dns/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username?: string;
  password?: string;
}

interface ApiConfig {
  provider: 'resend' | 'sendgrid' | 'brevo' | 'postmark' | 'custom';
  endpointUrl: string;
  authHeaderName: string;
  authToken: string;
}

interface SendOnePayload {
  mode: 'smtp' | 'api';
  smtp?: SmtpConfig;
  api?: ApiConfig;
  fromName?: string;
  fromEmail: string;
  replyTo?: string;
  to: string;
  subject: string;
  html?: string;
  text: string;
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Verify user's SMTP credentials without storing them
  app.post('/api/campaign/test-smtp', async (req: Request, res: Response) => {
    const body = req.body as Partial<SmtpConfig>;
    if (!body.host || !body.port) {
      res.status(400).json({ ok: false, error: 'SMTP host and port are required.' });
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: body.host.trim(),
        port: Number(body.port),
        secure: Boolean(body.secure),
        auth: body.username?.trim()
          ? {
              user: body.username.trim(),
              pass: body.password ?? '',
            }
          : undefined,
        connectionTimeout: 9000,
        greetingTimeout: 9000,
        socketTimeout: 10000,
      });

      await transporter.verify();
      res.json({
        ok: true,
        message: `Connected and authenticated to ${body.host.trim()}:${Number(body.port)}.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to connect to SMTP server.';
      res.status(400).json({ ok: false, error: message });
    }
  });

  // Discreetly verify From Email domain DNS (MX / SPF / DMARC) & SMTP username alignment
  app.post('/api/campaign/verify-sender', async (req: Request, res: Response) => {
    const body = req.body as {
      fromEmail?: string;
      smtpUsername?: string;
      smtpHost?: string;
    };

    const email = (body.fromEmail ?? '').trim().toLowerCase();
    const smtpUser = (body.smtpUsername ?? '').trim().toLowerCase();
    const smtpHost = (body.smtpHost ?? '').trim().toLowerCase();

    const emailRegex = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
    if (!email || !emailRegex.test(email)) {
      res.status(400).json({
        ok: false,
        error: 'Enter a valid From Email address before verifying.',
      });
      return;
    }

    const domain = email.split('@')[1] ?? '';
    const smtpUserIsEmail = emailRegex.test(smtpUser);
    const matchesSmtpUser = smtpUserIsEmail && email === smtpUser;
    const sameDomainAsSmtpUser =
      smtpUserIsEmail && (smtpUser.split('@')[1] ?? '') === domain;

    const withTimeout = async <T,>(promise: Promise<T>, fallback: T): Promise<T> => {
      try {
        return await Promise.race([
          promise,
          new Promise<T>((resolve) => setTimeout(() => resolve(fallback), 4500)),
        ]);
      } catch {
        return fallback;
      }
    };

    const mxRecords = await withTimeout(dns.resolveMx(domain), []);
    const hasMx = Array.isArray(mxRecords) && mxRecords.length > 0;

    if (!hasMx) {
      res.status(400).json({
        ok: false,
        email,
        domain,
        hasMx: false,
        hasSpf: false,
        hasDmarc: false,
        matchesSmtpUser,
        sameDomainAsSmtpUser,
        error: `Domain "${domain}" has no valid MX mail records. Use a real sending domain or your SMTP Username.`,
      });
      return;
    }

    const rootTxt = await withTimeout(dns.resolveTxt(domain), []);
    const hasSpf = rootTxt.some((chunks) =>
      chunks.join('').toLowerCase().includes('v=spf1')
    );

    const dmarcTxt = await withTimeout(dns.resolveTxt(`_dmarc.${domain}`), []);
    const hasDmarc = dmarcTxt.some((chunks) =>
      chunks.join('').toLowerCase().includes('v=dmarc1')
    );

    const isRelayHost =
      smtpHost.includes('sendgrid') ||
      smtpHost.includes('smtp.com') ||
      smtpHost.includes('amazonaws');

    const dnsParts = [
      'MX verified',
      hasSpf ? 'SPF found' : 'SPF missing',
      hasDmarc ? 'DMARC found' : 'DMARC missing',
    ].join(' · ');

    const relayNote = isRelayHost
      ? ' Ensure this sender is also authorized in your SendGrid / SMTP.com / SES dashboard.'
      : '';

    res.json({
      ok: true,
      email,
      domain,
      hasMx,
      hasSpf,
      hasDmarc,
      matchesSmtpUser,
      sameDomainAsSmtpUser,
      message: `Sender ${email} verified (${dnsParts}).${relayNote}`,
    });
  });

  // Proxy third-party email verification API checks (never persists API keys)
  app.post('/api/campaign/verify-recipient', async (req: Request, res: Response) => {
    const body = req.body as {
      provider?: string;
      apiKey?: string;
      customEndpoint?: string;
      email?: string;
    };

    const provider = (body.provider ?? 'zerobounce').trim().toLowerCase();
    const apiKey = (body.apiKey ?? '').trim();
    const email = (body.email ?? '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      res.status(400).json({ ok: false, error: 'A valid recipient email address is required.' });
      return;
    }

    if (!apiKey && provider !== 'custom') {
      res.status(400).json({ ok: false, error: 'Verification API key is required.' });
      return;
    }

    const isSafeExternalHttpsUrl = (rawUrl: string): boolean => {
      try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== 'https:') return false;
        const host = parsed.hostname.toLowerCase();
        if (
          host === 'localhost' ||
          host === '127.0.0.1' ||
          host === '0.0.0.0' ||
          host === '::1' ||
          host.startsWith('10.') ||
          host.startsWith('192.168.') ||
          host.startsWith('169.254.') ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
          host.endsWith('.local')
        ) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    };

    type NormalizedVerdict = 'Valid' | 'Invalid' | 'Catch-all' | 'Risky' | 'Role-based' | 'Unknown';

    try {
      let targetUrl = '';
      const headers: Record<string, string> = { Accept: 'application/json' };

      if (provider === 'zerobounce') {
        targetUrl = `https://api.zerobounce.net/v2/validate?api_key=${encodeURIComponent(
          apiKey
        )}&email=${encodeURIComponent(email)}`;
      } else if (provider === 'hunter') {
        targetUrl = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(
          email
        )}&api_key=${encodeURIComponent(apiKey)}`;
      } else if (provider === 'neverbounce') {
        targetUrl = `https://api.neverbounce.com/v4/single/check?key=${encodeURIComponent(
          apiKey
        )}&email=${encodeURIComponent(email)}`;
      } else if (provider === 'kickbox') {
        targetUrl = `https://api.kickbox.com/v2/verify?email=${encodeURIComponent(
          email
        )}&apikey=${encodeURIComponent(apiKey)}`;
      } else if (provider === 'abstract') {
        targetUrl = `https://emailvalidation.abstractapi.com/v1/?api_key=${encodeURIComponent(
          apiKey
        )}&email=${encodeURIComponent(email)}`;
      } else if (provider === 'myemailverifier') {
        targetUrl = `https://client.myemailverifier.com/verifier/validate_single/${encodeURIComponent(
          email
        )}/${encodeURIComponent(apiKey)}`;
      } else if (provider === 'custom') {
        const templateUrl = (body.customEndpoint ?? '').trim();
        if (!templateUrl) {
          res.status(400).json({ ok: false, error: 'Custom verification endpoint URL is required.' });
          return;
        }
        let resolvedUrl = templateUrl.replace(/\{email\}/gi, encodeURIComponent(email));
        if (/\{apiKey\}/i.test(resolvedUrl)) {
          resolvedUrl = resolvedUrl.replace(/\{apiKey\}/gi, encodeURIComponent(apiKey));
        } else {
          const joiner = resolvedUrl.includes('?') ? '&' : '?';
          if (!/email=/i.test(resolvedUrl) && !templateUrl.toLowerCase().includes('{email}')) {
            resolvedUrl = `${resolvedUrl}${joiner}email=${encodeURIComponent(email)}`;
          }
          if (apiKey) {
            headers.Authorization = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
          }
        }
        if (!isSafeExternalHttpsUrl(resolvedUrl)) {
          res.status(400).json({
            ok: false,
            error: 'Custom verification URL must be a valid public HTTPS URL.',
          });
          return;
        }
        targetUrl = resolvedUrl;
      } else {
        res.status(400).json({ ok: false, error: `Unsupported verification provider: ${provider}` });
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const apiRes = await fetch(targetUrl, { method: 'GET', headers, signal: controller.signal });
      clearTimeout(timeoutId);

      const rawText = await apiRes.text();
      let data: Record<string, unknown> | null = null;
      try {
        data = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        data = null;
      }

      if (!apiRes.ok) {
        const nestedErrors = Array.isArray(data?.errors)
          ? (data?.errors[0] as Record<string, unknown> | undefined)?.details
          : undefined;
        const errMsg =
          (typeof data?.error === 'string' && data.error) ||
          (typeof data?.message === 'string' && data.message) ||
          (typeof nestedErrors === 'string' && nestedErrors) ||
          `Provider returned HTTP ${apiRes.status}`;
        res.status(502).json({ ok: false, error: errMsg });
        return;
      }

      let deliverability: NormalizedVerdict = 'Unknown';
      let rawStatus = 'unknown';
      let detail = 'Verification check completed';

      if (provider === 'zerobounce' && data) {
        if (typeof data.error === 'string' && data.error) {
          res.status(400).json({ ok: false, error: data.error });
          return;
        }
        const status = String(data.status ?? '').toLowerCase();
        const subStatus = String(data.sub_status ?? '').toLowerCase();
        rawStatus = subStatus ? `${status} (${subStatus})` : status || 'unknown';
        if (status === 'valid') {
          deliverability = 'Valid';
          detail = 'Mailbox confirmed deliverable by ZeroBounce';
        } else if (status === 'invalid' || status === 'spamtrap' || status === 'abuse') {
          deliverability = 'Invalid';
          detail = subStatus ? `ZeroBounce: ${subStatus.replace(/_/g, ' ')}` : 'Undeliverable address';
        } else if (status === 'catch-all') {
          deliverability = 'Catch-all';
          detail = 'Domain accepts all mail (catch-all server)';
        } else if (status === 'do_not_mail') {
          deliverability = subStatus === 'role_based' ? 'Role-based' : 'Risky';
          detail = subStatus ? `Do not mail: ${subStatus.replace(/_/g, ' ')}` : 'Flagged do_not_mail';
        } else {
          deliverability = 'Unknown';
          detail = subStatus ? `Status unknown (${subStatus.replace(/_/g, ' ')})` : 'Status unknown';
        }
      } else if (provider === 'hunter' && data) {
        const payloadData = (data.data as Record<string, unknown> | undefined) ?? data;
        const status = String(payloadData.status ?? '').toLowerCase();
        const score = typeof payloadData.score === 'number' ? payloadData.score : undefined;
        rawStatus = status || 'unknown';
        if (status === 'valid' || status === 'webmail') {
          deliverability = 'Valid';
          detail = score !== undefined ? `Hunter score ${score}/100 (${status})` : `Hunter status: ${status}`;
        } else if (status === 'invalid' || status === 'disposable') {
          deliverability = 'Invalid';
          detail = `Hunter status: ${status}`;
        } else if (status === 'accept_all') {
          deliverability = 'Catch-all';
          detail = score !== undefined ? `Accept-all domain (score ${score}/100)` : 'Accept-all domain';
        } else {
          deliverability = 'Unknown';
          detail = score !== undefined ? `Hunter status: ${status} (score ${score}/100)` : `Hunter status: ${status}`;
        }
      } else if (provider === 'neverbounce' && data) {
        if (data.status && data.status !== 'success') {
          res.status(400).json({
            ok: false,
            error: String(data.message ?? data.status ?? 'NeverBounce verification failed'),
          });
          return;
        }
        const result = String(data.result ?? '').toLowerCase();
        rawStatus = result || 'unknown';
        if (result === 'valid') {
          deliverability = 'Valid';
          detail = 'Confirmed valid by NeverBounce';
        } else if (result === 'invalid' || result === 'disposable') {
          deliverability = 'Invalid';
          detail = `NeverBounce: ${result}`;
        } else if (result === 'catchall') {
          deliverability = 'Catch-all';
          detail = 'Catch-all domain detected by NeverBounce';
        } else {
          deliverability = 'Unknown';
          detail = `NeverBounce: ${result || 'unknown'}`;
        }
      } else if (provider === 'kickbox' && data) {
        if (data.success === false) {
          res.status(400).json({ ok: false, error: String(data.message ?? 'Kickbox API error') });
          return;
        }
        const result = String(data.result ?? '').toLowerCase();
        const reason = String(data.reason ?? '');
        rawStatus = result || 'unknown';
        if (result === 'deliverable') {
          deliverability = data.role === true ? 'Role-based' : 'Valid';
          detail = data.role === true ? 'Deliverable role-based mailbox' : 'Deliverable mailbox (Kickbox)';
        } else if (result === 'undeliverable') {
          deliverability = 'Invalid';
          detail = reason ? `Undeliverable (${reason})` : 'Undeliverable mailbox';
        } else if (result === 'risky') {
          deliverability = data.accept_all === true ? 'Catch-all' : 'Risky';
          detail = reason ? `Risky (${reason})` : 'Flagged risky by Kickbox';
        } else {
          deliverability = 'Unknown';
          detail = reason ? `Unknown (${reason})` : 'Status unknown';
        }
      } else if (provider === 'abstract' && data) {
        const deliv = String(data.deliverability ?? '').toUpperCase();
        rawStatus = deliv || 'UNKNOWN';
        if (deliv === 'DELIVERABLE') {
          deliverability = data.is_role_email && (data.is_role_email as Record<string, unknown>).value === true
            ? 'Role-based'
            : 'Valid';
          detail = 'Deliverable (AbstractAPI)';
        } else if (deliv === 'UNDELIVERABLE') {
          deliverability = 'Invalid';
          detail = 'Undeliverable (AbstractAPI)';
        } else if (deliv === 'RISKY') {
          deliverability = 'Risky';
          detail = 'Risky address (AbstractAPI)';
        } else {
          deliverability = 'Unknown';
          detail = 'Status unknown (AbstractAPI)';
        }
      } else if (provider === 'myemailverifier' && data) {
        const status = String(data.Status ?? data.status ?? '');
        const lower = status.toLowerCase();
        rawStatus = status || 'Unknown';
        if (lower === 'valid') {
          deliverability = data.Role_Based === 'true' ? 'Role-based' : 'Valid';
          detail = String(data.Diagnosis ?? 'Valid mailbox (MyEmailVerifier)');
        } else if (lower === 'invalid') {
          deliverability = 'Invalid';
          detail = String(data.Diagnosis ?? 'Invalid mailbox');
        } else if (lower.includes('catch')) {
          deliverability = 'Catch-all';
          detail = String(data.Diagnosis ?? 'Catch-all domain');
        } else {
          deliverability = 'Unknown';
          detail = String(data.Diagnosis ?? `Status: ${rawStatus}`);
        }
      } else if (data) {
        const candidate = String(
          data.status ??
            data.result ??
            data.deliverability ??
            (data.data as Record<string, unknown> | undefined)?.status ??
            ''
        ).toLowerCase();
        rawStatus = candidate || 'response received';
        if (['valid', 'deliverable', 'ok', 'safe'].includes(candidate)) {
          deliverability = 'Valid';
          detail = `Custom API returned: ${rawStatus}`;
        } else if (['invalid', 'undeliverable', 'bad', 'bounced'].includes(candidate)) {
          deliverability = 'Invalid';
          detail = `Custom API returned: ${rawStatus}`;
        } else if (['catch-all', 'catchall', 'accept_all'].includes(candidate)) {
          deliverability = 'Catch-all';
          detail = `Custom API returned: ${rawStatus}`;
        } else if (['risky', 'do_not_mail', 'disposable'].includes(candidate)) {
          deliverability = 'Risky';
          detail = `Custom API returned: ${rawStatus}`;
        } else {
          deliverability = 'Unknown';
          detail = `Custom API returned: ${rawStatus}`;
        }
      }

      res.json({
        ok: true,
        email,
        provider,
        deliverability,
        rawStatus,
        detail,
        safeToSend: deliverability === 'Valid' || deliverability === 'Catch-all' || deliverability === 'Role-based',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to reach verification provider.';
      res.status(502).json({ ok: false, error: message });
    }
  });

  // Relay one campaign email via user's own SMTP or Email API (never persisted)
  app.post('/api/campaign/send-one', async (req: Request, res: Response) => {
    const payload = req.body as Partial<SendOnePayload>;

    if (!payload.to || !payload.fromEmail || !payload.subject) {
      res.status(400).json({
        ok: false,
        error: 'Recipient (to), fromEmail, and subject are required.',
      });
      return;
    }

    const fromFormatted = payload.fromName?.trim()
      ? `"${payload.fromName.trim().replace(/"/g, '')}" <${payload.fromEmail.trim()}>`
      : payload.fromEmail.trim();

    if (payload.mode === 'smtp') {
      const smtp = payload.smtp;
      if (!smtp?.host || !smtp?.port) {
        res.status(400).json({ ok: false, error: 'SMTP host and port are required.' });
        return;
      }

      try {
        const transporter = nodemailer.createTransport({
          host: smtp.host.trim(),
          port: Number(smtp.port),
          secure: Boolean(smtp.secure),
          auth: smtp.username?.trim()
            ? {
                user: smtp.username.trim(),
                pass: smtp.password ?? '',
              }
            : undefined,
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        });

        const info = await transporter.sendMail({
          from: fromFormatted,
          to: payload.to.trim(),
          replyTo: payload.replyTo?.trim() || undefined,
          subject: payload.subject,
          text: payload.text || '',
          html: payload.html || undefined,
        });

        res.json({
          ok: true,
          messageId: info.messageId,
          detail: info.response || 'Accepted by SMTP server',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'SMTP delivery failed.';
        res.status(502).json({ ok: false, error: message });
      }
      return;
    }

    if (payload.mode === 'api') {
      const api = payload.api;
      if (!api?.endpointUrl || !api?.authToken) {
        res.status(400).json({
          ok: false,
          error: 'API endpoint URL and authorization token/key are required.',
        });
        return;
      }

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        let requestBody: Record<string, unknown>;
        const token = api.authToken.trim();

        if (api.provider === 'resend') {
          headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
          requestBody = {
            from: fromFormatted,
            to: [payload.to.trim()],
            subject: payload.subject,
            text: payload.text || undefined,
            html: payload.html || undefined,
            reply_to: payload.replyTo?.trim() || undefined,
          };
        } else if (api.provider === 'sendgrid') {
          headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
          const content = [
            { type: 'text/plain', value: payload.text || ' ' },
            ...(payload.html ? [{ type: 'text/html', value: payload.html }] : []),
          ];
          requestBody = {
            personalizations: [{ to: [{ email: payload.to.trim() }] }],
            from: {
              email: payload.fromEmail.trim(),
              ...(payload.fromName?.trim() ? { name: payload.fromName.trim() } : {}),
            },
            ...(payload.replyTo?.trim() ? { reply_to: { email: payload.replyTo.trim() } } : {}),
            subject: payload.subject,
            content,
          };
        } else if (api.provider === 'brevo') {
          headers['api-key'] = token;
          requestBody = {
            sender: {
              email: payload.fromEmail.trim(),
              ...(payload.fromName?.trim() ? { name: payload.fromName.trim() } : {}),
            },
            to: [{ email: payload.to.trim() }],
            ...(payload.replyTo?.trim() ? { replyTo: { email: payload.replyTo.trim() } } : {}),
            subject: payload.subject,
            textContent: payload.text || undefined,
            htmlContent: payload.html || undefined,
          };
        } else if (api.provider === 'postmark') {
          headers['X-Postmark-Server-Token'] = token;
          headers.Accept = 'application/json';
          requestBody = {
            From: fromFormatted,
            To: payload.to.trim(),
            ...(payload.replyTo?.trim() ? { ReplyTo: payload.replyTo.trim() } : {}),
            Subject: payload.subject,
            TextBody: payload.text || undefined,
            HtmlBody: payload.html || undefined,
          };
        } else {
          // Custom REST API
          const headerName = api.authHeaderName?.trim() || 'Authorization';
          headers[headerName] =
            headerName.toLowerCase() === 'authorization' && !token.includes(' ')
              ? `Bearer ${token}`
              : token;
          requestBody = {
            from: fromFormatted,
            fromName: payload.fromName?.trim() || undefined,
            fromEmail: payload.fromEmail.trim(),
            replyTo: payload.replyTo?.trim() || undefined,
            to: payload.to.trim(),
            subject: payload.subject,
            text: payload.text || '',
            html: payload.html || undefined,
          };
        }

        const apiRes = await fetch(api.endpointUrl.trim(), {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });

        const rawResponseText = await apiRes.text();
        let parsedJson: Record<string, unknown> | null = null;
        try {
          parsedJson = JSON.parse(rawResponseText) as Record<string, unknown>;
        } catch {
          parsedJson = null;
        }

        if (!apiRes.ok) {
          const errDetail =
            (parsedJson?.message as string) ||
            (parsedJson?.error as string) ||
            rawResponseText.slice(0, 220) ||
            `API returned HTTP ${apiRes.status}`;
          res.status(502).json({ ok: false, error: errDetail });
          return;
        }

        const messageId =
          (parsedJson?.id as string) ||
          (parsedJson?.messageId as string) ||
          (parsedJson?.MessageID as string) ||
          undefined;

        res.json({
          ok: true,
          messageId,
          detail: `HTTP ${apiRes.status} accepted by ${api.provider.toUpperCase()} API`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Email API request failed.';
        res.status(502).json({ ok: false, error: message });
      }
      return;
    }

    res.status(400).json({ ok: false, error: 'Unsupported send mode. Use "smtp" or "api".' });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

void createServer();
