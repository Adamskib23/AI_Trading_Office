import { inputHandler } from './inputHandler';
import { EMPLOYEES } from '../../data/office';
import { Player } from './player';

export const officeInputs = {
  installOffice: inputHandler({
    args: {},
    handler: (game, now) => {
      if (game.world.players.size || game.world.agents.size)
        throw new Error('Office must start empty');
      for (const employee of EMPLOYEES) {
        const id = Player.join(
          game,
          now,
          employee.name,
          employee.character,
          `${employee.specialty}. ${employee.strategy}. All selected markets. Phase 1: inactive.`,
        );
        const player = game.world.players.get(id)!;
        player.position = { x: employee.desk.x, y: employee.desk.y + 1 };
        player.facing = { dx: 0, dy: -1 };
      }
      return null;
    },
  }),
};
