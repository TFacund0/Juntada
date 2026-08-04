import { BigTextFlash } from "../../../../components/game-kit/BigTextFlash";

// The beat bridging the last vote confirm into the result screen — see
// BigTextFlash for the shared shell/animation.
export function VoteResultsFlash() {
  return <BigTextFlash text="Descubramos quién era..." />;
}
