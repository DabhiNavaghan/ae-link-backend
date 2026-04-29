'use client';

import React, { useState } from 'react';

interface InboxMessage {
  id: string;
  type: 'system' | 'alert' | 'info';
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const SAMPLE_MESSAGES: InboxMessage[] = [
  {
    id: '1',
    type: 'system',
    title: 'Welcome to SmartLink',
    body: 'Your deep linking platform is set up and ready. Start by creating your first campaign or exploring the docs.',
    time: 'Just now',
    read: false,
  },
  {
    id: '2',
    type: 'info',
    title: 'SDK Integration Guide',
    body: 'Check out the Flutter SDK documentation to start tracking installs and deferred deep links in your app.',
    time: '2 min ago',
    read: false,
  },
  {
    id: '3',
    type: 'alert',
    title: 'Team Invites Available',
    body: 'You can now invite team members with role-based access. Head to Settings > Team to get started.',
    time: '5 min ago',
    read: true,
  },
];

const TYPE_CONFIG = {
  system: { color: '#C9FF3D', icon: '⚡', label: 'System' },
  alert: { color: '#FF3D8A', icon: '🔔', label: 'Alert' },
  info: { color: '#7DD3FC', icon: 'ℹ', label: 'Info' },
};

export default function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>(SAMPLE_MESSAGES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const unreadCount = messages.filter(m => !m.read).length;
  const filtered = filter === 'unread' ? messages.filter(m => !m.read) : messages;
  const selected = messages.find(m => m.id === selectedId);

  const markRead = (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));
  };

  const markAllRead = () => {
    setMessages(prev => prev.map(m => ({ ...m, read: true })));
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700 }}>
            Inbox
          </h1>
          <p style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all', 'unread'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              style={{
                padding: '6px 14px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                border: '1px solid',
                borderColor: filter === f ? 'var(--color-primary)' : 'var(--color-border)',
                background: filter === f ? 'var(--color-primary-light)' : 'transparent',
                color: filter === f ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontWeight: filter === f ? 700 : 400,
              }}
            >
              {f}
            </button>
          ))}
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              style={{
                padding: '6px 14px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 0, border: '1px solid var(--color-border)' }}>
        {/* Message list */}
        <div style={{ borderRight: selected ? '1px solid var(--color-border)' : 'none', maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, margin: '0 auto 16px',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
              }}>
                📭
              </div>
              <p style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                {filter === 'unread' ? 'No unread messages' : 'No messages yet'}
              </p>
              <p style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: 4 }}>
                Notifications and updates will appear here
              </p>
            </div>
          ) : (
            filtered.map((msg) => {
              const cfg = TYPE_CONFIG[msg.type];
              const isActive = selectedId === msg.id;
              return (
                <button
                  key={msg.id}
                  onClick={() => { setSelectedId(msg.id); markRead(msg.id); }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    width: '100%',
                    padding: '16px 20px',
                    border: 'none',
                    borderBottom: '1px solid var(--color-border)',
                    background: isActive ? 'var(--color-bg-hover)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Unread dot */}
                  <div style={{ width: 8, paddingTop: 6, flexShrink: 0 }}>
                    {!msg.read && (
                      <div style={{
                        width: 8, height: 8,
                        borderRadius: '50%',
                        backgroundColor: cfg.color,
                      }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        padding: '2px 8px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: cfg.color,
                        backgroundColor: `${cfg.color}18`,
                        border: `1px solid ${cfg.color}30`,
                        borderRadius: 999,
                      }}>
                        {cfg.label}
                      </span>
                      <span style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 10, marginLeft: 'auto', flexShrink: 0 }}>
                        {msg.time}
                      </span>
                    </div>
                    <p style={{
                      color: msg.read ? 'var(--color-text-secondary)' : 'var(--color-text)',
                      fontFamily: 'var(--font-heading)',
                      fontSize: 13,
                      fontWeight: msg.read ? 400 : 600,
                      marginBottom: 2,
                    }}>
                      {msg.title}
                    </p>
                    <p style={{
                      color: 'var(--color-text-tertiary)',
                      fontSize: 12,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {msg.body}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ padding: 28, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{
                padding: '3px 10px',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: TYPE_CONFIG[selected.type].color,
                backgroundColor: `${TYPE_CONFIG[selected.type].color}18`,
                border: `1px solid ${TYPE_CONFIG[selected.type].color}30`,
                borderRadius: 999,
              }}>
                {TYPE_CONFIG[selected.type].icon} {TYPE_CONFIG[selected.type].label}
              </span>
              <span style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                {selected.time}
              </span>
            </div>
            <h2 style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
              {selected.title}
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, lineHeight: 1.7 }}>
              {selected.body}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
