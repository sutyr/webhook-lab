// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { Fragment, useState, useRef, useEffect } from 'react';
import { Sun, Moon, Menu, Github, Search, X, Settings, Trash2, Link as LinkIcon, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTheme } from '@/components/theme-provider';
import { useBreadcrumbs } from '@/lib/use-breadcrumbs';
import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { clearAll } from '@/lib/local-storage';

function SutureMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={24}
      height={24}
      className={className}
      aria-hidden="true"
    >
      <path
        d="M16 12L84 12L84 59.5L52.5 59.5L52.5 35.5L16 35.5Z"
        fill="var(--color-mark-dt)"
      />
      <path
        d="M84 88L16 88L16 40.5L47.5 40.5L47.5 64.5L84 64.5Z"
        fill="var(--color-copper)"
      />
    </svg>
  );
}

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const breadcrumbs = useBreadcrumbs();
  const { searchQuery } = useLabState();
  const dispatch = useLabDispatch();
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchOpen) return;
    // Focus whichever search input is visible for the current breakpoint.
    (inputRef.current ?? mobileInputRef.current)?.focus();
    if (window.matchMedia('(max-width: 1023px)').matches) {
      mobileInputRef.current?.focus();
    }
  }, [searchOpen]);

  // Cmd/Ctrl+K to toggle search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close settings popover on outside click or Escape
  useEffect(() => {
    if (!settingsOpen) return;
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSettingsOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [settingsOpen]);

  function closeSearch() {
    setSearchOpen(false);
    dispatch({ type: 'SET_SEARCH_QUERY', query: '' });
  }

  return (
    <header
      className={cn(
        'flex-shrink-0 border-b border-border-medium bg-surface-card pt-[env(safe-area-inset-top)]',
      )}
    >
      <div className="flex h-[58px] items-center justify-between px-4">
      <div className="flex min-w-0 flex-1 items-center">
        <div className="flex min-w-0 items-center gap-[10px]">
          {onMenuClick && (
            <button
              type="button"
              className="flex flex-shrink-0 items-center justify-center rounded-input p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary md:p-1.5 lg:hidden"
              onClick={onMenuClick}
              aria-label="Open sidebar menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <span className="flex-shrink-0">
            <SutureMark />
          </span>
          <span className="truncate font-mono text-[1rem] text-text-primary">
            Webhook&#8201;Lab
          </span>
        </div>

        {/* Breadcrumb or search input */}
        <div className="ml-4 hidden min-w-0 flex-1 items-center border-l border-border-medium pl-4 lg:flex">
          {searchOpen ? (
            <div className="flex flex-1 items-center gap-2">
              <Search size={14} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Filter events..."
                className="min-w-0 flex-1 bg-transparent font-mono text-[0.81rem] text-text-primary outline-none placeholder:text-text-muted"
                value={searchQuery}
                onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', query: e.target.value })}
                onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
              />
              <button
                type="button"
                onClick={closeSearch}
                aria-label="Close search"
                className="flex-shrink-0 text-text-muted transition-colors hover:text-text-secondary"
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {breadcrumbs.map((crumb, i) => {
                const isLast = i === breadcrumbs.length - 1;
                return (
                  <Fragment key={crumb.label}>
                    {i > 0 && (
                      <span className="font-mono text-[0.69rem] text-text-muted">/</span>
                    )}
                    {crumb.onClick && !isLast ? (
                      <button
                        type="button"
                        onClick={crumb.onClick}
                        className="font-sans text-[0.75rem] text-text-muted transition-colors hover:text-text-secondary"
                      >
                        {crumb.label}
                      </button>
                    ) : (
                      <span className={cn(
                        'truncate font-sans text-[0.75rem] text-text-secondary',
                        isLast && 'animate-breadcrumb-in',
                      )}>
                        {crumb.label}
                      </span>
                    )}
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <nav className="flex flex-shrink-0 items-center gap-0.5 sm:gap-2 md:gap-3">
        <button
          type="button"
          onClick={() => setSearchOpen(!searchOpen)}
          aria-label="Search events"
          className="flex items-center gap-1.5 rounded-input p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary md:p-1.5 lg:px-2"
        >
          <Search size={16} strokeWidth={1.75} />
          <kbd className="hidden rounded-badge bg-surface-input px-1.5 py-0.5 font-mono text-[0.6rem] text-text-muted lg:inline-flex">
            ⌘K
          </kbd>
        </button>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
          }}
          aria-label="Copy shareable link"
          className="flex items-center justify-center rounded-input p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary md:p-1.5"
        >
          {linkCopied ? (
            <Check size={16} strokeWidth={1.75} className="text-state-success animate-check-bounce" />
          ) : (
            <LinkIcon size={16} strokeWidth={1.75} />
          )}
        </button>
        <div ref={settingsRef} className="relative">
          <button
            type="button"
            onClick={() => setSettingsOpen(!settingsOpen)}
            aria-label="Settings"
            className="flex items-center justify-center rounded-input p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary md:p-1.5"
          >
            <Settings size={16} strokeWidth={1.75} />
          </button>
          {settingsOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-48 animate-fade-in rounded-card border border-border-medium bg-surface-card p-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  clearAll();
                  try { sessionStorage.removeItem('webhook-lab-tested-events'); } catch {}
                  window.location.reload();
                }}
                className="flex w-full items-center gap-2 rounded-input px-3 py-2 text-left font-sans text-[0.75rem] text-text-secondary transition-colors hover:bg-surface-hover hover:text-state-error"
              >
                <Trash2 size={14} strokeWidth={1.75} />
                Clear saved data
              </button>
            </div>
          )}
        </div>
        <a
          href="https://github.com/sutyr/webhook-lab"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden items-center justify-center rounded-input p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary sm:flex md:p-1.5"
          aria-label="GitHub repository"
        >
          <Github size={18} strokeWidth={1.75} />
        </a>
        <button
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="flex items-center justify-center rounded-input p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary md:p-1.5"
        >
          {theme === 'dark' ? (
            <Sun key="sun" size={16} strokeWidth={1.75} className="animate-rotate-in" />
          ) : (
            <Moon key="moon" size={16} strokeWidth={1.75} className="animate-rotate-in" />
          )}
        </button>
      </nav>
      </div>

      {/* Mobile search row — full-width filter below the bar (lg has its own inline search) */}
      {searchOpen && (
        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5 lg:hidden">
          <Search size={16} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
          <input
            ref={mobileInputRef}
            type="text"
            placeholder="Filter events..."
            className="min-w-0 flex-1 bg-transparent font-mono text-text-primary outline-none placeholder:text-text-muted"
            value={searchQuery}
            onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', query: e.target.value })}
            onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
          />
          <button
            type="button"
            onClick={closeSearch}
            aria-label="Close search"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-input text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
      )}
    </header>
  );
}
