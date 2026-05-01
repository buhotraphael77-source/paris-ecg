"use client";

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [pseudo, setPseudo] = useState(''); // On remplace l'email par le pseudo
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // L'astuce : on crée un faux email à partir du pseudo pour satisfaire Supabase
  const generateFakeEmail = (p: string) => {
    // On enlève les espaces et on met en minuscules pour éviter les bugs de connexion
    const cleanPseudo = p.toLowerCase().replace(/\s+/g, '');
    return `${cleanPseudo}@paris-ecg.fr`;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pseudo.length < 3) {
      setMessage({ text: "Ton pseudo doit faire au moins 3 caractères.", type: "error" });
      return;
    }
    
    setLoading(true);
    const fakeEmail = generateFakeEmail(pseudo);
    
    const { error } = await supabase.auth.signUp({
      email: fakeEmail,
      password,
      options: {
        data: {
          username: pseudo.trim(), // ON SAUVEGARDE LE VRAI PSEUDO ICI !
        }
      }
    });

    if (error) {
      setMessage({ text: "Erreur : " + error.message, type: "error" });
    } else {
      setMessage({ text: "Inscription réussie ! Clique sur Se connecter.", type: "success" });
    }
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const fakeEmail = generateFakeEmail(pseudo);
    
    const { error } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password,
    });

    if (error) {
      setMessage({ text: "Erreur : Pseudo ou mot de passe incorrect.", type: "error" });
    } else {
      setMessage({ text: "Connexion réussie ! Redirection...", type: "success" });
      window.location.href = '/';
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white max-w-md w-full rounded-3xl shadow-xl p-8 border-2 border-slate-100">
        
        <div className="text-center mb-8">
          {/* LE NOUVEAU NOM DU SITE */}
          <h1 className="text-3xl font-extrabold text-indigo-600 tracking-tight mb-2">
            🎲 Paris<span className="text-pink-500">Ecg</span>
          </h1>
          <p className="text-slate-500 font-medium">Connecte-toi pour placer tes mises</p>
        </div>

        {message.text && (
          <div className={`p-4 rounded-xl mb-6 text-sm font-bold ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {message.text}
          </div>
        )}

        <form className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Ton Pseudo</label>
            <input 
              type="text" 
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              required
              className="w-full bg-slate-100 border-2 border-slate-200 rounded-xl py-3 px-4 text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Ex: Rudelli"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Mot de passe (6 min.)</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-100 border-2 border-slate-200 rounded-xl py-3 px-4 text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button" onClick={handleSignUp} disabled={loading}
              className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              S'inscrire
            </button>
            <button 
              type="button" onClick={handleSignIn} disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors disabled:opacity-50"
            >
              {loading ? '...' : 'Se connecter'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}