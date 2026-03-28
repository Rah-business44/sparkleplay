import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  runTransaction
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  Ghost,
  BookOpen,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Share,
  Check,
  Home,
  Zap,
  Trophy,
  Palette,
  Eraser,
  X,
  Circle
} from "lucide-react";

// --- CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyBuiHQ82aH6Q76Ow3bc3EYICQlwOXJWidQ",
  authDomain: "sparkleplay-10c8b.firebaseapp.com",
  projectId: "sparkleplay-10c8b",
  storageBucket: "sparkleplay-10c8b.firebasestorage.app",
  messagingSenderId: "413578058656",
  appId: "1:413578058656:web:7e32b17dae5b37ff9662c5"
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

// --- CONTENT ---
const STORIES = [
  [
    { text: "The Dragon's Picnic", color: "bg-orange-50", emoji: "🐲" },
    { text: "He packed a giant blanket for the sunny hill.", color: "bg-yellow-50", emoji: "🧺" },
    { text: "Then he found a giant cupcake waiting there.", color: "bg-pink-50", emoji: "🧁" },
    { text: "He shared it with his new friends and everyone cheered!", color: "bg-green-50", emoji: "🥳" }
  ],
  [
    { text: "Astronaut Annie", color: "bg-slate-900", emoji: "👩‍🚀" },
    { text: "She zoomed through the stars in her sparkly rocket.", color: "bg-indigo-950", emoji: "🚀" },
    { text: "She landed on a moon made of cheese.", color: "bg-yellow-50", emoji: "🧀" },
    { text: "The moon aliens loved to dance all night long.", color: "bg-purple-50", emoji: "👽" }
  ],
  [
    { text: "Benny the Bunny", color: "bg-pink-50", emoji: "🐰" },
    { text: "Benny bounced into a garden full of carrots.", color: "bg-orange-50", emoji: "🥕" },
    { text: "One carrot glowed with rainbow sparkles.", color: "bg-cyan-50", emoji: "🌈" },
    { text: "Benny made a wish and the flowers sang hello.", color: "bg-lime-50", emoji: "🌸" }
  ],
  [
    { text: "Tina the Turtle", color: "bg-green-50", emoji: "🐢" },
    { text: "Tina found a tiny map near the pond.", color: "bg-blue-50", emoji: "🗺️" },
    { text: "It led her to a hidden shell treasure.", color: "bg-amber-50", emoji: "🐚" },
    { text: "She smiled and shared the treasure with her friends.", color: "bg-emerald-50", emoji: "💖" }
  ],
  [
    { text: "Leo the Lion", color: "bg-yellow-50", emoji: "🦁" },
    { text: "Leo heard giggles coming from the jungle trees.", color: "bg-green-50", emoji: "🌴" },
    { text: "A baby monkey was planning a surprise dance party.", color: "bg-orange-50", emoji: "🐵" },
    { text: "Soon the whole jungle was dancing together.", color: "bg-rose-50", emoji: "💃" }
  ],
  [
    { text: "Mila the Mermaid", color: "bg-cyan-50", emoji: "🧜‍♀️" },
    { text: "Mila swam past glowing coral castles.", color: "bg-sky-50", emoji: "🪸" },
    { text: "She found a pearl that hummed a sleepy song.", color: "bg-violet-50", emoji: "🫧" },
    { text: "Everyone in the ocean drifted into sweet dreams.", color: "bg-blue-100", emoji: "🌙" }
  ],
  [
    { text: "Dino Day", color: "bg-lime-50", emoji: "🦖" },
    { text: "Daisy the dino stomped into a muddy field.", color: "bg-amber-50", emoji: "🌋" },
    { text: "She discovered a puddle that splashed like a drum.", color: "bg-cyan-50", emoji: "🥁" },
    { text: "Soon every dino was making music together.", color: "bg-fuchsia-50", emoji: "🎶" }
  ],
  [
    { text: "Oliver the Owl", color: "bg-slate-100", emoji: "🦉" },
    { text: "Oliver flew under a sky full of twinkling stars.", color: "bg-indigo-100", emoji: "✨" },
    { text: "He found a tiny lantern hanging from a cloud.", color: "bg-yellow-100", emoji: "🏮" },
    { text: "Its glow guided everyone safely home.", color: "bg-blue-50", emoji: "🏡" }
  ]
];

