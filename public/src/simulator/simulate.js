/* TODO List:
  - Customizable Dora
  - Chiitoi and Kokushi
  - Aka Nashi
*/

import { ConfigurationUtil } from './util.js';
import { ConfigurationNode, GameStateNode } from './nodes.js';

//=============================================================================
// ** Simulator
//----------------------------------------------------------------------------
// Static class which provides methods for simulating game states.
//=============================================================================

export class Simulator {

  //--------------------------------------------------------------------------
  // * Simulation Methods
  //--------------------------------------------------------------------------

  static simulateHitori(
    wall,
    wallTiles,
    configurationNode,
    endShanten,
    drawsLeft,
    memo,
  ) {
    let agariChance = 0;

    if (
      drawsLeft === 0 ||
      configurationNode.shanten - endShanten > drawsLeft
    ) {
      return agariChance;
    }

    if (memo.has(configurationNode)) {
      const drawsLeftTable = memo.get(configurationNode);

      if (drawsLeftTable[drawsLeft - 1] >= 0) {
        return drawsLeftTable[drawsLeft - 1];
      }
    } else {
      const drawsLeftTable = new Array(18).fill(-1);

      memo.set(configurationNode, drawsLeftTable);
    }

    const ukeire = configurationNode.outs.reduce(
      (total, out) => total + wall[out],
      0,
    );

    const drawChance = ukeire / wallTiles;

    if (configurationNode.shanten > endShanten) {
      for (let i = 0; i < configurationNode.outs.length; i++) {
        const out = configurationNode.outs[i];
    
        if (wall[out] === 0) {
          continue;
        }
    
        const newWall = wall.slice();
        newWall[out] -= 1;
    
        let drawResult = -1;
        let tileToDiscard;

        const candidateTilesToDiscard = [];

        const discardTilesCache = configurationNode.tilesToDiscard.get(out);
        const candidateNextNodes = configurationNode.children.get(out);

        if (discardTilesCache[drawsLeft - 1] >= 0) {
          candidateTilesToDiscard.push(discardTilesCache[drawsLeft - 1]);
        } else {
          candidateTilesToDiscard.push(...candidateNextNodes.keys());
        }

        candidateTilesToDiscard.forEach(candidateTileToDiscard => {
          const candidateNodeAgariChance = Simulator.simulateHitori(
            newWall,
            wallTiles - 1,
            candidateNextNodes.get(candidateTileToDiscard),
            endShanten,
            drawsLeft - 1,
            memo,
          );

          if (candidateNodeAgariChance > drawResult) {
            drawResult = candidateNodeAgariChance;
            tileToDiscard = candidateTileToDiscard;
          }
        });
        
        discardTilesCache[drawsLeft - 1] = tileToDiscard;

        agariChance += (wall[out] / ukeire) * drawResult * drawChance;
      }  
    } else {
      agariChance += drawChance;
    }

    const missResult = Simulator.simulateHitori(
      wall,
      wallTiles - 1,
      configurationNode,
      endShanten, 
      drawsLeft - 1,
      memo,
    );

    agariChance += (1 - drawChance) * missResult;

    memo.get(configurationNode)[drawsLeft - 1] = agariChance;

    return agariChance;
  }

