# Design: Local Games Setup Layout Fix

## Architecture & Layout System

In Juntada's UI design kit, `T.card` (`rounded-2xl border border-[var(--jt-card-border,...)] bg-[var(--jt-card-bg,...)] p-[18px_20px] mb-3.5`) represents an atomic card container.
Nesting `T.card` inside another `T.card` produces visual glitches: double border, double inner padding (36px–40px), and bottom margin leakage.

### Component Structure

1. `frontend/src/games/quien-soy/LocalGame.tsx`:
   - Change:
     ```tsx
     {setupTab === "players" && (
       <>
         <div className={T.card}>
           <span className={T.label}>Jugadores ({players.length})</span>
           {players.map(p => (
             <div key={p.id} className="mb-2 flex items-center gap-2">
               <input
                 className={clsx(T.input, "flex-1 min-w-0")}
                 value={p.name}
                 onChange={...}
               />
               ...
             </div>
           ))}
         </div>
         <AddPlayerForm name={newName} onNameChange={setNewName} onSubmit={addPlayer} error={nameError} errorKey={nameErrorKey} />
       </>
     )}
     ```
2. `frontend/src/components/game-kit/AddPlayerForm.tsx`:
   - Add `min-w-0` to the input: `className={clsx(T.input, "flex-1 min-w-0")}`.
3. `frontend/src/games/color-correcto/components/PlayersConfig.tsx`:
   - Add `min-w-0 truncate` to player name containers: `className={clsx(T.input, "flex-1 min-w-0 truncate")}`.
4. `frontend/src/games/quien-soy/components/WordsEditor.tsx`:
   - Add `min-w-0` to the secret word input: `className={clsx(T.input, "flex-1 min-w-0")}`.
