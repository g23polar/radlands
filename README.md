# ⚔️ RADLANDS

**A post-apocalyptic card game for the browser**

Two tribes. Three camps. One water source. *Only one survives.*

---

## 🎮 Play Now

```bash
git clone https://github.com/your-username/radlands.git
cd radlands
pnpm install
pnpm dev
```

Open **http://localhost:5173** and enter the wasteland.

---

## 🏜️ About

Radlands is a digital adaptation of the acclaimed 2-player dueling card game. In a world ravaged by apocalypse, rival tribes battle for control of the last remaining water sources.

### The Goal
**Destroy all three of your opponent's camps to win.**

### The Loop
1. **Events Phase** — Your queued events tick down and resolve
2. **Replenish Phase** — Draw a card, collect 3 water
3. **Actions Phase** — Play cards, use abilities, junk for effects

### Core Mechanics

| Mechanic | Description |
|----------|-------------|
| **Water** | Your currency. Resets to 3 each turn. |
| **Camps** | Your bases. Lose all 3, you're done. |
| **People** | Fighters placed in columns. Protect what's behind them. |
| **Events** | Delayed effects. Queue them up, watch them trigger. |
| **Punks** | Face-down fodder. One hit and they're gone. |
| **Junking** | Discard any card for its icon effect. |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Game Logic** | Pure TypeScript (zero deps) |
| **Frontend** | React 18 + Vite |
| **Rendering** | PixiJS 8 (WebGL) |
| **State** | Zustand |
| **Animations** | Framer Motion |
| **Backend** | Node.js + Socket.io *(coming soon)* |

---

## 📁 Project Structure

```
radlands/
├── packages/
│   ├── core/        # Pure game logic — runs anywhere
│   ├── client/      # React + PixiJS frontend
│   └── server/      # Multiplayer backend (Phase 3)
└── pnpm-workspace.yaml
```

The `core` package has **zero dependencies** and contains all game rules. It runs identically on client and server, enabling:
- Instant local play
- Server-authoritative multiplayer
- Replay systems
- AI opponents

---

## 🚀 Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests (108 tests, 90%+ coverage)
pnpm test

# Type check
pnpm typecheck

# Production build
pnpm build
```

---

## 🗺️ Roadmap

- [x] **Phase 1** — Core game logic & rules engine
- [x] **Phase 2** — Visual client with hotseat multiplayer
- [ ] **Phase 3** — Online multiplayer (Socket.io)
- [ ] **Phase 4** — Animations, sound, polish
- [ ] **Phase 5** — Full 100-card set

---

## 🎴 Card Preview

**8 Camps** — Garage, Bunker, Armory, Refinery...
**14 People** — Gunner, Sniper, Medic, Warlord...
**10 Events** — Bombardment, Siege, Assassin...

*Full 100-card set coming in Phase 5.*

---

## 🤝 Contributing

This project is in active development. Feel free to:
- Report bugs
- Suggest features
- Submit PRs

---

## 📜 License

MIT

---

## 🙏 Credits

Inspired by the physical card game **Radlands** by Roxley Games.

This is a fan project for educational purposes.

---

<p align="center">
  <i>In the wasteland, water is life. And life is war.</i>
</p>
