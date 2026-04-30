'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

interface ActionLink {
  label: string;
  href: string;
  external?: boolean;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  links?: ActionLink[];
  time: string;
}

const QUICK_ACTIONS = [
  { label: 'SDK Setup',   prompt: 'How do I set up the Flutter SDK?' },
  { label: 'Deep Links',  prompt: 'How do deep links work in SmartLink?' },
  { label: 'Team Access', prompt: 'How do I invite team members?' },
  { label: 'API Docs',    prompt: 'Where can I find the API documentation?' },
  { label: 'Campaigns',   prompt: 'How do campaigns work?' },
  { label: 'Analytics',   prompt: 'What analytics are available?' },
];

interface BotReply {
  text: string;
  links?: ActionLink[];
}

const BOT_RESPONSES: Array<{ keys: string[]; reply: BotReply }> = [
  {
    keys: ['sdk', 'flutter', 'setup', 'install'],
    reply: {
      text: 'To set up the Flutter SDK, add the SmartLink package to your pubspec.yaml and initialise it with your API key in main.dart. The full step-by-step guide is in our Docs section.',
      links: [
        { label: '→ Open Docs', href: '/dashboard/docs' },
        { label: '→ Get API Key', href: '/dashboard/settings' },
      ],
    },
  },
  {
    keys: ['deep link', 'deferred', 'redirect'],
    reply: {
      text: 'SmartLink deep links detect the device, check if the app is installed, then open the app directly or route through the store. Deferred deep linking preserves the link context even after a fresh install.',
      links: [
        { label: '→ Create a Link', href: '/dashboard/links/create' },
        { label: '→ View Docs', href: '/dashboard/docs' },
      ],
    },
  },
  {
    keys: ['team', 'invite', 'member', 'role', 'access'],
    reply: {
      text: 'Go to Settings → Team to invite members by email. You can assign roles (Administrator, Admin, Editor, Analyst) and scope access to specific apps. Invites expire after 7 days.',
      links: [
        { label: '→ Team Settings', href: '/dashboard/settings' },
      ],
    },
  },
  {
    keys: ['api', 'documentation', 'reference', 'endpoint'],
    reply: {
      text: 'Full API documentation — endpoint references, auth guides, and code examples for all supported platforms — lives in the Docs section of your dashboard.',
      links: [
        { label: '→ Open API Docs', href: '/dashboard/docs' },
        { label: '→ Settings & Keys', href: '/dashboard/settings' },
      ],
    },
  },
  {
    keys: ['campaign', 'campaigns'],
    reply: {
      text: 'Campaigns are containers for your deep links. Create one, set targeting rules, then generate links that route users to the right destination. You can track clicks and conversions per campaign.',
      links: [
        { label: '→ View Campaigns', href: '/dashboard/campaigns' },
        { label: '→ New Campaign',   href: '/dashboard/campaigns/create' },
      ],
    },
  },
  {
    keys: ['analytic', 'click', 'conversion', 'stats', 'report'],
    reply: {
      text: 'The Analytics dashboard shows clicks, installs, and conversions broken down by platform, referrer, and time. You can filter by app and date range.',
      links: [
        { label: '→ Open Analytics', href: '/dashboard/analytics' },
      ],
    },
  },
  {
    keys: ['link', 'links', 'short'],
    reply: {
      text: 'Links are the individual deep links inside a campaign. Each link has a short code, destination URL, and routing rules. You can view all your links in the Links section.',
      links: [
        { label: '→ View Links',  href: '/dashboard/links' },
        { label: '→ Create Link', href: '/dashboard/links/create' },
      ],
    },
  },
];

function getBotReply(input: string): BotReply {
  const lower = input.toLowerCase();
  for (const entry of BOT_RESPONSES) {
    if (entry.keys.some((k) => lower.includes(k))) return entry.reply;
  }
  return {
    text: "Thanks for reaching out! Our team will get back to you shortly. In the meantime, explore the sections below or try asking about: SDK setup, deep links, campaigns, analytics, or team management.",
    links: [
      { label: '→ Docs',      href: '/dashboard/docs' },
      { label: '→ Analytics', href: '/dashboard/analytics' },
      { label: '→ Settings',  href: '/dashboard/settings' },
    ],
  };
}

