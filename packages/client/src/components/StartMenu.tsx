import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useGameStore,
  useConnectionState,
  useRoomCode,
  useOnlineError,
  useOpponentConnected,
} from '../stores/gameStore';
import './StartMenu.css';

type MenuView = 'main' | 'local' | 'online-create' | 'online-join' | 'waiting';

/**
 * Start menu screen
 * Players can start local hotseat games or online multiplayer
 */
export function StartMenu() {
  const initGame = useGameStore((state) => state.initGame);
  const createOnlineGame = useGameStore((state) => state.createOnlineGame);
  const joinOnlineGame = useGameStore((state) => state.joinOnlineGame);
  const startOnlineGame = useGameStore((state) => state.startOnlineGame);
  const leaveOnlineGame = useGameStore((state) => state.leaveOnlineGame);
  const attemptReconnect = useGameStore((state) => state.attemptReconnect);

  const connectionState = useConnectionState();
  const roomCode = useRoomCode();
  const onlineError = useOnlineError();
  const opponentConnected = useOpponentConnected();

  const [view, setView] = useState<MenuView>('main');
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Try to reconnect on mount
  useEffect(() => {
    attemptReconnect().then((reconnected) => {
      if (reconnected) {
        setView('waiting');
      }
    });
  }, [attemptReconnect]);

  // Update view when connection state changes
  useEffect(() => {
    if (connectionState === 'waiting_for_player') {
      setView('waiting');
      setIsLoading(false);
    }
  }, [connectionState]);

  const handleStartLocalGame = () => {
    const p1Name = player1Name.trim() || 'Player 1';
    const p2Name = player2Name.trim() || 'Player 2';
    initGame(p1Name, p2Name);
  };

  const handleCreateOnlineGame = async () => {
    if (!playerName.trim()) return;
    setIsLoading(true);
    try {
      await createOnlineGame(playerName.trim());
    } catch {
      setIsLoading(false);
    }
  };

  const handleJoinOnlineGame = async () => {
    if (!playerName.trim() || !joinCode.trim()) return;
    setIsLoading(true);
    try {
      await joinOnlineGame(joinCode.trim(), playerName.trim());
    } catch {
      setIsLoading(false);
    }
  };

  const handleStartGame = () => {
    startOnlineGame();
  };

  const handleBack = () => {
    if (view === 'waiting') {
      leaveOnlineGame();
    }
    setView('main');
    setIsLoading(false);
  };

  const canStartLocal = player1Name.trim().length > 0 || player2Name.trim().length > 0;

  return (
    <div className="start-menu screen">
      <AnimatePresence mode="wait">
        {view === 'main' && (
          <MainMenu key="main" onSelectView={setView} />
        )}

        {view === 'local' && (
          <LocalGameSetup
            key="local"
            player1Name={player1Name}
            player2Name={player2Name}
            onPlayer1Change={setPlayer1Name}
            onPlayer2Change={setPlayer2Name}
            onStart={handleStartLocalGame}
            onBack={handleBack}
            canStart={canStartLocal}
          />
        )}

        {view === 'online-create' && (
          <OnlineCreateSetup
            key="online-create"
            playerName={playerName}
            onPlayerNameChange={setPlayerName}
            onCreate={handleCreateOnlineGame}
            onBack={handleBack}
            isLoading={isLoading}
            error={onlineError}
          />
        )}

        {view === 'online-join' && (
          <OnlineJoinSetup
            key="online-join"
            playerName={playerName}
            joinCode={joinCode}
            onPlayerNameChange={setPlayerName}
            onJoinCodeChange={setJoinCode}
            onJoin={handleJoinOnlineGame}
            onBack={handleBack}
            isLoading={isLoading}
            error={onlineError}
          />
        )}

        {view === 'waiting' && (
          <WaitingRoom
            key="waiting"
            roomCode={roomCode}
            opponentConnected={opponentConnected}
            onStart={handleStartGame}
            onBack={handleBack}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ========== Sub-components ==========

interface MainMenuProps {
  onSelectView: (view: MenuView) => void;
}

function MainMenu({ onSelectView }: MainMenuProps) {
  return (
    <motion.div
      className="start-menu-content"
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <motion.h1
        className="title mb-xl"
        initial={{ letterSpacing: '20px', opacity: 0 }}
        animate={{ letterSpacing: '4px', opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        RADLANDS
      </motion.h1>

      <motion.p
        className="subtitle text-center text-muted mb-2xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Fight for water. Destroy their camps. Survive the wasteland.
      </motion.p>

      <div className="menu-buttons">
        <motion.button
          className="menu-button"
          onClick={() => onSelectView('local')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          Local Game
          <span className="button-hint">Play on one device</span>
        </motion.button>

        <motion.button
          className="menu-button"
          onClick={() => onSelectView('online-create')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          Create Online Game
          <span className="button-hint">Get a room code to share</span>
        </motion.button>

        <motion.button
          className="menu-button"
          onClick={() => onSelectView('online-join')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
        >
          Join Online Game
          <span className="button-hint">Enter a room code</span>
        </motion.button>
      </div>
    </motion.div>
  );
}

interface LocalGameSetupProps {
  player1Name: string;
  player2Name: string;
  onPlayer1Change: (name: string) => void;
  onPlayer2Change: (name: string) => void;
  onStart: () => void;
  onBack: () => void;
  canStart: boolean;
}

function LocalGameSetup({
  player1Name,
  player2Name,
  onPlayer1Change,
  onPlayer2Change,
  onStart,
  onBack,
  canStart,
}: LocalGameSetupProps) {
  return (
    <motion.div
      className="start-menu-content"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="section-title mb-lg">Local Game</h2>
      <p className="text-muted mb-xl">Play against a friend on this device</p>

      <div className="player-inputs mb-xl">
        <div className="input-group mb-md">
          <label htmlFor="player1">Player 1 Name</label>
          <input
            id="player1"
            type="text"
            placeholder="Enter name..."
            value={player1Name}
            onChange={(e) => onPlayer1Change(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canStart && onStart()}
            autoFocus
          />
        </div>

        <div className="input-group">
          <label htmlFor="player2">Player 2 Name</label>
          <input
            id="player2"
            type="text"
            placeholder="Enter name..."
            value={player2Name}
            onChange={(e) => onPlayer2Change(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canStart && onStart()}
          />
        </div>
      </div>

      <div className="button-row">
        <button className="back-button" onClick={onBack}>
          Back
        </button>
        <motion.button
          className="start-button"
          onClick={onStart}
          disabled={!canStart}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
        >
          Start Game
        </motion.button>
      </div>
    </motion.div>
  );
}

interface OnlineCreateSetupProps {
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  onCreate: () => void;
  onBack: () => void;
  isLoading: boolean;
  error: string | null;
}

function OnlineCreateSetup({
  playerName,
  onPlayerNameChange,
  onCreate,
  onBack,
  isLoading,
  error,
}: OnlineCreateSetupProps) {
  return (
    <motion.div
      className="start-menu-content"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="section-title mb-lg">Create Online Game</h2>
      <p className="text-muted mb-xl">You'll get a code to share with your opponent</p>

      <div className="player-inputs mb-xl">
        <div className="input-group">
          <label htmlFor="playerName">Your Name</label>
          <input
            id="playerName"
            type="text"
            placeholder="Enter your name..."
            value={playerName}
            onChange={(e) => onPlayerNameChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && playerName.trim() && onCreate()}
            autoFocus
            disabled={isLoading}
          />
        </div>
      </div>

      {error && <p className="error-message mb-md">{error}</p>}

      <div className="button-row">
        <button className="back-button" onClick={onBack} disabled={isLoading}>
          Back
        </button>
        <motion.button
          className="start-button"
          onClick={onCreate}
          disabled={!playerName.trim() || isLoading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
        >
          {isLoading ? 'Creating...' : 'Create Room'}
        </motion.button>
      </div>
    </motion.div>
  );
}

interface OnlineJoinSetupProps {
  playerName: string;
  joinCode: string;
  onPlayerNameChange: (name: string) => void;
  onJoinCodeChange: (code: string) => void;
  onJoin: () => void;
  onBack: () => void;
  isLoading: boolean;
  error: string | null;
}

function OnlineJoinSetup({
  playerName,
  joinCode,
  onPlayerNameChange,
  onJoinCodeChange,
  onJoin,
  onBack,
  isLoading,
  error,
}: OnlineJoinSetupProps) {
  const canJoin = playerName.trim() && joinCode.trim();

  return (
    <motion.div
      className="start-menu-content"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="section-title mb-lg">Join Online Game</h2>
      <p className="text-muted mb-xl">Enter the room code from your opponent</p>

      <div className="player-inputs mb-xl">
        <div className="input-group mb-md">
          <label htmlFor="playerName">Your Name</label>
          <input
            id="playerName"
            type="text"
            placeholder="Enter your name..."
            value={playerName}
            onChange={(e) => onPlayerNameChange(e.target.value)}
            autoFocus
            disabled={isLoading}
          />
        </div>

        <div className="input-group">
          <label htmlFor="joinCode">Room Code</label>
          <input
            id="joinCode"
            type="text"
            placeholder="ABCDEF"
            value={joinCode}
            onChange={(e) => onJoinCodeChange(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && canJoin && onJoin()}
            maxLength={6}
            className="room-code-input"
            disabled={isLoading}
          />
        </div>
      </div>

      {error && <p className="error-message mb-md">{error}</p>}

      <div className="button-row">
        <button className="back-button" onClick={onBack} disabled={isLoading}>
          Back
        </button>
        <motion.button
          className="start-button"
          onClick={onJoin}
          disabled={!canJoin || isLoading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
        >
          {isLoading ? 'Joining...' : 'Join Room'}
        </motion.button>
      </div>
    </motion.div>
  );
}

interface WaitingRoomProps {
  roomCode: string | null;
  opponentConnected: boolean;
  onStart: () => void;
  onBack: () => void;
}

function WaitingRoom({ roomCode, opponentConnected, onStart, onBack }: WaitingRoomProps) {
  return (
    <motion.div
      className="start-menu-content"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="section-title mb-lg">Waiting Room</h2>

      <div className="room-code-display mb-xl">
        <p className="text-muted mb-sm">Share this code with your opponent:</p>
        <div className="room-code">{roomCode ?? '------'}</div>
      </div>

      <div className="player-status mb-xl">
        <div className="status-item">
          <span className="status-dot connected" />
          <span>You (connected)</span>
        </div>
        <div className="status-item">
          <span className={`status-dot ${opponentConnected ? 'connected' : 'waiting'}`} />
          <span>{opponentConnected ? 'Opponent (connected)' : 'Waiting for opponent...'}</span>
        </div>
      </div>

      <div className="button-row">
        <button className="back-button" onClick={onBack}>
          Leave
        </button>
        <motion.button
          className="start-button"
          onClick={onStart}
          disabled={!opponentConnected}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
        >
          Start Game
        </motion.button>
      </div>
    </motion.div>
  );
}
