import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { Ghost, Star, Heart, BookOpen, ArrowLeft, ArrowRight, Sparkles, Share, Check, Home, Zap, Trophy, Palette, Eraser } from "lucide-react";

// --- CONFIG ---
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- SOUND ENGINE ---
const playSound = (type) => {
  const sounds = {
    pop: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    win: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3",
    click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3"
  };
  const audio = new Audio(sounds[type]);
  audio.volume = 0.4;
  audio.play().catch(() => {}); 
};

const STORIES = [
  [
    { text: "The Dragon's Picnic", color: "bg-orange-50", emoji: "🐲" },
    { text: "He found a giant cupcake.", color: "bg-pink-50", emoji: "🧁" },
    { text: "They shared and became friends!", color: "bg-green-50", emoji: "🍰" },
  ],
  [
    { text: "Astronaut Annie", color: "bg-slate-900", emoji: "👩‍🚀" },
    { text: "She landed on a cheese moon.", color: "bg-yellow-50", emoji: "🧀" },
    { text: "The aliens loved to dance!", color: "bg-purple-50", emoji: "👽" },
  ]
];

export default function App() {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [view, setView] = useState("lobby");
  const [roomData, setRoomData] = useState({ hiddenItems: [], storyPage: 0, storyIdx: 0, flashlight: {}, drawingLines: [] });
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [currentColor, setCurrentColor] = useState("#4f46e5");
  
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const currentLine = useRef([]);

  const roomDocRef = useMemo(() => (roomId ? doc(db, "rooms", roomId) : null), [roomId]);

  const resetGame = useCallback(async () => {
    if (!roomDocRef) return;
    const items = [
      { id: 'item1', type: 'ghost', x: Math.random() * 70 + 15, y: Math.random() * 60 + 20, found: false },
      { id: 'item2', type: 'star', x: Math.random() * 70 + 15, y: Math.random() * 60 + 20, found: false },
      { id: 'item3', type: 'heart', x: Math.random() * 70 + 15, y: Math.random() * 60 + 20, found: false }
    ];
    await setDoc(roomDocRef, { 
      hiddenItems: items, 
      storyPage: 0, 
      storyIdx: Math.floor(Math.random() * STORIES.length), 
      flashlight: {},
      drawingLines: [] 
    });
  }, [roomDocRef]);

  useEffect(() => {
    signInAnonymously(auth).then(() => onAuthStateChanged(auth, u => setUser(u)));
    const rId = new URLSearchParams(window.location.search).get("room");
    if (rId) { setRoomId(rId); setView("menu"); }
  }, []);

  useEffect(() => {
    if (!user || !roomDocRef) return;
    return onSnapshot(roomDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.lastAction === 'found' && data.lastActionId !== roomData.lastActionId) playSound('pop');
        setRoomData(data);
      } else {
        resetGame();
      }
    });
  }, [user, roomDocRef, roomData.lastActionId, resetGame]);

  // --- FLASH & ITEM ACTIONS (Now properly defined for all views) ---
  const handleItemClick = async (itemId) => {
    const updatedItems = roomData.hiddenItems.map(item => 
      item.id === itemId ? { ...item, found: true } : item
    );
    playSound('pop');
    await updateDoc(roomDocRef, { 
        hiddenItems: updatedItems, 
        lastAction: 'found', 
        lastActionId: Math.random() 
    });
    if (updatedItems.every(i => i.found)) setTimeout(() => playSound('win'), 500);
  };

  const handleFlashlightMove = (e) => {
    if (!roomDocRef || !user) return;
    const touch = e.touches ? e.touches[0] : e;
    const x = (touch.clientX / window.innerWidth) * 100;
    const y = (touch.clientY / window.innerHeight) * 100;
    updateDoc(roomDocRef, { [`flashlight.${user.uid}`]: { x, y } });
  };

  // --- DRAWING PAD LOGIC ---
  useEffect(() => {
    if (view === "drawing" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      roomData.drawingLines?.forEach(line => {
        if (line.points.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const firstPoint = line.points[0];
        ctx.moveTo((firstPoint.x / 100) * canvas.width, (firstPoint.y / 100) * canvas.height);
        line.points.forEach(p => ctx.lineTo((p.x / 100) * canvas.width, (p.y / 100) * canvas.height));
        ctx.stroke();
      });
    }
  }, [view, roomData.drawingLines]);

  const handleDrawStart = (e) => {
    isDrawing.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    currentLine.current = [{ x, y }];
  };

  const handleDrawMove = (e) => {
    if (!isDrawing.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    currentLine.current.push({ x, y });

    const ctx = canvasRef.current.getContext("2d");
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    const p1 = currentLine.current[currentLine.current.length - 2];
    const p2 = currentLine.current[currentLine.current.length - 1];
    ctx.beginPath();
    ctx.moveTo((p1.x / 100) * canvasRef.current.width, (p1.y / 100) * canvasRef.current.height);
    ctx.lineTo((p2.x / 100) * canvasRef.current.width, (p2.y / 100) * canvasRef.current.height);
    ctx.stroke();
  };

  const handleDrawEnd = async () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (currentLine.current.length > 1) {
      await updateDoc(roomDocRef, {
        drawingLines: arrayUnion({ color: currentColor, points: currentLine.current })
      });
    }
    currentLine.current = [];
  };

  const Header = () => (
    <div className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-50">
      <button onClick={() => { playSound('click'); setView('menu'); }} className="p-2 rounded-xl bg-slate-100"><Home /></button>
      <div className="flex flex-col items-center">
        <h1 className="text-lg font-black text-indigo-600 leading-tight">SparklePlay</h1>
        <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Room: {roomId ?? "—"}</span>
      </div>
      <button onClick={() => { navigator.clipboard.writeText(window.location.href); setCopyFeedback(true); setTimeout(()=>setCopyFeedback(false), 2000)}} className="p-2 rounded-xl bg-indigo-50">
        {copyFeedback ? <Check className="text-green-600" /> : <Share className="w-6 h-6 text-indigo-600" />}
      </button>
    </div>
  );

  if (view === "lobby") return (
    <div className="h-screen flex flex-col items-center justify-center p-8 bg-white text-center">
      <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center shadow-2xl mb-8 animate-bounce">
        <Sparkles className="w-12 h-12 text-white" />
      </div>
      <h1 className="text-4xl font-black text-slate-800">SparklePlay</h1>
      <button onClick={() => { playSound('click'); const id = Math.random().toString(36).substring(2, 7).toUpperCase(); window.history.pushState({}, "", `?room=${id}`); setRoomId(id); setView("menu"); }} className="mt-10 px-12 py-6 bg-indigo-600 text-white rounded-[2rem] font-bold text-2xl shadow-xl active:scale-95 transition-all">Start Playing</button>
    </div>
  );

  if (view === "menu") return (
    <div className="h-screen bg-slate-50 flex flex-col">
      <Header />
      <div className="flex-1 p-6 grid grid-cols-1 gap-4 overflow-y-auto">
        <button onClick={() => { playSound('click'); setView("flashlight"); }} className="bg-slate-900 text-white p-8 rounded-[2.5rem] flex items-center justify-between shadow-xl">
            <div className="flex flex-col items-start"><Zap className="text-yellow-400 mb-2" /><span className="text-xl font-black italic text-left">Flashlight Hide & Seek</span></div>
            <ArrowRight />
        </button>
        <button onClick={() => { playSound('click'); setView("drawing"); }} className="bg-white p-8 rounded-[2.5rem] flex items-center justify-between shadow-xl border-4 border-blue-50 text-left">
            <div className="flex flex-col items-start"><Palette className="text-blue-500 mb-2" /><span className="text-xl font-black">Shared Drawing Pad</span></div>
            <ArrowRight />
        </button>
        <button onClick={async () => { 
            playSound('click'); 
            await updateDoc(roomDocRef, { storyPage: 0, storyIdx: Math.floor(Math.random() * STORIES.length) });
            setView("story"); 
        }} className="bg-white p-8 rounded-[2.5rem] flex items-center justify-between shadow-xl border-4 border-orange-50 text-left">
            <div className="flex flex-col items-start"><BookOpen className="text-orange-500 mb-2" /><span className="text-xl font-black">Story Time</span></div>
            <ArrowRight />
        </button>
      </div>
    </div>
  );

  if (view === "drawing") return (
    <div className="h-screen bg-white flex flex-col touch-none">
        <Header />
        <div className="flex-1 relative bg-slate-50 overflow-hidden">
            <canvas 
              ref={canvasRef} 
              className="w-full h-full cursor-crosshair" 
              onMouseDown={handleDrawStart} 
              onMouseMove={handleDrawMove} 
              onMouseUp={handleDrawEnd}
              onTouchStart={handleDrawStart}
              onTouchMove={handleDrawMove}
              onTouchEnd={handleDrawEnd}
            />
        </div>
        <div className="p-6 bg-white border-t flex items-center justify-between gap-4">
            <div className="flex gap-4">
              {['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#4f46e5'].map(c => (
                <button 
                  key={c} 
                  onClick={() => { playSound('click'); setCurrentColor(c); }} 
                  className={`w-10 h-10 rounded-full shadow-md transition-transform ${currentColor === c ? 'scale-125 border-4 border-slate-200' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <button onClick={async () => { playSound('click'); await updateDoc(roomDocRef, { drawingLines: [] }); }} className="p-3 bg-red-50 text-red-500 rounded-2xl active:scale-90 transition-transform"><Eraser /></button>
        </div>
    </div>
  );

  if (view === "flashlight") {
    const lights = Object.values(roomData.flashlight || {});
    const allFound = roomData.hiddenItems?.length > 0 && roomData.hiddenItems?.every(i => i.found);
    const maskStyle = {
      background: allFound ? 'transparent' : `radial-gradient(circle at ${lights.map(l => `${l.x}% ${l.y}%`).join(', ')}, transparent 80px, rgba(15, 23, 42, 0.98) 160px)`
    };

    return (
      <div className="h-screen bg-slate-950 relative overflow-hidden touch-none" onMouseMove={handleFlashlightMove} onTouchMove={handleFlashlightMove}>
        <div className="absolute top-4 left-4 z-50"><button onClick={() => { playSound('click'); setView('menu'); }} className="p-3 bg-white/10 rounded-2xl text-white backdrop-blur-md"><Home /></button></div>
        {roomData.hiddenItems?.map((item) => (
          <button key={item.id} disabled={item.found} onClick={() => handleItemClick(item.id)} className={`absolute transition-all duration-700 transform -translate-x-1/2 -translate-y-1/2 ${item.found ? 'scale-150 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`} style={{ left: `${item.x}%`, top: `${item.y}%` }}>
            {item.type === 'ghost' && <Ghost className="w-16 h-16 text-blue-200" />}
            {item.type === 'star' && <Star className="w-16 h-16 text-yellow-300" />}
            {item.type === 'heart' && <Heart className="w-16 h-16 text-red-400" />}
          </button>
        ))}
        <div className="absolute inset-0 pointer-events-none transition-all duration-1000" style={maskStyle}></div>
        {allFound && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-600/30 backdrop-blur-sm">
            <Trophy className="w-40 h-40 text-yellow-400 mb-4 animate-bounce" />
            <h2 className="text-5xl font-black text-white italic drop-shadow-lg text-center">YOU DID IT!</h2>
            <button onClick={() => { playSound('click'); resetGame(); }} className="mt-10 px-10 py-5 bg-white text-indigo-600 rounded-[2rem] font-black text-xl shadow-2xl">Play Again?</button>
          </div>
        )}
      </div>
    );
  }

  if (view === "story") {
    const story = STORIES[roomData.storyIdx || 0];
    const pageIdx = roomData.storyPage || 0;
    const page = story[pageIdx];
    return (
      <div className={`h-screen flex flex-col transition-colors duration-700 ${page.color}`}>
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="text-[12rem] mb-4">{page.emoji}</div>
          <h2 className="text-4xl font-black text-slate-800 leading-tight">{page.text}</h2>
        </div>
        <div className="p-8 flex gap-6">
          <button disabled={pageIdx === 0} onClick={() => { playSound('click'); updateDoc(roomDocRef, { storyPage: pageIdx - 1 }); }} className="flex-1 py-6 bg-white/60 rounded-3xl disabled:opacity-20"><ArrowLeft className="mx-auto w-10 h-10"/></button>
          {pageIdx === story.length - 1 ? (
              <button onClick={() => { playSound('win'); setView('menu'); }} className="flex-1 py-6 bg-green-500 text-white rounded-3xl font-bold">RESTART</button>
          ) : (
              <button onClick={() => { playSound('click'); updateDoc(roomDocRef, { storyPage: pageIdx + 1 }); }} className="flex-1 py-6 bg-indigo-600 text-white rounded-3xl shadow-xl disabled:opacity-20"><ArrowRight className="mx-auto w-10 h-10"/></button>
          )}
        </div>
      </div>
    );
  }
  return null;
}
