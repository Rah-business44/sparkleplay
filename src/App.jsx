import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { 
  Ghost, BookOpen, ArrowLeft, ArrowRight, Sparkles, 
  Share, Check, Home, Zap, Trophy, Palette, Eraser, X, Circle
} from "lucide-react";

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
    click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
    boom: "https://assets.mixkit.co/active_storage/sfx/1690/1690-preview.mp3"
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

const ANIMALS = ["🐻", "🦁", "🐘", "🦒", "🐼", "🦊"];

export default function App() {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [view, setView] = useState("lobby");
  const [roomData, setRoomData] = useState({});
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [currentColor, setCurrentColor] = useState("#4f46e5");
  
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const currentLine = useRef([]);
  const localTapCount = useRef(0);
  const raceInterval = useRef(null);

  const roomDocRef = useMemo(() => (roomId ? doc(db, "rooms", roomId) : null), [roomId]);

  const resetGame = useCallback(async () => {
    if (!roomDocRef) return;
    const target = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const spots = Array(6).fill(null).map((_, i) => ({ id: i, hasAnimal: false, revealed: false }));
    spots[Math.floor(Math.random() * 6)].hasAnimal = true;

    await setDoc(roomDocRef, { 
      storyPage: 0, 
      storyIdx: Math.floor(Math.random() * STORIES.length), 
      drawingLines: [],
      hideReveal: { hideSpots: spots, targetAnimal: target, gameWon: false },
      raceTap: { racePositions: {}, winner: null },
      tictactoe: { board: Array(9).fill(null), turn: 'X', winner: null, lastMove: null }
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
      if (snap.exists()) setRoomData(snap.data());
      else resetGame();
    });
  }, [user, roomDocRef, resetGame]);

  // --- DRAWING LOGIC ---
  useEffect(() => {
    if (view === "drawing" && canvasRef.current && roomData.drawingLines) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      roomData.drawingLines.forEach(line => {
        if (!line.points || line.points.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo((line.points[0].x / 100) * canvas.width, (line.points[0].y / 100) * canvas.height);
        line.points.forEach(p => ctx.lineTo((p.x / 100) * canvas.width, (p.y / 100) * canvas.height));
        ctx.stroke();
      });
    }
  }, [view, roomData.drawingLines]);

  const handleDrawStart = (e) => {
    isDrawing.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    currentLine.current = [{ x: ((touch.clientX - rect.left) / rect.width) * 100, y: ((touch.clientY - rect.top) / rect.height) * 100 }];
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
    ctx.beginPath();
    ctx.moveTo((p1.x / 100) * canvasRef.current.width, (p1.y / 100) * canvasRef.current.height);
    ctx.lineTo((x / 100) * canvasRef.current.width, (y / 100) * canvasRef.current.height);
    ctx.stroke();
  };

  const handleDrawEnd = async () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (currentLine.current.length > 1) {
      await updateDoc(roomDocRef, { drawingLines: arrayUnion({ color: currentColor, points: currentLine.current }) });
    }
    currentLine.current = [];
  };

  // --- GAME HANDLERS ---
  const handlePeekClick = async (spotId) => {
    if (!roomData.hideReveal || roomData.hideReveal.gameWon) return;
    const currentSpots = roomData.hideReveal.hideSpots;
    const spot = currentSpots.find(s => s.id === spotId);
    if (!spot || spot.revealed) return;

    const newSpots = currentSpots.map(s => s.id === spotId ? { ...s, revealed: true } : s);
    
    if (spot.hasAnimal) {
      playSound('win');
      await updateDoc(roomDocRef, { "hideReveal.hideSpots": newSpots, "hideReveal.gameWon": true });
    } else {
      playSound('click');
      await updateDoc(roomDocRef, { "hideReveal.hideSpots": newSpots });
    }
  };

  useEffect(() => {
    if (view === "raceTap" && !roomData.raceTap?.winner) {
      raceInterval.current = setInterval(async () => {
        if (localTapCount.current > 0) {
          const currentPos = roomData.raceTap?.racePositions?.[user.uid] || 0;
          const newPos = currentPos + localTapCount.current;
          localTapCount.current = 0;
          const updates = { [`raceTap.racePositions.${user.uid}`]: newPos };
          if (newPos >= 100) { updates["raceTap.winner"] = user.uid; playSound('win'); }
          await updateDoc(roomDocRef, updates);
        }
      }, 200);
    }
    return () => clearInterval(raceInterval.current);
  }, [view, roomData.raceTap, user, roomDocRef]);

  const handleRaceTap = () => {
    if (roomData.raceTap?.winner) return;
    localTapCount.current += 2;
    playSound('pop');
  };

  const handleTTTClick = async (i) => {
    const ttt = roomData.tictactoe;
    if (!ttt || ttt.winner || ttt.board[i]) return;
    const newBoard = [...ttt.board];
    newBoard[i] = ttt.turn;
    const win = ((s) => {
      const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      for (let [a,b,c] of lines) if (s[a] && s[a]===s[b] && s[a]===s[c]) return s[a];
      return s.every(x => x) ? 'Draw' : null;
    })(newBoard);
    playSound('boom');
    await updateDoc(roomDocRef, { "tictactoe.board": newBoard, "tictactoe.turn": ttt.turn==='X'?'O':'X', "tictactoe.winner": win, "tictactoe.lastMove": i });
    if (win && win !== 'Draw') playSound('win');
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: 'SparklePlay', url }); } catch (err) { console.log(err); }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      } catch (err) { console.log(err); }
    }
  };

  const Header = () => (
    <div className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-50">
      <button onClick={() => { playSound('click'); setView('menu'); }} className="p-2 rounded-xl bg-slate-100"><Home /></button>
      <div className="flex flex-col items-center">
        <h1 className="text-lg font-black text-indigo-600 leading-tight">SparklePlay</h1>
        <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Room: {roomId ?? "—"}</span>
      </div>
      <button onClick={handleShare} className="p-2 rounded-xl bg-indigo-50">
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
        <button onClick={() => { playSound('click'); setView("hideReveal"); }} className="bg-orange-400 text-white p-6 rounded-[2.5rem] flex items-center justify-between shadow-xl">
            <div className="flex flex-col items-start"><Ghost className="mb-1" /><span className="text-xl font-black italic text-left">Peekaboo Game</span></div>
            <ArrowRight />
        </button>
        <button onClick={() => { playSound('click'); setView("raceTap"); }} className="bg-green-500 text-white p-6 rounded-[2.5rem] flex items-center justify-between shadow-xl">
            <div className="flex flex-col items-start"><Zap className="mb-1" /><span className="text-xl font-black italic text-left">Race Tap</span></div>
            <ArrowRight />
        </button>
        <button onClick={() => { playSound('click'); setView("tictactoe"); }} className="bg-purple-600 text-white p-6 rounded-[2.5rem] flex items-center justify-between shadow-xl">
            <div className="flex flex-col items-start"><Sparkles className="mb-1" /><span className="text-xl font-black italic text-left">Tic Tac Toe</span></div>
            <ArrowRight />
        </button>
        <button onClick={() => { playSound('click'); setView("drawing"); }} className="bg-white p-6 rounded-[2.5rem] flex items-center justify-between shadow-xl border-4 border-blue-50 text-left">
            <div className="flex flex-col items-start"><Palette className="text-blue-500 mb-1" /><span className="text-xl font-black">Drawing Pad</span></div>
            <ArrowRight />
        </button>
        <button onClick={async () => { 
            playSound('click'); 
            await updateDoc(roomDocRef, { storyPage: 0, storyIdx: Math.floor(Math.random() * STORIES.length) });
            setView("story"); 
        }} className="bg-white p-6 rounded-[2.5rem] flex items-center justify-between shadow-xl border-4 border-orange-50 text-left">
            <div className="flex flex-col items-start"><BookOpen className="text-orange-500 mb-1" /><span className="text-xl font-black">Story Time</span></div>
            <ArrowRight />
        </button>
      </div>
    </div>
  );

  if (view === "hideReveal") return (
    <div className="h-screen bg-orange-50 flex flex-col">
      <Header />
      <div className="flex-1 p-6 flex flex-col items-center justify-center">
        <h2 className="text-3xl font-black text-orange-600 mb-8 text-center">Find the {roomData.hideReveal?.targetAnimal}!</h2>
        <div className="grid grid-cols-2 gap-6 w-full max-w-sm">
          {roomData.hideReveal?.hideSpots.map((s) => (
            <button key={s.id} onClick={() => handlePeekClick(s.id)} className={`aspect-square rounded-[2rem] text-6xl flex items-center justify-center shadow-xl transition-all duration-300 transform ${s.revealed ? 'bg-white scale-100' : 'bg-orange-400 scale-105 active:scale-90'}`}>
              {s.revealed ? (s.hasAnimal ? roomData.hideReveal.targetAnimal : "💨") : "❓"}
            </button>
          ))}
        </div>
      </div>
      {roomData.hideReveal?.gameWon && (
        <div className="absolute inset-0 z-[100] bg-orange-500 flex flex-col items-center justify-center text-center">
          <div className="text-[10rem] animate-bounce">{roomData.hideReveal.targetAnimal}</div>
          <h2 className="text-5xl font-black text-white mb-8">FOUND IT!</h2>
          <button onClick={() => { playSound('click'); resetGame(); }} className="px-12 py-6 bg-white text-orange-600 rounded-[2rem] font-black text-2xl shadow-2xl">Play Again</button>
        </div>
      )}
    </div>
  );

  if (view === "raceTap") return (
    <div className="h-screen bg-green-50 flex flex-col touch-none" onClick={handleRaceTap}>
      <Header />
      <div className="flex-1 p-8 flex flex-col justify-around">
        {['🐰', '🐢'].map((emoji, i) => {
          const racerUids = Object.keys(roomData.raceTap?.racePositions || {});
          const pos = roomData.raceTap?.racePositions?.[racerUids[i]] || 0;
          return (
            <div key={i} className="relative w-full h-24 bg-white/50 rounded-full border-4 border-green-200 shadow-inner">
              <div className="absolute top-0 h-full flex items-center text-6xl transition-all duration-300" style={{ left: `${Math.min(pos, 85)}%` }}>{emoji}</div>
            </div>
          );
        })}
      </div>
      {!roomData.raceTap?.winner && <div className="p-10 text-center font-black text-3xl text-green-600 animate-pulse uppercase">Tap Fast!</div>}
      {roomData.raceTap?.winner && (
        <div className="absolute inset-0 z-[100] bg-green-600 flex flex-col items-center justify-center text-center">
          <Trophy className="w-48 h-48 text-yellow-300 animate-bounce" />
          <h2 className="text-6xl font-black text-white mb-10 uppercase">Winner!</h2>
          <button onClick={() => { playSound('click'); resetGame(); }} className="px-12 py-6 bg-white text-green-600 rounded-[2rem] font-black text-2xl shadow-2xl">Race Again</button>
        </div>
      )}
    </div>
  );

  if (view === "tictactoe") return (
    <div className="h-screen bg-purple-50 flex flex-col">
      <Header />
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="mb-6 text-2xl font-black text-purple-600 uppercase">
          {roomData.tictactoe?.winner ? (roomData.tictactoe.winner === 'Draw' ? "It's a Draw!" : `${roomData.tictactoe.winner} Wins!`) : `Player ${roomData.tictactoe?.turn}'s Turn`}
        </div>
        <div className="grid grid-cols-3 gap-3 w-full max-w-sm aspect-square bg-purple-200 p-3 rounded-[2.5rem] shadow-2xl">
          {roomData.tictactoe?.board.map((cell, i) => (
            <button key={i} onClick={() => handleTTTClick(i)} className={`bg-white rounded-2xl flex items-center justify-center text-6xl shadow-sm transition-all duration-300 ${roomData.tictactoe?.lastMove === i ? 'animate-bounce' : 'active:scale-95'}`}>
              {cell === 'X' && <X className="w-16 h-16 text-red-500 stroke-[4]" />}
              {cell === 'O' && <Circle className="w-16 h-16 text-blue-500 stroke-[4]" />}
            </button>
          ))}
        </div>
        {roomData.tictactoe?.winner && <button onClick={() => { playSound('click'); resetGame(); }} className="mt-10 px-10 py-5 bg-purple-600 text-white rounded-[2rem] font-black text-xl shadow-xl">New Game</button>}
      </div>
    </div>
  );

  if (view === "drawing") return (
    <div className="h-screen bg-white flex flex-col touch-none">
      <Header />
      <div className="flex-1 relative bg-slate-50 overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full cursor-crosshair" onMouseDown={handleDrawStart} onMouseMove={handleDrawMove} onMouseUp={handleDrawEnd} onTouchStart={handleDrawStart} onTouchMove={handleDrawMove} onTouchEnd={handleDrawEnd} />
      </div>
      <div className="p-6 bg-white border-t flex items-center justify-between gap-4">
        <div className="flex gap-4">
          {['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#4f46e5'].map(c => (
            <button key={c} onClick={() => { playSound('click'); setCurrentColor(c); }} className={`w-10 h-10 rounded-full shadow-md transition-transform ${currentColor === c ? 'scale-125 border-4 border-slate-200' : 'active:scale-90'}`} style={{ backgroundColor: c }} />
          ))}
        </div>
        <button onClick={async () => { playSound('click'); await updateDoc(roomDocRef, { drawingLines: [] }); }} className="p-4 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center shadow-md active:scale-90 transition-transform border border-red-200"><Eraser className="w-6 h-6" /></button>
      </div>
    </div>
  );

  if (view === "story") {
    const page = STORIES[roomData.storyIdx || 0][roomData.storyPage || 0];
    return (
      <div className={`h-screen flex flex-col transition-colors duration-700 ${page.color}`}>
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="text-[12rem] mb-4">{page.emoji}</div>
          <h2 className="text-4xl font-black text-slate-800 leading-tight">{page.text}</h2>
        </div>
        <div className="p-8 flex gap-6">
          <button disabled={roomData.storyPage===0} onClick={() => { playSound('click'); updateDoc(roomDocRef, { storyPage: roomData.storyPage - 1 }); }} className="flex-1 py-6 bg-white/60 rounded-3xl disabled:opacity-20 shadow-md"><ArrowLeft className="mx-auto w-10 h-10"/></button>
          {roomData.storyPage === 2 ? <button onClick={() => { playSound('win'); setView('menu'); }} className="flex-1 py-6 bg-green-500 text-white rounded-3xl font-bold uppercase shadow-xl">Done</button> : <button onClick={() => { playSound('click'); updateDoc(roomDocRef, { storyPage: roomData.storyPage + 1 }); }} className="flex-1 py-6 bg-indigo-600 text-white rounded-3xl shadow-xl"><ArrowRight className="mx-auto w-10 h-10"/></button>}
        </div>
      </div>
    );
  }
  return null;
}
