import React, { useState } from 'react';
import { TrendingUp, Mail, Lock, User, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [mode, setMode]         = useState('login'); // 'login' | 'register'
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
        setInfo('Account created! Check your email to confirm, then log in.');
        setMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #10b981, #3b82f6)',
            marginBottom: '1rem',
          }}>
            <TrendingUp size={28} color="#fff" />
          </div>
          <h1 style={{ color: '#e5e5e5', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>AI Trade Desk</h1>
          <p style={{ color: '#737373', fontSize: '0.875rem', marginTop: '0.25rem' }}>Your personal AI trading analyst</p>
        </div>

        {/* Card */}
        <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: '16px', padding: '2rem' }}>

          {/* Tab toggle */}
          <div style={{ display: 'flex', background: '#0a0a0a', borderRadius: '10px', padding: '4px', marginBottom: '1.5rem' }}>
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setInfo(''); }}
                style={{
                  flex: 1, padding: '0.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.15s',
                  background: mode === m ? '#262626' : 'transparent',
                  color: mode === m ? '#e5e5e5' : '#737373',
                }}>
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <Field label="Name" icon={<User size={15} />} type="text" value={name}
                placeholder="Your name" onChange={e => setName(e.target.value)} required />
            )}
            <Field label="Email" icon={<Mail size={15} />} type="email" value={email}
              placeholder="you@example.com" onChange={e => setEmail(e.target.value)} required />
            <Field label="Password" icon={<Lock size={15} />} type="password" value={password}
              placeholder={mode === 'register' ? 'Min. 6 characters' : '••••••••'}
              onChange={e => setPassword(e.target.value)} required />

            {error && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', background: '#1f0a0a', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
                <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: '1px' }} />
                <span style={{ color: '#fca5a5', fontSize: '0.8rem' }}>{error}</span>
              </div>
            )}

            {info && (
              <div style={{ background: '#0a1a12', border: '1px solid #064e3b', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
                <span style={{ color: '#6ee7b7', fontSize: '0.8rem' }}>{info}</span>
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '10px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? '#374151' : 'linear-gradient(135deg, #10b981, #3b82f6)',
                color: '#fff', fontWeight: 600, fontSize: '0.9rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                transition: 'opacity 0.15s',
              }}>
              {loading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#4b5563', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          Personal use only · Data stored securely in Supabase
        </p>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Field({ label, icon, ...props }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }}>{icon}</span>
        <input {...props} style={{
          width: '100%', background: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px',
          padding: '0.6rem 0.75rem 0.6rem 2.2rem', color: '#e5e5e5', fontSize: '0.875rem',
          outline: 'none', boxSizing: 'border-box',
        }}
          onFocus={e => e.target.style.borderColor = '#3b82f6'}
          onBlur={e => e.target.style.borderColor = '#262626'}
        />
      </div>
    </div>
  );
}
