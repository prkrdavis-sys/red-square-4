export interface PlayerInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpJust: boolean;
  down: boolean;
  downJust: boolean;
  special: boolean;
  specialJust: boolean;
}

export const EMPTY_PLAYER_INPUT: PlayerInput = {
  left: false,
  right: false,
  jump: false,
  jumpJust: false,
  down: false,
  downJust: false,
  special: false,
  specialJust: false,
};
