"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

export default function Multijoueur() {
  const [user, setUser] = useState<any>(null);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [betInput, setBetInput] = useState<string>("50");
  const [game, setGame] = useState<any>(null);
  const [myChoice, setMyChoice] = useState<string | null>(null);

  const gameRef = useRef(game);
  const userPointsRef = useRef(userPoints);
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { userPointsRef.current = userPoints; }, [userPoints]);

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const { data: profileData } = await supabase.from('profiles').select('points').eq('id', session.user.id).single();
        if (profileData) setUserPoints(profileData.points);
      } else {
        window.location.href = '/login';
      }
    }
    checkUser();
  }, []);

  useEffect(() => {
    if (!game) return;

    const sub = supabase.channel(`rps_room_${game.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rps_games', filter: `id=eq.${game.id}` }, (payload) => {
        const oldGame = gameRef.current;
        const newGame = payload.new;

        if (oldGame.status === 'waiting' && newGame.status === 'playing' && newGame.player1_id === user?.id) {
            const newPts = userPointsRef.current - newGame.final_bet;
            supabase.from('profiles').update({ points: newPts }).eq('id', user.id).then(() => setUserPoints(newPts));
        }

        if (newGame.choice_p1 && newGame.choice_p2 && newGame.status === 'playing') {
            if (newGame.player1_id === user?.id) {
                setTimeout(async () => {
                    const winner = determineWinner(newGame.choice_p1, newGame.choice_p2);
                    if (winner === 'tie') {
                        await supabase.from('rps_games').update({ choice_p1: null, choice_p2: null }).eq('id', newGame.id);
                    } else {
                        const winnerId = winner === 'p1' ? newGame.player1_id : newGame.player2_id;
                        await supabase.from('rps_games').update({ status: 'finished', winner_id: winnerId }).eq('id', newGame.id);
                    }
                }, 3000); 
            }
        }

        if (oldGame.status !== 'finished' && newGame.status === 'finished' && newGame.winner_id === user?.id) {
            const newPts = userPointsRef.current + (newGame.final_bet * 2);
            supabase.from('profiles').update({ points: newPts }).eq('id', user.id).then(() => setUserPoints(newPts));
        }

        if (oldGame.choice_p1 && !newGame.choice_p1) {
            setMyChoice(null); 
        }

        setGame(newGame);
      }).subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [game?.id, user?.id]);

  const determineWinner = (c1: string, c2: string) => {
      if (c1 === c2) return 'tie';
      if ((c1 === 'pierre' && c2 === 'ciseaux') || (c1 === 'feuille' && c2 === 'pierre') || (c1 === 'ciseaux' && c2 === 'feuille')) return 'p1';
      return 'p2';
  };

  const handlePlay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const bet = parseInt(betInput);
    if (bet <= 0 || bet > userPoints) return alert("Mise invalide ou fonds insuffisants !");

    const { data: waitingGames } = await supabase.from('rps_games').select('*').eq('status', 'waiting').neq('player1_id', user.id).limit(1);

    if (waitingGames && waitingGames.length > 0) {
      const match = waitingGames[0];
      const finalBet = Math.random() < 0.5 ? match.bet_p1 : bet;
      
      if (userPoints < finalBet) return alert(`L'adversaire a misé ${match.bet_p1} et tu n'as pas assez pour couvrir la mise finale !`);

      const { data: updatedMatch, error } = await supabase.from('rps_games').update({
        player2_id: user.id, bet_p2: bet, final_bet: finalBet, status: 'playing'
      }).eq('id', match.id).select().single();

      if (!error) {
        setGame(updatedMatch);
        const newPts = userPoints - finalBet;
        await supabase.from('profiles').update({ points: newPts }).eq('id', user.id);
        setUserPoints(newPts);
      }
    } else {
      const { data: newMatch, error } = await supabase.from('rps_games').insert([{
        player1_id: user.id, bet_p1: bet
      }]).select().single();

      if (!error) setGame(newMatch);
    }
  };

  const cancelMatchmaking = async () => {
    if (!game || !user) return;
    const { error } = await supabase.from('rps_games').delete().eq('id', game.id);
    if (!error) {
      setGame(null);
    } else {
      alert("Erreur lors de l'annulation. La partie a peut-être déjà commencé !");
    }
  };

  const makeChoice = async (choice: string) => {
      if (myChoice) return; 
      setMyChoice(choice);
      const isPlayer1 = game.player1_id === user.id;
      const updateField = isPlayer1 ? { choice_p1: choice } : { choice_p2: choice };
      await supabase.from('rps_games').update(updateField).eq('id', game.id);
  };

  const getEmoji = (choice: string) => {
      if (choice === 'pierre') return '✊';
      if (choice === 'feuille') return '✋';
      if (choice === 'ciseaux') return '✌️';
      return '❓';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col selection:bg-pink-500">
      
      {/* HEADER SÉCURISÉ */}
      <header className="bg-slate-800/80 backdrop-blur-md shadow-lg border-b border-slate-700 p-4 sticky top-0 z-20 flex justify-between items-center">
        
        {/* On affiche le bouton Retour SEULEMENT si on n'est pas en recherche (waiting) */}
        {game?.status === 'waiting' ? (
          <div className="w-24"></div> /* Boîte vide invisible pour garder l'alignement */
        ) : (
          <Link href="/" className="text-xl sm:text-2xl font-black text-indigo-400 hover:text-indigo-300 transition-colors">
            ⬅️ Retour
          </Link>
        )}

        <div className="bg-yellow-400/20 border border-yellow-500 text-yellow-400 px-4 py-2 rounded-2xl font-black flex items-center gap-2">
          🪙 {userPoints}
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-6 mt-8 flex-grow w-full flex flex-col items-center">
        <div className="text-center mb-8 sm:mb-12">
            <span className="text-5xl sm:text-6xl mb-4 block">⚔️</span>
            <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-indigo-500 mb-2">Pierre Feuille Ciseaux</h1>
            <p className="text-slate-400 font-bold">1 VS 1 en Temps Réel</p>
        </div>

        {/* ÉCRAN 1 : RECHERCHE DE MATCH */}
        {!game && (
            <div className="bg-slate-800 p-6 sm:p-8 rounded-[2rem] border-2 border-slate-700 w-full shadow-2xl text-center">
                <h2 className="text-2xl font-black mb-6">Prêt à combattre ?</h2>
                <form onSubmit={handlePlay} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">Ta Mise :</label>
                        <input type="number" min="1" max={userPoints} required value={betInput} onChange={(e) => setBetInput(e.target.value)} className="w-full bg-slate-900 border-2 border-slate-600 rounded-2xl py-4 text-center text-2xl font-black text-white focus:border-indigo-500 focus:outline-none transition-colors" />
                        <p className="text-xs text-slate-500 mt-2">Si les mises sont différentes, le destin choisira !</p>
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-[0_4px_0_0_#4338ca] active:translate-y-1 active:shadow-none transition-all text-xl">
                        Chercher un adversaire 🔍
                    </button>
                </form>
            </div>
        )}

        {/* ÉCRAN 2 : EN ATTENTE D'UN JOUEUR */}
        {game?.status === 'waiting' && (
            <div className="bg-slate-800 p-8 sm:p-12 rounded-[2rem] border-2 border-slate-700 w-full shadow-2xl text-center flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                <h2 className="text-2xl font-black text-indigo-400 mb-2 animate-pulse">Recherche en cours...</h2>
                <p className="text-slate-400 font-bold mb-10">En attente d'un adversaire digne de ce nom.</p>
                
                {/* BOUTON D'ANNULATION */}
                <button 
                  onClick={cancelMatchmaking}
                  className="bg-red-900/40 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/50 font-bold py-3 px-6 rounded-xl transition-all duration-300"
                >
                  ❌ Annuler la recherche
                </button>
            </div>
        )}

        {/* ÉCRAN 3 : LE COMBAT */}
        {game?.status === 'playing' && (
            <div className="w-full text-center">
                <div className="bg-indigo-900/50 border-2 border-indigo-500 p-4 rounded-2xl mb-8">
                    <p className="text-indigo-200 font-black">Mise Finale : <span className="text-yellow-400 text-2xl ml-2">{game.final_bet} 🪙</span></p>
                </div>

                {!game.choice_p1 || !game.choice_p2 ? (
                    <>
                        {!myChoice ? (
                            <div className="space-y-6">
                                <h2 className="text-2xl sm:text-3xl font-black mb-8">Choisis ton arme !</h2>
                                <div className="flex justify-center gap-2 sm:gap-4">
                                    {['pierre', 'feuille', 'ciseaux'].map(arme => (
                                        <button key={arme} onClick={() => makeChoice(arme)} className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-800 hover:bg-slate-700 border-4 border-slate-600 hover:border-pink-500 rounded-2xl sm:rounded-3xl text-3xl sm:text-4xl shadow-xl transition-all transform hover:scale-110">
                                            {getEmoji(arme)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-800 p-8 rounded-3xl border-2 border-slate-700">
                                <h2 className="text-2xl font-black text-emerald-400 mb-4 animate-pulse">Arme chargée !</h2>
                                <p className="text-slate-400 font-bold mb-4">L'adversaire réfléchit...</p>
                                <span className="text-6xl opacity-50">{getEmoji(myChoice)}</span>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="bg-slate-800 p-6 sm:p-8 rounded-[2rem] border-4 border-pink-500 w-full animate-in zoom-in duration-300">
                        <h2 className="text-2xl sm:text-3xl font-black mb-8 text-white">🔥 COMBAT 🔥</h2>
                        <div className="flex justify-between items-center px-2 sm:px-12">
                            <div className="text-center">
                                <p className="text-indigo-400 font-bold mb-2">Toi</p>
                                <div className="text-5xl sm:text-6xl animate-bounce">{getEmoji(game.player1_id === user.id ? game.choice_p1 : game.choice_p2)}</div>
                            </div>
                            <span className="text-2xl sm:text-3xl font-black text-slate-600">VS</span>
                            <div className="text-center">
                                <p className="text-red-400 font-bold mb-2">Adversaire</p>
                                <div className="text-5xl sm:text-6xl animate-bounce" style={{ animationDelay: '0.2s' }}>{getEmoji(game.player1_id === user.id ? game.choice_p2 : game.choice_p1)}</div>
                            </div>
                        </div>
                        <p className="mt-8 text-slate-400 font-bold animate-pulse">L'arbitre délibère...</p>
                    </div>
                )}
            </div>
        )}

        {/* ÉCRAN 4 : RÉSULTAT */}
        {game?.status === 'finished' && (
            <div className={`p-6 sm:p-8 rounded-[2rem] border-4 w-full shadow-2xl text-center transform transition-all ${game.winner_id === user.id ? 'bg-emerald-900/50 border-emerald-500' : 'bg-red-900/50 border-red-500'}`}>
                <span className="text-5xl sm:text-6xl mb-4 block">{game.winner_id === user.id ? '🏆' : '💀'}</span>
                <h2 className="text-3xl sm:text-4xl font-black mb-2">{game.winner_id === user.id ? 'VICTOIRE !' : 'DÉFAITE...'}</h2>
                
                {game.winner_id === user.id ? (
                    <p className="text-emerald-400 font-black text-lg sm:text-xl mb-8">Tu remportes {game.final_bet * 2} 🪙 !</p>
                ) : (
                    <p className="text-red-400 font-bold text-base sm:text-lg mb-8">Tes {game.final_bet} 🪙 sont perdus à jamais.</p>
                )}

                <button onClick={() => { setGame(null); setMyChoice(null); }} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-2xl shadow-[0_4px_0_0_#1e293b] active:translate-y-1 active:shadow-none transition-all text-lg sm:text-xl">
                    🔄 Retour au lobby
                </button>
            </div>
        )}
      </main>
    </div>
  );
}
