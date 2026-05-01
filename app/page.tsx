"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from './lib/supabase';

export default function Home() {
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [betAmount, setBetAmount] = useState("");
  const [realBets, setRealBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [user, setUser] = useState<any>(null);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [userExistingBets, setUserExistingBets] = useState<string[]>([]);
  
  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchBets = async () => {
    const { data } = await supabase
      .from('bets')
      .select('id, title, open_at, deadline, recurrence, recurrence_start, recurrence_end, bet_options ( id, title, odds, user_bets ( id ) )')
      .eq('status', 'open');

    if (data) {
      const activeBets = data.filter(bet => {
        const now = new Date();

        if (!bet.recurrence || bet.recurrence === 'none') {
           const openAtDate = new Date(bet.open_at);
           const deadlineDate = new Date(bet.deadline);
           return now >= openAtDate && now <= deadlineDate;
        }

        const dayMap: { [key: number]: string } = { 
          0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' 
        };
        const currentDay = dayMap[now.getDay()];

        if (bet.recurrence !== currentDay) return false;

        const currentHours = now.getHours().toString().padStart(2, '0');
        const currentMinutes = now.getMinutes().toString().padStart(2, '0');
        const currentTime = `${currentHours}:${currentMinutes}`;

        if (bet.recurrence_start && bet.recurrence_end) {
          return currentTime >= bet.recurrence_start && currentTime <= bet.recurrence_end;
        }

        return true; 
      });

      setRealBets(activeBets);
    }
    setLoading(false);
  };

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        
        let { data: profileData } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', session.user.id)
          .maybeSingle(); 
          
        if (profileData) {
          setUserPoints(profileData.points);
        } else {
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert([{ id: session.user.id, username: session.user.user_metadata?.username || 'Joueur', points: 1000 }])
            .select('points')
            .single();
          if (newProfile) setUserPoints(newProfile.points);
        }

        const { data: myBets } = await supabase
          .from('user_bets')
          .select('bet_id')
          .eq('user_id', session.user.id);
        
        if (myBets) {
          setUserExistingBets(myBets.map(bet => bet.bet_id));
        }

        // NOUVEAU : On récupère locked_odds pour la notification !
        const { data: unreadBets } = await supabase
          .from('user_bets')
          .select(`
            id,
            amount,
            option_id,
            locked_odds,
            bets!inner ( title, status, winning_option_id )
          `)
          .eq('user_id', session.user.id)
          .eq('is_read', false)
          .eq('bets.status', 'closed');

        if (unreadBets && unreadBets.length > 0) {
          setNotifications(unreadBets);
        }

      } else {
        setUser(null);
        setUserExistingBets([]); 
        setNotifications([]);
      }
    }
    checkUser();
    fetchBets();
    
    const interval = setInterval(fetchBets, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserPoints(0);
    setUserExistingBets([]);
  };

  const openModal = (option: any, betId: string, betTitle: string) => {
    setSelectedOption({ ...option, betId, betTitle });
  };

  const closeModal = () => {
    setSelectedOption(null);
    setBetAmount("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const amount = parseInt(betAmount);

    if (amount <= 0) {
      alert("La mise doit être supérieure à 0 !");
      return;
    }
    if (amount > userPoints) {
      alert(`❌ Fonds insuffisants ! Tu n'as que ${userPoints} points.`);
      return;
    }

    const { error: betError } = await supabase
      .from('user_bets')
      .insert([{
        user_id: user.id,
        bet_id: selectedOption.betId,
        option_id: selectedOption.id,
        amount: amount,
        locked_odds: selectedOption.odds 
      }]);

    if (betError) {
      alert("Erreur : Tu as probablement déjà parié sur cet événement !");
      return;
    }

    const newPoints = userPoints - amount;
    await supabase.from('profiles').update({ points: newPoints }).eq('id', user.id);

    setUserPoints(newPoints);
    setUserExistingBets([...userExistingBets, selectedOption.betId]);

    await fetchBets();

    closeModal();
  };

  const markNotificationsAsRead = async () => {
    const ids = notifications.map(n => n.id);
    const { error } = await supabase.from('user_bets').update({ is_read: true }).in('id', ids);
    
    if (error) {
      console.error("Erreur bloquante Supabase :", error.message);
      alert("Erreur technique : Le videur de la base de données a bloqué la mise à jour !");
    } else {
      setNotifications([]);
    }
  };

  return (
    <div className="min-h-screen bg-indigo-50 text-slate-900 font-sans pb-12 flex flex-col selection:bg-pink-300">
      
      <header className="bg-white/90 backdrop-blur-md shadow-sm border-b-4 border-indigo-100 p-4 sticky top-0 z-20 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-black text-indigo-700 tracking-tight transform -rotate-2 hover:rotate-0 transition-transform cursor-pointer">
            🎲 Paris<span className="text-pink-500">Ecg</span>
          </h1>
          <div className="hidden sm:flex gap-3">
            <Link href="/leaderboard" className="flex items-center gap-2 bg-white border-2 border-slate-200 text-slate-700 font-black py-2 px-4 rounded-xl text-sm shadow-[0_3px_0_0_#e2e8f0] hover:translate-y-0.5 hover:shadow-[0_1px_0_0_#e2e8f0] transition-all">
              🏆 Top
            </Link>
            <Link href="/historique" className="flex items-center gap-2 bg-white border-2 border-slate-200 text-slate-700 font-black py-2 px-4 rounded-xl text-sm shadow-[0_3px_0_0_#e2e8f0] hover:translate-y-0.5 hover:shadow-[0_1px_0_0_#e2e8f0] transition-all">
              📜 Historique
            </Link>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <div className="hidden sm:block font-bold text-slate-600 text-sm">
                Salut, <span className="text-indigo-600">{user.user_metadata?.username || 'Joueur'}</span>
              </div>
              <div className="bg-yellow-300 border-2 border-yellow-500 text-yellow-900 px-4 py-2 rounded-2xl font-black shadow-[0_3px_0_0_#eab308] flex items-center gap-2 text-sm sm:text-base">
                <span className="animate-bounce">🪙</span> {userPoints}
              </div>
            </>
          ) : (
            <button onClick={() => window.location.href = '/login'} className="bg-indigo-600 text-white font-black py-2 px-5 rounded-2xl shadow-[0_4px_0_0_#4338ca] hover:translate-y-1 hover:shadow-none transition-all">
              Go !
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 mt-6 flex-grow w-full">
        <div className="flex justify-between items-end mb-8">
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Paris en cours 🔥</h2>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600"></div>
          </div>
        )}

        {!loading && realBets.length === 0 && (
          <div className="bg-white border-4 border-dashed border-slate-300 rounded-3xl p-12 text-center">
            <span className="text-4xl block mb-4">😴</span>
            <h3 className="text-xl font-black text-slate-500">Aucun pari disponible...</h3>
            <p className="text-slate-400 mt-2">Reviens plus tard pour de nouveaux défis !</p>
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {realBets.map((bet) => {
              const hasBetted = userExistingBets.includes(bet.id);

              return (
                <div key={bet.id} className="bg-white border-4 border-slate-100 rounded-3xl p-6 shadow-xl hover:-translate-y-1 transition-transform duration-300 flex flex-col justify-between relative overflow-hidden group">
                  
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500 z-0"></div>

                  <div className="relative z-10">
                    <span className="inline-block text-[10px] uppercase tracking-wider font-black bg-red-100 text-red-600 px-3 py-1 rounded-xl mb-4 border-b-2 border-red-200">
                      {bet.recurrence !== 'none' 
                        ? `Fini à ${bet.recurrence_end} ajd`
                        : `Fin le ${new Date(bet.deadline).toLocaleDateString('fr-FR')} à ${new Date(bet.deadline).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}`
                      }
                    </span>
                    <h3 className="text-xl font-black mb-6 text-slate-800 leading-snug">{bet.title}</h3>
                  </div>

                  {hasBetted ? (
                    <div className="relative z-10 mt-auto bg-emerald-100 border-b-4 border-emerald-300 text-emerald-700 text-center font-black py-4 rounded-2xl flex items-center justify-center gap-2">
                      <span className="text-xl">✅</span> Pari enregistré
                    </div>
                  ) : (
                    <div className="relative z-10 flex gap-3 mt-auto">
                      {bet.bet_options.map((option: any) => {
                        const betCount = option.user_bets ? option.user_bets.length : 0;
                        
                        return (
                          <button 
                            key={option.id}
                            onClick={() => openModal(option, bet.id, bet.title)}
                            className="flex-1 bg-white hover:bg-indigo-50 text-slate-700 font-black py-4 px-2 rounded-2xl border-2 border-slate-200 shadow-[0_4px_0_0_#e2e8f0] hover:border-indigo-300 hover:text-indigo-700 hover:shadow-[0_4px_0_0_#c7d2fe] active:shadow-[0_0px_0_0_#c7d2fe] active:translate-y-1 transition-all flex flex-col items-center justify-center"
                          >
                            <span className="text-lg">{option.title}</span>
                            <div className="flex flex-col items-center mt-2 opacity-90">
                              <span className="text-xs text-pink-500 bg-pink-50 px-2 py-0.5 rounded-md border border-pink-100 mb-1">Cote: {option.odds}</span>
                              <span className="text-[11px] text-slate-400 font-bold">👤 {betCount} joueur(s)</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {user && (
        <div className="max-w-4xl mx-auto px-4 pb-8 w-full flex flex-col items-center gap-4 text-center">
          <Link href="/leaderboard" className="sm:hidden w-full max-w-sm bg-white border-2 border-slate-200 text-slate-700 font-black py-4 px-8 rounded-2xl shadow-[0_4px_0_0_#e2e8f0] active:translate-y-1 active:shadow-none transition-all">
            🏆 Voir le Classement
          </Link>
          <Link href="/historique" className="sm:hidden w-full max-w-sm bg-white border-2 border-slate-200 text-slate-700 font-black py-4 px-8 rounded-2xl shadow-[0_4px_0_0_#e2e8f0] active:translate-y-1 active:shadow-none transition-all">
            📜 Mon Historique
          </Link>
          <button onClick={handleSignOut} className="w-full max-w-sm mt-4 text-slate-400 hover:text-red-500 font-bold py-2 transition-colors underline decoration-2 underline-offset-4">
            Me déconnecter
          </button>
        </div>
      )}

      {selectedOption && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border-4 border-indigo-100">
            <div className="bg-indigo-50 rounded-2xl p-4 mb-6 border-2 border-indigo-100">
              <p className="text-sm text-indigo-400 font-bold mb-1 uppercase tracking-wider">Tu paries sur :</p>
              <h3 className="text-xl font-black text-indigo-900">{selectedOption.betTitle}</h3>
            </div>
            
            <div className="flex justify-between items-center mb-6 px-2">
              <span className="font-black text-slate-600">Ton choix :</span>
              <span className="font-black text-xl text-pink-500 bg-pink-50 px-3 py-1 rounded-xl border-2 border-pink-100">
                {selectedOption.title} <span className="text-sm">x{selectedOption.odds}</span>
              </span>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-8">
                <label className="block text-sm font-black text-slate-600 mb-3 ml-2">Combien de pièces ?</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl">🪙</span>
                  <input type="number" min="1" max={userPoints} required value={betAmount} onChange={(e) => setBetAmount(e.target.value)} className="w-full bg-slate-50 border-4 border-slate-200 rounded-2xl py-4 pl-14 pr-4 text-xl font-black text-slate-800 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors" placeholder={`Max: ${userPoints}`}/>
                </div>
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={closeModal} className="flex-1 bg-slate-100 text-slate-500 font-black py-4 rounded-2xl border-2 border-slate-200 hover:bg-slate-200 transition-colors">Annuler</button>
                <button type="submit" className="flex-[2] bg-pink-500 text-white font-black py-4 rounded-2xl shadow-[0_4px_0_0_#be185d] hover:translate-y-1 hover:shadow-none transition-all text-lg">Valider le Pari !</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {notifications.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl text-center animate-in zoom-in duration-300 border-4 border-white">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-yellow-200">
              <span className="text-4xl animate-bounce">🔔</span>
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-6">Nouveaux Résultats !</h2>
            
            <div className="space-y-4 max-h-[50vh] overflow-y-auto mb-8 text-left pr-2">
              {notifications.map(notif => {
                 const isWinner = notif.option_id === notif.bets.winning_option_id;
                 
                 // LE CALCUL MATHEMATIQUE EST CORRIGÉ ICI !
                 const odds = notif.locked_odds || 2.00;
                 const winnings = Math.floor(notif.amount * odds);

                 return (
                   <div key={notif.id} className={`p-5 rounded-2xl border-4 flex flex-col ${isWinner ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                      <p className="font-black text-slate-700 leading-tight mb-2">{notif.bets.title}</p>
                      {isWinner ? (
                        <p className="text-emerald-600 font-black text-xl flex items-center gap-2"><span>🎉</span> Gagné ! <span className="bg-emerald-200 px-2 py-0.5 rounded-lg text-sm text-emerald-800">+{winnings} pts</span></p>
                      ) : (
                        <p className="text-red-500 font-bold flex items-center gap-2"><span>❌</span> Perdu <span className="text-sm text-red-400">-{notif.amount} pts</span></p>
                      )}
                   </div>
                 )
              })}
            </div>
            
            <button 
              onClick={markNotificationsAsRead} 
              className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-[0_5px_0_0_#4338ca] hover:translate-y-1 hover:shadow-none transition-all text-lg"
            >
              C'est noté, super !
            </button>
          </div>
        </div>
      )}
    </div>
  );
}