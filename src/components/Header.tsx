import React from 'react';
import { Cloud, CloudOff, Plus, Search } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onLogoClick: () => void;
  onUploadClick: () => void;
  onSyncClick: () => void;
  cloudUserEmail: string | null;
  isCloudConfigured: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onLogoClick,
  onUploadClick,
  onSyncClick,
  cloudUserEmail,
  isCloudConfigured,
}) => {
  const initials = cloudUserEmail
    ? cloudUserEmail.slice(0, 2).toUpperCase()
    : 'ZL';

  return (
    <header className="zen-header">
      <button className="zen-brand" onClick={onLogoClick} title="Return to Category Racks">
        <div className="zen-logo-mark" aria-hidden="true">
          <span style={{ width: 9, height: 28, background: '#2B463C' }} />
          <span style={{ width: 8, height: 23, background: '#D46F4D' }} />
          <span
            style={{
              width: 8,
              height: 25,
              background: '#D9A74E',
              transform: 'rotate(-10deg) translateY(-1px)',
            }}
          />
        </div>
        <span className="zen-brand-name">Zen&apos;s Library</span>
      </button>

      <div className="zen-search-wrap">
        <Search size={16} className="zen-search-icon" />
        <input
          type="text"
          className="zen-search-input"
          placeholder="Search books, authors, or racks..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="zen-header-actions">
        <button
          className="zen-sync-pill"
          onClick={onSyncClick}
          title={
            cloudUserEmail
              ? `Cloud synced as ${cloudUserEmail}`
              : 'Local-First mode (IndexedDB) — Click to configure Cloud Sync'
          }
        >
          <span className={`zen-sync-dot ${cloudUserEmail ? '' : 'local'}`} />
          {cloudUserEmail ? <Cloud size={14} /> : <CloudOff size={14} />}
          <span>
            {cloudUserEmail
              ? 'Cloud Synced'
              : isCloudConfigured
                ? 'Sign In to Sync'
                : 'Local + Cloud Ready'}
          </span>
        </button>

        <button className="zen-btn-primary" onClick={onUploadClick}>
          <Plus size={16} />
          <span>Upload Book</span>
        </button>

        <button
          onClick={onSyncClick}
          title={cloudUserEmail ?? 'Library Account'}
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            border: 'none',
            background: '#D8C3A8',
            color: '#2C2621',
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {initials}
        </button>
      </div>
    </header>
  );
};
