import { TeamRole } from '@/types';

const ROLE_LABELS: Record<TeamRole, { label: string; description: string }> = {
  administrator: {
    label: 'ADMINISTRATOR',
    description: 'Full access — manage apps, campaigns, links, settings, billing, and team members.',
  },
  admin: {
    label: 'ADMIN',
    description: 'Manage apps, campaigns, links, and settings. Cannot manage billing or team.',
  },
  editor: {
    label: 'EDITOR',
    description: 'Create and edit campaigns & links. View analytics. No settings access.',
  },
  analyst: {
    label: 'DATA ANALYST',
    description: 'View-only access to dashboard, analytics, campaigns, and links.',
  },
};

export function buildInviteEmailHtml({
  inviterName,
  tenantName,
  role,
  acceptUrl,
  expiresInDays,
}: {
  inviterName: string;
  tenantName: string;
  role: TeamRole;
  acceptUrl: string;
  expiresInDays: number;
}): string {
  const roleInfo = ROLE_LABELS[role];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to SmartLink</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0D11; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0B0D11; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom: 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 10px; height: 10px; background-color: #C9FF3D; margin-right: 10px;"></td>
                  <td style="padding-left: 10px; font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; color: #E8EAED; letter-spacing: -0.02em;">
                    smartlink<span style="color: #C9FF3D;">/</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Meta line -->
          <tr>
            <td style="padding-bottom: 24px;">
              <span style="font-family: 'Courier New', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #7A8290;">
                // team invite
              </span>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background-color: #141820; border: 1px solid #232831; padding: 40px 36px;">

              <!-- Heading -->
              <h1 style="margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 700; font-size: 28px; line-height: 1.1; color: #E8EAED; text-transform: uppercase; letter-spacing: -0.02em;">
                You're invited.
              </h1>
              <p style="margin: 0 0 28px 0; font-size: 15px; line-height: 1.6; color: #B8BDC7;">
                <strong style="color: #E8EAED;">${inviterName}</strong> has invited you to join
                <strong style="color: #C9FF3D;">${tenantName}</strong> on SmartLink.
              </p>

              <!-- Role badge -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 28px; width: 100%;">
                <tr>
                  <td style="background-color: rgba(201, 255, 61, 0.08); border: 1px solid rgba(201, 255, 61, 0.2); padding: 16px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom: 6px;">
                          <span style="font-family: 'Courier New', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em; color: #7A8290;">your role</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 4px;">
                          <span style="font-family: 'Courier New', monospace; font-size: 14px; font-weight: 700; color: #C9FF3D; letter-spacing: 0.06em;">${roleInfo.label}</span>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <span style="font-size: 13px; color: #B8BDC7; line-height: 1.5;">${roleInfo.description}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                <tr>
                  <td style="background-color: #C9FF3D; padding: 14px 32px;">
                    <a href="${acceptUrl}" style="font-family: 'Courier New', monospace; font-size: 13px; font-weight: 700; color: #0B0D11; text-decoration: none; text-transform: uppercase; letter-spacing: 0.08em;">
                      &rarr; Accept Invite
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry -->
              <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 11px; color: #7A8290; text-transform: uppercase; letter-spacing: 0.1em;">
                expires in ${expiresInDays} days
              </p>

            </td>
          </tr>

          <!-- Fallback link -->
          <tr>
            <td style="padding-top: 20px;">
              <p style="margin: 0; font-size: 12px; color: #7A8290; line-height: 1.6;">
                If the button doesn't work, copy and paste this URL:<br>
                <a href="${acceptUrl}" style="color: #C9FF3D; word-break: break-all; font-family: 'Courier New', monospace; font-size: 11px;">${acceptUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 40px; border-top: 1px solid #232831; margin-top: 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="padding-top: 24px; width: 100%;">
                <tr>
                  <td>
                    <p style="margin: 0 0 6px 0; font-family: 'Courier New', monospace; font-size: 11px; color: #4A5061; text-transform: uppercase; letter-spacing: 0.1em;">
                      smartlink / by allevents
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #4A5061;">
                      Smart deep linking platform. You received this email because someone invited you to their team.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildInviteEmailText({
  inviterName,
  tenantName,
  role,
  acceptUrl,
  expiresInDays,
}: {
  inviterName: string;
  tenantName: string;
  role: TeamRole;
  acceptUrl: string;
  expiresInDays: number;
}): string {
  const roleInfo = ROLE_LABELS[role];
  return `You're invited to SmartLink

${inviterName} has invited you to join ${tenantName} on SmartLink.

Your role: ${roleInfo.label}
${roleInfo.description}

Accept your invite: ${acceptUrl}

This invite expires in ${expiresInDays} days.

---
SmartLink by AllEvents — Smart deep linking platform.`;
}
