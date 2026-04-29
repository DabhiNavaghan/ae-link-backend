'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
}

const QUICK_ACTIONS = [
  { label: 'SDK Setup', prompt: 'How do I set up the Flutter SDK?' },
  { label: 'Deep Links', prompt: 'How do deep links work in SmartLink?' },
  { label: 'Team Access', prompt: 'How do I invite team members?' },
  { label: 'API Docs', prompt: 'Where can I find the API documentation?' },
];

const BOT_RESPONSES: Record<string, string> = {
  'sdk': 'To set up the Flutter SDK, add the SmartLink package to your pubspec.yaml and initialize it with your API key in main.dart. Check out the full guide under Dashboard > Docs > Flutter SDK.',
  'deep link': 'SmartLink deep links work by creating a redirect URL that detects the user\'s device, checks if the app is installed, and either opens the app directly or routes through the app store. Deferred deep linking preserves the link context even after install.',
  'team': 'Go to Settings > Team tab to invite members. You can assign roles (Administrator, Admin, Editor, Analyst) and scope access to specific apps. Invites are sent via email and expire in 7 days.',
  'api': 'API documentation is available at Dashboard > Docs. You\'ll find endpoint references, authentication guides, and code examples for all supported platforms.',
  'campaign': 'Campaigns are containers for your deep links. Create one under Dashboard > Campaigns, set targeting rules, and generate links that route users to the right destination.',
  'analytics': 'The Analytics dashboard shows clicks, installs, and conversions broken down by platform, referrer, and time. You can filter by app and date range.',
};

function getBotResponse(input: string): string {
  const lower = input.toLowerCase();
  for (const [key, response] of Object.entries(BOT_RESPONSES)) {
    if (lower.includes(key)) return response;
  }
  return 'Thanks for reaching out! Our team will get back to you shortly. In the meantime, you can check the Docs section for guides and API reference, or try asking about: SDK setup, deep links, campaigns, analytics, or team management.';
}

function formatTime(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function SupportPage() {
  const { user } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: `Hey${user?.firstName ? ` ${user.firstName}` : ''}! 👋 I\'m SmartLink Assistant. How can I help you today? You can ask about SDK setup, deep linking, campaigns, or anything else.`,
      time: formatTime(),
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      time: formatTime(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    // Simulate bot response delay
    setTimeout(() => {
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: getBotResponse(text),
        time: formatTime(),
      };
      setMessages(prev => [...prev, botMsg]);
      setTyping(false);
    }, 800 + Math.random() * 600);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40,
            background: 'var(--color-primary)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
          }}>
            🤖
          </div>
          <div>
            <h1 style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700 }}>
              Support
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#34D399' }} />
              <span style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Online
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
              ✉ Email us directly
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
            <div style={{ display: 'flex', gap: 10, maxWidth: '75%', flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row' }}>
              {/* Avatar */}
              <div style={{
                width: 32, height: 32,
                borderRadius: '50%',
                background: msg.sender === 'bot' ? 'var(--color-primary)' : 'var(--color-bg-hover)',
                border: msg.sender === 'user' ? '1px solid var(--color-border)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, flexShrink: 0,
                color: msg.sender === 'bot' ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                fontFamily: 'var(--font-mono)',
              }}>
                {msg.sender === 'bot' ? '⚡' : (user?.firstName?.charAt(0).toUpperCase() || 'U')}
              </div>
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
                <p style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--color-text-tertiary)',
                  marginTop: 4,
                  textAlign: msg.sender === 'user' ? 'right' : 'left',
                }}>
                  {msg.time}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {typing && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32,
              borderRadius: '50%',
              background: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, flexShrink: 0,
            }}>
              ⚡
            </div>
            <div style={{
              padding: '12px 16px',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px 12px 12px 2px',
              display: 'flex', gap: 4, alignItems: 'center',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--color-text-tertiary)', animation: 'pulse 1.2s infinite', animationDelay: '0ms' }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--color-text-tertiary)', animation: 'pulse 1.2s infinite', animationDelay: '200ms' }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--color-text-tertiary)', animation: 'pulse 1.2s infinite', animationDelay: '400ms' }} />
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
        {QUICK_ACTIONS.map(action => (
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
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--color-primary)';
              e.currentTarget.style.color = 'var(--color-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{
        display: 'flex',
        gap: 0,
        border: '1px solid var(--color-border)',
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
          placeholder="Type a message..."
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

      {/* Pulse animation for typing dots */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