  static simulateBlackBoxShoubu(
    wall,
    wallTiles,
    configurationNode,
    oppUkeire,
    drawsLeft,
    currentPlayer,
    memo,
  ) {
    let agariMatrix = new Array(4).fill(0);
  
    if (drawsLeft === 0) {
      return agariMatrix;
    }
  
    if (memo.has(configurationNode)) {
      const drawsLeftTable = memo.get(configurationNode);
  
      if (drawsLeftTable[drawsLeft - 1][0] >= 0) {
        return drawsLeftTable[drawsLeft - 1];
      }
    } else {
      const drawsLeftTable = [];
  
      // TODO: Instead of 36, this should be some sort of MAX_DRAWS_LEFT
      // constant.
      for (let i = 0; i < 36; i++) {
        drawsLeftTable.push(new Array(4).fill(-1));
      }
  
      memo.set(configurationNode, drawsLeftTable);
    }
  
    const playerUkeire = configurationNode.outs.reduce(
      (total, out) => total + wall[out],
      0,
    );
  
    const playerDrawChance = playerUkeire / wallTiles;
    const oppDrawChance = oppUkeire / wallTiles;
  
    if (configurationNode.shanten === 0) {
      agariMatrix[currentPlayer] += playerDrawChance;
    } else if (currentPlayer === 0) {
      const playerDrawsLeft = Math.ceil(drawsLeft / 2);
  
      for (let i = 0; i < configurationNode.outs.length; i++) {
        const out = configurationNode.outs[i];
    
        if (wall[out] === 0) {
          continue;
        }
    
        const newWall = wall.slice();
        newWall[out] -= 1;
  
        let newConfigurationNode = configurationNode;
  
        if (playerDrawsLeft > configurationNode.shanten - 1) {
          const discardTilesCache = configurationNode.tilesToDiscard.get(out);
  
          newConfigurationNode =  configurationNode.children.get(out).get(
            discardTilesCache[playerDrawsLeft - 1],
          );
        }
        
        const drawResult = Simulator.simulateBlackBoxShoubu(
          newWall,
          wallTiles - 1,
          newConfigurationNode,
          oppUkeire,
          drawsLeft - 1,
          (currentPlayer + 1) % 2,
          memo,
        );
  
        const outDrawChance = (wall[out] / playerUkeire) * playerDrawChance;
  
        agariMatrix.forEach((_, index) => { 
          agariMatrix[index] += outDrawChance * drawResult[index];
        });
      }
    }
  
    agariMatrix[2 + currentPlayer] += oppDrawChance;
  
    let missChance = 1 - oppDrawChance;
  
    if (configurationNode.shanten === 0 || currentPlayer === 0) {
      missChance -= playerDrawChance;
    }
  
    const missResult = Simulator.simulateBlackBoxShoubu(
      wall,
      wallTiles - 1,
      configurationNode,
      oppUkeire,
      drawsLeft - 1,
      (currentPlayer + 1) % 2,
      memo,
    );
  
    agariMatrix.forEach((_, index) => { 
      agariMatrix[index] += missChance * missResult[index];
      
      memo.get(configurationNode)[drawsLeft - 1][index] = agariMatrix[index];
    });

    return agariMatrix;
  }

  static simulateGameState(
    wall,
    wallTiles,
    gameStateNode,
    drawsLeft,
    currentPlayer,
    memo,
  ) {
    const numPlayers = gameStateNode.configurationNodes.length;
  
    let agariMatrix = new Array(numPlayers ** 2).fill(0);
  
    if (drawsLeft === 0) {
      return agariMatrix;
    }
  
    if (!memo.has(gameStateNode)) {
      const newDrawsLeftTable = [];
  
      for (let i = 0; i < 70; i++) {
        newDrawsLeftTable.push(new Array(4).fill(-1));
      }
  
      memo.set(gameStateNode, newDrawsLeftTable);
    }
  
    const drawsLeftTable = memo.get(gameStateNode);
  
    if (drawsLeftTable[drawsLeft - 1][0] >= 0) {
      return drawsLeftTable[drawsLeft - 1];
    }
  
    const outsList = Simulator.getOutsList(gameStateNode, currentPlayer);
    const ukeireList = outsList.map(outs => {
      return outs.reduce((total, out) => total += wall[out], 0);
    });
  
    const totalUkeire = ukeireList.reduce((total, ukeire) => total + ukeire);
    let missChance = 1 - (totalUkeire / wallTiles);
  
    for (let i = 0; i < numPlayers; i++) {
      const drawChance = ukeireList[i] / wallTiles;
  
      if (gameStateNode.configurationNodes[i].shanten === 0) {
        agariMatrix[i * numPlayers + currentPlayer] += drawChance;
        continue;
      } else if (i !== currentPlayer) {
        missChance += drawChance;
        continue;
      }
  
      for (let j = 0; j < outsList[i].length; j++) {
        const out = outsList[i][j];
        
        if (wall[out] === 0) {
          continue;
        }
  
        const outDrawChance = (wall[out] / ukeireList[i]) * drawChance;
  
        let newGameStateNode;
  
        if (currentPlayer !== i) {
          newGameStateNode = gameStateNode;
        } else {
          newGameStateNode = gameStateNode.children[i].get(out);
        }
  
        // TODO: The fact that the wall changes the game state is really 
        // annoying... 
        const newWall = wall.slice();
        newWall[out] -= 1;
  
        const drawResult = Simulator.simulateGameState(
          newWall,
          wallTiles - 1,
          newGameStateNode,
          drawsLeft - 1,
          (currentPlayer + 1) % 2,
          memo,
        );
  
        agariMatrix.forEach((_, index) => { 
          agariMatrix[index] += outDrawChance * drawResult[index];
        });
      }
    }
  
    const missResult = Simulator.simulateGameState(
      wall,
      wallTiles - 1,
      gameStateNode,
      drawsLeft - 1,
      (currentPlayer + 1) % 2,
      memo,
    );
  
    agariMatrix.forEach((_, index) => { 
      agariMatrix[index] += missChance * missResult[index];
  
      const drawsLeftTable = memo.get(gameStateNode);
      drawsLeftTable[drawsLeft - 1][index] = agariMatrix[index];
    });
  
    return agariMatrix;
  }

