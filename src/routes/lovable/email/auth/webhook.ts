import * as React from 'react'
import { verifyWebhookRequest, WebhookError } from '@lovable.dev/webhooks-js'
import type { AuthEmailHookData, AuthEmailWebhookPayload } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'

// Configuration
const SITE_NAME = 'CAFE 1 ST ALBANS'
const ROOT_DOMAIN = 'cafe1stalbans.co.uk'
const FROM = `${SITE_NAME} <no-reply@${ROOT_DOMAIN}>`
const REPLY_TO = `info@${ROOT_DOMAIN}`
const SITE_URL = `https://${ROOT_DOMAIN}`
const RESEND_GATEWAY = 'https://connector-gateway.lovable.dev/resend'

type Definition = { subject: string; render: (data: AuthEmailHookData) => React.ReactElement }

const emails: Record<string, Definition> = {
  signup: {
    subject: 'Confirm your email',
    render: (data) =>
      React.createElement(SignupEmail, {
        siteName: SITE_NAME,
        siteUrl: SITE_URL,
        recipient: data.email,
        confirmationUrl: data.url,
      }),
  },
  invite: {
    subject: "You've been invited",
    render: (data) =>
      React.createElement(InviteEmail, {
        siteName: SITE_NAME,
        siteUrl: SITE_URL,
        confirmationUrl: data.url,
      }),
  },
  magiclink: {
    subject: 'Your login link',
    render: (data) =>
      React.createElement(MagicLinkEmail, {
        siteName: SITE_NAME,
        confirmationUrl: data.url,
      }),
  },
  recovery: {
    subject: 'Reset your password',
    render: (data) =>
      React.createElement(RecoveryEmail, {
        siteName: SITE_NAME,
        confirmationUrl: data.url,
      }),
  },
  email_change: {
    subject: 'Confirm your new email',
    render: (data) =>
      React.createElement(EmailChangeEmail, {
        siteName: SITE_NAME,
        oldEmail: data.old_email ?? '',
        email: data.email,
        newEmail: data.new_email ?? '',
        confirmationUrl: data.url,
      }),
  },
  reauthentication: {
    subject: 'Your verification code',
    render: (data) => React.createElement(ReauthenticationEmail, { token: data.token ?? '' }),
  },
}

function parsePayload(body: string): AuthEmailWebhookPayload {
  const parsed = JSON.parse(body) as AuthEmailWebhookPayload
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    parsed.type !== 'auth' ||
    !parsed.data ||
    typeof parsed.data.action_type !== 'string' ||
    typeof parsed.data.email !== 'string'
  ) {
    throw new Error('Invalid auth email webhook payload')
  }
  return parsed
}

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST' } })
  }

  const lovableApiKey = process.env.LOVABLE_API_KEY
  const resendApiKey = process.env.RESEND_API_KEY
  if (!lovableApiKey || !resendApiKey) {
    console.error('[auth-email] missing LOVABLE_API_KEY or RESEND_API_KEY')
    return Response.json({ error: 'Email not configured' }, { status: 500 })
  }

  let event: AuthEmailWebhookPayload
  try {
    ;({ payload: event } = await verifyWebhookRequest<AuthEmailWebhookPayload>({
      req: request,
      secret: lovableApiKey,
      parser: parsePayload,
    }))
  } catch (error) {
    if (error instanceof WebhookError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    console.error('[auth-email] verification failed:', error)
    return Response.json({ error: 'Webhook verification failed' }, { status: 500 })
  }

  const definition = emails[event.data.action_type]
  if (!definition) {
    return Response.json({ error: `Unknown action type: ${event.data.action_type}` }, { status: 400 })
  }

  try {
    const { render } = await import('@react-email/render')
    const element = definition.render(event.data)
    const html = await render(element)
    const text = await render(element, { plainText: true })

    const response = await fetch(`${RESEND_GATEWAY}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lovableApiKey}`,
        'X-Connection-Api-Key': resendApiKey,
      },
      body: JSON.stringify({
        from: FROM,
        to: [event.data.email],
        reply_to: REPLY_TO,
        subject: definition.subject,
        html,
        text,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`[auth-email] Resend send failed [${response.status}]: ${errorBody}`)
      return Response.json({ error: 'Failed to send email' }, { status: response.status >= 500 ? 500 : 400 })
    }
  } catch (error) {
    console.error('[auth-email] send failed:', error)
    return Response.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return Response.json({ success: true, sent: true })
}

export const Route = createFileRoute('/lovable/email/auth/webhook')({
  server: {
    handlers: {
      POST: ({ request }) => handler(request),
    },
  },
})