function formatTime(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Yalina SVG Avatar ───────────────────────────────────────────
function YalinaAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Circle background */}
      <circle cx="20" cy="20" r="20" fill="#c9ff3d" />
      {/* Neck */}
      <rect x="16.5" y="27" width="7" height="5" rx="2" fill="#f5c6aa" />
      {/* Face */}
      <ellipse cx="20" cy="22" rx="9" ry="10" fill="#f5c6aa" />
      {/* Hair top */}
      <ellipse cx="20" cy="14" rx="9.5" ry="6" fill="#3b2a1a" />
      {/* Hair left side */}
      <ellipse cx="11.5" cy="21" rx="2.5" ry="7" fill="#3b2a1a" />
      {/* Hair right side */}
      <ellipse cx="28.5" cy="21" rx="2.5" ry="7" fill="#3b2a1a" />
      {/* Eyes */}
      <ellipse cx="16.5" cy="22" rx="1.5" ry="1.7" fill="#2d1b0e" />
      <ellipse cx="23.5" cy="22" rx="1.5" ry="1.7" fill="#2d1b0e" />
      {/* Eye shine */}
      <circle cx="17.2" cy="21.3" r="0.5" fill="white" />
      <circle cx="24.2" cy="21.3" r="0.5" fill="white" />
      {/* Eyebrows */}
      <path d="M14.5 19.5 Q16.5 18.5 18.5 19.5" stroke="#3b2a1a" strokeWidth="1" strokeLinecap="round" fill="none" />
      <path d="M21.5 19.5 Q23.5 18.5 25.5 19.5" stroke="#3b2a1a" strokeWidth="1" strokeLinecap="round" fill="none" />
      {/* Smile */}
      <path d="M17 26 Q20 28.5 23 26" stroke="#d4847a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Rosy cheeks */}
      <ellipse cx="13.5" cy="25" rx="2.2" ry="1.2" fill="#f4a8a0" opacity="0.5" />
      <ellipse cx="26.5" cy="25" rx="2.2" ry="1.2" fill="#f4a8a0" opacity="0.5" />
    </svg>
  );
}

export default function SupportPage() {
  const { user } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: `Hey${user?.firstName ? ` ${user.firstName}` : ''}! 👋 I'm Yalina, your SmartLink assistant. How can I help you today? Ask me about SDK setup, deep linking, campaigns, analytics, or team management.`,
      links: [
        { label: '→ View Docs',     href: '/dashboard/docs' },
        { label: '→ Go to Analytics', href: '/dashboard/analytics' },
      ],
      time: formatTime(),
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      time: formatTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      const reply = getBotReply(text);
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: reply.text,
        links: reply.links,
        time: formatTime(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setTyping(false);
    }, 700 + Math.random() * 500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <YalinaAvatar size={44} />
          <div>
            <h1 style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700 }}>
              Yalina
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#34D399' }} />
              <span style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Online · SmartLink Assistant
              </span>
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <a
              href="mailto:support@allevents.in?subject=SmartLink%20Support"
              style={{
                padding: '7px 16px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              ✉ Email support
            </a>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          border: '1px solid var(--color-border)',
          borderBottom: 'none',
          padding: '20px 20px 0',
          background: 'var(--color-bg-secondary)',
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', gap: 10, maxWidth: '78%', flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row' }}>
              {/* Avatar */}
              {msg.sender === 'bot' ? (
                <div style={{ flexShrink: 0 }}><YalinaAvatar size={32} /></div>
              ) : (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--color-bg-hover)',
                  border: '1px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                  color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)',
                }}>
                  {user?.firstName?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}

              {/* Bubble */}
              <div>
                <div style={{
                  padding: '12px 16px',
                  background: msg.sender === 'user' ? 'var(--color-primary)' : 'var(--color-bg-card)',
                  color: msg.sender === 'user' ? '#000' : 'var(--color-text)',
                  border: msg.sender === 'bot' ? '1px solid var(--color-border)' : 'none',
                  fontSize: 13,
                  lineHeight: 1.6,
                  borderRadius: msg.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                }}>
                  {msg.text}
                </div>

                {/* Action links */}
                {msg.links && msg.links.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {msg.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          border: '1px solid var(--color-primary)',
                          color: 'var(--color-primary)',
                          textDecoration: 'none',
                          borderRadius: 2,
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = 'var(--color-primary)';
                          (e.currentTarget as HTMLElement).style.color = '#000';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                          (e.currentTarget as HTMLElement).style.color = 'var(--color-primary)';
                        }}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}

                <p style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--color-text-tertiary)',
                  marginTop: 4,
                  textAlign: msg.sender === 'user' ? 'right' : 'left',
                }}>
                  {msg.sender === 'bot' ? 'Yalina · ' : ''}{msg.time}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {typing && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ flexShrink: 0 }}><YalinaAvatar size={32} /></div>
            <div style={{
              padding: '12px 16px',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px 12px 12px 2px',
              display: 'flex', gap: 4, alignItems: 'center',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--color-text-tertiary)', animation: 'dot-pulse 1.2s infinite', animationDelay: '0ms' }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--color-text-tertiary)', animation: 'dot-pulse 1.2s infinite', animationDelay: '200ms' }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--color-text-tertiary)', animation: 'dot-pulse 1.2s infinite', animationDelay: '400ms' }} />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Quick actions */}
      <div style={{
        padding: '10px 16px',
        borderLeft: '1px solid var(--color-border)',
        borderRight: '1px solid var(--color-border)',
        background: 'var(--color-bg-card)',
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
      }}>
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => sendMessage(action.prompt)}
            style={{
              padding: '5px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              borderRadius: 999,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary)';
              e.currentTarget.style.color = 'var(--color-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 0, border: '1px solid var(--color-border)' }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
          placeholder="Ask Yalina anything..."
          style={{
            flex: 1,
            padding: '14px 20px',
            background: 'var(--color-bg-card)',
            border: 'none',
            outline: 'none',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim()}
          style={{
            padding: '14px 24px',
            background: input.trim() ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
            border: 'none',
            color: input.trim() ? '#000' : 'var(--color-text-tertiary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
          }}
        >
          Send →
        </button>
      </div>

      <style jsx>{`
        @keyframes dot-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1);   }
        }
      `}</style>
    </div>
  );
}
