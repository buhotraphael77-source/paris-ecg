"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from './lib/supabase';

export default function Home() {
  // VARIABLES (Paris classiques, Utilisateur)
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [betAmount, setBetAmount] = useState("");
  const [realBets, setRealBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [userExistingBets, setUserExistingBets] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // VARIABLES (Création de pari)
  const [isCreatingBet, setIsCreatingBet] = useState(false);
  const [newBetTitle, setNewBetTitle] = useState("");
  const [newBetDeadline, setNewBetDeadline] = useState("");
  const [option1Title, setOption1Title] = useState("Oui");
  const [option1Odds, setOption1Odds] = useState("");
  const [option2Title, setOption2Title] = useState("Non");
  const [option2Odds, setOption2Odds] = useState("");

  // VARIABLES (Course de Chevaux - ex-Billes)
  const [currentHorseRace, setCurrentHorseRace] = useState<any>(null);
  const [myHorseBet, setMyHorseBet] = useState<number | null>(null);
  const [showRaceModal, setShowRaceModal] = useState(false);
  const [raceStarted, setRaceStarted] = useState(false);
  const [raceDurations, setRaceDurations] = useState<{ [key: number]: number }>({});
  const [showRaceResults, setShowRaceResults] = useState(false);
  
  // Sécurité pour le lancement automatique
  const autoRaceTriggered = useRef(false);

  // VARIABLE (Guide)
  const [showGuideModal, setShowGuideModal] = useState(false);

  // --- LOGIQUE TEMPORELLE DU PLANNING ---
  const [timeState, setTimeState] = useState({
    isBettingOpen: false,
    isPreparing: false,
    isLiveOrReplay: false,
    isCleaning: false
  });

  const calculateTimePhase = () => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes(); 

    const TIME_1200 = 12 * 60;
    const TIME_1250 = 12 * 60 + 50;
    const TIME_1500 = 15 * 60;
    const TIME_1505 = 15 * 60 + 5;

    setTimeState({
      isBettingOpen: currentTime >= TIME_1505 || currentTime < TIME_1200,
      isPreparing: currentTime >= TIME_1200 && currentTime < TIME_1250,
      isLiveOrReplay: currentTime >= TIME_1250 && currentTime < TIME_1500,
      isCleaning: currentTime >= TIME_1500 && currentTime < TIME_1505
    });
  };

  const fetchBets = async () => {
    const { data } = await supabase.from('bets').select('id, title, open_at, deadline, recurrence, recurrence_start, recurrence_end, bet_options ( id, title, odds, user_bets ( id ) )').eq('status', 'open');
    if (data) {
      const activeBets = data.filter(bet => {
        const now = new Date();
        if (!bet.recurrence || bet.recurrence === 'none') {
           const openAtDate = bet.open_at ? new Date(bet.open_at) : new Date(0);
           const deadlineDate = new Date(bet.deadline);
           return now >= openAtDate && now <= deadlineDate;
        }
        const dayMap: { [key: number]: string } = { 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' };
        const currentDay = dayMap[now.getDay()];
        if (bet.recurrence !== currentDay) return false;
        const currentHours = now.getHours().toString().padStart(2, '0');
        const currentMinutes = now.getMinutes().toString().padStart(2, '0');
        const currentTime = `${currentHours}:${currentMinutes}`;
        if (bet.recurrence_start && bet.recurrence_end) return currentTime >= bet.recurrence_start && currentTime <= bet.recurrence_end;
        return true; 
      });
      setRealBets(activeBets.reverse());
    }
  };

  const fetchHorseRace = async (userId: string | undefined) => {
    calculateTimePhase(); 
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    if (currentTime >= (12 * 60 + 50) && currentTime < (15 * 60)) {
      await supabase.rpc('trigger_marble_race'); // Toujours "marble" en base de données pour ne rien casser
    }

    const targetDate = new Date();
    if (currentTime >= (15 * 60 + 5)) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    
    const targetString = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

    const { data: races } = await supabase.from('marble_races').select('*').eq('race_date', targetString).limit(1);
    
    if (races && races.length > 0) {
        const race = races[0];
        setCurrentHorseRace(race);
        if (userId) {
            const { data: myBet } = await supabase.from('marble_bets').select('marble_number').eq('race_id', race.id).eq('user_id', userId).maybeSingle();
            if (myBet) setMyHorseBet(myBet.marble_number);
            else setMyHorseBet(null);
        }
    }
    setLoading(false);
  };

  const fetchEverything = async () => {
    fetchBets();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) fetchHorseRace(session.user.id);
    else fetchHorseRace(undefined);
  };

  // CHRONOMÈTRE AUTOMATIQUE
  useEffect(() => {
    const clockInterval = setInterval(() => {
      calculateTimePhase();
      const now = new Date();
      if (now.getHours() === 12 && now.getMinutes() === 50 && !autoRaceTriggered.current) {
        autoRaceTriggered.current = true;
        triggerAutomaticRace();
      }
      if (now.getHours() === 0 && now.getMinutes() === 0) autoRaceTriggered.current = false;
    }, 1000); 

    return () => clearInterval(clockInterval);
  }, [user, myHorseBet]);

  const triggerAutomaticRace = async () => {
    await supabase.rpc('trigger_marble_race');
    await fetchEverything();
    if (myHorseBet) {
      setShowRaceModal(true);
      startLiveRace();
    }
  };

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;
      if (currentUserId) {
        setUser(session.user);
        let { data: profileData } = await supabase.from('profiles').select('points').eq('id', currentUserId).maybeSingle(); 
        if (profileData) setUserPoints(profileData.points);
        const { data: myBets } = await supabase.from('user_bets').select('bet_id').eq('user_id', currentUserId);
        if (myBets) setUserExistingBets(myBets.map(bet => bet.bet_id));
        const { data: unreadBets } = await supabase.from('user_bets').select(`id, amount, option_id, locked_odds, bets!inner ( title, status, winning_option_id )`).eq('user_id', currentUserId).eq('is_read', false).eq('bets.status', 'closed');
        if (unreadBets) setNotifications(unreadBets);
      }
      await fetchHorseRace(currentUserId);
    }
    checkUser();
    fetchBets();
    const interval = setInterval(fetchEverything, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = async () => { await supabase.auth.signOut(); window.location.href = '/login'; };
  const openModal = (option: any, betId: string, betTitle: string) => { setSelectedOption({ ...option, betId, betTitle }); };
  const closeModal = () => { setSelectedOption(null); setBetAmount(""); };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amount = parseInt(betAmount);
    if (amount <= 0 || amount > userPoints) return alert("Mise invalide ou fonds insuffisants !");
    const { error } = await supabase.from('user_bets').insert([{ user_id: user.id, bet_id: selectedOption.betId, option_id: selectedOption.id, amount: amount, locked_odds: selectedOption.odds }]);
    if (error) return alert("Erreur lors du pari !");
    const newPoints = userPoints - amount;
    await supabase.from('profiles').update({ points: newPoints }).eq('id', user.id);
    setUserPoints(newPoints);
    setUserExistingBets([...userExistingBets, selectedOption.betId]);
    closeModal();
    fetchBets();
  };

  const markNotificationsAsRead = async () => {
    const ids = notifications.map(n => n.id);
    await supabase.from('user_bets').update({ is_read: true }).in('id', ids);
    setNotifications([]);
  };

  const handleCreateBet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const badWords = ['merde', 'putain', 'con', 'connard', 'salut', 'nul']; 
    if (badWords.some(word => newBetTitle.toLowerCase().includes(word))) return alert("🚨 Oups ! Ton titre contient un mot non autorisé.");
    const o1 = parseFloat(option1Odds); const o2 = parseFloat(option2Odds);
    if (o1 < 1.2 || o1 > 3 || o2 < 1.2 || o2 > 3) return alert("Cotes invalides !");
    if (new Date(newBetDeadline) <= new Date()) return alert("⚠️ La date de fin doit être dans le futur !");
    const { data: newBet, error } = await supabase.from('bets').insert([{ title: newBetTitle, deadline: newBetDeadline, status: 'open', recurrence: 'none', creator_id: user.id }]).select().single();
    if (!error && newBet) {
      await supabase.from('bet_options').insert([{ bet_id: newBet.id, title: option1Title, odds: o1 }, { bet_id: newBet.id, title: option2Title, odds: o2 }]);
      alert("Pari créé !"); setIsCreatingBet(false); fetchBets();
    }
  };

  const handleHorseBet = async (horseNumber: number) => {
    if (!user || !currentHorseRace) return;
    if (userPoints < 50) return alert("🪙 Fonds insuffisants !");
    if (!window.confirm(`Parier 50 pièces sur le Cheval N°${horseNumber} ?`)) return;
    const { error } = await supabase.from('marble_bets').insert([{ user_id: user.id, race_id: currentHorseRace.id, marble_number: horseNumber }]);
    if (error) return alert("Tu as déjà un ticket !");
    const newPoints = userPoints - 50;
    await supabase.from('profiles').update({ points: newPoints }).eq('id', user.id);
    setUserPoints(newPoints);
    setMyHorseBet(horseNumber);
  };

  const startLiveRace = () => {
    if (!currentHorseRace) return;
    const durations: { [key: number]: number } = {};
    for(let i = 1; i <= 10; i++) {
        if(i === currentHorseRace.winner_1) durations[i] = 8; 
        else if(i === currentHorseRace.winner_2) durations[i] = 8.8; 
        else if(i === currentHorseRace.winner_3) durations[i] = 9.5; 
        else durations[i] = 10 + Math.random() * 2; 
    }
    setRaceDurations(durations); 
    setRaceStarted(false); 
    setShowRaceResults(false);
    
    setTimeout(() => {
        setRaceStarted(true);
        setTimeout(() => { setShowRaceResults(true); fetchEverything(); }, 12500); 
    }, 500);
  };

  return (
    <div className="min-h-screen bg-indigo-50 text-slate-900 font-sans pb-12 flex flex-col selection:bg-pink-300">
      <header className="bg-white/90 backdrop-blur-md shadow-sm border-b-4 border-indigo-100 p-4 sticky top-0 z-20 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-black text-indigo-700 tracking-tight transform -rotate-2 hover:rotate-0 transition-transform cursor-pointer">🎲 Paris<span className="text-pink-500">Ecg</span></h1>
          <div className="hidden sm:flex gap-3">
            <Link href="/leaderboard" className="flex items-center gap-2 bg-white border-2 border-slate-200 text-slate-700 font-black py-2 px-4 rounded-xl text-sm shadow-[0_3px_0_0_#e2e8f0] hover:translate-y-0.5 hover:shadow-[0_1px_0_0_#e2e8f0] transition-all">🏆 Top</Link>
            <Link href="/historique" className="flex items-center gap-2 bg-white border-2 border-slate-200 text-slate-700 font-black py-2 px-4 rounded-xl text-sm shadow-[0_3px_0_0_#e2e8f0] hover:translate-y-0.5 hover:shadow-[0_1px_0_0_#e2e8f0] transition-all">📜 Historique</Link>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <div className="hidden sm:block font-bold text-slate-600 text-sm">Salut, <span className="text-indigo-600">{user.user_metadata?.username || 'Joueur'}</span></div>
              <div className="bg-yellow-300 border-2 border-yellow-500 text-yellow-900 px-4 py-2 rounded-2xl font-black shadow-[0_3px_0_0_#eab308] flex items-center gap-2">
                <span className="animate-bounce">🪙</span> {userPoints}
              </div>
            </>
          ) : (
            <button onClick={() => window.location.href = '/login'} className="bg-indigo-600 text-white font-black py-2 px-5 rounded-2xl">Go !</button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 mt-6 flex-grow w-full">
        
        {/* LA SECTION COURSE DE CHEVAUX */}
        {currentHorseRace && user && (
          <div className="bg-gradient-to-br from-emerald-900 to-slate-900 rounded-[2rem] p-6 sm:p-8 shadow-2xl border-4 border-emerald-400 mb-8 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl transform rotate-12 group-hover:rotate-0 transition-transform duration-700">🐎</div>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row justify-between md:items-start mb-6 gap-4">
                <div>
                  <span className="bg-amber-400 text-amber-900 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest mb-2 inline-block shadow-sm">Hippodrome</span>
                  <h2 className="text-3xl font-black mb-1 text-white">Course de Chevaux</h2>
                  <p className="text-emerald-200 font-bold">Départ: 12h50. <span className="text-pink-300">Fin des paris: 12h00.</span> <span className="bg-white/20 px-2 py-0.5 rounded-md ml-1">Mise: 50 🪙</span></p>
                </div>
              </div>

              <div className="bg-white/10 p-5 rounded-2xl border border-white/20 backdrop-blur-md">
                
                {timeState.isCleaning && (
                  <div className="text-center py-6">
                      <span className="text-5xl mb-4 block animate-bounce">🧹</span>
                      <h3 className="text-2xl font-black text-white">Nettoyage des écuries...</h3>
                      <p className="text-emerald-200 mt-2 font-bold max-w-md mx-auto">Les guichets rouvrent à 15h05 précises pour la prochaine course !</p>
                  </div>
                )}

                {timeState.isLiveOrReplay && (
                   <div className="text-center py-6">
                       <span className="text-5xl mb-4 block">🏆</span>
                       <h3 className="text-2xl font-black text-white">Le Grand Prix du Jour !</h3>
                       {myHorseBet ? (
                         <div className="mt-4">
                            <p className="text-amber-300 font-black text-lg mb-4">Ticket Validé : Cheval N°{myHorseBet}</p>
                            <button onClick={() => { setShowRaceModal(true); startLiveRace(); }} className="bg-red-600 hover:bg-red-500 text-white font-black py-4 px-8 rounded-2xl shadow-[0_4px_0_0_#991b1b] hover:translate-y-1 hover:shadow-none transition-all text-xl flex items-center justify-center gap-3 mx-auto border-2 border-red-400">
                              📺 Suivre la course !
                            </button>
                         </div>
                       ) : (
                          <p className="text-red-300 font-bold max-w-md mx-auto mt-2 bg-red-900/50 p-4 rounded-xl border border-red-500">Tu n'as pas acheté de ticket à temps pour cette course. Reviens après 15h05 pour parier sur demain !</p>
                       )}
                   </div>
                )}

                {timeState.isPreparing && (
                  <div className="text-center py-6">
                      <span className="text-5xl mb-4 block">🚧</span>
                      <h3 className="text-2xl font-black text-white">Les chevaux s'échauffent...</h3>
                      {myHorseBet && <p className="text-amber-300 font-black text-lg mb-4 mt-2">Ticket en poche : Cheval N°{myHorseBet}</p>}
                      <p className="text-emerald-200 mt-2 font-bold max-w-md mx-auto">Les paris sont clos. Reste connecté, départ imminent à 12h50 !</p>
                  </div>
                )}

                {timeState.isBettingOpen && (
                  myHorseBet ? (
                    <div className="text-center py-4">
                      <span className="text-4xl mb-3 block animate-bounce">🎟️</span>
                      <h3 className="text-xl font-black text-white">Ticket validé ! (Cheval N°{myHorseBet})</h3>
                      <p className="text-emerald-200 mt-4 font-bold bg-black/30 p-3 rounded-xl border border-white/10 inline-block">⏳ Reviens à 12h50 pour le grand départ !</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-center font-bold text-emerald-100 mb-4">Choisis ton crack pour la prochaine course :</p>
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 sm:gap-3">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                          <button key={num} onClick={() => handleHorseBet(num)} className="aspect-square flex flex-col items-center justify-center rounded-xl font-black text-sm sm:text-base shadow-[0_4px_0_0_#0f766e] transition-all border-2 border-white bg-gradient-to-b from-white to-emerald-50 text-emerald-900 hover:translate-y-1 hover:shadow-[0_2px_0_0_#0f766e] hover:border-amber-400 active:translate-y-2 active:shadow-none">
                            <span className="text-lg sm:text-xl">🐎</span>
                            {num}
                          </button>
                        ))}
                      </div>
                    </>
                  )
                )}

              </div>
            </div>
          </div>
        )}

        {/* LA BANNIÈRE DU JEU MULTIJOUEUR */}
        {user && (
          <div className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-[2rem] p-6 sm:p-8 shadow-2xl border-4 border-pink-300 mb-12 text-white relative overflow-hidden group flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="absolute -left-10 -bottom-10 text-9xl opacity-20 transform -rotate-12 group-hover:rotate-0 transition-transform duration-500">⚔️</div>
            <div className="relative z-10 text-center sm:text-left">
              <span className="bg-white text-pink-600 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest mb-2 inline-block shadow-sm">Nouveau Jeu !</span>
              <h2 className="text-3xl font-black mb-1">Pierre Feuille Ciseaux</h2>
              <p className="text-pink-100 font-bold">Défie un autre joueur en temps réel !</p>
            </div>
            <Link href="/multijoueur" className="relative z-10 bg-white text-pink-600 hover:bg-pink-50 font-black py-4 px-8 rounded-2xl shadow-[0_4px_0_0_#be185d] hover:translate-y-1 hover:shadow-none transition-all text-xl flex items-center justify-center gap-3 border-2 border-pink-200 w-full sm:w-auto">Jouer maintenant 🎮</Link>
          </div>
        )}

        {/* SECTION DES PARIS CLASSIQUES */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 gap-4">
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Paris en cours 🔥</h2>
          {user && (
            <button onClick={() => setIsCreatingBet(true)} className="bg-emerald-500 text-white font-black py-3 px-6 rounded-2xl shadow-[0_4px_0_0_#047857] hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-2"><span className="text-xl">✨</span> Créer mon pari</button>
          )}
        </div>

        {loading && <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-emerald-600"></div></div>}
        
        {!loading && realBets.length === 0 && (
          <div className="bg-white border-4 border-dashed border-slate-300 rounded-3xl p-12 text-center">
             <span className="text-4xl block mb-4">😴</span>
             <h3 className="text-xl font-black text-slate-500">Aucun pari disponible...</h3>
             <p className="text-slate-400 mt-2">Crée le premier pari pour défier tes amis !</p>
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
                      {bet.recurrence !== 'none' ? `Fini à ${bet.recurrence_end} ajd` : `Fin le ${new Date(bet.deadline).toLocaleDateString('fr-FR')} à ${new Date(bet.deadline).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}`}
                    </span>
                    <h3 className="text-xl font-black mb-6 text-slate-800 leading-snug">{bet.title}</h3>
                  </div>

                  {hasBetted ? (
                    <div className="relative z-10 mt-auto bg-emerald-100 border-b-4 border-emerald-300 text-emerald-700 text-center font-black py-4 rounded-2xl flex items-center justify-center gap-2"><span className="text-xl">✅</span> Pari enregistré</div>
                  ) : (
                    <div className="relative z-10 flex gap-3 mt-auto">
                      {bet.bet_options.map((option: any) => (
                          <button key={option.id} onClick={() => openModal(option, bet.id, bet.title)} className="flex-1 bg-white hover:bg-indigo-50 text-slate-700 font-black py-4 px-2 rounded-2xl border-2 border-slate-200 shadow-[0_4px_0_0_#e2e8f0] hover:border-indigo-300 hover:text-indigo-700 hover:shadow-[0_4px_0_0_#c7d2fe] active:shadow-[0_0px_0_0_#c7d2fe] active:translate-y-1 transition-all flex flex-col items-center justify-center">
                            <span className="text-lg">{option.title}</span>
                            <div className="flex flex-col items-center mt-2 opacity-90">
                              <span className="text-xs text-pink-500 bg-pink-50 px-2 py-0.5 rounded-md border border-pink-100 mb-1">Cote: {option.odds}</span>
                              <span className="text-[11px] text-slate-400 font-bold">👤 {option.user_bets ? option.user_bets.length : 0} joueur(s)</span>
                            </div>
                          </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MENU DU BAS */}
      {user && (
        <div className="max-w-4xl mx-auto px-4 pb-8 mt-4 w-full flex flex-col items-center gap-4 text-center">
          <button onClick={() => setShowGuideModal(true)} className="w-full max-w-sm bg-indigo-100 text-indigo-700 font-black py-4 px-8 rounded-2xl shadow-[0_4px_0_0_#c7d2fe] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 mb-2 hover:bg-indigo-200"><span className="text-xl">ℹ️</span> Comment ça marche ?</button>
          <Link href="/leaderboard" className="sm:hidden w-full max-w-sm bg-white border-2 border-slate-200 text-slate-700 font-black py-4 px-8 rounded-2xl shadow-[0_4px_0_0_#e2e8f0] active:translate-y-1 active:shadow-none transition-all">🏆 Voir le Classement</Link>
          <Link href="/historique" className="sm:hidden w-full max-w-sm bg-white border-2 border-slate-200 text-slate-700 font-black py-4 px-8 rounded-2xl shadow-[0_4px_0_0_#e2e8f0] active:translate-y-1 active:shadow-none transition-all">📜 Mon Historique</Link>
          <button onClick={handleSignOut} className="w-full max-w-sm mt-4 text-slate-400 hover:text-red-500 font-bold py-2 transition-colors underline decoration-2 underline-offset-4">Me déconnecter</button>
        </div>
      )}

      {/* ------------------- MODALES --------------------- */}
      
      {showGuideModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
          <div className="bg-white rounded-[2rem] p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200 border-4 border-indigo-100 relative">
            <button onClick={() => setShowGuideModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 font-black text-xl w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full">✕</button>
            <h2 className="text-3xl font-black text-indigo-800 mb-6 flex items-center gap-3 border-b-2 border-indigo-100 pb-4"><span className="text-4xl">📖</span> Guide ParisEcg</h2>
            <div className="space-y-8 text-slate-700">
              <section><h3 className="text-xl font-black text-slate-900 mb-2 flex items-center gap-2"><span>🎯</span> 1. Les Paris Classiques</h3><p className="leading-relaxed font-medium bg-slate-50 p-4 rounded-xl border-2 border-slate-100">Parie sur des événements de la vie de l'école. Choisis ton option, défini ta mise et c'est tout !</p></section>
              <section><h3 className="text-xl font-black text-slate-900 mb-2 flex items-center gap-2"><span>🐎</span> 2. Course de Chevaux</h3><p className="leading-relaxed font-medium bg-amber-50 p-4 rounded-xl border-2 border-amber-200">La course se lance <strong>automatiquement à 12h50</strong>. Attention, fin des paris à 12h00 ! Les guichets rouvrent à 15h05 pour la course du lendemain.</p></section>
              <section><h3 className="text-xl font-black text-slate-900 mb-2 flex items-center gap-2"><span>⚔️</span> 3. Jeu Multijoueur</h3><p className="leading-relaxed font-medium bg-pink-50 p-4 rounded-xl border-2 border-pink-200">Défie un autre joueur au Pierre-Feuille-Ciseaux en ligne.</p></section>
            </div>
            <button onClick={() => setShowGuideModal(false)} className="w-full mt-8 bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-[0_4px_0_0_#4338ca]">J'ai tout compris, let's go !</button>
          </div>
        </div>
      )}
      
      {isCreatingBet && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
             <div className="bg-white rounded-[2rem] p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border-4 border-emerald-100 max-h-[90vh] overflow-y-auto">
                 <div className="flex items-center gap-3 mb-6"><span className="text-3xl">✨</span><h3 className="text-2xl font-black text-slate-800">Nouveau Pari</h3></div>
                 <form onSubmit={handleCreateBet} className="space-y-4">
                     <div><input type="text" required value={newBetTitle} onChange={(e) => setNewBetTitle(e.target.value)} className="w-full bg-slate-50 border-4 border-slate-200 rounded-2xl p-3 font-bold text-slate-800" placeholder="Ex: Le prof va-t-il dire 'Bonjour' ?" /></div>
                     <div><input type="datetime-local" required value={newBetDeadline} onChange={(e) => setNewBetDeadline(e.target.value)} className="w-full bg-slate-50 border-4 border-slate-200 rounded-2xl p-3 font-bold text-slate-800" /></div>
                     <div className="flex gap-4">
                         <div className="flex-1"><input type="text" required value={option1Title} onChange={(e) => setOption1Title(e.target.value)} className="w-full bg-slate-50 border-4 border-slate-200 rounded-2xl p-3 font-bold text-slate-800 mb-2" placeholder="Choix 1" /><input type="number" step="0.01" min="1.2" max="3" required value={option1Odds} onChange={(e) => setOption1Odds(e.target.value)} placeholder="Cote" className="w-full bg-slate-50 border-4 border-slate-200 rounded-2xl p-3 font-bold text-slate-800" /></div>
                         <div className="flex-1"><input type="text" required value={option2Title} onChange={(e) => setOption2Title(e.target.value)} className="w-full bg-slate-50 border-4 border-slate-200 rounded-2xl p-3 font-bold text-slate-800 mb-2" placeholder="Choix 2" /><input type="number" step="0.01" min="1.2" max="3" required value={option2Odds} onChange={(e) => setOption2Odds(e.target.value)} placeholder="Cote" className="w-full bg-slate-50 border-4 border-slate-200 rounded-2xl p-3 font-bold text-slate-800" /></div>
                     </div>
                     <div className="flex gap-4 mt-6"><button type="button" onClick={() => setIsCreatingBet(false)} className="flex-1 bg-slate-100 text-slate-500 font-black py-4 rounded-2xl border-2 border-slate-200">Annuler</button><button type="submit" className="flex-[2] bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-[0_4px_0_0_#047857]">Mettre en ligne</button></div>
                 </form>
             </div>
         </div>
      )}

      {selectedOption && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[2rem] p-6 w-full max-w-md shadow-2xl border-4 border-indigo-100">
                <div className="bg-indigo-50 rounded-2xl p-4 mb-6 border-2 border-indigo-100"><p className="text-sm text-indigo-400 font-bold mb-1">Tu paries sur :</p><h3 className="text-xl font-black text-indigo-900">{selectedOption.betTitle}</h3></div>
                <form onSubmit={handleSubmit}>
                    <div className="mb-8"><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl">🪙</span><input type="number" min="1" max={userPoints} required value={betAmount} onChange={(e) => setBetAmount(e.target.value)} className="w-full bg-slate-50 border-4 border-slate-200 rounded-2xl py-4 pl-14 pr-4 text-xl font-black" placeholder={`Max: ${userPoints}`}/></div></div>
                    <div className="flex gap-4"><button type="button" onClick={closeModal} className="flex-1 bg-slate-100 text-slate-500 font-black py-4 rounded-2xl border-2 border-slate-200">Annuler</button><button type="submit" className="flex-[2] bg-pink-500 text-white font-black py-4 rounded-2xl shadow-[0_4px_0_0_#be185d]">Valider !</button></div>
                </form>
            </div>
          </div>
      )}

      {/* 🚀 LE NOUVEL HIPPODROME COMPACT ET LISIBLE (Toutes les pistes visibles) */}
      {showRaceModal && currentHorseRace && (
          <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl flex items-center justify-center z-[200] p-2 sm:p-4">
              <div className="bg-emerald-900 rounded-2xl sm:rounded-[2rem] p-3 sm:p-6 w-full max-w-3xl shadow-2xl border-4 border-amber-600 relative overflow-hidden flex flex-col">
                
                <div className="flex justify-between items-center mb-3 sm:mb-4 shrink-0">
                  <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">🏁 Grand Prix</h2>
                  {!showRaceResults && <div className="bg-red-600 text-white px-2 py-1 rounded-md font-black text-xs animate-pulse">🔴 DIRECT</div>}
                </div>
                
                {/* LA PISTE (Sable de l'hippodrome) */}
                <div className="bg-[#b45309] border-4 border-[#78350f] rounded-xl p-2 relative flex-grow">
                    
                    {/* Lignes de Départ et d'Arrivée */}
                    <div className="absolute top-0 bottom-0 left-[2.5rem] sm:left-[3.5rem] w-1 bg-white/30 z-0"></div>
                    <div className="absolute top-0 bottom-0 right-[1rem] sm:right-[1.5rem] w-2 sm:w-3 bg-red-600 border-x border-white z-0 opacity-90"></div>
                    
                    {/* Les 10 couloirs très compacts */}
                    <div className="flex flex-col gap-[2px] sm:gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                            <div key={num} className="flex items-center h-6 sm:h-8 relative z-10 border-b border-black/10 last:border-0">
                                
                                {/* Numéro du cheval */}
                                <div className="w-6 sm:w-10 flex-shrink-0 text-center font-black text-amber-200 text-xs sm:text-sm">
                                  {num}
                                </div>
                                
                                {/* Zone de course */}
                                <div className="flex-grow h-full relative border-l border-white/20">
                                    <div 
                                      className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center transition-all ease-in-out
                                          ${num === myHorseBet ? 'z-20 scale-125 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : 'opacity-90'}
                                      `} 
                                      style={{ 
                                        left: raceStarted ? 'calc(100% - 2rem)' : '0px', 
                                        transitionDuration: raceStarted ? `${raceDurations[num]}s` : '0s',
                                        fontSize: '1.5rem'
                                      }}
                                    >
                                        {num === myHorseBet ? '🏇' : '🐎'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                {showRaceResults && (
                    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-500 p-4">
                        <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border-4 border-amber-400">
                            <h3 className="text-2xl font-black text-slate-800 mb-6">Podium 🏆</h3>
                            <div className="space-y-3 mb-8">
                              <p className="text-xl font-black text-amber-500">🥇 Cheval {currentHorseRace.winner_1}</p>
                              <p className="text-lg font-black text-slate-400">🥈 Cheval {currentHorseRace.winner_2}</p>
                              <p className="text-base font-black text-amber-700">🥉 Cheval {currentHorseRace.winner_3}</p>
                            </div>
                            <button onClick={() => setShowRaceModal(false)} className="w-full bg-slate-800 text-white font-black py-3 rounded-xl shadow-[0_4px_0_0_#0f172a]">Fermer</button>
                        </div>
                    </div>
                )}
              </div>
          </div>
      )}

      {notifications.length > 0 && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl text-center animate-in zoom-in duration-300 border-4 border-white">
                  <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-yellow-200"><span className="text-4xl animate-bounce">🔔</span></div>
                  <h2 className="text-2xl font-black text-slate-800 mb-6">Nouveaux Résultats !</h2>
                  <div className="space-y-4 max-h-[50vh] overflow-y-auto mb-8 text-left pr-2">
                      {notifications.map(notif => {
                          const isWinner = notif.option_id === notif.bets.winning_option_id;
                          return (
                              <div key={notif.id} className={`p-5 rounded-2xl border-4 flex flex-col ${isWinner ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                  <p className="font-black text-slate-700 mb-2">{notif.bets.title}</p>
                                  {isWinner ? <p className="text-emerald-600 font-black">🎉 Gagné ! +{Math.floor(notif.amount * (notif.locked_odds || 2.00))} pts</p> : <p className="text-red-500 font-bold">❌ Perdu -{notif.amount} pts</p>}
                              </div>
                          )
                      })}
                  </div>
                  <button onClick={markNotificationsAsRead} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-[0_5px_0_0_#4338ca]">C'est noté !</button>
              </div>
          </div>
      )}

    </div>
  );
}