const PEEKABOO_ANIMALS = ["🐻", "🦁", "🐘", "🦒", "🐼", "🦊", "🐰", "🐵"];
const DRAW_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#000000",
  "#ffffff"
];
const RACE_CHARACTERS = ["🐰", "🐢"];

const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const createPeekabooRound = () => {
  const targetAnimal = getRandomItem(PEEKABOO_ANIMALS);
  const spots = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    hasAnimal: false,
    revealed: false
  }));
  spots[Math.floor(Math.random() * spots.length)].hasAnimal = true;

  return {
    hideSpots: spots,
    targetAnimal,
    gameWon: false
  };
};

const createStoryRound = () => ({
  storyPage: 0,
  storyIdx: Math.floor(Math.random() * STORIES.length)
});

const createRaceRound = () => ({
  racePositions: {},
  winner: null,
  started: false
});

const createTTTRound = () => ({
  board: Array(9).fill(null),
  turn: "X",
  winner: null,
  lastMove: null
});

const createInitialRoomState = () => ({
  players: {
    player1: null,
    player2: null,
    characters: {}
  },
  drawingLines: [],
  hideReveal: createPeekabooRound(),
  raceTap: createRaceRound(),
  tictactoe: createTTTRound(),
  ...createStoryRound()
});

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
  const roomDataRef = useRef({});

  const roomDocRef = useMemo(() => (roomId ? doc(db, "rooms", roomId) : null), [roomId]);

  useEffect(() => {
    roomDataRef.current = roomData;
  }, [roomData]);

  const initializeRoom = useCallback(async () => {
    if (!roomDocRef) return;
    await setDoc(roomDocRef, createInitialRoomState(), { merge: true });
  }, [roomDocRef]);

  const resetPeekaboo = useCallback(async () => {
    if (!roomDocRef) return;
    await updateDoc(roomDocRef, {
      hideReveal: createPeekabooRound()
    });
  }, [roomDocRef]);

  const resetRaceTap = useCallback(async () => {
    if (!roomDocRef) return;
    await updateDoc(roomDocRef, {
      raceTap: createRaceRound(),
      "players.characters": {}
    });
  }, [roomDocRef]);

  const resetTTT = useCallback(async () => {
    if (!roomDocRef) return;
    await updateDoc(roomDocRef, {
      tictactoe: createTTTRound()
    });
  }, [roomDocRef]);

  const resetStory = useCallback(async () => {
    if (!roomDocRef) return;
    await updateDoc(roomDocRef, createStoryRound());
  }, [roomDocRef]);

  const clearDrawing = useCallback(async () => {
    if (!roomDocRef) return;
    await updateDoc(roomDocRef, {
      drawingLines: []
    });
  }, [roomDocRef]);

  useEffect(() => {
    signInAnonymously(auth).then(() => {
      onAuthStateChanged(auth, (u) => setUser(u));
    });

    const rId = new URLSearchParams(window.location.search).get("room");
    if (rId) {
      setRoomId(rId);
      setView("menu");
    }
  }, []);

  useEffect(() => {
    if (!user || !roomDocRef) return;

    return onSnapshot(roomDocRef, async (snap) => {
      if (snap.exists()) {
        setRoomData(snap.data());
      } else {
        await initializeRoom();
      }
    });
  }, [user, roomDocRef, initializeRoom]);

  useEffect(() => {
    if (!user || !roomDocRef || !roomData?.players) return;

    const alreadyAssigned =
      roomData.players.player1 === user.uid || roomData.players.player2 === user.uid;

    if (alreadyAssigned) return;

    const claimSeat = async () => {
      try {
        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(roomDocRef);
          const data = snap.exists() ? snap.data() : createInitialRoomState();
          const players = data.players || { player1: null, player2: null, characters: {} };

          if (players.player1 === user.uid || players.player2 === user.uid) return;

          if (!players.player1) {
            players.player1 = user.uid;
          } else if (!players.player2) {
            players.player2 = user.uid;
          } else {
            return;
          }

          transaction.set(
            roomDocRef,
            {
              players
            },
            { merge: true }
          );
        });
      } catch (err) {
        console.error("Seat assignment failed:", err);
      }
    };

    claimSeat();
  }, [user, roomDocRef, roomData, db]);

  const myPlayerSlot =
    roomData?.players?.player1 === user?.uid
      ? "player1"
      : roomData?.players?.player2 === user?.uid
      ? "player2"
      : null;

  const otherPlayerUid =
    myPlayerSlot === "player1"
      ? roomData?.players?.player2
      : myPlayerSlot === "player2"
      ? roomData?.players?.player1
      : null;

  const myCharacter = user?.uid ? roomData?.players?.characters?.[user.uid] : null;
  const otherCharacter = otherPlayerUid ? roomData?.players?.characters?.[otherPlayerUid] : null;

  const bothPlayersJoined = Boolean(roomData?.players?.player1 && roomData?.players?.player2);
  const bothCharactersChosen = Boolean(myCharacter && otherCharacter);
  const raceStarted = Boolean(roomData?.raceTap?.started);
  const raceWinner = roomData?.raceTap?.winner || null;

  // --- DRAWING LOGIC ---
  useEffect(() => {
    if (view === "drawing" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      const redraw = () => {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        (roomData.drawingLines || []).forEach((line) => {
          if (!line.points || line.points.length < 2) return;
          ctx.beginPath();
          ctx.strokeStyle = line.color;
          ctx.lineWidth = 6;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.moveTo(
            (line.points[0].x / 100) * canvas.width,
            (line.points[0].y / 100) * canvas.height
          );
          line.points.forEach((p) => {
            ctx.lineTo((p.x / 100) * canvas.width, (p.y / 100) * canvas.height);
          });
          ctx.stroke();
        });
      };

      redraw();
      window.addEventListener("resize", redraw);

      return () => {
        window.removeEventListener("resize", redraw);
      };
    }
  }, [view, roomData.drawingLines]);

  const handleDrawStart = (e) => {
    if (!canvasRef.current) return;
    if (e.cancelable) e.preventDefault();

    isDrawing.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;

    currentLine.current = [
      {
        x: ((touch.clientX - rect.left) / rect.width) * 100,
        y: ((touch.clientY - rect.top) / rect.height) * 100
      }
    ];
  };

  const handleDrawMove = (e) => {
    if (!isDrawing.current || !canvasRef.current) return;
    if (e.cancelable) e.preventDefault();

    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;

    currentLine.current.push({ x, y });

    const ctx = canvasRef.current.getContext("2d");
    const p1 = currentLine.current[currentLine.current.length - 2];
    if (!p1) return;

    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo((p1.x / 100) * canvasRef.current.width, (p1.y / 100) * canvasRef.current.height);
    ctx.lineTo((x / 100) * canvasRef.current.width, (y / 100) * canvasRef.current.height);
    ctx.stroke();
  };

  const handleDrawEnd = async () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (currentLine.current.length > 1 && roomDocRef) {
      await updateDoc(roomDocRef, {
        drawingLines: arrayUnion({
          color: currentColor,
          points: currentLine.current
        })
      });
    }

    currentLine.current = [];
  };

  // --- PEEKABOO ---
  const handlePeekClick = async (spotId) => {
    if (!roomData.hideReveal || roomData.hideReveal.gameWon || !roomDocRef) return;

    const newSpots = roomData.hideReveal.hideSpots.map((s) =>
      s.id === spotId ? { ...s, revealed: true } : s
    );
    const spot = roomData.hideReveal.hideSpots.find((s) => s.id === spotId);

    if (spot?.hasAnimal) {
      playSound("win");
      await updateDoc(roomDocRef, {
        "hideReveal.hideSpots": newSpots,
        "hideReveal.gameWon": true
      });
    } else {
      playSound("click");
      await updateDoc(roomDocRef, {
        "hideReveal.hideSpots": newSpots
      });
    }
  };

  // --- RACE TAP ---
  const handleChooseRaceCharacter = async (emoji) => {
    if (!roomDocRef || !user || !myPlayerSlot) return;
    if (myCharacter) return;

    const otherEmoji = RACE_CHARACTERS.find((c) => c !== emoji);

    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(roomDocRef);
        const data = snap.data() || {};
        const players = data.players || { player1: null, player2: null, characters: {} };
        const characters = players.characters || {};

        if (characters[user.uid]) return;

        const taken = Object.values(characters);
        if (taken.includes(emoji)) return;

        const updatedCharacters = {
          ...characters,
          [user.uid]: emoji
        };

        const otherUid =
          players.player1 === user.uid ? players.player2 : players.player2 === user.uid ? players.player1 : null;

        if (otherUid && !updatedCharacters[otherUid] && otherEmoji) {
          updatedCharacters[otherUid] = otherEmoji;
        }

        transaction.set(
          roomDocRef,
          {
            players: {
              ...players,
              characters: updatedCharacters
            }
          },
          { merge: true }
        );
      });

      playSound("click");
    } catch (err) {
      console.error("Character selection failed:", err);
    }
  };

  const handleRaceStart = async () => {
    if (!roomDocRef || !bothPlayersJoined || !bothCharactersChosen || raceStarted) return;

    await updateDoc(roomDocRef, {
      raceTap: {
        racePositions: {
          [roomData.players.player1]: 0,
          [roomData.players.player2]: 0
        },
        winner: null,
        started: true
      }
    });

    playSound("boom");
  };

  const handleRaceTap = () => {
    if (!raceStarted || raceWinner || !myCharacter) return;
    localTapCount.current += 3;
    playSound("pop");
  };

  useEffect(() => {
    if (view !== "raceTap" || !roomDocRef || !user) return;

    raceInterval.current = setInterval(async () => {
      if (localTapCount.current <= 0) return;

      const latestRoom = roomDataRef.current;
      const latestRace = latestRoom?.raceTap;

      if (!latestRace?.started || latestRace?.winner) {
        localTapCount.current = 0;
        return;
      }

      const currentPos = latestRace?.racePositions?.[user.uid] || 0;
      const newPos = currentPos + localTapCount.current;
      localTapCount.current = 0;

      const updates = {
        [`raceTap.racePositions.${user.uid}`]: newPos
      };

      if (newPos >= 100) {
        updates["raceTap.winner"] = user.uid;
      }

      try {
        await updateDoc(roomDocRef, updates);
        if (newPos >= 100) playSound("win");
      } catch (err) {
        console.error("Race update failed:", err);
      }
    }, 150);

    return () => {
      clearInterval(raceInterval.current);
    };
  }, [view, roomDocRef, user]);

  const player1Uid = roomData?.players?.player1 || null;
  const player2Uid = roomData?.players?.player2 || null;

  const player1Character = player1Uid ? roomData?.players?.characters?.[player1Uid] || "❔" : "❔";
  const player2Character = player2Uid ? roomData?.players?.characters?.[player2Uid] || "❔" : "❔";

  const player1Pos = roomData?.raceTap?.racePositions?.[player1Uid] || 0;
  const player2Pos = roomData?.raceTap?.racePositions?.[player2Uid] || 0;

  // --- TIC TAC TOE ---
  const handleTTTClick = async (i) => {
    const ttt = roomData.tictactoe;
    if (!ttt || ttt.winner || ttt.board[i] || !roomDocRef) return;

    const newBoard = [...ttt.board];
    newBoard[i] = ttt.turn;

    const getWinner = (board) => {
      const lines = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
      ];

      for (let [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
      }

      return board.every((x) => x) ? "Draw" : null;
    };

    const win = getWinner(newBoard);
    playSound("boom");

    await updateDoc(roomDocRef, {
      "tictactoe.board": newBoard,
      "tictactoe.turn": ttt.turn === "X" ? "O" : "X",
      "tictactoe.winner": win,
      "tictactoe.lastMove": i
    });

    if (win && win !== "Draw") playSound("win");
  };

  const Header = () => (
    <div className="sticky top-0 z-50 flex items-center justify-between p-4 bg-white border-b">
      <button
        onClick={() => {
          playSound("click");
          setView("menu");
        }}
        className="p-2 rounded-xl bg-slate-100 active:bg-slate-200"
      >
        <Home />
      </button>

      <div className="flex flex-col items-center">
        <h1 className="text-lg font-black text-indigo-600">SparklePlay</h1>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Room: {roomId ?? "—"}
        </span>
      </div>

      <button
        onClick={() => {
          navigator.clipboard.writeText(window.location.href);
          setCopyFeedback(true);
          setTimeout(() => setCopyFeedback(false), 2000);
        }}
        className="p-2 rounded-xl bg-indigo-50"
      >
        {copyFeedback ? <Check className="text-green-600" /> : <Share className="w-6 h-6 text-indigo-600" />}
      </button>
    </div>
  );

  if (view === "lobby") {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-8 bg-white text-center">
        <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center shadow-2xl mb-8 animate-bounce">
          <Sparkles className="w-12 h-12 text-white" />
        </div>

        <h1 className="text-4xl font-black text-slate-800">SparklePlay</h1>

        <button
          onClick={() => {
            playSound("click");
            const id = Math.random().toString(36).substring(2, 7).toUpperCase();
            window.history.pushState({}, "", `?room=${id}`);
            setRoomId(id);
            setView("menu");
          }}
          className="mt-10 px-12 py-6 bg-indigo-600 text-white rounded-[2rem] font-bold text-2xl shadow-xl active:scale-95 transition-all"
        >
          Start Playing
        </button>
      </div>
    );
  }

  if (view === "menu") {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
        <Header />

        <div className="flex-1 overflow-y-auto p-6 pb-24 grid grid-cols-1 gap-4">
          <button
            onClick={() => {
              playSound("click");
              setView("hideReveal");
            }}
            className="bg-orange-400 text-white p-6 rounded-[2.5rem] flex items-center justify-between shadow-xl"
          >
            <div className="flex flex-col items-start">
              <Ghost className="mb-1" />
              <span className="text-xl font-black italic">Peekaboo Game</span>
            </div>
            <ArrowRight />
          </button>

          <button
            onClick={() => {
              playSound("click");
              setView("raceTap");
            }}
            className="bg-green-500 text-white p-6 rounded-[2.5rem] flex items-center justify-between shadow-xl"
          >
            <div className="flex flex-col items-start">
              <Zap className="mb-1" />
              <span className="text-xl font-black italic">Race Tap</span>
            </div>
            <ArrowRight />
          </button>

          <button
            onClick={() => {
              playSound("click");
              setView("tictactoe");
            }}
            className="bg-purple-600 text-white p-6 rounded-[2.5rem] flex items-center justify-between shadow-xl"
          >
            <div className="flex flex-col items-start">
              <Sparkles className="mb-1" />
              <span className="text-xl font-black italic">Tic Tac Toe</span>
            </div>
            <ArrowRight />
          </button>

          <button
            onClick={() => {
              playSound("click");
              setView("drawing");
            }}
            className="bg-white p-6 rounded-[2.5rem] flex items-center justify-between shadow-xl border-4 border-blue-50 text-left"
          >
            <div className="flex flex-col items-start">
              <Palette className="text-blue-500 mb-1" />
              <span className="text-xl font-black">Drawing Pad</span>
            </div>
            <ArrowRight />
          </button>

          <button
            onClick={async () => {
              playSound("click");
              await resetStory();
              setView("story");
            }}
            className="bg-white p-6 rounded-[2.5rem] flex items-center justify-between shadow-xl border-4 border-orange-50 text-left"
          >
            <div className="flex flex-col items-start">
              <BookOpen className="text-orange-500 mb-1" />
              <span className="text-xl font-black">Story Time</span>
            </div>
            <ArrowRight />
          </button>
        </div>
      </div>
    );
  }

  if (view === "hideReveal") {
    return (
      <div className="min-h-[100dvh] bg-orange-50 flex flex-col">
        <Header />

        <div className="flex-1 p-6 flex flex-col items-center justify-center">
          <h2 className="text-3xl font-black text-orange-600 mb-8 text-center uppercase">
            Find the {roomData.hideReveal?.targetAnimal}!
          </h2>

          <div className="grid grid-cols-2 gap-6 w-full max-w-sm">
            {roomData.hideReveal?.hideSpots?.map((s) => (
              <button
                key={s.id}
                onClick={() => handlePeekClick(s.id)}
                className={`aspect-square rounded-[2rem] text-6xl flex items-center justify-center shadow-xl transition-all ${
                  s.revealed ? "bg-white" : "bg-orange-400 active:scale-95"
                }`}
              >
                {s.revealed ? (s.hasAnimal ? roomData.hideReveal.targetAnimal : "💨") : "❓"}
              </button>
            ))}
          </div>
        </div>

        {roomData.hideReveal?.gameWon && (
          <div className="fixed inset-0 z-50 bg-orange-500 flex flex-col items-center justify-center p-6 text-center">
            <div className="text-[8rem] sm:text-[12rem] animate-bounce">
              {roomData.hideReveal.targetAnimal}
            </div>

            <button
              onClick={resetPeekaboo}
              className="mt-6 px-12 py-6 bg-white text-orange-600 rounded-[2rem] font-black text-2xl shadow-2xl"
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    );
  }

  if (view === "raceTap") {
    const myLabel = myPlayerSlot === "player1" ? "Player 1" : myPlayerSlot === "player2" ? "Player 2" : "Waiting";

    return (
      <div className="min-h-[100dvh] bg-green-50 flex flex-col">
        <Header />

        <div className="flex-1 p-5 sm:p-6 flex flex-col gap-5">
          <div className="bg-white rounded-[2rem] p-5 shadow-lg border border-green-100">
            <div className="text-center">
              <h2 className="text-2xl font-black text-green-600">Race Tap</h2>
              <p className="text-sm text-slate-500 mt-1">You are: {myLabel}</p>
            </div>

            <div className="mt-4 flex gap-3">
              {RACE_CHARACTERS.map((emoji) => {
                const taken =
                  Object.values(roomData?.players?.characters || {}).includes(emoji) && myCharacter !== emoji;

                return (
                  <button
                    key={emoji}
                    onClick={() => handleChooseRaceCharacter(emoji)}
                    disabled={Boolean(myCharacter) || taken}
                    className={`flex-1 rounded-2xl p-4 text-4xl font-bold border-2 transition-all ${
                      myCharacter === emoji
                        ? "bg-green-500 text-white border-green-500 scale-105"
                        : taken
                        ? "bg-slate-100 text-slate-300 border-slate-200"
                        : "bg-white border-green-200 active:scale-95"
                    }`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-2 text-sm text-slate-600">
              <div>Players joined: {bothPlayersJoined ? "2 / 2" : "Waiting for both players"}</div>
              <div>Characters ready: {bothCharactersChosen ? "Ready" : "Choose a character"}</div>
            </div>

            {!raceStarted && (
              <button
                onClick={handleRaceStart}
                disabled={!bothPlayersJoined || !bothCharactersChosen}
                className={`mt-5 w-full py-4 rounded-2xl font-black text-lg ${
                  bothPlayersJoined && bothCharactersChosen
                    ? "bg-green-500 text-white shadow-lg active:scale-[0.98]"
                    : "bg-slate-200 text-slate-400"
                }`}
              >
                Start Race
              </button>
            )}
          </div>

          <div className="flex flex-col justify-around gap-6">
            <div className="relative w-full h-24 bg-white rounded-full border-4 border-green-200 overflow-hidden">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                P1
              </div>
              <div
                className="absolute top-1/2 -translate-y-1/2 text-6xl transition-all duration-150"
                style={{ left: `${Math.min(player1Pos, 82)}%` }}
              >
                {player1Character}
              </div>
            </div>

            <div className="relative w-full h-24 bg-white rounded-full border-4 border-green-200 overflow-hidden">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                P2
              </div>
              <div
                className="absolute top-1/2 -translate-y-1/2 text-6xl transition-all duration-150"
                style={{ left: `${Math.min(player2Pos, 82)}%` }}
              >
                {player2Character}
              </div>
            </div>
          </div>

          <button
            onClick={handleRaceTap}
            disabled={!raceStarted || Boolean(raceWinner)}
            className={`mt-auto w-full rounded-[2rem] py-8 text-3xl font-black shadow-2xl select-none ${
              raceStarted && !raceWinner
                ? "bg-green-500 text-white active:scale-[0.98]"
                : "bg-slate-200 text-slate-400"
            }`}
          >
            TAP!
          </button>
        </div>

        {raceWinner && (
          <div className="fixed inset-0 z-50 bg-green-600 flex flex-col items-center justify-center p-6 text-center">
            <Trophy className="w-40 h-40 text-yellow-300 animate-bounce" />
            <div className="text-white text-2xl font-black mt-4">
              {raceWinner === player1Uid ? "Player 1 Wins!" : "Player 2 Wins!"}
            </div>
            <button
              onClick={resetRaceTap}
              className="mt-8 px-12 py-6 bg-white text-green-600 rounded-[2rem] font-black text-2xl shadow-2xl"
            >
              Race Again
            </button>
          </div>
        )}
      </div>
    );
  }

  if (view === "tictactoe") {
    return (
      <div className="min-h-[100dvh] bg-purple-50 flex flex-col">
        <Header />

        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="mb-6 text-2xl font-black text-purple-600 uppercase italic text-center">
            {roomData.tictactoe?.winner
              ? roomData.tictactoe.winner === "Draw"
                ? "It's a Draw!"
                : `${roomData.tictactoe.winner} Wins!`
              : `Player ${roomData.tictactoe?.turn}'s Turn`}
          </div>

          <div className="grid grid-cols-3 gap-3 w-full max-w-sm aspect-square bg-purple-200 p-3 rounded-[2.5rem] shadow-2xl">
            {roomData.tictactoe?.board?.map((cell, i) => (
              <button
                key={i}
                onClick={() => handleTTTClick(i)}
                className={`bg-white rounded-2xl flex items-center justify-center text-6xl shadow-sm transition-all duration-300 ${
                  roomData.tictactoe?.lastMove === i ? "scale-110 rotate-3" : ""
                }`}
              >
                {cell === "X" && <X className="w-16 h-16 text-red-500 stroke-[4]" />}
                {cell === "O" && <Circle className="w-16 h-16 text-blue-500 stroke-[4]" />}
              </button>
            ))}
          </div>

          {roomData.tictactoe?.winner && (
            <button
              onClick={resetTTT}
              className="mt-10 px-10 py-5 bg-purple-600 text-white rounded-[2rem] font-black text-xl shadow-xl"
            >
              New Game
            </button>
          )}
        </div>
      </div>
    );
  }

  if (view === "drawing") {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col">
        <Header />

        <div className="flex-1 min-h-0 flex flex-col bg-slate-50">
          <div className="flex-1 min-h-[50vh] relative overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-full touch-none"
              onMouseDown={handleDrawStart}
              onMouseMove={handleDrawMove}
              onMouseUp={handleDrawEnd}
              onMouseLeave={handleDrawEnd}
              onTouchStart={handleDrawStart}
              onTouchMove={handleDrawMove}
              onTouchEnd={handleDrawEnd}
            />
          </div>

          <div className="sticky bottom-0 z-40 bg-white border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(0,0,0,0.06)]">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {DRAW_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    playSound("click");
                    setCurrentColor(c);
                  }}
                  className={`shrink-0 w-11 h-11 rounded-full shadow-md border-2 transition-transform ${
                    currentColor === c ? "scale-110 border-slate-400" : "border-slate-200"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <div className="mt-2 flex justify-end">
              <button
                onClick={async () => {
                  playSound("click");
                  await clearDrawing();
                }}
                className="px-5 py-3 bg-red-100 text-red-600 rounded-2xl flex items-center gap-2 shadow-md active:bg-red-200"
              >
                <Eraser className="w-5 h-5" />
                <span className="font-bold">Clear</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "story") {
    const story = STORIES[roomData.storyIdx || 0] || STORIES[0];
    const currentPageIndex = Math.min(roomData.storyPage || 0, story.length - 1);
    const page = story[currentPageIndex];
    const isLastPage = currentPageIndex === story.length - 1;

    return (
      <div className={`min-h-[100dvh] flex flex-col transition-colors duration-700 ${page.color}`}>
        <Header />

        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="text-[7rem] sm:text-[10rem] mb-4">{page.emoji}</div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-800 leading-tight max-w-2xl">
            {page.text}
          </h2>
        </div>

        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex gap-4">
          <button
            disabled={currentPageIndex === 0}
            onClick={() => updateDoc(roomDocRef, { storyPage: currentPageIndex - 1 })}
            className={`flex-1 py-5 rounded-3xl ${
              currentPageIndex === 0 ? "bg-white/30 text-slate-300" : "bg-white/70 text-slate-700"
            }`}
          >
            <ArrowLeft className="mx-auto w-8 h-8" />
          </button>

          {isLastPage ? (
            <button
              onClick={() => setView("menu")}
              className="flex-1 py-5 bg-green-500 text-white rounded-3xl font-bold uppercase text-lg shadow-lg"
            >
              Done
            </button>
          ) : (
            <button
              onClick={() => updateDoc(roomDocRef, { storyPage: currentPageIndex + 1 })}
              className="flex-1 py-5 bg-indigo-600 text-white rounded-3xl shadow-lg"
            >
              <ArrowRight className="mx-auto w-8 h-8" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
