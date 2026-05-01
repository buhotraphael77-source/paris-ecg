"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, points')
        .order('points', { ascending: false });

      if (!error && data) {
        setLeaderboard(data);
      }
      setLoading(false);
    }
    fetchLeaderboard();
  }, []);

  return (
    <div className="min-h-screen bg-indigo-50 text-slate-900 font-sans pb-12 flex flex-col selection:bg-pink-300">
      
      {/* HEADER GLASSMORPHISM */}
      <header className="bg-white/90 backdrop-blur-md shadow-sm border-b-4 border-indigo-100 p-4 sticky top-0 z-20 flex justify-between items-center">
        <h1 className="text-2xl sm:text-3xl font-black text-indigo-700 tracking-tight">
          🏆 Top <span className="text-pink-500">Joueurs</span>
        </h1>
        <Link href="/" className="bg-white border-2 border-slate-200 text-slate-700 font-black py-2 px-5 rounded-xl text-sm shadow-[0_3px_0_0_#e2e8f0] hover:translate-y-0.5 hover:shadow-[0_1px_0_0_#e2e8f0] transition-all">
          Retour
        </Link>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-6 mt-6 w-full flex-grow">
        <div className="bg-white border-4 border-slate-100 rounded-[2rem] p-6 sm:p-8 shadow-xl">
          
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-slate-800">Le Panthéon</h2>
            <p className="text-slate-500 font-bold mt-2">Qui a le plus gros cerveau ? 🧠</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-indigo-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {leaderboard.map((player, index) => {
                const isFirst = index === 0;
                const isSecond = index === 1;
                const isThird = index === 2;

                return (
                  <div 
                    key={player.id} 
                    className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border-4 transition-transform hover:-translate-y-1 ${
                      isFirst ? 'bg-yellow-50 border-yellow-300 shadow-[0_4px_0_0_#fde047]' :
                      isSecond ? 'bg-slate-50 border-slate-300 shadow-[0_4px_0_0_#cbd5e1]' :
                      isThird ? 'bg-orange-50 border-orange-300 shadow-[0_4px_0_0_#fdba74]' :
                      'bg-white border-slate-100 shadow-[0_4px_0_0_#f1f5f9]'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* LE BADGE DE RANG */}
                      <div className="w-12 flex justify-center items-center">
                        {isFirst ? <span className="text-4xl animate-bounce">👑</span> :
                         isSecond ? <span className="text-4xl">🥈</span> :
                         isThird ? <span className="text-4xl">🥉</span> :
                         <span className="w-10 h-10 flex items-center justify-center bg-slate-100 border-2 border-slate-200 rounded-xl font-black text-slate-400">{index + 1}</span>}
                      </div>
                      
                      <span className={`text-lg sm:text-xl font-black ${isFirst ? 'text-yellow-700' : 'text-slate-700'}`}>
                        {player.username}
                      </span>
                    </div>

                    <div className={`font-black px-4 py-2 rounded-xl border-2 flex items-center gap-2 ${
                      isFirst ? 'bg-yellow-200 border-yellow-400 text-yellow-800' :
                      isSecond ? 'bg-slate-200 border-slate-400 text-slate-800' :
                      isThird ? 'bg-orange-200 border-orange-400 text-orange-800' :
                      'bg-indigo-50 border-indigo-100 text-indigo-700'
                    }`}>
                      {player.points} <span className="text-sm">🪙</span>
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