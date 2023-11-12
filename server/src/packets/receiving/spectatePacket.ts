import { existsSync, mkdirSync, writeFileSync } from "fs";
import { SpectateActions } from "../../../../common/src/constants";
import { random } from "../../../../common/src/utils/random";
import { SPECTATE_ACTIONS_BITS, type SuroiBitStream } from "../../../../common/src/utils/suroiBitStream";
import { type Player } from "../../objects/player";
import { ReceivingPacket } from "../../types/receivingPacket";
import { ReportPacket } from "../sending/reportPacket";
import { randomBytes } from "crypto";

export class SpectatePacket extends ReceivingPacket {
    override deserialize(stream: SuroiBitStream): void {
        const player = this.player;
        if (!player.dead) return;
        const game = player.game;
        const action = stream.readBits(SPECTATE_ACTIONS_BITS);
        if (game.now - player.lastSpectateActionTime < 200) return;
        player.lastSpectateActionTime = game.now;
        switch (action) {
            case SpectateActions.BeginSpectating: {
                let toSpectate: Player | undefined;
                if (player.killedBy !== undefined && !player.killedBy.dead) toSpectate = player.killedBy;
                else if (game.players.length > 1) toSpectate = game.players[random(0, game.players.length)];
                if (toSpectate !== undefined) player.spectate(toSpectate);
                break;
            }
            case SpectateActions.SpectatePrevious:
                if (game.players.length < 2) {
                    game.removePlayer(player);
                    break;
                }
                if (player.spectating !== undefined) {
                    let index: number = game.players.indexOf(player.spectating) - 1;
                    if (index < 0) index = game.players.length - 1;
                    player.spectate(game.players[index]);
                }
                break;
            case SpectateActions.SpectateNext:
                if (game.players.length < 2) {
                    game.removePlayer(player);
                    break;
                }
                if (player.spectating !== undefined) {
                    let index: number = game.players.indexOf(player.spectating) + 1;
                    if (index >= game.players.length) index = 0;
                    player.spectate(game.players[index]);
                }
                break;
            case SpectateActions.SpectateSpecific: {
                const playerID = stream.readObjectID();
                const playerToSpectate = game.players.find(player => player.id === playerID);
                if (playerToSpectate) player.spectate(playerToSpectate);
                break;
            }
            case SpectateActions.SpectateKillLeader: {
                const playerToSpectate = game.players.find(player => player.id === player.game.killLeader?.id);
                if (playerToSpectate) player.spectate(playerToSpectate);
                break;
            }
            case SpectateActions.Report: {
                if (!existsSync("reports")) mkdirSync("reports");
                const reportID = randomBytes(4).toString("hex");
                writeFileSync(`reports/${reportID}.json`, JSON.stringify({
                    ip: player.spectating?.ip,
                    name: player.spectating?.name,
                    time: player.game.now
                }));
                player.sendPacket(new ReportPacket(player, player.spectating?.name ?? "", reportID));
                break;
            }
        }
    }
}
