"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function AdminDashboard() {
  const [adminCode, setAdminCode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  
  // NOUVEAU : On ajoute des variables pour stocker les cotes (par défaut à 2.00)
  const [option1, setOption1] = useState('Oui');
  const [odds1, setOdds1] = useState('2.00'); 
  const [option2, setOption2] = useState('Non');
  const [odds2, setOdds2] = useState('2.00');
  
  const [recurrence, setRecurrence] = useState('none');
  const [recurrenceStart, setRecurrenceStart] = useState('');
  const [recurrenceEnd, setRecurrenceEnd] = useState('');

  const [bets, setBets] = useState<any[]>([]);
  const [status, setStatus] = useState({ message: '', type: '' });
  const [loading, setLoading] = useState(false);

  const fetchAllBets = async () => {
    const { data } = await supabase
      .from('bets')
      .select('*, bet_options(id, title, odds)') // Modifié pour récupérer les cotes
      .order('created_at', { ascending: false });
    if (data) setBets(data);
  };

  useEffect(() => {
    if (isAuthenticated) fetchAllBets();
  }, [isAuthenticated]);

  const checkCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminCode === 'PaulKlaudess1') setIsAuthenticated(true);
    else alert("Code incorrect ❌");
  };

  const handleCreateBet = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: betData, error: betError } = await supabase
        .from('bets')
        .insert([{
          title,
          open_at: recurrence !== 'none' ? new Date().toISOString() : new Date(startDate).toISOString(), 
          deadline: recurrence !== 'none' ? new Date().toISOString() : new Date(deadline).toISOString(),
          status: 'open',
          recurrence: recurrence,
          recurrence_start: recurrence !== 'none' ? recurrenceStart : null,
          recurrence_end: recurrence !== 'none' ? recurrenceEnd : null
        }])
        .select();

      if (betError) throw betError;

      // NOUVEAU : On enregistre les cotes saisies dans la base de données
      await supabase.from('bet_options').insert([
        { bet_id: betData[0].id, title: option1, odds: parseFloat(odds1) || 2.00 },
        { bet_id: betData[0].id, title: option2, odds: parseFloat(odds2) || 2.00 }
      ]);

      setStatus({ message: '✅ Pari créé avec ses cotes !', type: 'success' });
      setTitle(''); setStartDate(''); setDeadline(''); setRecurrence('none');
      setRecurrenceStart(''); setRecurrenceEnd('');
      setOdds1('2.00'); setOdds2('2.00'); // On remet les cotes à zéro pour le prochain pari
      fetchAllBets();
    } catch (error: any) {
      setStatus({ message: '❌ ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce pari définitivement ?")) return;
    const { error } = await supabase.from('bets').delete().eq('id', id);
    if (!error) fetchAllBets();
  };

  const handleResolveBet = async (betId: string, winningOptionId: string) => {
    if (!confirm("Confirmer cette réponse ? L'argent sera distribué et le pari fermé.")) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.rpc('resolve_bet', {
        p_bet_id: betId,
        p_winning_option_id: winningOptionId
      });

      if (error) throw error;

      setStatus({ message: '💰 Gains distribués avec succès !', type: 'success' });
      fetchAllBets(); 
    } catch (error: any) {
      setStatus({ message: '❌ Erreur de paiement : ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <form onSubmit={checkCode} className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-6 text-pink-500">Accès Restreint 👑</h1>
          <input 
            type="password" placeholder="Code secret" 
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white mb-4 text-center focus:border-pink-500 outline-none"
            value={adminCode} onChange={(e) => setAdminCode(e.target.value)}
          />
          <button className="w-full bg-pink-600 text-white font-bold py-3 rounded-xl hover:bg-pink-500 transition-all">
            Débloquer le Panneau
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
          <h1 className="text-3xl font-extrabold text-pink-500">👑 Admin ParisEcg</h1>
          <button onClick={() => window.location.href = '/'} className="bg-slate-800 py-2 px-4 rounded-lg font-bold">Retour site</button>
        </header>

        {status.message && (
          <div className={`p-4 rounded-xl mb-6 font-bold text-center ${status.type === 'error' ? 'bg-red-900/50 text-red-400' : 'bg-emerald-900/50 text-emerald-400'}`}>
            {status.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl h-fit">
            <h2 className="text-xl font-bold mb-6 text-indigo-400">Nouveau Pari</h2>
            <form onSubmit={handleCreateBet} className="space-y-4">
              <input type="text" placeholder="Titre..." required className="w-full bg-slate-900 p-3 rounded-xl outline-none focus:border-pink-500 border border-transparent" value={title} onChange={(e) => setTitle(e.target.value)} />
              
              {recurrence === 'none' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400">Date Début</label>
                    <input type="datetime-local" required className="w-full bg-slate-900 p-3 rounded-xl [color-scheme:dark]" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400">Date Fin</label>
                    <input type="datetime-local" required className="w-full bg-slate-900 p-3 rounded-xl [color-scheme:dark]" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                <label className="text-xs font-bold text-slate-400 mb-2 block">Récurrence</label>
                <select className="w-full bg-slate-900 p-3 rounded-xl outline-none text-slate-300 mb-3" value={recurrence} onChange={(e) => {
                  setRecurrence(e.target.value);
                  if (e.target.value !== 'none') {
                    setStartDate(new Date().toISOString().slice(0,16));
                    setDeadline(new Date().toISOString().slice(0,16));
                  }
                }}>
                  <option value="none">Aucune (Pari unique)</option>
                  <option value="monday">Tous les lundis</option>
                  <option value="tuesday">Tous les mardis</option>
                  <option value="wednesday">Tous les mercredis</option>
                  <option value="thursday">Tous les jeudis</option>
                  <option value="friday">Tous les vendredis</option>
                </select>

                {recurrence !== 'none' && (
                  <div className="grid grid-cols-2 gap-3 mt-2 animate-in fade-in slide-in-from-top-2">
                    <div>
                      <label className="text-xs font-bold text-slate-400">Ouverture</label>
                      <input type="time" required value={recurrenceStart} onChange={(e) => setRecurrenceStart(e.target.value)} className="w-full bg-slate-900 p-3 rounded-xl [color-scheme:dark] mt-1 text-pink-400" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400">Fermeture</label>
                      <input type="time" required value={recurrenceEnd} onChange={(e) => setRecurrenceEnd(e.target.value)} className="w-full bg-slate-900 p-3 rounded-xl [color-scheme:dark] mt-1 text-pink-400" />
                    </div>
                  </div>
                )}
              </div>

              {/* NOUVEAU : Les champs pour entrer les cotes dans l'interface ! */}
              <label className="text-xs font-bold text-slate-400 block mt-4">Options & Cotes</label>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex gap-2">
                  <input type="text" placeholder="Opt. 1" className="w-2/3 bg-slate-900 p-3 rounded-xl outline-none" value={option1} onChange={(e) => setOption1(e.target.value)} />
                  <input type="number" step="0.01" min="1.01" className="w-1/3 bg-slate-900 p-3 rounded-xl outline-none text-center text-pink-400 font-bold" value={odds1} onChange={(e) => setOdds1(e.target.value)} placeholder="Cote (ex: 1.50)" />
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="Opt. 2" className="w-2/3 bg-slate-900 p-3 rounded-xl outline-none" value={option2} onChange={(e) => setOption2(e.target.value)} />
                  <input type="number" step="0.01" min="1.01" className="w-1/3 bg-slate-900 p-3 rounded-xl outline-none text-center text-pink-400 font-bold" value={odds2} onChange={(e) => setOdds2(e.target.value)} placeholder="Cote (ex: 3.20)" />
                </div>
              </div>

              <button disabled={loading} className="w-full bg-indigo-600 py-4 rounded-xl font-bold shadow-lg hover:bg-indigo-500 transition-all disabled:opacity-50 mt-4">Lancer le pari !</button>
            </form>
          </div>

          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl overflow-hidden">
            <h2 className="text-xl font-bold mb-6 text-pink-400">Gérer les paris ({bets.length})</h2>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {bets.map(bet => (
                <div key={bet.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-700">
                  <div className="flex justify-between items-start mb-4">
                    <div className="max-w-[80%]">
                      <p className="font-bold text-base mb-1">{bet.title}</p>
                      {bet.status === 'closed' ? (
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-md font-bold">🔒 Pari Terminé</span>
                      ) : (
                        <span className="text-xs bg-emerald-900/50 text-emerald-400 border border-emerald-800 px-2 py-1 rounded-md font-bold">🟢 En cours</span>
                      )}
                    </div>
                    <button onClick={() => handleDelete(bet.id)} className="bg-red-900/30 text-red-500 p-2 rounded-lg hover:bg-red-900/50 transition-colors">
                      🗑️
                    </button>
                  </div>

                  {/* NOUVEAU : On affiche les cotes dans la liste pour que l'admin s'en souvienne */}
                  {bet.status === 'open' && bet.bet_options && (
                    <div className="mt-4 pt-4 border-t border-slate-800">
                      <p className="text-xs font-bold text-slate-400 mb-2">Qui est le gagnant ?</p>
                      <div className="flex gap-2">
                        {bet.bet_options.map((option: any) => (
                          <button 
                            key={option.id}
                            onClick={() => handleResolveBet(bet.id, option.id)}
                            disabled={loading}
                            className="flex-1 bg-slate-800 hover:bg-emerald-600 border border-slate-700 text-slate-300 hover:text-white font-bold py-2 rounded-lg text-sm transition-colors flex flex-col items-center disabled:opacity-50"
                          >
                            <span>{option.title}</span>
                            <span className="text-[10px] text-pink-400 mt-1">Cote: {option.odds}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}