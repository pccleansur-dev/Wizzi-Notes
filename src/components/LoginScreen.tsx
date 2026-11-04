import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, AlertCircle } from 'lucide-react';

export default function LoginScreen() {
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'unauthorized') {
      setError('Tu cuenta de Google no está autorizada para acceder a esta app. Contactá al administrador.');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#131313] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm text-center"
      >
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 mb-6">
          <Sparkles size={36} className="text-primary" />
        </div>

        <h1 className="text-3xl font-black text-white mb-2">Wizzi Note</h1>
        <p className="text-on-surface-variant text-sm mb-8">
          Suite de productividad con IA para tu agencia.
        </p>

        {error && (
          <div className="flex items-start gap-2 bg-error/10 border border-error/20 rounded-xl p-3 mb-6 text-left">
            <AlertCircle size={15} className="text-error shrink-0 mt-0.5" />
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        <a
          href="/auth/google"
          className="flex items-center justify-center gap-3 w-full py-3.5 bg-white text-[#131313] font-bold rounded-xl hover:bg-white/90 active:scale-[0.99] transition-all shadow-lg shadow-black/20 text-sm"
        >
          {/* Google icon */}
          <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
            <path d="M6.306 14.691l6.571 4.819C14.655 15.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
            <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.311 0-9.822-3.378-11.396-8.03l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
            <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
          </svg>
          Iniciar sesión con Google
        </a>

        <p className="text-[11px] text-on-surface-variant/40 mt-6">
          Solo cuentas autorizadas pueden acceder.
        </p>
      </motion.div>
    </div>
  );
}
