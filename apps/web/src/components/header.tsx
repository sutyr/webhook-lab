// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { Fragment, useState, useRef, useEffect } from 'react';
import { Sun, Moon, Menu, Github, Search, X, Settings, Trash2, Link as LinkIcon, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTheme } from '@/components/theme-provider';
import { useBreadcrumbs } from '@/lib/use-breadcrumbs';
import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { filterEvents, stepEvent } from '@/lib/event-groups';
import { clearAll } from '@/lib/local-storage';
import { LabLockup } from '@/components/suture-mark';

interface HeaderProps {
  onMenuClick?: () => void;
  /**
   * Below lg the sidebar lives in a drawer, so search opens the drawer and
   * its search field instead of the inline one.
   */
  onMobileSearch?: () => void;
}

const isNarrow = () => window.matchMedia('(max-width: 1023px)').matches;

export function Header({ onMenuClick, onMobileSearch }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const breadcrumbs = useBreadcrumbs();
  const { searchQuery, selectedEventType } = useLabState();
  const dispatch = useLabDispatch();
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef(onMobileSearch);
  mobileSearchRef.current = onMobileSearch;

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  // Cmd/Ctrl+K toggles search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isNarrow() && mobileSearchRef.current) mobileSearchRef.current();
        else setSearchOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  function openSearch() {
    if (isNarrow() && onMobileSearch) onMobileSearch();
    else setSearchOpen(!searchOpen);
  }

  /**
   * Arrow keys walk the matches and select each one, so the editor follows
   * along; Enter keeps the current match (or takes the first) and closes.
   */
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      closeSearch();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
    const matches = filterEvents(searchQuery).map((entry) => entry.type);
    if (matches.length === 0) return;
    e.preventDefault();
    if (e.key === 'Enter') {
      const pick = matches.includes(selectedEventType) ? selectedEventType : matches[0];
      dispatch({ type: 'SELECT_EVENT', eventType: pick });
      closeSearch();
      return;
    }
    const next = stepEvent(matches, selectedEventType, e.key === 'ArrowDown' ? 1 : -1);
    if (next) dispatch({ type: 'SELECT_EVENT', eventType: next });
  }

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
          <a href="/" className="flex min-w-0 items-center rounded-input" aria-label="Webhook Lab by Sutyr, home">
            <LabLockup />
          </a>
        </div>

        {/* Breadcrumb or search input */}
        <div className="ml-4 hidden min-w-0 flex-1 items-center border-l border-border-medium pl-4 lg:flex">
          {searchOpen ? (
            <div className="flex flex-1 items-center gap-2">
              <Search size={14} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search events"
                aria-label="Search events"
                aria-controls="tabpanel-events"
                className="min-w-0 flex-1 bg-transparent font-mono text-[0.81rem] text-text-primary outline-none placeholder:font-sans placeholder:text-text-muted"
                value={searchQuery}
                onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', query: e.target.value })}
                onKeyDown={handleSearchKeyDown}
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
          onClick={openSearch}
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

    </header>
  );
}
