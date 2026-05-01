"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

// Définition de la structure commune pour un élément de l'historique
type HistoryItem = {
  id: string;
  date: Date;
  type: 'Classique' | 'Course Billes' | 'PFC 1v1';
  title: string;
  result: 'En cours' | 'Gagné' | 'Perdu' | 'Remboursé';
  amount: number;
  gain: number;
};

export default function Historique() {
  const [user, setUser] = useState<any>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        window.location.href = '/login';
        return;
      }
      setUser(session.user);
      const userId = session.user.id;

      let allHistory: HistoryItem[] = [];

      // 1. Récupération des Paris Classiques
      const { data: classicBets } = await supabase
        .from('user_bets')
        .select(`id, created_at, amount, option_id, locked_odds, bets!inner (title, status, winning_option_id)`)
        .eq('user_id', userId);

      if (classicBets) {
        classicBets.forEach((b: any) => {
          let result: 'En cours' | 'Gagné' | 'Perdu' = 'En cours';
          let gain = 0;
          if (b.bets.status === 'closed') {
            result = b.option_id === b.bets.winning_option_id ? 'Gagné' : 'Perdu';
            gain = result === 'Gagné' ? Math.floor(b.amount * (b.locked_odds || 2)) : -b.amount;
          }
          allHistory.push({ id: `classic_${b.id}`, date: new Date(b.created_at), type: 'Classique', title: b.bets.title, result, amount: b.amount, gain });
        });
      }

      // 2. Récupération des Courses de Billes
      const { data: marbleBets } = await supabase
        .from('marble_bets')
        .select(`id, created_at, amount, marble_number, marble_races!inner (status, winner_1, winner_2, winner_3)`)
        .eq('user_id', userId);

      if (marbleBets) {
        marbleBets.forEach((m: any) => {
          let result: 'En cours' | 'Gagné' | 'Perdu' = 'En cours';
          let gain = 0;
          if (m.marble_races.status === 'closed') {
            if (m.marble_number === m.marble_races.winner_1) { result = 'Gagné'; gain = 500; }
            else if (m.marble_number === m.marble_races.winner_2) { result = 'Gagné'; gain = 200; }
            else if (m.marble_number === m.marble_races.winner_3) { result = 'Gagné'; gain = 100; }
            else { result = 'Perdu'; gain = -50; }
          }
          allHistory.push({ id: `marble_${m.id}`, date: new Date(m.created_at), type: 'Course Billes', title: `Ticket N°${m.marble_number}`, result, amount: 50, gain });
        });
      }

      // 3. Récupération des Matchs PFC
      const { data: pfcGames } = await supabase
        .from('rps_games')
        .select(`id, created_at, bet_p1, bet_p2, final_bet, status, player1_id, player2_id, winner_id`)
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`);

      if (pfcGames) {
        pfcGames.forEach((p: any) => {
          let result: 'En cours' | 'Gagné' | 'Perdu' | 'Remboursé' = 'En cours';
          let gain = 0;
          // La mise affichée dépend si la partie a vraiment commencé
          const myBetAmount = p.final_bet ? p.final_bet : (p.player1_id === userId ? p.bet_p1 : p.bet_p2);
          
          if (p.status === 'finished') {
            result = p.winner_id === userId ? 'Gagné' : 'Perdu';
            gain = result === 'Gagné' ? p.final_bet * 2 : -p.final_bet;
          }
          allHistory.push({ id: `pfc_${p.id}`, date: new Date(p.created_at), type: 'PFC 1v1', title: `Match en duel`, result, amount: myBetAmount, gain });
        });
      }

      // Tri chronologique (du plus récent au plus ancien)
      allHistory.sort((a, b) => b.date.getTime() - a.date.getTime());
      setHistory(allHistory);
      setLoading(false);
    }

    fetchHistory();
  }, []);

  const getTypeStyle = (type: string) => {
    if (type === 'Classique') return "bg-indigo-100 text-indigo-700 border-indigo-200";
    if (type === 'Course Billes') return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (type === 'PFC 1v1') return "bg-pink-100 text-pink-700 border-pink-200";
    return "bg-slate-100 text-slate-700";
  };

  const getResultStyle = (result: string) => {
    if (result === 'Gagné') return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (result === 'Perdu') return "text-red-500 bg-red-50 border-red-200";
    if (result === 'Remboursé') return "text-slate-500 bg-slate-100 border-slate-300";
    return "text-amber-600 bg-amber-50 border-amber-200"; // En cours
  };

  return (
    <div className="min-h-screen bg-indigo-50 text-slate-900 font-sans pb-12 flex flex-col selection:bg-pink-300">
      <header className="bg-white/90 backdrop-blur-md shadow-sm border-b-4 border-indigo-100 p-4 sticky top-0 z-20 flex justify-between items-center">
        <Link href="/" className="text-xl font-black text-indigo-400 hover:text-indigo-600 transition-colors flex items-center gap-2">⬅️ Accueil</Link>
        <h1 className="text-2xl font-black text-slate-800">📜 Mon Historique</h1>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 mt-6 flex-grow w-full">
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600"></div></div>
        ) : history.length === 0 ? (
          <div className="bg-white border-4 border-dashed border-slate-300 rounded-3xl p-12 text-center">
             <span className="text-4xl block mb-4">👻</span>
             <h3 className="text-xl font-black text-slate-500">Aucune trace de toi...</h3>
             <p className="text-slate-400 mt-2">Commence à parier pour remplir ton historique !</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`text-[10px] uppercase tracking-wider font-black px-2 py-1 rounded-lg border ${getTypeStyle(item.type)}`}>
                      {item.type}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">
                      {item.date.toLocaleDateString('fr-FR')} à {item.date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-800">{item.title}</h3>
                  <p className="text-sm text-slate-500 font-bold mt-1">Mise : <span className="text-slate-700">{item.amount} 🪙</span></p>
                </div>

                <div className={`px-4 py-2 rounded-xl border-2 font-black flex flex-col items-center justify-center min-w-[120px] ${getResultStyle(item.result)}`}>
                  <span className="text-sm uppercase tracking-wider">{item.result}</span>
                  {item.result !== 'En cours' && item.result !== 'Remboursé' && (
                    <span className="text-lg">
                      {item.gain > 0 ? '+' : ''}{item.gain} 🪙
                    </span>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}