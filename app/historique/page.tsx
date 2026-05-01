"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

export default function Historique() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userPoints, setUserPoints] = useState<number>(0);

  useEffect(() => {
    async function fetchHistory() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        
        const { data: profile } = await supabase.from('profiles').select('points').eq('id', session.user.id).single();
        if (profile) setUserPoints(profile.points);

        // NOUVEAU : On récupère explicitement "locked_odds" de la table user_bets
        const { data: myBets } = await supabase
          .from('user_bets')
          .select(`
            amount,
            locked_odds,
            option_id,
            created_at,
            bet_options ( title, odds ),
            bets ( title, status, winning_option_id )
          `)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (myBets) setHistory(myBets);
      } else {
        window.location.href = '/login'; 
      }
      setLoading(false);
    }
    fetchHistory();
  }, []);

  return (
    <div className="min-h-screen bg-indigo-50 text-slate-900 font-sans pb-12 flex flex-col selection:bg-pink-300">
      
      {/* HEADER */}
      <header className="bg-white/90 backdrop-blur-md shadow-sm border-b-4 border-indigo-100 p-4 sticky top-0 z-20 flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-2xl sm:text-3xl font-black text-indigo-700 tracking-tight">
          📜 Mon <span className="text-pink-500">Historique</span>
        </h1>
        <div className="flex gap-3 items-center">
          <div className="bg-yellow-300 border-2 border-yellow-500 text-yellow-900 px-4 py-2 rounded-2xl font-black shadow-[0_3px_0_0_#eab308] flex items-center gap-2 text-sm sm:text-base">
            🪙 {userPoints}
          </div>
          <Link href="/" className="bg-white border-2 border-slate-200 text-slate-700 font-black py-2 px-4 rounded-xl text-sm shadow-[0_3px_0_0_#e2e8f0] hover:translate-y-0.5 hover:shadow-[0_1px_0_0_#e2e8f0] transition-all">
            Retour
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 mt-6 w-full flex-grow">
        
        <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-xl border-4 border-slate-100">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-indigo-600"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 border-4 border-dashed border-slate-200 rounded-3xl bg-slate-50">
              <span className="text-5xl block mb-4">👻</span>
              <h3 className="text-xl font-black text-slate-500">C'est bien vide par ici...</h3>
              <p className="text-slate-400 mt-2 font-bold">Lance-toi et fais ton premier pari !</p>
            </div>
          ) : (
            <div className="space-y-5">
              {history.map((bet, index) => {
                const isResolved = bet.bets.status === 'closed';
                const isWinner = isResolved && bet.option_id === bet.bets.winning_option_id;
                const isLoser = isResolved && bet.option_id !== bet.bets.winning_option_id;
                
                // LE CALCUL CORRIGÉ : On prend la cote bloquée, ou 2.00 par défaut si elle n'existe pas
                const finalOdds = bet.locked_odds || 2.00;
                const winnings = Math.floor(bet.amount * finalOdds);

                return (
                  <div key={index} className={`p-5 rounded-2xl border-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-transform hover:-translate-y-1 ${
                    isWinner ? 'bg-emerald-50 border-emerald-300 shadow-[0_4px_0_0_#6ee7b7]' :
                    isLoser ? 'bg-red-50 border-red-300 shadow-[0_4px_0_0_#fca5a5]' :
                    'bg-white border-slate-200 shadow-[0_4px_0_0_#e2e8f0]'
                  }`}>
                    
                    <div>
                      <h3 className="font-black text-lg text-slate-800 mb-2">{bet.bets.title}</h3>
                      <div className="flex flex-wrap gap-2 items-center text-sm">
                        <span className="bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg font-bold text-slate-600">
                          Choix: <span className="text-indigo-600">{bet.bet_options.title}</span>
                        </span>
                        <span className="bg-pink-50 border border-pink-200 px-3 py-1 rounded-lg font-bold text-pink-600">
                          Mise: {bet.amount} 🪙
                        </span>
                        
                        {/* AFFICHAGE CORRIGÉ : On montre la cote qui a été figée */}
                        <span className="bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg font-bold text-indigo-600">
                          Cote: {finalOdds}
                        </span>
                        
                      </div>
                      <p className="text-xs font-bold text-slate-400 mt-3 uppercase tracking-wide">
                        Le {new Date(bet.created_at).toLocaleDateString('fr-FR')} à {new Date(bet.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>

                    <div className="flex-shrink-0 sm:text-right">
                      {!isResolved && (
                        <div className="inline-flex items-center gap-2 bg-white border-2 border-slate-200 text-slate-600 px-4 py-2 rounded-xl font-black text-sm">
                          <span className="animate-pulse">⏳</span> En attente
                        </div>
                      )}
                      {isWinner && (
                        <div className="inline-flex items-center gap-2 bg-emerald-500 border-b-4 border-emerald-700 text-white px-4 py-3 rounded-xl font-black text-sm">
                          {/* GAINS CORRIGÉS : On affiche le vrai calcul mathématique */}
                          <span>🎉</span> Gagné ! (+{winnings} pts)
                        </div>
                      )}
                      {isLoser && (
                        <div className="inline-flex items-center gap-2 bg-red-500 border-b-4 border-red-700 text-white px-4 py-3 rounded-xl font-black text-sm">
                          <span>❌</span> Perdu (-{bet.amount} pts)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}