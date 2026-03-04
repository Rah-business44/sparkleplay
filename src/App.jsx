import React, { useEffect, useMemo, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "firebase/auth";
import {
  Ghost,
  Star,
  Heart,
  Palette,
  BookOpen,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Video,
  Share,
  Check,
  Trash2,
  Home,
} from "lucide-react";

/**
 * Helper: read env vars in either Vite (import.meta.env)
 * or CRA/Next (process.env) without crashing builds.
 */
function readEnv(key) {
  // Vite
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      const v = import.meta.env[key];
      if (v !== undefined) return v;
    }
  } catch (_) {
    // ignore
  }
  // CRA/Next
  try {
    if (typeof process !== "undefined" && process.env) {
      const v = process.env[key];
      if (v !== undefined) return v;
    }
  } catch (_) {
    // ignore
  }
  return undefined;
}

/**
 * Firebase config from environment variables (recommended for Vercel).
 * Supports either VITE_* or REACT_APP_* style keys.
 */
const firebaseConfig = {
  apiKey: readEnv("VITE_FIREBASE_API_KEY") ?? readEnv("REACT_APP_FIREBASE_API_KEY"),
  authDomain:
    readEnv("VITE_FIREBASE_AUTH_DOMAIN") ?? readEnv("REACT_APP_FIREBASE_AUTH_DOMAIN"),
  projectId:
    readEnv("VITE_FIREBASE_PROJECT_ID") ?? readEnv("REACT_APP_FIREBASE_PROJECT_ID"),
  storageBucket:
    readEnv("VITE_FIREBASE_STORAGE_BUCKET") ?? readEnv("REACT_APP_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId:
    readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID") ??
    readEnv("REACT_APP_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("VITE_FIREBASE_APP_ID") ?? readEnv("REACT_APP_FIREBASE_APP_ID"),
};

function assertFirebaseConfig(cfg) {
  const missing = Object.entries(cfg)
    .filter(([_, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    // Don’t hard-crash the whole app; show a helpful message in UI.
    console.error(
      "Missing Firebase env vars:",
      missing,
      "— add these in Vercel Project Settings → Environment Variables."
    );
    return false;
  }
  return true;
}

// Initialize Firebase exactly once
const firebaseReady = assertFirebaseConfig(firebaseConfig);
const app = firebaseReady
  ? (getApps().length ? getApps()[0] : initializeApp(firebaseConfig))
  : null;

const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

// --- GAME ASSETS ---
const STICKERS = [
  { id: "star", icon: <Star className="text-yellow-400 fill-yellow-400 w-full h-full" /> },
  { id: "heart", icon: <Heart className="text-red-500 fill-red-500 w-full h-full" /> },
  { id: "ghost", icon: <Ghost className="text-blue-300 fill-blue-300 w-full h-full" /> },
  { id: "magic", icon: <Sparkles className="text-purple-400 w-full h-full" /> },
];

const STORY_PAGES = [
  { text: "Once upon a time...", color: "bg-blue-50", emoji: "🏰" },
  { text: "There lived a happy dragon.", color: "bg-green-50", emoji: "🐲" },
  { text: "Who loved eating cupcakes!", color: "bg-pink-50", emoji: "🧁" },
  { text: "And playing with friends.", color: "bg-yellow-50", emoji: "🎈" },
  { text: "The End!", color: "bg-purple-50", emoji: "✨" },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [view, setView] = useState("lobby");
  const [roomData, setRoomData] = useState({ stickers: [], storyPage: 0 });
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [fatalConfigError, setFatalConfigError] = useState(false);

  const roomDocRef = useMemo(() => {
    if (!db || !roomId) return null;
    // Simple, normal Firestore structure:
    // rooms/{roomId}
    return doc(db, "rooms", roomId);
  }, [roomId]);

  // 1) Auth (anonymous)
  useEffect(() => {
    if (!firebaseReady || !auth) {
      setFatalConfigError(true);
      return;
    }

    let unsub = null;

    (async () => {
      try {
        await signInAnonymously(auth);
        unsub = onAuthStateChanged(auth, (u) => setUser(u));
      } catch (err) {
        console.error("Auth error:", err);
      }
    })();

    // room from URL
    const urlParams = new URLSearchParams(window.location.search);
    const rId = urlParams.get("room");
    if (rId) {
      setRoomId(rId);
      setView("menu");
    }

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  // 2) Realtime sync
  useEffect(() => {
    if (!user || !roomDocRef) return;

    const unsub = onSnapshot(
      roomDocRef,
      (snap) => {
        if (snap.exists()) {
          setRoomData(snap.data());
        } else {
          // Create room doc on first join
          setDoc(roomDocRef, { stickers: [], storyPage: 0 });
        }
      },
      (error) => {
        console.error("Firestore sync error:", error);
      }
    );

    return () => unsub();
  }, [user, roomDocRef]);

  // --- actions ---
  const createRoom = () => {
    const id = Math.random().toString(36).substring(2, 7).toUpperCase();
    const newUrl = `${window.location.origin}${window.location.pathname}?room=${id}`;
    window.history.pushState({}, "", newUrl);
    setRoomId(id);
    setView("menu");
  };

  const copyLink = async () => {
    const link = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const el = document.createElement("textarea");
        el.value = link;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  const addSticker = async (type) => {
    if (!roomDocRef || !user) return;

    const newSticker = {
      id: Date.now(),
      type,
      x: Math.random() * 70 + 15,
      y: Math.random() * 60 + 20,
      rotation: Math.random() * 40 - 20,
    };

    try {
      await updateDoc(roomDocRef, { stickers: arrayUnion(newSticker) });
    } catch (e) {
      console.error("Add sticker failed", e);
    }
  };

  const clearStickers = async () => {
    if (!roomDocRef || !user) return;
    try {
      await updateDoc(roomDocRef, { stickers: [] });
    } catch (e) {
      console.error("Clear stickers failed", e);
    }
  };

  const setPage = async (idx) => {
    if (!roomDocRef || !user) return;
    try {
      await updateDoc(roomDocRef, { storyPage: idx });
    } catch (e) {
      console.error("Set page failed", e);
    }
  };

  // --- UI bits ---
  const Header = () => (
    <div className="flex items-center justify-between p-4 bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
      <button
        onClick={() => setView("menu")}
        className="p-3 rounded-2xl bg-slate-50 active:scale-90 transition-transform"
      >
        <Home className="w-6 h-6 text-slate-600" />
      </button>
      <div className="flex flex-col items-center">
        <h1 className="text-lg font-black text-indigo-600 leading-tight">SparklePlay</h1>
        <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">
          Room: {roomId ?? "—"}
        </span>
      </div>
      <button
        onClick={copyLink}
        className="p-3 rounded-2xl bg-indigo-50 active:scale-90 transition-transform"
        disabled={!roomId}
        title={!roomId ? "Create or join a room first" : "Copy room link"}
      >
        {copyFeedback ? (
          <Check className="w-6 h-6 text-green-600" />
        ) : (
          <Share className="w-6 h-6 text-indigo-600" />
        )}
      </button>
    </div>
  );

  // --- config error screen ---
  if (fatalConfigError) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8 font-sans">
        <div className="max-w-lg w-full bg-slate-50 border border-slate-200 rounded-3xl p-8 space-y-4">
          <h1 className="text-2xl font-black text-slate-800">Firebase config missing</h1>
          <p className="text-slate-600">
            Add your Firebase environment variables in Vercel, then redeploy.
          </p>
          <div className="text-sm text-slate-700 bg-white rounded-2xl p-4 border border-slate-200">
            <div className="font-bold mb-2">Expected env vars (Vite):</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>VITE_FIREBASE_API_KEY</li>
              <li>VITE_FIREBASE_AUTH_DOMAIN</li>
              <li>VITE_FIREBASE_PROJECT_ID</li>
              <li>VITE_FIREBASE_STORAGE_BUCKET</li>
              <li>VITE_FIREBASE_MESSAGING_SENDER_ID</li>
              <li>VITE_FIREBASE_APP_ID</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW: LOBBY ---
  if (view === "lobby") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 space-y-12 font-sans">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-[2rem] mx-auto flex items-center justify-center shadow-2xl shadow-indigo-200">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">SparklePlay</h1>
          <p className="text-slate-500 font-medium italic">Play together, even far away!</p>
        </div>

        <button
          onClick={createRoom}
          className="w-full max-w-xs py-6 bg-indigo-600 text-white rounded-[2rem] font-bold text-xl shadow-xl shadow-indigo-100 active:scale-95 transition-all"
        >
          Create Play Room
        </button>

        <div className="max-w-xs text-center space-y-4">
          {!user && <p className="text-xs text-indigo-400 animate-pulse">Connecting to Play Network...</p>}
          <p className="text-sm text-slate-400 px-4 leading-relaxed">
            Text the link to your relative, then call them on FaceTime!
          </p>
          <div className="flex items-center justify-center gap-2 text-indigo-500 font-bold">
            <Video className="w-4 h-4" />
            <span className="text-xs uppercase tracking-widest font-black">Works best with FaceTime</span>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW: MENU ---
  if (view === "menu") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
          <button
            onClick={() => setView("stickers")}
            className="w-full max-w-sm bg-white p-8 rounded-[2.5rem] shadow-xl shadow-blue-100 flex flex-col items-center gap-4 active:scale-95 transition-transform border-4 border-transparent active:border-blue-400"
          >
            <div className="bg-blue-100 p-6 rounded-3xl">
              <Palette className="w-12 h-12 text-blue-600" />
            </div>
            <span className="text-2xl font-black text-slate-700">Sticker Board</span>
          </button>

          <button
            onClick={() => setView("story")}
            className="w-full max-w-sm bg-white p-8 rounded-[2.5rem] shadow-xl shadow-orange-100 flex flex-col items-center gap-4 active:scale-95 transition-transform border-4 border-transparent active:border-orange-400"
          >
            <div className="bg-orange-100 p-6 rounded-3xl">
              <BookOpen className="w-12 h-12 text-orange-600" />
            </div>
            <span className="text-2xl font-black text-slate-700">Story Time</span>
          </button>
        </div>
      </div>
    );
  }

  // --- VIEW: STICKERS ---
  if (view === "stickers") {
    return (
      <div className="h-screen flex flex-col bg-white overflow-hidden select-none font-sans">
        <Header />
        <div className="flex-1 relative bg-slate-50 overflow-hidden touch-none">
          {roomData.stickers?.map((s) => (
            <div
              key={s.id}
              className="absolute pointer-events-none animate-in zoom-in duration-300"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                transform: `translate(-50%, -50%) rotate(${s.rotation}deg)`,
                width: "100px",
                height: "100px",
              }}
            >
              {STICKERS.find((t) => t.id === s.type)?.icon}
            </div>
          ))}
          {(!roomData.stickers || roomData.stickers.length === 0) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 opacity-40">
              <Palette className="w-20 h-20 mb-4" />
              <p className="font-bold text-center px-8">Tap a shape below to share with your relative!</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-white border-t border-gray-100 flex items-center justify-between gap-4">
          <div className="flex flex-1 justify-around">
            {STICKERS.map((s) => (
              <button
                key={s.id}
                onClick={() => addSticker(s.id)}
                className="w-16 h-16 p-3 bg-slate-50 rounded-2xl active:scale-150 transition-transform border-2 border-transparent active:border-indigo-200"
              >
                {s.icon}
              </button>
            ))}
          </div>
          <button
            onClick={clearStickers}
            className="p-4 bg-red-50 text-red-500 rounded-2xl active:scale-90 transition-transform"
          >
            <Trash2 className="w-6 h-6" />
          </button>
        </div>
      </div>
    );
  }

  // --- VIEW: STORY ---
  if (view === "story") {
    const pageIdx = roomData.storyPage || 0;
    const page = STORY_PAGES[pageIdx];

    return (
      <div className="h-screen flex flex-col bg-white overflow-hidden font-sans">
        <Header />
        <div className={`flex-1 flex flex-col items-center justify-center p-8 transition-colors duration-700 ${page.color}`}>
          <div className="text-[10rem] md:text-[12rem] mb-4 animate-bounce drop-shadow-2xl" style={{ animationDuration: "3s" }}>
            {page.emoji}
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-center text-slate-800 leading-tight px-4">
            {page.text}
          </h2>
        </div>
        <div className="p-8 bg-white flex items-center gap-6">
          <button
            disabled={pageIdx === 0}
            onClick={() => setPage(pageIdx - 1)}
            className="flex-1 py-6 bg-slate-100 rounded-[2rem] flex items-center justify-center disabled:opacity-20 active:scale-90 transition-transform"
          >
            <ArrowLeft className="w-10 h-10 text-slate-600" />
          </button>
          <button
            disabled={pageIdx === STORY_PAGES.length - 1}
            onClick={() => setPage(pageIdx + 1)}
            className="flex-1 py-6 bg-indigo-600 rounded-[2rem] flex items-center justify-center disabled:opacity-20 active:scale-90 transition-transform shadow-xl shadow-indigo-100"
          >
            <ArrowRight className="w-10 h-10 text-white" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
