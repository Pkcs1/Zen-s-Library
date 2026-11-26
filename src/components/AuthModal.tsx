import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Cloud, LogOut, RefreshCw, X } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { syncLocalToCloud } from '../lib/storage';

interface AuthModalProps {
  cloudUserEmail: string | null;
  onClose: () => void;
  onAuthSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  cloudUserEmail,
  onClose,
  onAuthSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [message, setMessage] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setMessage(null);
    const res =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);
    if (res.error) {
      setMessage(res.error.message);
    } else {
      onAuthSuccess();
      onClose();
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setSyncStatus(null);
    const res = await syncLocalToCloud((status) => setSyncStatus(status));
    setSyncing(false);
    if (res.error) {
      setSyncStatus(`Sync warning: ${res.error}`);
    } else if (res.syncedBooks === 0 && res.syncedCategories === 0 && res.skippedBooks > 0) {
      setSyncStatus(`All ${res.skippedBooks} book(s) are already synced to the cloud!`);
      onAuthSuccess();
    } else if (res.skippedBooks > 0) {
      setSyncStatus(
        `Synced ${res.syncedBooks} new book(s) (${res.skippedBooks} already synced skipped)!`
      );
      onAuthSuccess();
    } else {
      setSyncStatus(`Synced ${res.syncedCategories} racks/binders & ${res.syncedBooks} books to cloud!`);
      onAuthSuccess();
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    onAuthSuccess();
    onClose();
  };

  return (
    <motion.div
      className="modal-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-card"
        style={{ maxWidth: 460 }}
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid #EBE3D6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Cloud size={20} color="#2B463C" />
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, margin: 0 }}>
              Cloud Library Sync
            </h3>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', color: '#7A6F64' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '24px 28px' }}>
          {!isSupabaseConfigured ? (
            <div style={{ fontSize: 14, lineHeight: 1.65, color: '#5A5148' }}>
              <p style={{ marginTop: 0 }}>
                Zen&apos;s Library is currently running in <strong>Local-First Mode</strong>{' '}
                (your books, PDFs, EPUBs, and progress are persisted in browser IndexedDB).
              </p>
              <p>To enable cross-device <strong>Supabase Cloud Sync</strong>:</p>
              <ol style={{ paddingLeft: 20 }}>
                <li>Create a free Supabase project and run <code>supabase/schema.sql</code>.</li>
                <li>Copy <code>.env.example</code> to <code>.env</code> with your project URL &amp; Anon key.</li>
                <li>Restart the dev server and sign in here.</li>
              </ol>
            </div>
          ) : cloudUserEmail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0, fontSize: 14, color: '#2B463C', lineHeight: 1.5 }}>
                Signed in &amp; syncing privately as <strong>{cloudUserEmail}</strong>.
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#7A6F64', lineHeight: 1.5 }}>
                If you added books on this device before signing in, press{' '}
                <strong>Push Local Books to Cloud</strong> so they appear on your phone too.
              </p>

              {syncStatus && (
                <div
                  style={{
                    fontSize: 13,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: syncStatus.startsWith('Sync warning') ? '#FDF4F2' : '#EEF5F1',
                    color: syncStatus.startsWith('Sync warning') ? '#9E332C' : '#2B463C',
                    fontWeight: 600,
                  }}
                >
                  {syncStatus}
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button
                  className="zen-btn-primary"
                  onClick={handleManualSync}
                  disabled={syncing}
                >
                  <RefreshCw size={14} />
                  <span>{syncing ? 'Syncing...' : 'Push Local Books to Cloud'}</span>
                </button>
                <button className="zen-btn-secondary" onClick={handleSignOut}>
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input
                type="email"
                className="zen-input"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                className="zen-input"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {message && <div style={{ fontSize: 13, color: '#B4433C' }}>{message}</div>}
              <button type="submit" className="zen-btn-primary" disabled={loading}>
                {loading ? 'Connecting...' : mode === 'signin' ? 'Sign In & Sync' : 'Create Account'}
              </button>
              <button
                type="button"
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                style={{ border: 'none', background: 'none', fontSize: 12, color: '#7A6F64' }}
              >
                {mode === 'signin'
                  ? 'Need an account? Sign up'
                  : 'Already have an account? Sign in'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
