import { Request } from "express";
import { db } from "../adapters/db/index.js";
import {
  NewGameFormSchema,
  JoinGameFormSchema,
  XHR_ERRORS,
  APIErrorResponse,
  PLAYER_COLORS,
} from "@ssaquif/rock-paper-wizard-api-types-and-schema";
import { Game, NewGame } from "../models/games.model.js";
import { IntRange } from "../types/utility.types.js";

export const createNewGame = async (
  req: Request
): Promise<Game | APIErrorResponse> => {
  const validatedFormInput = NewGameFormSchema.safeParse(req.body);
  if (!validatedFormInput.success) {
    throw new Error(validatedFormInput.error.issues[0].message);
  }

  const remainingColors = PLAYER_COLORS.filter(
    (color) => color !== validatedFormInput.data.selectedColor
  );

  const dataToInsert: NewGame = {
    player_1: validatedFormInput.data.username,
    player_1_points: 0,
    player_1_position: 6,
    number_of_players: validatedFormInput.data.numOfPlayers as IntRange<2, 6>,
    password: validatedFormInput.data.password,
    player_1_color: validatedFormInput.data.selectedColor,
    current_round: 0,
    player_order: [],
    game_status: "creating",
    cards_in_play: [],
    cards_in_deck: [],
    discard_pile: [],
    unselected_colors: remainingColors,
  };

  // todo: determine if I need to return all
  const result = await db
    .insertInto("games")
    .values(dataToInsert)
    .returningAll()
    .executeTakeFirstOrThrow();

  return result;
};

export const joinGame = async (
  req: Request
): Promise<Game | APIErrorResponse> => {
  const validatedFormInput = JoinGameFormSchema.safeParse(req.body);
  if (!validatedFormInput.success) {
    throw new Error(validatedFormInput.error.issues[0].message);
  }
  const { gameId, username, password, selectedColor } = validatedFormInput.data;

  const game = await db
    .selectFrom("games")
    .selectAll()
    .where("game_id", "=", gameId)
    .executeTakeFirst();

  if (!game) {
    return { error: XHR_ERRORS.GAME_NOT_FOUND }; // todo: consider throwing error instead
  }
  if (gameId !== game.game_id) {
    return { error: XHR_ERRORS.GAME_NOT_FOUND }; // todo: consider throwing error instead
  }
  if (password !== game.password) {
    return { error: XHR_ERRORS.INVALID_PASSWORD }; // todo: consider throwing error instead
  }

  const {
    player_1,
    player_2,
    player_3,
    player_4,
    player_5,
    player_6,
    number_of_players,
    unselected_colors,
  } = game;

  if (!unselected_colors.includes(selectedColor)) {
    return { error: XHR_ERRORS.INVALID_COLOR }; // todo: consider throwing error instead
  }

  const remainingColors = unselected_colors.filter(
    (color) => color !== selectedColor
  );

  const spotsTaken = [
    player_1,
    player_2,
    player_3,
    player_4,
    player_5,
    player_6,
  ].filter((player) => player).length;

  if (spotsTaken >= number_of_players) {
    return { error: XHR_ERRORS.GAME_FULL }; // todo: consider throwing error instead
  }

  const updatedGame = {
    ...game,
    [`player_${spotsTaken + 1}`]: username,
    [`player_${spotsTaken + 1}_points`]: 0,
    [`player_${spotsTaken + 1}_position`]: spotsTaken,
    [`player_${spotsTaken + 1}_color`]: selectedColor,
    unselected_colors: remainingColors,
  };

  const result = await db
    .updateTable("games")
    .set(updatedGame)
    .where("game_id", "=", gameId)
    .returningAll()
    .executeTakeFirstOrThrow();

  return result;
};
