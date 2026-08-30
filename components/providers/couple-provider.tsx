import { createContext, use, useState, type ReactNode } from 'react';

import * as seed from '@/mocks/couple';
import type {
  BucketListItem,
  CheckinState,
  Goal,
  MoodKey,
  NeedKey,
  Todo,
  WikiEntry,
} from '@/types/domain';

/**
 * The single source of truth for the UI layer.
 *
 * This is the seam. Every screen reads through the hooks in `hooks/`, which
 * read this context. When the API lands, the hook bodies become queries and
 * mutations and this provider goes away — no screen file changes.
 */

export type CoupleStore = {
  // people
  you: typeof seed.you;
  partner: typeof seed.partner;
  togetherSince: string;
  coupleCode: string;

  // check-in
  yourCheckin: CheckinState;
  partnerCheckin: CheckinState;
  setMood: (mood: MoodKey) => void;
  setBattery: (battery: number) => void;
  setNeed: (need: NeedKey) => void;
  saveCheckin: () => void;

  // streak + progression
  streak: number;
  level: number;
  checkedOnThem: boolean;
  toggleCheckedOnThem: () => void;

  // lists
  todos: Todo[];
  toggleTodo: (id: string) => void;
  addTodo: (label: string) => void;

  goals: Goal[];
  addGoal: (goal: Omit<Goal, 'id'>) => void;
  toggleGoal: (id: string) => void;

  bucketList: BucketListItem[];
  toggleBucketItem: (id: string) => void;

  wiki: WikiEntry[];
  updateWikiEntry: (id: string, value: string) => void;

  // coach

  // monetisation
  isPremium: boolean;
  upgrade: () => void;

  // pairing
  isPaired: boolean;
  pair: () => void;
  unpair: () => void;
};

const CoupleContext = createContext<CoupleStore | null>(null);

let nextId = 0;
const makeId = (prefix: string) => `${prefix}${Date.now()}-${nextId++}`;

export function CoupleProvider({ children }: { children: ReactNode }) {
  const [yourCheckin, setYourCheckin] = useState<CheckinState>(seed.yourCheckin);
  const [partnerCheckin] = useState<CheckinState>(seed.partnerCheckin);
  const [streak, setStreak] = useState(seed.initialStreak);
  const [level] = useState(seed.initialLevel);
  const [checkedOnThem, setCheckedOnThem] = useState(false);
  const [todos, setTodos] = useState<Todo[]>(seed.todos);
  const [goals, setGoals] = useState<Goal[]>(seed.goals);
  const [bucketList, setBucketList] = useState<BucketListItem[]>(seed.bucketList);
  const [wiki, setWiki] = useState<WikiEntry[]>(seed.wiki);
  const [isPremium, setIsPremium] = useState(false);
  const [isPaired, setIsPaired] = useState(false);

  const store: CoupleStore = {
    you: seed.you,
    partner: seed.partner,
    togetherSince: seed.togetherSince,
    coupleCode: seed.coupleCode,

    yourCheckin,
    partnerCheckin,
    setMood: (mood) => setYourCheckin((c) => ({ ...c, mood })),
    setBattery: (battery) => setYourCheckin((c) => ({ ...c, battery })),
    setNeed: (need) => setYourCheckin((c) => ({ ...c, need })),
    saveCheckin: () =>
      setYourCheckin((c) => {
        if (!c.savedToday) setStreak((s) => s + 1);
        return { ...c, savedToday: true };
      }),

    streak,
    level,
    checkedOnThem,
    toggleCheckedOnThem: () => setCheckedOnThem((v) => !v),

    todos,
    toggleTodo: (id) =>
      setTodos((list) => list.map((t) => (t.id === id ? { ...t, done: !t.done } : t))),
    addTodo: (label) => setTodos((list) => [...list, { id: makeId('t'), label, done: false }]),

    goals,
    addGoal: (goal) => setGoals((list) => [...list, { ...goal, id: makeId('g') }]),
    toggleGoal: (id) =>
      setGoals((list) => list.map((g) => (g.id === id ? { ...g, done: !g.done } : g))),

    bucketList,
    toggleBucketItem: (id) =>
      setBucketList((list) => list.map((b) => (b.id === id ? { ...b, done: !b.done } : b))),

    wiki,
    updateWikiEntry: (id, value) =>
      setWiki((list) => list.map((w) => (w.id === id ? { ...w, value } : w))),

    isPremium,
    upgrade: () => setIsPremium(true),

    isPaired,
    pair: () => setIsPaired(true),
    unpair: () => setIsPaired(false),
  };

  return <CoupleContext value={store}>{children}</CoupleContext>;
}

export function useCouple(): CoupleStore {
  const store = use(CoupleContext);
  if (!store) throw new Error('useCouple must be used inside <CoupleProvider>');
  return store;
}
