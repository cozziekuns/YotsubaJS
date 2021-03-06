//=============================================================================
// ** Util
//=============================================================================

export class Util {

  //--------------------------------------------------------------------------
  // * General Utility Functions
  //--------------------------------------------------------------------------

  static addToBucketMap(bucketMap, key, value) {
    if (!bucketMap.has(key)) {
      bucketMap.set(key, []);
    }
  
    bucketMap.get(key).push(value);
  }

  //--------------------------------------------------------------------------
  // * Hand Utility Functions
  //--------------------------------------------------------------------------

  static tileValue(tile) {
    return ((tile < 0 || tile >= 27) ? 10 : (tile % 9 + 1));
  }

  static getHandFromString(string) {
    const result = [];
    const currTiles = [];
  
    for (let i = 0; i < string.length; i++) {
      const tileChar = string.charAt(i);
  
      if ( /^\d$/.test(tileChar)) {
        currTiles.push(Number(tileChar - 1));
      } else {
        if (tileChar === 'm') {
          result.push(...currTiles);
        } else if (tileChar === 'p') {
          result.push(...currTiles.map(tile => tile + 9));
        } else if (tileChar === 's') {
          result.push(...currTiles.map(tile => tile + 18));
        } else if (tileChar === 'z') {
          result.push(...currTiles.map(tile => tile + 27));
        }
  
        // Empty the array of currTiles
        currTiles.length = 0;
      }
    }
  
    return result.sort((a, b) => a - b);
  }

}

//=============================================================================
// ** ConfigurationUtil
//=============================================================================

export class ConfigurationUtil {

  //----------------------------------------------------------------------------
  // * Mentsu Configuration Calculation
  //----------------------------------------------------------------------------

  static calcMentsuConfigurations(hand, maxMentsu=4) {
    let queue = [[hand, [], 0, false]];

    while (queue.length > 0) {
      const nextElement = queue.shift();

      const currentHand = nextElement[0];
      const oldHand = nextElement[1];
      const mentsu = nextElement[2];
      const hasAtama = nextElement[3];

      // Return all the configurations in the queue that have an empty
      // currentHand.
      if (currentHand.length === 0) {
        return [oldHand].concat(
          queue
            .filter(element => element[0].length === 0)
            .map(element => element[1])
        );
      }

      if (currentHand.length > 2 && mentsu < maxMentsu) {
        // Kootsu
        if (
          currentHand[0] === currentHand[1] && 
          currentHand[1] === currentHand[2]
        ) {
          queue.push([
            currentHand.slice(3, currentHand.length),
            oldHand.concat([currentHand.slice(0, 3)]),
            mentsu + 1,
            hasAtama,
          ]);
        }

        // Shuntsu
        if (Util.tileValue(currentHand[0]) < 8) {
          if (
            currentHand.includes(currentHand[0] + 1) && 
            currentHand.includes(currentHand[0] + 2)
          ) {
            const newHand = currentHand.slice(1, currentHand.length);
            newHand.splice(newHand.indexOf(currentHand[0] + 1), 1);
            newHand.splice(newHand.indexOf(currentHand[0] + 2), 1);

            const shuntsu = [
              currentHand[0],
              currentHand[0] + 1,
              currentHand[0] + 2,
            ];

            queue.push(
              [newHand, oldHand.concat([shuntsu]), mentsu + 1, hasAtama],
            );
          }

        }
      }

      if (currentHand.length > 1) {
        // Toitsu
        if (
          currentHand[0] === currentHand[1] && 
          (!hasAtama || mentsu < maxMentsu)
        ) {
          queue.push([
            currentHand.slice(2, currentHand.length),
            oldHand.concat([currentHand.slice(0, 2)]),
            (hasAtama ? mentsu + 1 : mentsu),
            true,
          ]);
        }

        if (mentsu < maxMentsu) {
          // Ryanmen / Penchan
          if (
            Util.tileValue(currentHand[0]) < 9 &&
            currentHand.includes(currentHand[0] + 1)
          ) {
            const newHand = currentHand.slice(1, currentHand.length);
            newHand.splice(newHand.indexOf(currentHand[0] + 1), 1);

            const taatsu = [currentHand[0], currentHand[0] + 1];
            queue.push(
              [newHand, oldHand.concat([taatsu]), mentsu + 1, hasAtama],
            );
          }

          // Kanchan
          if (
            Util.tileValue(currentHand[0]) < 8 &&
            currentHand.includes(currentHand[0] + 2)
          ) {
            const newHand = currentHand.slice(1, currentHand.length);
            newHand.splice(newHand.indexOf(currentHand[0] + 2), 1);

            const taatsu = [currentHand[0], currentHand[0] + 2];
            queue.push(
              [newHand, oldHand.concat([taatsu]), mentsu + 1, hasAtama],
            );
          }
        }
      }

      // Tanki
      queue.push([
        currentHand.slice(1, currentHand.length),
        oldHand.concat([currentHand.slice(0, 1)]),
        mentsu,
        hasAtama,
      ]);
    }

    throw 'Invalid input.';
  }

  static calcChiitoiConfiguration(hand) {
    const configuration = [];
    const toitsu = [];

    for (let i = 0; i < hand.length - 1; i++) {
      if (toitsu.includes(hand[i])) {
        continue;
      }

      if (hand[i] === hand[i + 1]) {
        toitsu.push(hand[i]);
        configuration.push([hand[i], hand[i + 1]]);
        i++;
      } else {
        configuration.push([hand[i]]);
      }
    }

    return configuration;
  }

  //----------------------------------------------------------------------------
  // * Shanten Calculation
  //----------------------------------------------------------------------------

  static calculateChiitoiShanten(configuration) {
    return 6 - configuration.filter(shape => shape.length === 2).length;
  }

  static calculateConfigurationShanten(configuration, maxMentsu=4) {
    const blocks = configuration.filter(shape => shape.length > 1);

    return maxMentsu * 2 - blocks.reduce((a, b) => a + b.length - 1, 0);
  }

  static getMinShantenConfigurations(configurations) {
    const configurationShanten = configurations.map(configuration => {
      return ConfigurationUtil.calculateConfigurationShanten(configuration);
    });

    const shanten = Math.min(...configurationShanten);
    
    return configurations.filter(
      (_, index) => configurationShanten[index] === shanten
    );
  }

  static getOutsForShape(shape) {
    const outs = [];
  
    if (shape.length === 1) {
      // Tanki
      for (let i = -2; i <= 2; i++) {
        if (Util.tileValue(shape[0] + i) === Util.tileValue(shape) + i) {
          outs.push(shape[0] + i);
        }
      }
    } else if (shape.length === 2) {
      if (shape[0] === shape[1]) {
        // Toitsu
        outs.push(shape[0]);
      } else if (shape[0] === shape[1] - 1) {
        // Ryanmen / Penchan
        if (Util.tileValue(shape[0]) > 1) {
          outs.push(shape[0] - 1);
        }
  
        if (Util.tileValue(shape[1]) < 9) {
          outs.push(shape[1] + 1);
        }
      } else if (shape[0] === shape[1] - 2) {
        // Kanchan
        outs.push(shape[0] + 1);
      }
    }
  
    return outs;
  }
  
}