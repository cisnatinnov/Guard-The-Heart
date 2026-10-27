import { GAME_CHARACTERS } from '../data/characters'

export function GameCharacters({ className = '' }: { className?: string }) {
  return <div className={`game-characters ${className}`} aria-label="Fight the Dragon heroes">
    {GAME_CHARACTERS.map((character) => <img key={character.id} data-character={character.id} src={character.image} alt={character.description} />)}
  </div>
}