  //----------------------------------------------------------------------------
  // * Helper Methods
  //----------------------------------------------------------------------------

  static getOutsList(gameStateNode, currentPlayer) {
    const configurationNodes = gameStateNode.configurationNodes;

    const numPlayers = configurationNodes.length;
    const outsList = new Array(numPlayers);

    outsList[currentPlayer] = configurationNodes[currentPlayer].outs;

    for (let i = 0; i < numPlayers; i++) {
      if (i === currentPlayer) {
        continue;
      }

      const outsSet = new Set(configurationNodes[i].outs);

      outsList[currentPlayer].forEach(out => outsSet.delete(out));
      outsList[i] = [...outsSet];
    }

    return outsList;
  }

}

//=============================================================================
// ** SimulationAdapter
//----------------------------------------------------------------------------
// Client-facing interface that takes in a GameState payload and generates a 
// response.
//=============================================================================

export class SimulationAdapter {

  constructor() {
    this.dirty = true;
  }

  //--------------------------------------------------------------------------
  // * Getters and Setters
  //--------------------------------------------------------------------------

  markDirty() {
    this.dirty = true;
  }

  //--------------------------------------------------------------------------
  // * Process Payload
  //--------------------------------------------------------------------------

  processGameState(payload) {
    if (!this.dirty) {
      return;
    }

    this.wall = payload.wall;
    this.wallTiles = payload.wallTiles;

    this.actorConfigurations = new Array(4);

    for (let index = 0; index < 4; index++) {
      const chiitoiConfiguration = ConfigurationUtil.calcChiitoiConfiguration(
        payload.hands[index],
      );
      
      const mentsuConfigurations = ConfigurationUtil.calcMentsuConfigurations(
        payload.hands[index],
      );

      const configurationList = ConfigurationUtil.getMinShantenConfigurations(
        mentsuConfigurations,
      );

      this.actorConfigurations[index] = new ConfigurationNode(
        configurationList,
        new Map(),
      );
    }

    this.warmupConfigurations(payload);
    this.dirty = false;
  }

  //--------------------------------------------------------------------------
  // * Configuration Warmup
  //--------------------------------------------------------------------------

  warmupConfigurations(payload) {
    const playerWalls = new Array(4);
    const playerWallTiles = new Array(4).fill(this.wallTiles);

    for (let i = 0; i < 4; i++) {
      playerWalls[i] = this.wall.slice();

      for (let j = 0; j < 4; j++) {
        if (i === j || this.actorConfigurations[i] === null) {
          continue;
        }

        payload.hands[i].forEach(tile => {
          playerWalls[i][tile] += 1;
          playerWallTiles[i] += 1;
        });
      }
    }

    this.actorConfigurations.forEach((configuration, index) => {
      Simulator.simulateHitori(
        playerWalls[index],
        playerWallTiles[index],
        configuration,
        0,
        18,
        new WeakMap(),
      );
    });
  }

  //--------------------------------------------------------------------------
  // * Simulation Wrappers
  //--------------------------------------------------------------------------

  simulateHitori(playerIndex, drawsLeft, endShanten) {
    if (this.actorConfigurations[playerIndex].shanten < endShanten) {
      return 1;
    }

    return Simulator.simulateHitori(
      this.wall,
      this.wallTiles,
      this.actorConfigurations[playerIndex],
      endShanten,
      drawsLeft,
      new WeakMap(),
    );
  }

  simulateBlackBoxShoubu(playerIndex, oppUkeire, drawsLeft, currentPlayer) {
    return Simulator.simulateBlackBoxShoubu(
      this.wall,
      this.wallTiles,
      this.actorConfigurations[playerIndex],
      oppUkeire,
      drawsLeft,
      currentPlayer,
      new WeakMap(),
    );
  }

  simulateGameState(actorIndicies, drawsLeft, currentPlayer) {
    const configurationNodeList = actorIndicies.map(
      index => this.actorConfigurations[index]
    );

    const gameStateNode = new GameStateNode(configurationNodeList, new Map());

    return Simulator.simulateGameState(
      this.wall,
      this.wallTiles,
      gameStateNode,
      drawsLeft,
      currentPlayer,
      new WeakMap(),
    );
  }

}