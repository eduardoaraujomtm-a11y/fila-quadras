// Seletor de backend: usa Supabase quando as chaves existem, senão a store em memória.
// As Route Handlers importam APENAS deste módulo (sempre com await).
import * as mem from './store';

const useSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let _sbPromise;
async function backend() {
  if (useSupabase) {
    if (!_sbPromise) _sbPromise = import('./supabaseDb');
    return _sbPromise;
  }
  return mem;
}

export function usingSupabase() { return useSupabase; }

export async function snapshot() { return (await backend()).snapshot(); }
export async function checkIn(name) { return (await backend()).checkIn(name); }
export async function getPlayer(id) { return (await backend()).getPlayer(id); }
export async function presentSingles(exclude) { return (await backend()).presentSingles(exclude); }
export async function formGroup(creatorId, type, partnerIds) { return (await backend()).formGroup(creatorId, type, partnerIds); }
export async function addMember(groupId, playerId) { return (await backend()).addMember(groupId, playerId); }
export async function disbandGroup(groupId) { return (await backend()).disbandGroup(groupId); }
export async function setBatedorAvailable(v) { return (await backend()).setBatedorAvailable(v); }
export async function callNext(courtId) { return (await backend()).callNext(courtId); }
export async function startGame(courtId) { return (await backend()).startGame(courtId); }
export async function endGame(courtId) { return (await backend()).endGame(courtId); }
export async function extendGame(courtId, minutes) { return (await backend()).extendGame(courtId, minutes); }
export async function blockLesson(courtId, label, minutes) { return (await backend()).blockLesson(courtId, label, minutes); }
export async function unblockLesson(courtId) { return (await backend()).unblockLesson(courtId); }
export async function resetAll() { return (await backend()).resetAll(); }
export async function addSchedule(body) { return (await backend()).addSchedule(body); }
export async function removeSchedule(id) { return (await backend()).removeSchedule(id); }
export async function listSchedule() { return (await backend()).listSchedule(); }
