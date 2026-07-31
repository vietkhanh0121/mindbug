import { createServer } from "node:http";
import { writeFile } from "node:fs/promises";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";

const PORT = Number(process.env.PORT || 5177);
const CLIENT_ORIGINS = String(process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map(origin => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const rooms = new Map();
const abandonedSessions = new Map();
const DISCONNECT_GRACE_MS = 60_000;
const BOT_LEARNING_FILE_URL = new URL("./bot-learning-data.json", import.meta.url);
let botLearningWriteQueue = Promise.resolve();

function isAllowedClientOrigin(origin = "") {
  const normalized = String(origin || "").replace(/\/+$/, "");
  return !origin
    || CLIENT_ORIGINS.includes(normalized)
    || /^https:\/\/[^/]+\.github\.io$/i.test(normalized)
    || /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(normalized);
}
const STARTING_LIFE = 3;
const STARTING_MINDBUGS = 2;
const HAND_SIZE = 5;
const TARGET_DECK_SIZE = 72;
const PLAYER_DECK_SIZE = 10;
const RAW_CARDS = [
  ["Shark Dog", 1, 4, ["HUNTER"], "Attack: Defeat an enemy creature with power 6 or more"],
  ["Mysterious Mermaid", 1, 7, [], "Play: Set your life points equal to the opponent's"],
  ["Shark Crab-Dog Mummypus", 1, 5, [], "Constant: Has HUNTER, SNEAKY, FRENZY, POISONOUS while an enemy creature does"],
  ["Bee Bear", 1, 8, [], "Constant: Cannot be blocked by creatures with power 6 or less"],
  ["Urchin Hurler", 1, 5, ["HUNTER"], "Constant: Other allied creatures have +2 power while it is your turn"],
  ["Ferret Bomber", 2, 2, ["SNEAKY"], "Play: The opponent chooses and discards 2 cards"],
  ["Explosive Toad", 2, 5, ["FRENZY"], "Defeated: Defeat an enemy creature"],
  ["Compost Dragon", 2, 3, ["HUNTER"], "Play: Play a card from your discard pile"],
  ["Plated Scorpion", 2, 2, ["TOUGH", "POISONOUS"], "NONE"],
  ["Axolotl Healer", 2, 4, ["POISONOUS"], "Play: Gain 2 life points"],
  ["Elephantopus", 1, 7, ["TOUGH"], "Constant: The opponent cannot block with creatures with power 4 or less"],
  ["Killer Bee", 2, 5, ["HUNTER"], "Play: The opponent loses 1 life point"],
  ["Grave Robber", 2, 7, ["TOUGH"], "Play: Play a card from the opponent's discard pile"],
  ["Giraffodile", 1, 7, [], "Play: Draw your entire discard pile"],
  ["Goblin Werewolf", 2, 2, ["HUNTER"], "Constant: Has +6 power while it is your turn"],
  ["Luchataur", 2, 9, ["FRENZY"], "NONE"],
  ["Snail Hydra", 2, 9, [], "Attack: If you control fewer creatures than the opponent, defeat a monster"],
  ["Strange Barrel", 1, 6, [], "Defeated: Steal 2 random cards from the opponent's hand"],
  ["Deathweaver", 1, 2, ["POISONOUS"], "Constant: The opponent cannot activate play effects"],
  ["Turbo Bug", 1, 4, [], "Attack: The opponent loses all life point except one"],
  ["Lone Yeti", 1, 5, ["TOUGH"], "Constant: While this is your only allied creature, it has +5 power and FRENZY"],
  ["Harpy Mother", 1, 5, [], "Defeated: Take control of up to 2 creatures with power 5 or less"],
  ["Gorillion", 1, 10, [], "NONE"],
  ["Rhino Turtle", 2, 8, ["FRENZY", "TOUGH"], "NONE"],
  ["Shield Bugs", 2, 4, ["TOUGH"], "Constant: Other allied creatures have +1 power"],
  ["Brain Fly", 1, 4, [], "Play: Take control of a creature with power 6 or more"],
  ["Chameleon Sniper", 1, 1, ["SNEAKY"], "Attack: The opponent loses 1 life point"],
  ["Snail Thrower", 1, 1, ["POISONOUS"], "Constant: Other allied creatures with power 4 or less have HUNTER and POISONOUS"],
  ["Kangasaurus Rex", 2, 7, [], "Play: Defeat all enemy creatures with power 4 or less"],
  ["Spider Owl", 2, 3, ["SNEAKY", "POISONOUS"], "NONE"],
  ["Tiger Squirrel", 2, 3, ["SNEAKY"], "Play: Defeat an enemy creature with power of 7 or more"],
  ["Tusked Exporter", 2, 8, [], "Attack: The opponent chooses and discards a card"],
  ["Bugserker", 2, 3, ["TOUGH"], "Constant: Has +8 power while you have 1 life point left"],
  ["Count Draculeech", 2, 7, [], "Attack: You lose 1 life point. Defeat a creature"],
  ["Creep From The Deep", 2, 4, ["POISONOUS", "HUNTER"], "NONE"],
  ["Ferret Pacifier", 2, 4, [], "Constant: The enemy creature(s) with the highest power can't block"],
  ["Froblin Instigator", 2, 1, ["HUNTER"], "Constant: Has +2 power for each other allied creature"],
  ["Goreagle Alpha", 2, 6, ["FRENZY", "HUNTER", "TOUGH"], "Play: You lose 1 life point"],
  ["Hamster Lion", 2, 8, ["FRENZY"], "Constant: The enemy creature(s) with the lowest power can't attack"],
  ["Hungry Hungry Hamster", 2, 2, ["SNEAKY"], "Play: The opponent gives you a card from their hand"],
  ["Hyenix", 2, 7, ["FRENZY"], "Constant: When you lose life while this is in your discard pile, play it"],
  ["Majestic Manticore", 2, 6, ["POISONOUS"], "Attack: Defeat the creature(s) with the lowest power among all creatures in play"],
  ["The Lurker", 2, 4, ["TOUGH"], "Attack: If you control more creatures than the opponent, this has SNEAKY this turn"],
  ["Turf The Surfer", 2, 8, [], "Attack: Choose a creature. It cannot block this turn"],
  ["Cloud Lady", 1, 4, [], "Action: Defeat an enemy creature with power 4 or less. Evolve into Typhoon Princess."],
  ["Curious Tadpole", 1, 1, ["POISONOUS"], "Action: Gain 1 life point. Evolve into Frog Prophet."],
  ["Waddling Recruit", 1, 3, [], "Action: The opponent discards a card. Evolve into Veteran Penguin."]
];
const BEYOND_EVOLUTION_CARDS = [
  ["Blastfish", 1, 1, ["POISONOUS"], "Attack: This cannot be defeated this turn."],
  ["Bullet Train", 2, 9, [], "Attack: Defeat an enemy creature with power 3 or less."],
  ["Cake Trickster", 2, 6, ["POISONOUS"], "Action: Choose an enemy creature. The opponent attacks with it if able."],
  ["Captain Hippo", 1, 7, ["FRENZY"], "During the opponent's turn, they must always attack this with a creature with HUNTER if able."],
  ["Cheeky Chimpborg", 1, 5, ["HUNTER"], "Play: The opponent discards a card for each creature they control."],
  ["Cheery Chimpborg", 1, 5, ["HUNTER"], "While there are 3 or more enemy creatures, this has +5 power."],
  ["Chuckling Chimpborg", 1, 5, ["HUNTER"], "Play: The opponent loses 1 life for each Mindbug they have."],
  ["Coach Panda", 2, 6, [], "While there is exactly 1 other allied creature, that creature has +3 power and FRENZY."],
  ["Dr. Orange U. Tan", 1, 6, [], "Play: You may lose 1 life. If you do, return all enemy creatures to the opponent's hand."],
  ["Dragon Inn", 2, 3, ["TOUGH"], "Action: If you control fewer creatures than the opponent, they lose 1 life."],
  ["Earwig Assassin", 2, 1, ["SNEAKY"], "Play: You may discard a card. If you do, defeat any creature."],
  ["Infernostrich", 1, 6, [], "Action: Defeat an enemy creature with power 7 or more."],
  ["Kitsunsei", 1, 4, [], "Other allied creatures have SNEAKY."],
  ["Mole Machine", 2, 5, ["TOUGH"], "The opponent cannot block with creatures with power 7 or more."],
  ["Octocopter", 1, 5, [], "Action: Defeat this. Take control of an enemy creature."],
  ["Puffermech", 2, 2, ["POISONOUS"], "Defeated: Defeat all enemy creatures with power 8 or more."],
  ["Radioactive Rabbit", 1, 3, ["FRENZY"], "Play: The opponent takes control of this. Defeated: Defeat all other allied creatures."],
  ["Robopup", 2, 1, ["SNEAKY", "TOUGH"], "NONE"],
  ["Sawn", 2, 5, ["TOUGH"], "When this fights, the creature with the highest power is defeated instead of the lowest."],
  ["Spiky Shinobi", 2, 3, ["SNEAKY"], "While you have no Mindbugs, this has +5 power."],
  ["Steelhorn", 1, 7, [], "Defeated: The opponent discards 3 cards."],
  ["Sweet Fighter", 2, 9, [], "Defeated: Gain 2 life."],
  ["The Experiment", 1, 6, ["POISONOUS"], "Play: The opponent takes control of this. Take control of an enemy creature."],
  ["Turtle Toaster", 2, 4, ["TOUGH"], "Play: Defeat up to 2 enemy creatures with power from 4 to 6."],
  ["Utility Bug", 2, 4, ["HUNTER", "TOUGH"], "Play: You may copy the Play effect of another creature."],
  ["Westside Monster", 2, 8, ["FRENZY"], "Enemy creatures with SNEAKY cannot attack or block."]
];
const EXTRA_CARD_SPECS = [
  ["Typhoon Princess", 1, 6, [], "Action: Defeat an enemy creature with power 6 or less. Evolve into Thunder Queen."],
  ["Thunder Queen", 1, 9, [], "Attack: Defeat an enemy creature."],
  ["Frog Prophet", 1, 3, ["POISONOUS", "TOUGH"], "Action: Gain 1 life point. Evolve into World Eater."],
  ["World Eater", 1, 8, ["POISONOUS", "TOUGH"], "Attack: The opponent loses 1 life point."],
  ["Veteran Penguin", 1, 5, ["TOUGH"], "Action: The opponent discards a card. Evolve into Frosty Fortress."],
  ["Frosty Fortress", 1, 10, ["TOUGH"], "Attack: The opponent discards their hand."]
];
const ALL_CARD_SPECS = [...RAW_CARDS, ...EXTRA_CARD_SPECS, ...BEYOND_EVOLUTION_CARDS];
const EVOLUTION_INFO = {
  "Cloud Lady": { level: 1, evolution: "Typhoon Princess", root: "Cloud Lady" },
  "Typhoon Princess": { level: 2, evolution: "Thunder Queen", root: "Cloud Lady" },
  "Thunder Queen": { level: 3, evolution: "", root: "Cloud Lady" },
  "Curious Tadpole": { level: 1, evolution: "Frog Prophet", root: "Curious Tadpole" },
  "Frog Prophet": { level: 2, evolution: "World Eater", root: "Curious Tadpole" },
  "World Eater": { level: 3, evolution: "", root: "Curious Tadpole" },
  "Waddling Recruit": { level: 1, evolution: "Veteran Penguin", root: "Waddling Recruit" },
  "Veteran Penguin": { level: 2, evolution: "Frosty Fortress", root: "Waddling Recruit" },
  "Frosty Fortress": { level: 3, evolution: "", root: "Waddling Recruit" }
};
const DUEL_DECK_SPECS = RAW_CARDS.filter(([name]) => !EVOLUTION_INFO[name]);
const ACTION_ABILITY_CARDS = new Set([
  ...Object.keys(EVOLUTION_INFO).filter(name => EVOLUTION_INFO[name].evolution),
  "Cake Trickster",
  "Dragon Inn",
  "Infernostrich",
  "Octocopter"
]);
const PLAY_ABILITY_CARDS = new Set([
  "Mysterious Mermaid",
  "Ferret Bomber",
  "Compost Dragon",
  "Axolotl Healer",
  "Killer Bee",
  "Grave Robber",
  "Giraffodile",
  "Brain Fly",
  "Kangasaurus Rex",
  "Tiger Squirrel",
  "Goreagle Alpha",
  "Hungry Hungry Hamster",
  "Cheeky Chimpborg",
  "Chuckling Chimpborg",
  "Dr. Orange U. Tan",
  "Earwig Assassin",
  "The Experiment",
  "Utility Bug",
  "Radioactive Rabbit",
  "Turtle Toaster"
]);
const ATTACK_ABILITY_CARDS = new Set([
  "Shark Dog",
  "Snail Hydra",
  "Turbo Bug",
  "Chameleon Sniper",
  "Tusked Exporter",
  "Count Draculeech",
  "Majestic Manticore",
  "The Lurker",
  "Turf The Surfer",
  "Thunder Queen",
  "World Eater",
  "Frosty Fortress",
  "Blastfish",
  "Bullet Train"
]);
const DEFEATED_ABILITY_CARDS = new Set([
  "Strange Barrel",
  "Harpy Mother",
  "Explosive Toad",
  "Puffermech",
  "Radioactive Rabbit",
  "Steelhorn",
  "Sweet Fighter"
]);

function hasPrintedPlayAbility(card) {
  return /^play\s*:/i.test(String(card?.ability ?? "").trim());
}

function makeRng(seed) {
  let value = Number(seed) >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function makeServerDeckPool(seed) {
  const deckSpecs = [...DUEL_DECK_SPECS, ...BEYOND_EVOLUTION_CARDS];
  let id = 1;
  const cards = [];
  for (const spec of deckSpecs) {
    for (let i = 0; i < spec[1]; i += 1) cards.push(makeServerCard(spec, id++, null));
  }
  let filler = 0;
  while (cards.length < TARGET_DECK_SIZE) {
    cards.push(makeServerCard(deckSpecs[filler % deckSpecs.length], id++, null));
    filler += 1;
  }
  return shuffleWithRng(cards, makeRng(seed));
}

function makeServerCard([name, , power, keywords, ability], id, ownerIndex) {
  const evolutionInfo = EVOLUTION_INFO[name] ?? { level: 0, evolution: "", root: "" };
  return {
    id: `s${id}`,
    name,
    basePower: power,
    keywords,
    ability,
    level: evolutionInfo.level,
    evolution: evolutionInfo.evolution,
    evolutionRoot: evolutionInfo.root,
    evolutionChainId: "",
    evolvedFromNames: [],
    highestEvolutionName: name,
    exhausted: false,
    attacksThisTurn: 0,
    damage: 0,
    originalOwnerIndex: ownerIndex,
    mindbuggedThisTurn: false,
    cannotBlockThisTurn: false,
    lurkerSneakyThisTurn: false
    ,cannotBeDefeatedThisTurn: false
    ,countLifeLossAfterAttack: false
    ,deferredAttackLifeEffect: ""
  };
}

function makeServerExtraDeck(ownerIndex) {
  return EXTRA_CARD_SPECS.map((spec, index) => makeServerCard(spec, `e${ownerIndex}-${index}`, ownerIndex));
}

function shuffleWithRng(items, rng) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomFirstPlayerIndex(seed) {
  return Math.floor(makeRng(seed + 424242)() * 2);
}

function markServerOriginalOwner(cards, ownerIndex) {
  for (const card of cards) {
    if (card.originalOwnerIndex === null || card.originalOwnerIndex === undefined) {
      card.originalOwnerIndex = ownerIndex;
    }
  }
}

function makeGame(room, seed) {
  const firstPlayerIndex = randomFirstPlayerIndex(seed);
  const deckPool = makeServerDeckPool(seed);
  const state = {
    players: room.players.map((player, index) => ({
      name: player.name,
      life: STARTING_LIFE,
      mindbugs: STARTING_MINDBUGS,
      deck: deckPool.splice(0, PLAYER_DECK_SIZE),
      extraDeck: makeServerExtraDeck(index),
      evolutionArchive: [],
      hand: [],
      board: [],
      discard: []
    })),
    active: firstPlayerIndex,
    phase: "action",
    log: [],
    winner: null,
    extraTurn: false,
    extraTurnSource: "",
    frenzyOnly: null,
    pending: null
  };
  state.players.forEach((player, index) => markServerOriginalOwner(player.deck, index));
  state.players.forEach((player, index) => markServerOriginalOwner(player.extraDeck, index));
  state.players.forEach(player => drawToFive(player));
  state.log.unshift(`${state.players[firstPlayerIndex].name} bắt đầu lượt.`);
  return state;
}

function drawToFive(player) {
  let drawn = 0;
  while (player.hand.length < HAND_SIZE && player.deck.length) {
    player.hand.push(player.deck.shift());
    drawn += 1;
  }
  return drawn;
}

function triggerServerHyenixFromDiscard(state, playerIndex, after = { type: "resume-action", actorIndex: state.active }) {
  const player = state.players[playerIndex];
  if (!player || state.winner !== null) return { pending: null };
  const card = player.discard.find(item => item.name === "Hyenix");
  if (!card) return { pending: null };
  return beginServerPending(state, {
    type: "hyenix",
    actorIndex: playerIndex,
    playerIndex,
    cardId: card.id,
    sourceCard: { id: card.id, name: card.name },
    after
  });
}

function endServerTurn(state, next = 1 - state.active) {
  drawToFive(state.players[state.active]);
  checkServerGameOver(state);
  if (state.winner !== null) return;
  state.active = next;
  state.phase = "action";
  state.pending = null;
  for (const player of state.players) {
    for (const card of player.board) {
      card.cannotBlockThisTurn = false;
      card.lurkerSneakyThisTurn = false;
      card.cannotBeDefeatedThisTurn = false;
    }
  }
  for (const card of state.players[state.active].board) {
    card.exhausted = false;
    card.attacksThisTurn = 0;
    card.mindbuggedThisTurn = false;
  }
  state.log.unshift(`${state.players[state.active].name} bắt đầu lượt.`);
  checkServerActionLoss(state);
}

function cardPower(card, state = null, ownerIndex = -1) {
  if (!card) return 0;
  let power = card.basePower;
  if (!state || ownerIndex < 0) return power;
  const owner = state.players[ownerIndex];
  if (!owner) return power;
  if (card.name === "Goblin Werewolf" && state.active === ownerIndex) power += 6;
  if (card.name === "Lone Yeti" && owner.board.length === 1 && owner.board[0]?.id === card.id) power += 5;
  if (card.name === "Bugserker" && owner.life === 1) power += 8;
  if (card.name === "Froblin Instigator") power += Math.max(0, owner.board.length - 1) * 2;
  if (card.name === "Cheery Chimpborg" && state.players[1 - ownerIndex].board.length >= 3) power += 5;
  if (card.name === "Spiky Shinobi" && owner.mindbugs === 0) power += 5;
  for (const ally of owner.board) {
    if (ally.id === card.id) continue;
    if (ally.name === "Shield Bugs") power += 1;
    if (ally.name === "Urchin Hurler" && state.active === ownerIndex) power += 2;
    if (ally.name === "Coach Panda" && owner.board.length === 2) power += 3;
  }
  return power;
}

function cardKeywordsServer(card, state = null, ownerIndex = -1, visited = new Set()) {
  const set = new Set(card?.keywords ?? []);
  if (!card || !state || ownerIndex < 0) return [...set];
  const visitKey = `${ownerIndex}:${card.id}`;
  if (visited.has(visitKey)) return [...set];
  visited.add(visitKey);
  const owner = state.players[ownerIndex];
  const enemy = state.players[1 - ownerIndex];
  if (card.name === "Lone Yeti" && owner?.board.length === 1 && owner.board[0]?.id === card.id) {
    set.add("FRENZY");
  }
  if (card.name === "The Lurker" && card.lurkerSneakyThisTurn) {
    set.add("SNEAKY");
  }
  if (owner?.board.some(ally => ally.id !== card.id && ally.name === "Kitsunsei")) set.add("SNEAKY");
  if (owner?.board.length === 2 && owner.board.some(ally => ally.id !== card.id && ally.name === "Coach Panda")) set.add("FRENZY");
  if (card.name === "Shark Crab-Dog Mummypus") {
    const enemyKeywords = (enemy?.board ?? []).flatMap(enemyCard => (
      cardKeywordsServer(enemyCard, state, 1 - ownerIndex, new Set(visited))
    ));
    for (const keyword of ["HUNTER", "SNEAKY", "FRENZY", "POISONOUS"]) {
      if (enemyKeywords.includes(keyword)) set.add(keyword);
    }
  }
  const basePower = cardPower(card, state, ownerIndex);
  for (const ally of owner?.board ?? []) {
    if (ally.id === card.id) continue;
    if (ally.name === "Snail Thrower" && basePower <= 4) {
      set.add("HUNTER");
      set.add("POISONOUS");
    }
  }
  return [...set];
}

function canAttackServer(card, state = null, actorIndex = -1) {
  if (!canAttackServerIgnoringCaptainHippo(card, state, actorIndex)) return false;
  const forcedAttackers = captainHippoForcedAttackersServer(state, actorIndex);
  if (forcedAttackers.length) return forcedAttackers.some(attacker => attacker.id === card.id);
  return true;
}

function canAttackServerIgnoringCaptainHippo(card, state = null, actorIndex = -1) {
  if (!card || card.exhausted) return false;
  if (state?.frenzyOnly && state.frenzyOnly !== card.id) return false;
  if (state && actorIndex >= 0 && state.players[1 - actorIndex]?.board.some(enemyCard => enemyCard.name === "Westside Monster")
      && cardKeywordsServer(card, state, actorIndex).includes("SNEAKY")) return false;
  if (state && actorIndex >= 0 && state.players[1 - actorIndex]?.board.some(enemyCard => enemyCard.name === "Hamster Lion")) {
    const lowestPower = Math.min(...state.players[actorIndex].board.map(boardCard => cardPower(boardCard, state, actorIndex)));
    if (cardPower(card, state, actorIndex) === lowestPower) return false;
  }
  if (card.attacksThisTurn <= 0) return true;
  return card.attacksThisTurn === 1 && cardKeywordsServer(card, state, actorIndex).includes("FRENZY") && state?.frenzyOnly === card.id;
}

function captainHippoForcedAttackersServer(state, actorIndex) {
  const player = state?.players?.[actorIndex];
  const enemy = state?.players?.[1 - actorIndex];
  if (!player || !enemy || player.board.some(card => card.cakeForcedAttack)) return [];
  if (!enemy.board.some(card => card.name === "Captain Hippo")) return [];
  return player.board.filter(card => (
    cardKeywordsServer(card, state, actorIndex).includes("HUNTER")
    && canAttackServerIgnoringCaptainHippo(card, state, actorIndex)
  ));
}

function canUseServerEvolutionAction(card, state = null, actorIndex = -1) {
  if (!card || !ACTION_ABILITY_CARDS.has(card.name)) return false;
  if (card.exhausted) return false;
  if (card.attacksThisTurn > 0) return false;
  if (captainHippoForcedAttackersServer(state, actorIndex).length) return false;
  if (state?.frenzyOnly && state.frenzyOnly !== card.id) return false;
  return true;
}

function canServerPlayerAct(state, playerIndex) {
  const player = state.players[playerIndex];
  if (!player) return false;
  if (player.hand.length > 0) return true;
  return player.board.some(card => canAttackServer(card, state, playerIndex) || canUseServerEvolutionAction(card, state, playerIndex));
}

function checkServerActionLoss(state) {
  if (state.winner !== null || state.phase !== "action") return;
  if (canServerPlayerAct(state, state.active)) return;
  state.winner = 1 - state.active;
  state.phase = "gameover";
  state.pending = null;
}

function legalBlockersServer(state, attacker, defenderIndex) {
  const attackerIndex = 1 - defenderIndex;
  const attackerKeywords = cardKeywordsServer(attacker, state, attackerIndex);
  return state.players[defenderIndex].board.filter(card => {
    const blockerPower = cardPower(card, state, defenderIndex);
    if (card.cannotBlockThisTurn) return false;
    if (state.players[attackerIndex]?.board.some(creature => creature.name === "Mole Machine") && blockerPower >= 7) return false;
    if (state.players[attackerIndex]?.board.some(creature => creature.name === "Westside Monster")
        && cardKeywordsServer(card, state, defenderIndex).includes("SNEAKY")) return false;
    if (attackerKeywords.includes("SNEAKY") && !cardKeywordsServer(card, state, defenderIndex).includes("SNEAKY")) return false;
    if (attacker.name === "Bee Bear" && blockerPower <= 6) return false;
    if (state.players[attackerIndex]?.board.some(creature => creature.name === "Elephantopus") && blockerPower <= 4) return false;
    if (state.players[attackerIndex]?.board.some(creature => creature.name === "Ferret Pacifier")) {
      const highestPower = Math.max(...state.players[defenderIndex].board.map(blocker => cardPower(blocker, state, defenderIndex)));
      if (blockerPower === highestPower) return false;
    }
    return true;
  });
}

function discardServerCard(state, card, fallbackOwnerIndex) {
  const owner = Number.isInteger(card.originalOwnerIndex) ? card.originalOwnerIndex : fallbackOwnerIndex;
  state.players[owner]?.discard.push(card);
}

function takeServerRandom(cards, amount) {
  const taken = [];
  for (let i = 0; i < amount && cards.length; i += 1) {
    const index = Math.floor(Math.random() * cards.length);
    taken.push(cards.splice(index, 1)[0]);
  }
  return taken;
}

function moveServerCreature(state, cardId, fromIndex, toIndex) {
  const from = state.players[fromIndex];
  const to = state.players[toIndex];
  const index = from?.board.findIndex(card => card.id === cardId) ?? -1;
  if (index < 0 || !to) return null;
  const [card] = from.board.splice(index, 1);
  card.exhausted = true;
  to.board.push(card);
  return card;
}

function removeServerCreature(state, cardId, ownerIndex) {
  const board = state.players[ownerIndex]?.board;
  const index = board?.findIndex(card => card.id === cardId) ?? -1;
  if (index < 0) return null;
  const [removed] = board.splice(index, 1);
  removed.damage = 0;
  removed.exhausted = false;
  removed.attacksThisTurn = 0;
  discardServerCard(state, removed, ownerIndex);
  return removed;
}

function makeServerEvolutionFallbackCard(cardName, ownerIndex) {
  const spec = EXTRA_CARD_SPECS.find(([name]) => name === cardName);
  if (!spec) return null;
  return makeServerCard(spec, `ef${ownerIndex}-${Date.now()}-${Math.floor(Math.random() * 100000)}`, ownerIndex);
}

function evolveServerBoardCreature(state, cardId, ownerIndex) {
  const player = state.players[ownerIndex];
  const boardIndex = player?.board.findIndex(card => card.id === cardId) ?? -1;
  if (boardIndex < 0) return null;
  const current = player.board[boardIndex];
  const nextName = EVOLUTION_INFO[current.name]?.evolution;
  if (!nextName) return null;
  const extraIndex = player.extraDeck.findIndex(card => card.name === nextName);
  const next = extraIndex >= 0
    ? player.extraDeck.splice(extraIndex, 1)[0]
    : makeServerEvolutionFallbackCard(nextName, ownerIndex);
  if (!next) return null;
  current.exhausted = false;
  current.attacksThisTurn = 0;
  current.damage = 0;
  current.highestEvolutionName = next.name;
  player.evolutionArchive.push(current);
  next.originalOwnerIndex = Number.isInteger(current.originalOwnerIndex) ? current.originalOwnerIndex : ownerIndex;
  next.evolutionChainId = current.evolutionChainId || current.id;
  next.evolvedFromNames = [...(current.evolvedFromNames ?? []), current.name];
  next.highestEvolutionName = next.name;
  next.exhausted = true;
  next.attacksThisTurn = 0;
  next.damage = 0;
  player.board[boardIndex] = next;
  state.log.unshift(`${current.name} tiến hóa thành ${next.name}.`);
  return { fromCard: current, fromCardId: current.id, toCard: next, toCardId: next.id, ownerIndex };
}

function canActivateServerPlay(state, ownerIndex, card) {
  const enemy = state.players[1 - ownerIndex];
  return !enemy?.board.some(enemyCard => enemyCard.name === "Deathweaver") || card.name === "Deathweaver";
}

function beginServerPending(state, pending) {
  state.phase = "pending";
  state.pending = pending;
  return { pending };
}

function refillDiscardPendingPlayer(state, pending) {
  if (pending?.type !== "discard") return 0;
  const player = state.players[pending.playerIndex];
  const drawn = drawToFive(player);
  if (drawn > 0) state.log.unshift(`${player.name} rút ${drawn} lá để đủ 5 lá sau khi bỏ bài.`);
  return drawn;
}

function completeServerPendingAfter(state, pending) {
  pending.drawnToFive = refillDiscardPendingPlayer(state, pending);
  state.pending = null;
  if (pending.remainingDefeatedCards?.length) {
    const remainingDefeatedCards = pending.remainingDefeatedCards;
    const resumedPending = { ...pending, remainingDefeatedCards: [] };
    const defeatedAbility = resolveServerDefeatedAbilities(state, remainingDefeatedCards, pending.after);
    if (defeatedAbility.pending) {
      return {
        type: "ability-defeated-chain",
        defeatedIds: defeatedAbility.defeatedIds ?? [],
        defeatedEffects: defeatedAbility.defeatedEffects ?? []
      };
    }
    const afterEvent = completeServerPendingAfter(state, resumedPending);
    return {
      type: "ability-defeated-chain",
      defeatedIds: defeatedAbility.defeatedIds ?? [],
      defeatedEffects: defeatedAbility.defeatedEffects ?? [],
      afterEvent
    };
  }
  const evolutionResult = pending.evolve
    ? evolveServerBoardCreature(state, pending.evolve.cardId, pending.evolve.ownerIndex)
    : null;
  const evolutionEvent = evolutionResult
    ? { type: "action-evolve", actorIndex: pending.evolve.actorIndex, ...evolutionResult }
    : null;
  const after = pending.after ?? { type: "resume-action", actorIndex: state.active };
  if (after.type === "end-turn") {
    state.active = after.actorIndex;
    endServerTurn(state);
    return evolutionEvent;
  }
  if (after.type === "mindbug-extra") {
    drawToFive(state.players[after.playedByIndex]);
    checkServerGameOver(state);
    if (state.winner !== null) return;
    state.active = after.playedByIndex;
    state.phase = "action";
    state.extraTurn = true;
    state.extraTurnSource = "mindbug";
    checkServerActionLoss(state);
    return null;
  }
  if (after.type === "continue-attack") {
    return continueServerAttackAfterAbility(state, after.attackerIndex, after.attackerId)?.event ?? null;
  }
  if (after.type === "post-combat") {
    return finalizeServerPostCombat(state, after.attackerIndex, after.attackerId)?.event ?? null;
  }
  if (after.type === "resume-defeat") {
    state.phase = "pending";
    state.pending = after.pending;
    return null;
  }
  if (after.type === "earwig-defeat") {
    const candidates = state.players.flatMap((player, ownerIndex) => (
      player.board.map(card => ({ card, ownerIndex }))
    ));
    if (candidates.length) {
      beginServerPending(state, {
        type: "defeat",
        actorIndex: after.actorIndex,
        ownerIndex: null,
        ownerByCardId: Object.fromEntries(candidates.map(target => [target.card.id, target.ownerIndex])),
        sourceCard: after.sourceCard,
        cardIds: candidates.map(target => target.card.id),
        allowSkip: false,
        after: after.after
      });
      return null;
    }
    state.active = after.after?.actorIndex ?? after.actorIndex;
    if (after.after?.type === "end-turn") endServerTurn(state);
    else state.phase = "action";
    return null;
  }
  state.active = after.actorIndex;
  state.phase = "action";
  return evolutionEvent;
}

function chooseServerCardId(cards, strategy = "lowest") {
  if (!cards.length) return "";
  const sorted = [...cards].sort((a, b) => {
    if (strategy === "highest") return b.basePower - a.basePower;
    return a.basePower - b.basePower;
  });
  return sorted[0]?.id ?? "";
}

function serverIndexFromLocalDebugIndex(actorIndex, localPlayerIndex) {
  return Number(localPlayerIndex) === 0 ? actorIndex : 1 - actorIndex;
}

function findServerCardSpecByName(cardName) {
  const normalized = String(cardName || "").trim().toLowerCase();
  return ALL_CARD_SPECS.find(([name]) => name.toLowerCase() === normalized) ?? null;
}

function resolveServerPlayAbility(state, ownerIndex, card, after = { type: "end-turn", actorIndex: ownerIndex }) {
  if (!PLAY_ABILITY_CARDS.has(card.name)) return { pending: null };
  if (!canActivateServerPlay(state, ownerIndex, card)) {
    state.log.unshift(`${card.name} bị Deathweaver chặn hiệu ứng Chơi.`);
    return { pending: null };
  }
  const owner = state.players[ownerIndex];
  const enemyIndex = 1 - ownerIndex;
  const enemy = state.players[enemyIndex];
  const source = { id: card.id, name: card.name };
  state.log.unshift(`${card.name} kích hoạt hiệu ứng.`);
  switch (card.name) {
    case "Mysterious Mermaid":
      const previousLife = owner.life;
      owner.life = enemy.life;
      if (owner.life < previousLife) {
        checkServerGameOver(state);
        if (state.winner === null) {
          const hyenixResult = triggerServerHyenixFromDiscard(state, ownerIndex, after);
          if (hyenixResult.pending) return hyenixResult;
        }
      }
      return { pending: null, ability: "life-set" };
    case "Axolotl Healer":
      owner.life += 2;
      return { pending: null, ability: "life-gain" };
    case "Killer Bee":
      enemy.life -= 1;
      checkServerGameOver(state);
      if (state.winner === null) {
        const hyenixResult = triggerServerHyenixFromDiscard(state, enemyIndex, after);
        if (hyenixResult.pending) return hyenixResult;
      }
      return { pending: null, ability: "life-loss" };
    case "Giraffodile": {
      const cards = owner.discard.splice(0);
      owner.hand.push(...cards);
      return { pending: null, ability: "draw-discard" };
    }
    case "Kangasaurus Rex": {
      const defeatedIds = [];
      const defeatedCards = [];
      for (const target of [...enemy.board]) {
        if (cardPower(target, state, enemyIndex) > 4) continue;
        const removed = removeServerCreature(state, target.id, enemyIndex);
        if (!removed) continue;
        defeatedIds.push(removed.id);
        defeatedCards.push({ card: removed, ownerIndex: enemyIndex });
      }
      const defeatedAbility = resolveServerDefeatedAbilities(state, defeatedCards, after);
      defeatedIds.push(...(defeatedAbility.defeatedIds ?? []));
      return {
        pending: defeatedAbility.pending,
        ability: "defeat-many",
        defeatedIds,
        defeatedEffects: defeatedAbility.defeatedEffects ?? []
      };
    }
    case "Ferret Bomber":
      if (!enemy.hand.length) return { pending: null };
      return beginServerPending(state, {
        type: "discard",
        actorIndex: enemyIndex,
        playerIndex: enemyIndex,
        sourceCard: source,
        amount: Math.min(2, enemy.hand.length),
        selectedCount: 0,
        after
      });
    case "Compost Dragon":
      if (!owner.discard.length) return { pending: null };
      return beginServerPending(state, {
        type: "discard-pile",
        actorIndex: ownerIndex,
        ownerIndex,
        sourceOwnerIndex: ownerIndex,
        sourceCard: source,
        cardIds: owner.discard.map(item => item.id),
        after
      });
    case "Grave Robber":
      if (!enemy.discard.length) return { pending: null };
      return beginServerPending(state, {
        type: "discard-pile",
        actorIndex: ownerIndex,
        ownerIndex,
        sourceOwnerIndex: enemyIndex,
        sourceCard: source,
        cardIds: enemy.discard.map(item => item.id),
        after
      });
    case "Brain Fly": {
      const candidates = enemy.board.filter(target => cardPower(target, state, enemyIndex) >= 6);
      if (!candidates.length) return { pending: null };
      return beginServerPending(state, {
        type: "steal",
        actorIndex: ownerIndex,
        ownerIndex: enemyIndex,
        toIndex: ownerIndex,
        sourceCard: source,
        cardIds: candidates.map(target => target.id),
        allowSkip: true,
        after
      });
    }
    case "Tiger Squirrel": {
      const candidates = enemy.board.filter(target => cardPower(target, state, enemyIndex) >= 7);
      if (!candidates.length) return { pending: null };
      return beginServerPending(state, {
        type: "defeat",
        actorIndex: ownerIndex,
        ownerIndex: enemyIndex,
        sourceCard: source,
        cardIds: candidates.map(target => target.id),
        allowSkip: true,
        after
      });
    }
    case "Goreagle Alpha":
      owner.life -= 1;
      checkServerGameOver(state);
      if (state.winner === null) {
        const hyenixResult = triggerServerHyenixFromDiscard(state, ownerIndex, after);
        if (hyenixResult.pending) return hyenixResult;
      }
      return { pending: null, ability: "life-loss" };
    case "Hungry Hungry Hamster":
      if (!enemy.hand.length) return { pending: null };
      return beginServerPending(state, {
        type: "give-card",
        actorIndex: enemyIndex,
        playerIndex: enemyIndex,
        toIndex: ownerIndex,
        sourceCard: source,
        cardIds: enemy.hand.map(item => item.id),
        after
      });
    case "Cheeky Chimpborg":
      if (!enemy.hand.length || !enemy.board.length) return { pending: null };
      return beginServerPending(state, {
        type: "discard",
        actorIndex: enemyIndex,
        playerIndex: enemyIndex,
        sourceCard: source,
        amount: Math.min(enemy.board.length, enemy.hand.length),
        selectedCount: 0,
        after
      });
    case "Chuckling Chimpborg":
      const lifeLoss = enemy.mindbugs;
      enemy.life -= lifeLoss;
      checkServerGameOver(state);
      if (lifeLoss > 0 && state.winner === null) {
        const hyenixResult = triggerServerHyenixFromDiscard(state, enemyIndex, after);
        if (hyenixResult.pending) return hyenixResult;
      }
      return { pending: null, ability: "life-loss" };
    case "Dr. Orange U. Tan":
      return beginServerPending(state, {
        type: "dr-orange",
        actorIndex: ownerIndex,
        ownerIndex,
        sourceCard: source,
        after
      });
    case "Earwig Assassin":
      return beginServerPending(state, {
        type: "earwig",
        actorIndex: ownerIndex,
        ownerIndex,
        sourceCard: source,
        after
      });
    case "The Experiment": {
      if (!enemy.board.length) return { pending: null };
      return beginServerPending(state, {
        type: "experiment",
        actorIndex: ownerIndex,
        ownerIndex,
        enemyIndex,
        experimentId: card.id,
        sourceCard: source,
        cardIds: enemy.board.map(target => target.id),
        after
      });
    }
    case "Utility Bug": {
      const candidates = state.players.flatMap(player => (
        player.board.filter(target => (
          target.id !== card.id && hasPrintedPlayAbility(target)
        ))
      ));
      if (!candidates.length) {
        state.log.unshift(`${card.name}: không có PLAY ability hợp lệ để sao chép. Hiệu ứng bị hủy.`);
        return { pending: null, ability: "utility-no-target" };
      }
      return beginServerPending(state, {
        type: "utility-play",
        actorIndex: ownerIndex,
        ownerIndex,
        utilityId: card.id,
        sourceCard: source,
        cardIds: candidates.map(target => target.id),
        after
      });
    }
    case "Radioactive Rabbit": {
      const index = owner.board.findIndex(item => item.id === card.id);
      if (index >= 0) enemy.board.push(owner.board.splice(index, 1)[0]);
      card.exhausted = true;
      return { pending: null, ability: "control" };
    }
    case "Turtle Toaster": {
      const candidates = enemy.board.filter(target => {
        const power = cardPower(target, state, enemyIndex);
        return power >= 4 && power <= 6;
      });
      if (!candidates.length) return { pending: null };
      return beginServerPending(state, {
        type: "defeat",
        actorIndex: ownerIndex,
        ownerIndex: enemyIndex,
        sourceCard: source,
        cardIds: candidates.map(target => target.id),
        amount: Math.min(2, candidates.length),
        selectedCount: 0,
        allowSkip: true,
        after
      });
    }
    default:
      return { pending: null };
  }
}

function resolveServerAttackAbility(state, ownerIndex, card) {
  if (!ATTACK_ABILITY_CARDS.has(card.name)) return { ability: null };
  const enemy = state.players[1 - ownerIndex];
  const enemyIndex = 1 - ownerIndex;
  const source = { id: card.id, name: card.name };
  const continueAfter = { type: "continue-attack", attackerIndex: ownerIndex, attackerId: card.id };
  state.log.unshift(`${card.name} kích hoạt hiệu ứng tấn công.`);
  if (card.name === "Shark Dog") {
    const candidates = enemy.board.filter(target => cardPower(target, state, enemyIndex) >= 6);
    if (!candidates.length) return { ability: null };
    return beginServerPending(state, {
      type: "defeat",
      actorIndex: ownerIndex,
      ownerIndex: enemyIndex,
      sourceCard: source,
      cardIds: candidates.map(target => target.id),
      allowSkip: false,
      after: continueAfter
    });
  }
  if (card.name === "Snail Hydra") {
    if (state.players[ownerIndex].board.length >= enemy.board.length || !enemy.board.length) return { ability: null };
    return beginServerPending(state, {
      type: "defeat",
      actorIndex: ownerIndex,
      ownerIndex: enemyIndex,
      sourceCard: source,
      cardIds: enemy.board.map(target => target.id),
      allowSkip: true,
      after: continueAfter
    });
  }
  if (card.name === "Tusked Exporter") {
    if (!enemy.hand.length) return { ability: null };
    return beginServerPending(state, {
      type: "discard",
      actorIndex: enemyIndex,
      playerIndex: enemyIndex,
      sourceCard: source,
      amount: 1,
      selectedCount: 0,
      after: continueAfter
    });
  }
  if (card.name === "Turbo Bug") {
    if (enemy.life <= 1) return { ability: null };
    enemy.life = 1;
    checkServerGameOver(state);
    const hyenixResult = triggerServerHyenixFromDiscard(state, enemyIndex, continueAfter);
    if (hyenixResult.pending) return { ...hyenixResult, ability: "life-set" };
    return { ability: "life-set" };
  }
  if (card.name === "Chameleon Sniper") {
    enemy.life -= 1;
    checkServerGameOver(state);
    if (state.winner !== null) return { ability: "life-loss" };
    const hyenixResult = triggerServerHyenixFromDiscard(state, enemyIndex, continueAfter);
    if (hyenixResult.pending) return { ...hyenixResult, ability: "life-loss" };
    return { ability: "life-loss" };
  }
  if (card.name === "Count Draculeech") {
    const candidates = state.players.flatMap((player, targetOwnerIndex) => (
      player.board.map(target => ({ target, ownerIndex: targetOwnerIndex }))
    ));
    state.players[ownerIndex].life -= 1;
    checkServerGameOver(state);
    if (state.winner !== null) {
      return { pending: null, ability: "self-life-loss" };
    }
    const defeatPending = {
      type: "defeat",
      actorIndex: ownerIndex,
      ownerIndex: null,
      ownerByCardId: Object.fromEntries(candidates.map(candidate => [candidate.target.id, candidate.ownerIndex])),
      sourceCard: source,
      cardIds: candidates.map(candidate => candidate.target.id),
      allowSkip: false,
      after: continueAfter
    };
    const hyenixResult = triggerServerHyenixFromDiscard(state, ownerIndex, {
      type: "resume-defeat",
      pending: defeatPending
    });
    if (hyenixResult.pending) {
      return { ...hyenixResult, ability: "self-life-loss" };
    }
    return beginServerPending(state, defeatPending);
  }
  if (card.name === "Majestic Manticore") {
    const creaturesInPlay = state.players.flatMap((player, targetOwnerIndex) => (
      player.board.map(target => ({
        card: target,
        ownerIndex: targetOwnerIndex,
        power: cardPower(target, state, targetOwnerIndex)
      }))
    ));
    const lowestPower = Math.min(...creaturesInPlay.map(target => target.power));
    const defeatedIds = [];
    const defeatedCards = [];
    for (const target of creaturesInPlay) {
      if (target.power !== lowestPower) continue;
      const removed = removeServerCreature(state, target.card.id, target.ownerIndex);
      if (!removed) continue;
      defeatedIds.push(removed.id);
      defeatedCards.push({ card: removed, ownerIndex: target.ownerIndex });
    }
    const defeatedAbility = resolveServerDefeatedAbilities(state, defeatedCards, continueAfter);
    defeatedIds.push(...(defeatedAbility.defeatedIds ?? []));
    return {
      pending: defeatedAbility.pending,
      ability: "defeat-many",
      defeatedIds,
      defeatedEffects: defeatedAbility.defeatedEffects ?? []
    };
  }
  if (card.name === "The Lurker") {
    if (state.players[ownerIndex].board.length > enemy.board.length) {
      card.lurkerSneakyThisTurn = true;
      return { ability: "keyword" };
    }
    return { ability: null };
  }
  if (card.name === "Turf The Surfer") {
    if (!enemy.board.length) return { ability: null };
    return beginServerPending(state, {
      type: "disable-block",
      actorIndex: ownerIndex,
      ownerIndex: enemyIndex,
      sourceCard: source,
      cardIds: enemy.board.map(target => target.id),
      allowSkip: false,
      after: continueAfter
    });
  }
  if (card.name === "Thunder Queen") {
    if (!enemy.board.length) return { ability: null };
    return beginServerPending(state, {
      type: "defeat",
      actorIndex: ownerIndex,
      ownerIndex: enemyIndex,
      sourceCard: source,
      cardIds: enemy.board.map(target => target.id),
      allowSkip: false,
      after: continueAfter
    });
  }
  if (card.name === "World Eater") {
    enemy.life -= 1;
    checkServerGameOver(state);
    if (state.winner !== null) return { ability: "life-loss" };
    const hyenixResult = triggerServerHyenixFromDiscard(state, enemyIndex, continueAfter);
    if (hyenixResult.pending) return { ...hyenixResult, ability: "life-loss" };
    return { ability: "life-loss" };
  }
  if (card.name === "Frosty Fortress") {
    const discarded = discardServerHandAndDeck(state, enemyIndex);
    state.delayedDrawToFive = { playerIndex: enemyIndex };
    return { ability: "discard-all", discardAll: { playerIndex: enemyIndex, ...discarded } };
  }
  if (card.name === "Blastfish") {
    card.cannotBeDefeatedThisTurn = true;
    return { ability: "protected" };
  }
  if (card.name === "Bullet Train") {
    const candidates = enemy.board.filter(target => cardPower(target, state, enemyIndex) <= 3);
    if (!candidates.length) return { ability: null };
    return beginServerPending(state, {
      type: "defeat",
      actorIndex: ownerIndex,
      ownerIndex: enemyIndex,
      sourceCard: source,
      cardIds: candidates.map(target => target.id),
      allowSkip: false,
      after: continueAfter
    });
  }
  return { ability: null };
}

function discardServerHandAndDeck(state, playerIndex) {
  const player = state.players[playerIndex];
  const handCards = player.hand.splice(0);
  const deckCards = [];
  for (const card of handCards) discardServerCard(state, card, playerIndex);
  return { handCards, deckCards };
}

function completeDelayedDrawToFive(state) {
  const delayed = state.delayedDrawToFive;
  state.delayedDrawToFive = null;
  if (!delayed || !Number.isInteger(delayed.playerIndex)) return null;
  const player = state.players[delayed.playerIndex];
  if (!player) return null;
  const drawn = drawToFive(player);
  if (drawn > 0) state.log.unshift(`${player.name} rút ${drawn} lá để đủ 5 lá sau khi bỏ bài.`);
  return { playerIndex: delayed.playerIndex, count: drawn };
}

function resolveServerCombat(state, attackerIndex, blockerId) {
  const pending = state.pending;
  if (!pending || pending.type !== "block") return { ok: false, defeatedIds: [] };
  const defenderIndex = 1 - attackerIndex;
  const attacker = state.players[attackerIndex].board.find(card => card.id === pending.attackerId);
  const blocker = state.players[defenderIndex].board.find(card => card.id === blockerId);
  if (!attacker || !blocker) return { ok: false, defeatedIds: [] };
  let attackerPower = cardPower(attacker, state, attackerIndex);
  let blockerPower = cardPower(blocker, state, defenderIndex);
  if (attacker.name === "Sawn" || blocker.name === "Sawn") {
    [attackerPower, blockerPower] = [blockerPower, attackerPower];
  }
  const attackerPoison = cardKeywordsServer(attacker, state, attackerIndex).includes("POISONOUS");
  const blockerPoison = cardKeywordsServer(blocker, state, defenderIndex).includes("POISONOUS");
  const defeatAttacker = blockerPoison || blockerPower >= attackerPower;
  const defeatBlocker = attackerPoison || attackerPower >= blockerPower;
  const defeatedIds = [];
  const defeatedCards = [];
  if (defeatAttacker) {
    const result = damageOrDefeatServer(state, attacker, attackerIndex);
    if (result.defeated) {
      defeatedIds.push(attacker.id);
      defeatedCards.push(result);
    }
  }
  if (defeatBlocker) {
    const result = damageOrDefeatServer(state, blocker, defenderIndex);
    if (result.defeated) {
      defeatedIds.push(blocker.id);
      defeatedCards.push(result);
    }
  }
  if (state.players[attackerIndex].board.some(card => card.id === attacker.id)) {
    attacker.attacksThisTurn += 1;
  }
  applyServerDeferredAttackLifeEffect(state, attackerIndex, attacker);
  if (attacker.countLifeLossAfterAttack) {
    attacker.countLifeLossAfterAttack = false;
    state.players[attackerIndex].life -= 1;
  }
  checkServerGameOver(state);
  state.log.unshift(`${attacker.name} bị chặn bởi ${blocker.name}.`);
  return { ok: true, defeatedIds, defeatedCards };
}

function maybePromptServerFrenzy(state, attackerIndex, attackerId) {
  const attacker = state.players[attackerIndex].board.find(card => card.id === attackerId);
  if (!attacker) return false;
  if (!cardKeywordsServer(attacker, state, attackerIndex).includes("FRENZY") || attacker.attacksThisTurn !== 1) return false;
  state.phase = "pending";
  state.pending = { type: "frenzy", actorIndex: attackerIndex, attackerId };
  state.frenzyOnly = attackerId;
  state.log.unshift(`${attacker.name} có thể tấn công lần 2.`);
  return true;
}

function resolveServerDefeatedAbilities(state, defeatedCards, after) {
  const abilityDefeatedIds = [];
  const defeatedEffects = [];
  const defeatedQueue = [...defeatedCards];
  for (let queueIndex = 0; queueIndex < defeatedQueue.length; queueIndex += 1) {
    const defeat = defeatedQueue[queueIndex];
    const card = defeat.card;
    const ownerIndex = defeat.ownerIndex;
    if (!card || !DEFEATED_ABILITY_CARDS.has(card.name)) continue;
    const owner = state.players[ownerIndex];
    const enemyIndex = 1 - ownerIndex;
    const enemy = state.players[enemyIndex];
    const source = { id: card.id, name: card.name };
    state.log.unshift(`${card.name} kích hoạt hiệu ứng bị hạ.`);
    defeatedEffects.push({
      cardId: card.id,
      cardName: card.name,
      ownerIndex,
      lifeGain: card.name === "Sweet Fighter" ? 2 : 0
    });
    if (card.name === "Strange Barrel") {
      const stolen = takeServerRandom(enemy.hand, 2);
      owner.hand.push(...stolen);
      drawToFive(enemy);
      continue;
    }
    if (card.name === "Harpy Mother") {
      const candidates = enemy.board.filter(target => cardPower(target, state, enemyIndex) <= 5);
      if (!candidates.length) continue;
      const remainingDefeatedCards = defeatedQueue.slice(queueIndex + 1);
      return {
        ...beginServerPending(state, {
        type: "steal",
        actorIndex: ownerIndex,
        ownerIndex: enemyIndex,
        toIndex: ownerIndex,
        sourceCard: source,
        cardIds: candidates.map(target => target.id),
        amount: Math.min(2, candidates.length),
        selectedCount: 0,
        allowSkip: true,
        after,
        remainingDefeatedCards
        }),
        defeatedIds: abilityDefeatedIds,
        defeatedEffects
      };
    }
    if (card.name === "Explosive Toad") {
      if (!enemy.board.length) continue;
      const remainingDefeatedCards = defeatedQueue.slice(queueIndex + 1);
      return {
        ...beginServerPending(state, {
        type: "defeat",
        actorIndex: ownerIndex,
        ownerIndex: enemyIndex,
        sourceCard: source,
        cardIds: enemy.board.map(target => target.id),
        allowSkip: false,
        after,
        remainingDefeatedCards
        }),
        defeatedIds: abilityDefeatedIds,
        defeatedEffects
      };
    }
    if (card.name === "Puffermech") {
      for (const target of [...enemy.board]) {
        if (cardPower(target, state, enemyIndex) < 8) continue;
        const removed = removeServerCreature(state, target.id, enemyIndex);
        if (removed) {
          abilityDefeatedIds.push(removed.id);
          defeatedQueue.push({ card: removed, ownerIndex: enemyIndex });
        }
      }
      continue;
    }
    if (card.name === "Steelhorn") {
      const amount = Math.min(3, enemy.hand.length);
      if (!amount) continue;
      const remainingDefeatedCards = defeatedQueue.slice(queueIndex + 1);
      return {
        ...beginServerPending(state, {
        type: "discard",
        actorIndex: enemyIndex,
        playerIndex: enemyIndex,
        sourceCard: source,
        amount,
        selectedCount: 0,
        after,
        remainingDefeatedCards
        }),
        defeatedIds: abilityDefeatedIds,
        defeatedEffects
      };
    }
    if (card.name === "Sweet Fighter") {
      owner.life += 2;
      continue;
    }
    if (card.name === "Radioactive Rabbit") {
      for (const ally of [...owner.board]) {
        const removed = removeServerCreature(state, ally.id, ownerIndex);
        if (!removed) continue;
        abilityDefeatedIds.push(removed.id);
        defeatedQueue.push({ card: removed, ownerIndex });
      }
      continue;
    }
  }
  return { pending: null, defeatedIds: abilityDefeatedIds, defeatedEffects };
}

function resolveServerEvolutionAction(state, ownerIndex, card) {
  const enemyIndex = 1 - ownerIndex;
  const enemy = state.players[enemyIndex];
  const source = { id: card.id, name: card.name };
  const evolve = { actorIndex: ownerIndex, ownerIndex, cardId: card.id };
  const after = { type: "end-turn", actorIndex: ownerIndex };
  state.log.unshift(`${card.name} kích hoạt Khi Được tưới.`);
  if (card.name === "Cake Trickster") {
    const candidates = [...enemy.board];
    if (!candidates.length) {
      endServerTurn(state);
      return { pending: null, ability: "action" };
    }
    return beginServerPending(state, {
      type: "forced-attack",
      actorIndex: ownerIndex,
      attackerIndex: enemyIndex,
      sourceCard: source,
      cardIds: candidates.map(target => target.id),
      after
    });
  }
  if (card.name === "Dragon Inn") {
    if (state.players[ownerIndex].board.length < enemy.board.length) {
      enemy.life -= 1;
      state.log.unshift(`${enemy.name} mất 1 LP bởi ${card.name}.`);
      checkServerGameOver(state);
      if (state.winner === null) {
        const hyenixResult = triggerServerHyenixFromDiscard(state, enemyIndex, after);
        if (hyenixResult.pending) return { ...hyenixResult, ability: "life-loss" };
      }
    }
    if (state.winner === null) endServerTurn(state);
    return { pending: null, ability: "life-loss" };
  }
  if (card.name === "Infernostrich") {
    const candidates = enemy.board.filter(target => cardPower(target, state, enemyIndex) >= 7);
    if (!candidates.length) {
      endServerTurn(state);
      return { pending: null, ability: "action" };
    }
    return beginServerPending(state, {
      type: "defeat",
      actorIndex: ownerIndex,
      ownerIndex: enemyIndex,
      sourceCard: source,
      cardIds: candidates.map(target => target.id),
      allowSkip: false,
      after
    });
  }
  if (card.name === "Octocopter") {
    const removed = removeServerCreature(state, card.id, ownerIndex);
    const candidates = [...enemy.board];
    if (!candidates.length) {
      endServerTurn(state);
      return { pending: null, ability: "action", defeatedIds: removed ? [removed.id] : [] };
    }
    return {
      ...beginServerPending(state, {
        type: "steal",
        actorIndex: ownerIndex,
        ownerIndex: enemyIndex,
        toIndex: ownerIndex,
        sourceCard: source,
        cardIds: candidates.map(target => target.id),
        amount: 1,
        selectedCount: 0,
        allowSkip: false,
        after
      }),
      defeatedIds: removed ? [removed.id] : []
    };
  }
  if (card.name === "Cloud Lady" || card.name === "Typhoon Princess") {
    const maxPower = card.name === "Cloud Lady" ? 4 : 6;
    const candidates = enemy.board.filter(target => cardPower(target, state, enemyIndex) <= maxPower);
    if (!candidates.length) {
      const evolution = evolveServerBoardCreature(state, card.id, ownerIndex);
      endServerTurn(state);
      return { pending: null, ability: "action", evolution };
    }
    return beginServerPending(state, {
      type: "defeat",
      actorIndex: ownerIndex,
      ownerIndex: enemyIndex,
      sourceCard: source,
      cardIds: candidates.map(item => item.id),
      evolve,
      after
    });
  }
  if (card.name === "Curious Tadpole" || card.name === "Frog Prophet") {
    state.players[ownerIndex].life += 1;
    const evolution = evolveServerBoardCreature(state, card.id, ownerIndex);
    endServerTurn(state);
    return { pending: null, ability: "life-gain", evolution };
  }
  if (card.name === "Waddling Recruit" || card.name === "Veteran Penguin") {
    if (!enemy.hand.length) {
      const evolution = evolveServerBoardCreature(state, card.id, ownerIndex);
      endServerTurn(state);
      return { pending: null, ability: "action", evolution };
    }
    return beginServerPending(state, {
      type: "discard",
      actorIndex: enemyIndex,
      playerIndex: enemyIndex,
      sourceCard: source,
      amount: 1,
      selectedCount: 0,
      evolve,
      after
    });
  }
  return { pending: null };
}

function finalizeServerPostCombat(state, attackerIndex, attackerId) {
  if (state.winner !== null) return { ok: true, event: null };
  const attackerAfter = state.players[attackerIndex].board.find(card => card.id === attackerId);
  if (!maybePromptServerFrenzy(state, attackerIndex, attackerId)) {
    if (attackerAfter) attackerAfter.exhausted = true;
    state.frenzyOnly = null;
    endServerTurn(state);
  }
  return { ok: true, event: null };
}

function damageOrDefeatServer(state, card, ownerIndex) {
  if (card.cannotBeDefeatedThisTurn) return { defeated: false, card: null, ownerIndex };
  if (cardKeywordsServer(card, state, ownerIndex).includes("TOUGH") && card.damage < 1) {
    card.damage += 1;
    state.log.unshift(`${card.name} mất Khiên.`);
    return { defeated: false, card: null, ownerIndex };
  }
  const board = state.players[ownerIndex].board;
  const index = board.findIndex(boardCard => boardCard.id === card.id);
  if (index < 0) return { defeated: false, card: null, ownerIndex };
  const [removed] = board.splice(index, 1);
  removed.damage = 0;
  removed.exhausted = false;
  removed.attacksThisTurn = 0;
  discardServerCard(state, removed, ownerIndex);
  return { defeated: true, card: removed, ownerIndex };
}

function applyServerDeferredAttackLifeEffect(state, attackerIndex, attacker) {
  const effect = attacker?.deferredAttackLifeEffect ?? "";
  if (!effect) return;
  attacker.deferredAttackLifeEffect = "";
  const defender = state.players[1 - attackerIndex];
  if (!defender) return;
  if (effect === "set-enemy-to-one" && defender.life > 1) defender.life = 1;
  if (effect === "enemy-loses-one") defender.life -= 1;
}

function resolveServerDirectAttack(state, attackerIndex, attackerId) {
  const defenderIndex = 1 - attackerIndex;
  const attacker = state.players[attackerIndex].board.find(card => card.id === attackerId);
  if (!attacker) return { ok: false, pending: null };
  state.players[defenderIndex].life -= 1;
  applyServerDeferredAttackLifeEffect(state, attackerIndex, attacker);
  if (attacker.countLifeLossAfterAttack) {
    attacker.countLifeLossAfterAttack = false;
    state.players[attackerIndex].life -= 1;
  }
  attacker.attacksThisTurn += 1;
  state.log.unshift(`${attacker.name} tấn công trực tiếp.`);
  checkServerGameOver(state);
  if (state.winner !== null) return { ok: true, pending: null };
  const hyenixResult = triggerServerHyenixFromDiscard(state, defenderIndex, { type: "post-combat", attackerIndex, attackerId });
  return { ok: true, pending: hyenixResult.pending ?? null };
}

function continueServerAttackAfterAbility(state, attackerIndex, attackerId) {
  const defenderIndex = 1 - attackerIndex;
  const attacker = state.players[attackerIndex].board.find(card => card.id === attackerId);
  if (!attacker) {
    state.active = attackerIndex;
    state.phase = "action";
    state.pending = null;
    state.frenzyOnly = null;
    endServerTurn(state);
    return {
      ok: true,
      event: {
        type: "attack-cancelled",
        actorIndex: attackerIndex,
        defenderIndex,
        attackerId,
        defeatedIds: [attackerId]
      }
    };
  }
  const isCakeForcedAttack = Boolean(attacker.cakeForcedAttack);
  delete attacker.cakeForcedAttack;
  if (cardKeywordsServer(attacker, state, attackerIndex).includes("HUNTER") && state.players[defenderIndex].board.length) {
    const defenders = state.players[defenderIndex].board;
    const captains = isCakeForcedAttack
      ? []
      : defenders.filter(card => card.name === "Captain Hippo");
    const hunterTargets = captains.length ? captains : defenders;
    state.phase = "pending";
    state.pending = {
      type: "hunter",
      actorIndex: attackerIndex,
      attackerIndex,
      attackerId: attacker.id,
      targetIds: hunterTargets.map(card => card.id),
      mustTargetCreature: captains.length > 0
    };
    state.log.unshift(`${attacker.name} chọn mục tiêu HUNTER.`);
    return { ok: true, event: { type: "attack-intent", actorIndex: attackerIndex, defenderIndex, attackerId: attacker.id, targetIds: state.pending.targetIds, hunter: true } };
  }
  return continueServerFaceAttack(state, attackerIndex, attacker.id);
}

function continueServerFaceAttack(state, attackerIndex, attackerId) {
  const defenderIndex = 1 - attackerIndex;
  const attacker = state.players[attackerIndex].board.find(card => card.id === attackerId);
  if (!attacker) return { ok: false, event: null };
  const blockers = legalBlockersServer(state, attacker, defenderIndex);
  if (blockers.length) {
    state.phase = "pending";
    state.pending = {
      type: "block",
      actorIndex: defenderIndex,
      attackerIndex,
      attackerId: attacker.id,
      blockerIds: blockers.map(card => card.id)
    };
    state.log.unshift(`${attacker.name} tấn công. Chờ chặn.`);
    return { ok: true, event: { type: "attack-intent", actorIndex: attackerIndex, defenderIndex, attackerId: attacker.id, blockerIds: blockers.map(card => card.id) } };
  }
  const directResult = resolveServerDirectAttack(state, attackerIndex, attacker.id);
  const drawnToFive = completeDelayedDrawToFive(state);
  if (directResult.pending) {
    return { ok: true, event: { type: "attack-face", actorIndex: attackerIndex, defenderIndex, attackerId: attacker.id, pending: state.pending, drawnToFive } };
  }
  if (state.winner === null && !maybePromptServerFrenzy(state, attackerIndex, attacker.id)) {
    attacker.exhausted = true;
    state.frenzyOnly = null;
    endServerTurn(state);
  }
  return { ok: true, event: { type: "attack-face", actorIndex: attackerIndex, defenderIndex, attackerId: attacker.id, drawnToFive } };
}

function continueServerCreatureAttack(state, attackerIndex, targetId) {
  const defenderIndex = 1 - attackerIndex;
  const pending = { type: "block", attackerId: state.pending?.attackerId ?? "", attackerIndex };
  const attackerId = state.pending?.attackerId;
  const attacker = state.players[attackerIndex].board.find(card => card.id === attackerId);
  if (!attacker) return { ok: false, event: null };
  state.pending = pending;
  const combatResult = resolveServerCombat(state, attackerIndex, targetId);
  const event = {
    type: "attack-creature",
    actorIndex: attackerIndex,
    defenderIndex,
    attackerId: attacker.id,
    blockerId: targetId,
    defeatedIds: combatResult.defeatedIds,
    drawnToFive: completeDelayedDrawToFive(state)
  };
  state.pending = null;
  if (state.winner === null) {
    const after = { type: "post-combat", attackerIndex, attackerId: attacker.id };
    const defeatedAbility = resolveServerDefeatedAbilities(state, combatResult.defeatedCards ?? [], after);
    event.defeatedIds.push(...(defeatedAbility.defeatedIds ?? []));
    event.defeatedEffects = defeatedAbility.defeatedEffects ?? [];
    if (defeatedAbility.pending) {
      event.pending = state.pending;
      return { ok: true, event };
    }
    finalizeServerPostCombat(state, attackerIndex, attacker.id);
  }
  return { ok: true, event };
}

function checkServerGameOver(state) {
  if (state.winner !== null) return;
  const lifeLoser = state.players.findIndex(player => player.life <= 0);
  if (lifeLoser >= 0) {
    state.winner = 1 - lifeLoser;
    state.phase = "gameover";
    state.pending = null;
    return;
  }
}

function playerIndexForSocket(room, socket) {
  return room.players.findIndex(player => player.id === socket.data.playerSessionId);
}

function emitGame(room, event = null) {
  io.to(room.code).emit("game-update", {
    room: publicRoom(room),
    state: room.game,
    event
  });
}

function applyGameAction(room, socket, action = {}) {
  const actorIndex = playerIndexForSocket(room, socket);
  if (actorIndex < 0) return { ok: false, message: "Ván không hợp lệ." };
  const type = action.type;
  if (type === "new-game") {
    room.seed = Date.now();
    room.game = makeGame(room, room.seed);
    return { ok: true, event: { type: "new-game", actorIndex, seed: room.seed } };
  }
  const state = room.game;
  if (!state || state.winner !== null) return { ok: false, message: "Ván không hợp lệ." };
  if (type === "surrender") {
    state.winner = 1 - actorIndex;
    state.phase = "gameover";
    state.pending = null;
    state.frenzyOnly = null;
    state.extraTurn = false;
    state.extraTurnSource = "";
    state.log.unshift(`${state.players[actorIndex].name} đã đầu hàng.`);
    return { ok: true, event: { type: "surrender", actorIndex, winnerIndex: state.winner } };
  }
  if (type === "debug-add-board") {
    const spec = findServerCardSpecByName(action.cardName);
    if (!spec) return { ok: false, message: "Không tìm thấy lá debug." };
    const ownerIndex = serverIndexFromLocalDebugIndex(actorIndex, action.playerIndex);
    const card = makeServerCard(spec, debugCardId++, ownerIndex);
    card.exhausted = false;
    card.attacksThisTurn = 0;
    card.damage = 0;
    card.originalOwnerIndex = ownerIndex;
    state.players[ownerIndex].board.push(card);
    state.log.unshift(`Debug: thêm ${card.name} lên sân ${state.players[ownerIndex].name}.`);
    if (action.triggerPlayAbility) {
      const defenderIndex = 1 - ownerIndex;
      if (state.players[defenderIndex].mindbugs > 0 && !card.mindbuggedThisTurn) {
        state.phase = "pending";
        state.pending = {
          type: "mindbug",
          actorIndex: defenderIndex,
          playedByIndex: ownerIndex,
          cardId: card.id,
          after: { type: "resume-action", actorIndex: state.active }
        };
        return { ok: true, event: { type: "debug-add-board", actorIndex, ownerIndex, cardId: card.id, card, pending: state.pending, pendingActorIndex: defenderIndex } };
      }
      const abilityResult = resolveServerPlayAbility(state, ownerIndex, card, { type: "resume-action", actorIndex: state.active });
      if (abilityResult.pending) return { ok: true, event: { type: "ability-pending", ability: "play", pending: state.pending, sourceCard: { id: card.id, name: card.name }, defeatedIds: abilityResult.defeatedIds ?? [], defeatedEffects: abilityResult.defeatedEffects ?? [] } };
      checkServerGameOver(state);
      return { ok: true, event: { type: "debug-add-board", actorIndex, ownerIndex, cardId: card.id, card, ability: abilityResult.ability, defeatedIds: abilityResult.defeatedIds ?? [], defeatedEffects: abilityResult.defeatedEffects ?? [] } };
    }
    return { ok: true, event: { type: "debug-add-board", actorIndex, ownerIndex, cardId: card.id, card } };
  }
  if (type === "play-card") {
    if (state.phase !== "action" || state.active !== actorIndex) return { ok: false, message: "Chưa đến lượt." };
    if (captainHippoForcedAttackersServer(state, actorIndex).length) {
      return { ok: false, message: "Bạn phải tấn công Captain Hippo bằng Quái vật có HUNTER." };
    }
    const player = state.players[actorIndex];
    const cardIndex = player.hand.findIndex(card => card.id === action.cardId);
    if (cardIndex < 0) return { ok: false, message: "Không có lá bài này." };
    const [card] = player.hand.splice(cardIndex, 1);
    player.board.push(card);
    const defenderIndex = 1 - actorIndex;
    const event = { type: "play-card", actorIndex, cardId: card.id, card };
    if (state.players[defenderIndex].mindbugs > 0 && !card.mindbuggedThisTurn) {
      state.phase = "pending";
      state.pending = { type: "mindbug", actorIndex: defenderIndex, playedByIndex: actorIndex, cardId: card.id };
      state.log.unshift(`${player.name} đánh ${card.name}.`);
      return { ok: true, event: { ...event, pending: "mindbug", pendingActorIndex: defenderIndex } };
    }
    state.log.unshift(`${player.name} đánh ${card.name}.`);
    const abilityResult = resolveServerPlayAbility(state, actorIndex, card);
    if (abilityResult.pending) return { ok: true, event: { ...event, type: "ability-pending", ability: abilityResult.ability ?? "play", pending: state.pending, sourceCard: { id: card.id, name: card.name }, controlCardId: abilityResult.controlCardId, fromIndex: abilityResult.fromIndex, toIndex: abilityResult.toIndex, defeatedIds: abilityResult.defeatedIds ?? [], defeatedEffects: abilityResult.defeatedEffects ?? [] } };
    checkServerGameOver(state);
    if (state.winner !== null) return { ok: true, event: { ...event, ability: abilityResult.ability, defeatedIds: abilityResult.defeatedIds ?? [], defeatedEffects: abilityResult.defeatedEffects ?? [] } };
    endServerTurn(state);
    return { ok: true, event: { ...event, ability: abilityResult.ability, defeatedIds: abilityResult.defeatedIds ?? [], defeatedEffects: abilityResult.defeatedEffects ?? [] } };
  }
  if (type === "mindbug-choice") {
    const pending = state.pending;
    if (state.phase !== "pending" || pending?.type !== "mindbug" || pending.actorIndex !== actorIndex) {
      return { ok: false, message: "Không thể Cướp lúc này." };
    }
    const playedBy = pending.playedByIndex;
    const defender = state.players[actorIndex];
    const playedBoard = state.players[playedBy].board;
    const cardIndex = playedBoard.findIndex(card => card.id === pending.cardId);
    const card = playedBoard[cardIndex];
    if (!card) return { ok: false, message: "Lá bài không còn trên sân." };
    if (action.choice === "steal" && defender.mindbugs > 0) {
      playedBoard.splice(cardIndex, 1);
      defender.mindbugs -= 1;
      card.mindbuggedThisTurn = true;
      defender.board.push(card);
      state.log.unshift(`${defender.name} Cướp ${card.name}.`);
      const stealAfter = pending.after ?? { type: "mindbug-extra", playedByIndex: playedBy };
      const abilityResult = resolveServerPlayAbility(state, actorIndex, card, stealAfter);
      if (abilityResult.pending) return { ok: true, event: { type: "mindbug-steal", actorIndex, playedByIndex: playedBy, cardId: card.id, card, pending: state.pending, ability: abilityResult.ability, controlCardId: abilityResult.controlCardId, fromIndex: abilityResult.fromIndex, toIndex: abilityResult.toIndex, defeatedIds: abilityResult.defeatedIds ?? [], defeatedEffects: abilityResult.defeatedEffects ?? [] } };
      if (pending.after) {
        checkServerGameOver(state);
        const afterEvent = state.winner === null ? completeServerPendingAfter(state, pending) : null;
        return { ok: true, event: { type: "mindbug-steal", actorIndex, playedByIndex: playedBy, cardId: card.id, card, ability: abilityResult.ability, defeatedIds: abilityResult.defeatedIds ?? [], defeatedEffects: abilityResult.defeatedEffects ?? [], afterEvent } };
      }
      state.phase = "action";
      state.pending = null;
      state.active = playedBy;
      drawToFive(state.players[playedBy]);
      state.extraTurn = true;
      state.extraTurnSource = "mindbug";
      checkServerGameOver(state);
      checkServerActionLoss(state);
      return { ok: true, event: { type: "mindbug-steal", actorIndex, playedByIndex: playedBy, cardId: card.id, card, ability: abilityResult.ability, defeatedIds: abilityResult.defeatedIds ?? [], defeatedEffects: abilityResult.defeatedEffects ?? [] } };
    }
    state.phase = "action";
    state.pending = null;
    state.log.unshift(`${defender.name} không Cướp.`);
    const abilityResult = resolveServerPlayAbility(state, playedBy, card, pending.after);
    if (abilityResult.pending) return { ok: true, event: { type: "mindbug-pass", actorIndex, playedByIndex: playedBy, cardId: card.id, card, pending: state.pending, ability: abilityResult.ability, controlCardId: abilityResult.controlCardId, fromIndex: abilityResult.fromIndex, toIndex: abilityResult.toIndex, defeatedIds: abilityResult.defeatedIds ?? [], defeatedEffects: abilityResult.defeatedEffects ?? [] } };
    checkServerGameOver(state);
    if (state.winner !== null) return { ok: true, event: { type: "mindbug-pass", actorIndex, playedByIndex: playedBy, cardId: card.id, card, ability: abilityResult.ability, defeatedIds: abilityResult.defeatedIds ?? [], defeatedEffects: abilityResult.defeatedEffects ?? [] } };
    if (pending.after) {
      const afterEvent = completeServerPendingAfter(state, pending);
      return { ok: true, event: { type: "mindbug-pass", actorIndex, playedByIndex: playedBy, cardId: card.id, card, ability: abilityResult.ability, defeatedIds: abilityResult.defeatedIds ?? [], defeatedEffects: abilityResult.defeatedEffects ?? [], afterEvent } };
    }
    endServerTurn(state);
    return { ok: true, event: { type: "mindbug-pass", actorIndex, playedByIndex: playedBy, cardId: card.id, card, ability: abilityResult.ability, defeatedIds: abilityResult.defeatedIds ?? [], defeatedEffects: abilityResult.defeatedEffects ?? [] } };
  }
  if (type === "discard-choice") {
    const pending = state.pending;
    if (state.phase !== "pending" || pending?.type !== "discard" || pending.actorIndex !== actorIndex) {
      return { ok: false, message: "Không thể bỏ bài lúc này." };
    }
    const player = state.players[pending.playerIndex];
    const index = player.hand.findIndex(card => card.id === action.cardId);
    if (index < 0) return { ok: false, message: "Không có lá bài này." };
    const [card] = player.hand.splice(index, 1);
    discardServerCard(state, card, pending.playerIndex);
    pending.selectedCount = (pending.selectedCount ?? 0) + 1;
    state.log.unshift(`${player.name} bỏ ${card.name}.`);
    let afterEvent = null;
    let drawn = 0;
    if (pending.selectedCount >= pending.amount || !player.hand.length) {
      afterEvent = completeServerPendingAfter(state, pending);
      drawn = pending.drawnToFive ?? 0;
    }
    checkServerGameOver(state);
    return {
      ok: true,
      event: {
        type: "ability-discard",
        actorIndex,
        playerIndex: pending.playerIndex,
        cardId: card.id,
        pending: state.pending,
        drawnToFive: { playerIndex: pending.playerIndex, count: drawn },
        afterEvent
      }
    };
  }
  if (type === "defeat-choice") {
    const pending = state.pending;
    if (state.phase !== "pending" || pending?.type !== "defeat" || pending.actorIndex !== actorIndex) {
      return { ok: false, message: "Không thể hạ Quái vật lúc này." };
    }
    let defeatedIds = [];
    let defeatedEffects = [];
    let defeatedCard = null;
    let defeatedOwnerIndex = pending.ownerIndex;
    let selectedTarget = false;
    if (action.cardId) {
      if (!pending.cardIds.includes(action.cardId)) return { ok: false, message: "Mục tiêu không hợp lệ." };
      defeatedOwnerIndex = Number.isInteger(pending.ownerByCardId?.[action.cardId])
        ? pending.ownerByCardId[action.cardId]
        : pending.ownerIndex;
      if (!Number.isInteger(defeatedOwnerIndex)) return { ok: false, message: "Không tìm thấy chủ sở hữu mục tiêu." };
      const removed = removeServerCreature(state, action.cardId, defeatedOwnerIndex);
      if (removed) {
        selectedTarget = true;
        defeatedIds = [removed.id];
        defeatedCard = removed;
        pending.cardIds = pending.cardIds.filter(cardId => cardId !== removed.id);
        pending.selectedCount = (pending.selectedCount ?? 0) + 1;
        state.log.unshift(`${removed.name} bị hạ.`);
      }
    } else if (!pending.allowSkip) {
      return { ok: false, message: "Phải chọn mục tiêu." };
    }
    let afterEvent = null;
    const continueSelecting = selectedTarget
      && Number.isInteger(pending.amount)
      && pending.selectedCount < pending.amount
      && pending.cardIds.length > 0;
    const continuationAfter = continueSelecting
      ? { type: "resume-defeat", pending }
      : pending.after ?? { type: "resume-action", actorIndex: state.active };
    if (defeatedCard) {
      const defeatedAbility = resolveServerDefeatedAbilities(
        state,
        [{ card: defeatedCard, ownerIndex: defeatedOwnerIndex }],
        continuationAfter
      );
      defeatedIds.push(...(defeatedAbility.defeatedIds ?? []));
      defeatedEffects.push(...(defeatedAbility.defeatedEffects ?? []));
      if (defeatedAbility.pending) {
        checkServerGameOver(state);
        return { ok: true, event: { type: "ability-defeat", actorIndex, defeatedIds, defeatedEffects, sourceCard: pending.sourceCard, pending: state.pending } };
      }
    }
    if (continueSelecting) {
      state.phase = "pending";
      state.pending = pending;
      return {
        ok: true,
        event: {
          type: "ability-defeat",
          actorIndex,
          defeatedIds,
          defeatedEffects,
          sourceCard: pending.sourceCard,
          pending: state.pending
        }
      };
    }
    afterEvent = completeServerPendingAfter(state, pending);
    checkServerGameOver(state);
    return { ok: true, event: { type: "ability-defeat", actorIndex, defeatedIds, defeatedEffects, sourceCard: pending.sourceCard, pending: state.pending, afterEvent } };
  }
  if (type === "disable-block-choice") {
    const pending = state.pending;
    if (state.phase !== "pending" || pending?.type !== "disable-block" || pending.actorIndex !== actorIndex) {
      return { ok: false, message: "Không thể chọn Quái vật lúc này." };
    }
    if (!pending.cardIds.includes(action.cardId)) return { ok: false, message: "Mục tiêu không hợp lệ." };
    const target = state.players[pending.ownerIndex]?.board.find(card => card.id === action.cardId);
    if (!target) return { ok: false, message: "Không tìm thấy mục tiêu." };
    target.cannotBlockThisTurn = true;
    const afterEvent = completeServerPendingAfter(state, pending);
    return { ok: true, event: { type: "ability-disable-block", actorIndex, cardId: target.id, sourceCard: pending.sourceCard, pending: state.pending, afterEvent } };
  }
  if (type === "steal-choice") {
    const pending = state.pending;
    if (state.phase !== "pending" || pending?.type !== "steal" || pending.actorIndex !== actorIndex) {
      return { ok: false, message: "Không thể cướp Quái vật lúc này." };
    }
    let movedId = "";
    if (action.cardId) {
      if (!pending.cardIds.includes(action.cardId)) return { ok: false, message: "Mục tiêu không hợp lệ." };
      const moved = moveServerCreature(state, action.cardId, pending.ownerIndex, pending.toIndex);
      if (moved) {
        movedId = moved.id;
        state.log.unshift(`${state.players[pending.toIndex].name} cướp ${moved.name}.`);
      }
    } else if (!pending.allowSkip) {
      return { ok: false, message: "Phải chọn mục tiêu." };
    }
    pending.selectedCount = (pending.selectedCount ?? 0) + (movedId ? 1 : pending.allowSkip ? pending.amount ?? 1 : 0);
    pending.cardIds = state.players[pending.ownerIndex]?.board
      .filter(card => pending.cardIds.includes(card.id))
      .map(card => card.id) ?? [];
    let afterEvent = null;
    if (pending.selectedCount >= (pending.amount ?? 1) || !pending.cardIds.length || (!movedId && pending.allowSkip)) {
      afterEvent = completeServerPendingAfter(state, pending);
    }
    checkServerGameOver(state);
    return { ok: true, event: { type: "ability-steal", actorIndex, cardId: movedId, sourceCard: pending.sourceCard, pending: state.pending, afterEvent } };
  }
  if (type === "give-card-choice") {
    const pending = state.pending;
    if (state.phase !== "pending" || pending?.type !== "give-card" || pending.actorIndex !== actorIndex) {
      return { ok: false, message: "Không thể đưa bài lúc này." };
    }
    if (!pending.cardIds.includes(action.cardId)) return { ok: false, message: "Lá bài không hợp lệ." };
    const player = state.players[pending.playerIndex];
    const index = player.hand.findIndex(card => card.id === action.cardId);
    if (index < 0) return { ok: false, message: "Không có lá bài này." };
    const [card] = player.hand.splice(index, 1);
    state.players[pending.toIndex].hand.push(card);
    drawToFive(player);
    state.phase = "pending";
    state.pending = {
      type: "received-card",
      actorIndex: pending.toIndex,
      playerIndex: pending.toIndex,
      cardId: card.id,
      card,
      sourceCard: pending.sourceCard,
      after: pending.after
    };
    return { ok: true, event: { type: "ability-give-card", actorIndex, playerIndex: pending.playerIndex, toIndex: pending.toIndex, cardId: card.id, card, sourceCard: pending.sourceCard, pending: state.pending } };
  }
  if (type === "received-card-choice") {
    const pending = state.pending;
    if (state.phase !== "pending" || pending?.type !== "received-card" || pending.actorIndex !== actorIndex) {
      return { ok: false, message: "Không thể chọn Chơi/Giữ lúc này." };
    }
    const player = state.players[pending.playerIndex];
    const index = player.hand.findIndex(card => card.id === pending.cardId);
    if (index < 0) return { ok: false, message: "Không có lá bài này." };
    const afterPending = pending;
    if (action.choice === "play") {
      const [card] = player.hand.splice(index, 1);
      player.board.push(card);
      state.phase = "action";
      state.pending = null;
      state.log.unshift(`${player.name} chơi ${card.name} vừa được đưa.`);
      const abilityResult = resolveServerPlayAbility(state, pending.playerIndex, card, pending.after);
      if (abilityResult.pending) {
        return { ok: true, event: { type: "ability-received-card-play", actorIndex, playerIndex: pending.playerIndex, cardId: card.id, card, sourceCard: pending.sourceCard, pending: state.pending } };
      }
      checkServerGameOver(state);
      const afterEvent = state.winner === null ? completeServerPendingAfter(state, afterPending) : null;
      return { ok: true, event: { type: "ability-received-card-play", actorIndex, playerIndex: pending.playerIndex, cardId: card.id, card, sourceCard: pending.sourceCard, ability: abilityResult.ability, defeatedIds: abilityResult.defeatedIds ?? [], afterEvent } };
    }
    state.log.unshift(`${player.name} giữ ${player.hand[index].name} trên tay.`);
    const afterEvent = completeServerPendingAfter(state, afterPending);
    return { ok: true, event: { type: "ability-received-card-keep", actorIndex, playerIndex: pending.playerIndex, cardId: pending.cardId, card: player.hand[index], sourceCard: pending.sourceCard, pending: state.pending, afterEvent } };
  }
  if (type === "hyenix-choice") {
    const pending = state.pending;
    if (state.phase !== "pending" || pending?.type !== "hyenix" || pending.actorIndex !== actorIndex) {
      return { ok: false, message: "Không thể chọn Vải Hồi Sinh lúc này." };
    }
    const player = state.players[pending.playerIndex];
    let card = player.discard.find(item => item.id === pending.cardId) ?? null;
    if (!card) return { ok: false, message: "Lá bài không còn trong Mộ bài." };
    if (action.choice === "play") {
      const index = player.discard.findIndex(item => item.id === pending.cardId);
      [card] = player.discard.splice(index, 1);
      player.board.push(card);
      state.log.unshift(`${player.name} chơi ${card.name} từ Mộ bài.`);
    } else {
      state.log.unshift(`${player.name} không chơi ${card.name} từ Mộ bài.`);
    }
    const afterEvent = completeServerPendingAfter(state, pending);
    return { ok: true, event: { type: "ability-hyenix-choice", actorIndex, playerIndex: pending.playerIndex, cardId: pending.cardId, card, choice: action.choice === "play" ? "play" : "skip", pending: state.pending, afterEvent } };
  }
  if (type === "dr-orange-choice") {
    const pending = state.pending;
    if (state.phase !== "pending" || pending?.type !== "dr-orange" || pending.actorIndex !== actorIndex) {
      return { ok: false, message: "Không thể chọn hiệu ứng Dr. Orange lúc này." };
    }
    const returnedIds = [];
    if (action.activate) {
      const owner = state.players[pending.ownerIndex];
      const enemyIndex = 1 - pending.ownerIndex;
      const enemy = state.players[enemyIndex];
      owner.life -= 1;
      checkServerGameOver(state);
      if (state.winner === null) {
        for (const card of enemy.board.splice(0)) {
          card.exhausted = false;
          card.attacksThisTurn = 0;
          card.damage = 0;
          card.originalOwnerIndex = enemyIndex;
          enemy.hand.push(card);
          returnedIds.push(card.id);
        }
        const hyenixResult = triggerServerHyenixFromDiscard(state, pending.ownerIndex, pending.after);
        if (hyenixResult.pending) {
          return { ok: true, event: { type: "ability-dr-orange", actorIndex, sourceCard: pending.sourceCard, activate: true, returnedIds, pending: state.pending } };
        }
      }
    }
    const afterEvent = state.winner === null ? completeServerPendingAfter(state, pending) : null;
    return { ok: true, event: { type: "ability-dr-orange", actorIndex, sourceCard: pending.sourceCard, activate: Boolean(action.activate), returnedIds, afterEvent } };
  }
  if (type === "earwig-choice") {
    const pending = state.pending;
    if (state.phase !== "pending" || pending?.type !== "earwig" || pending.actorIndex !== actorIndex) {
      return { ok: false, message: "Không thể chọn hiệu ứng Earwig Assassin lúc này." };
    }
    const owner = state.players[pending.ownerIndex];
    const creaturesInPlay = state.players.reduce((total, player) => total + player.board.length, 0);
    if (action.activate && owner.hand.length && creaturesInPlay > 0) {
      state.phase = "pending";
      state.pending = {
        type: "discard",
        actorIndex,
        playerIndex: pending.ownerIndex,
        sourceCard: pending.sourceCard,
        amount: 1,
        selectedCount: 0,
        after: {
          type: "earwig-defeat",
          actorIndex,
          sourceCard: pending.sourceCard,
          after: pending.after
        }
      };
      return { ok: true, event: { type: "ability-earwig", actorIndex, sourceCard: pending.sourceCard, activate: true, pending: state.pending } };
    }
    const afterEvent = completeServerPendingAfter(state, pending);
    return { ok: true, event: { type: "ability-earwig", actorIndex, sourceCard: pending.sourceCard, activate: false, afterEvent } };
  }
  if (type === "experiment-choice") {
    const pending = state.pending;
    if (state.phase !== "pending" || pending?.type !== "experiment" || pending.actorIndex !== actorIndex) {
      return { ok: false, message: "Không thể chọn mục tiêu The Experiment lúc này." };
    }
    if (!pending.cardIds.includes(action.cardId)) return { ok: false, message: "Mục tiêu không hợp lệ." };
    const owner = state.players[pending.ownerIndex];
    const enemy = state.players[pending.enemyIndex];
    const experimentIndex = owner.board.findIndex(card => card.id === pending.experimentId);
    const targetIndex = enemy.board.findIndex(card => card.id === action.cardId);
    if (experimentIndex < 0 || targetIndex < 0) return { ok: false, message: "Lá bài không còn trên sân." };
    const [experiment] = owner.board.splice(experimentIndex, 1);
    const [target] = enemy.board.splice(targetIndex, 1);
    experiment.exhausted = true;
    target.exhausted = true;
    enemy.board.push(experiment);
    owner.board.push(target);
    const afterEvent = completeServerPendingAfter(state, pending);
    return {
      ok: true,
      event: {
        type: "ability-experiment-exchange",
        actorIndex,
        ownerIndex: pending.ownerIndex,
        enemyIndex: pending.enemyIndex,
        experimentId: experiment.id,
        targetId: target.id,
        sourceCard: pending.sourceCard,
        afterEvent
      }
    };
  }
  if (type === "utility-play-choice") {
    const pending = state.pending;
    if (state.phase !== "pending" || pending?.type !== "utility-play" || pending.actorIndex !== actorIndex) {
      return { ok: false, message: "Không thể chọn PLAY ability lúc này." };
    }
    if (!pending.cardIds.includes(action.cardId)) return { ok: false, message: "Mục tiêu không hợp lệ." };
    const utility = state.players[pending.ownerIndex].board.find(card => card.id === pending.utilityId);
    let target = null;
    let targetOwnerIndex = -1;
    for (let index = 0; index < state.players.length; index += 1) {
      target = state.players[index].board.find(card => card.id === action.cardId);
      if (target) {
        targetOwnerIndex = index;
        break;
      }
    }
    if (!utility || !target) return { ok: false, message: "Lá bài không còn trên sân." };
    state.pending = null;
    state.phase = "action";
    const copiedAbilityCard = { ...utility, name: target.name, ability: target.ability };
    const abilityResult = resolveServerPlayAbility(state, pending.ownerIndex, copiedAbilityCard, pending.after);
    if (abilityResult.pending) {
      return { ok: true, event: { type: "ability-utility-play", actorIndex, sourceCard: pending.sourceCard, targetId: target.id, copiedCardName: target.name, pending: state.pending, ability: abilityResult.ability, defeatedIds: abilityResult.defeatedIds ?? [] } };
    }
    const afterEvent = completeServerPendingAfter(state, pending);
    return { ok: true, event: { type: "ability-utility-play", actorIndex, sourceCard: pending.sourceCard, targetId: target.id, copiedCardName: target.name, defeatedIds: abilityResult.defeatedIds ?? [], afterEvent } };
  }
  if (type === "discard-pile-choice") {
    const pending = state.pending;
    if (state.phase !== "pending" || pending?.type !== "discard-pile" || pending.actorIndex !== actorIndex) {
      return { ok: false, message: "Không thể chọn Mộ bài lúc này." };
    }
    if (!pending.cardIds.includes(action.cardId)) return { ok: false, message: "Lá bài không hợp lệ." };
    const sourcePlayer = state.players[pending.sourceOwnerIndex];
    const index = sourcePlayer.discard.findIndex(card => card.id === action.cardId);
    if (index < 0) return { ok: false, message: "Lá bài không còn trong Mộ bài." };
    const [card] = sourcePlayer.discard.splice(index, 1);
    state.players[pending.ownerIndex].board.push(card);
    state.log.unshift(`${state.players[pending.ownerIndex].name} hồi sinh ${card.name}.`);
    state.pending = null;
    state.phase = "action";
    const abilityResult = resolveServerPlayAbility(state, pending.ownerIndex, card, pending.after);
    if (!abilityResult.pending) completeServerPendingAfter(state, pending);
    checkServerGameOver(state);
    return { ok: true, event: { type: "ability-revive", actorIndex, cardId: card.id, card, pending: state.pending, ability: abilityResult.ability, defeatedIds: abilityResult.defeatedIds ?? [] } };
  }
  if (type === "action-card") {
    if (state.phase !== "action" || state.active !== actorIndex) return { ok: false, message: "Chưa đến lượt." };
    if (captainHippoForcedAttackersServer(state, actorIndex).length) {
      return { ok: false, message: "Bạn phải tấn công Captain Hippo bằng Quái vật có HUNTER." };
    }
    const card = state.players[actorIndex].board.find(item => item.id === action.cardId);
    if (!canUseServerEvolutionAction(card, state, actorIndex)) return { ok: false, message: "Lá này chưa thể dùng hiệu ứng Khi Được tưới." };
    const result = resolveServerEvolutionAction(state, actorIndex, card);
    if (result.pending) {
      return { ok: true, event: { type: "ability-pending", ability: "action", pending: state.pending, sourceCard: { id: card.id, name: card.name }, defeatedIds: result.defeatedIds ?? [] } };
    }
    checkServerGameOver(state);
    const evolutionEvent = result.evolution
      ? { type: "action-evolve", actorIndex, ...result.evolution, ability: result.ability }
      : { type: "ability-action", actorIndex, cardId: card.id, sourceCard: { id: card.id, name: card.name }, ability: result.ability, defeatedIds: result.defeatedIds ?? [] };
    return { ok: true, event: evolutionEvent };
  }
  if (type === "forced-attack-choice") {
    const pending = state.pending;
    if (state.phase !== "pending" || pending?.type !== "forced-attack" || pending.actorIndex !== actorIndex) {
      return { ok: false, message: "Không thể chọn Quái vật tấn công lúc này." };
    }
    if (!pending.cardIds.includes(action.cardId)) return { ok: false, message: "Mục tiêu không hợp lệ." };
    const attackerIndex = pending.attackerIndex;
    const attacker = state.players[attackerIndex].board.find(card => card.id === action.cardId);
    if (attacker) attacker.cakeForcedAttack = true;
    if (!canAttackServer(attacker, state, attackerIndex)) {
      if (attacker) delete attacker.cakeForcedAttack;
      const sourceName = pending.sourceCard?.name ?? "Cake Trickster";
      const message = `${attacker?.name ?? "Quái vật đã chọn"} bị hiệu ứng khác ngăn tấn công. Hiệu ứng của ${sourceName} bị hủy.`;
      state.log.unshift(message);
      state.pending = null;
      state.phase = "action";
      state.active = actorIndex;
      endServerTurn(state);
      return {
        ok: true,
        event: {
          type: "ability-cancel",
          ability: "action",
          actorIndex,
          sourceCard: pending.sourceCard,
          cardId: attacker?.id ?? action.cardId,
          message
        }
      };
    }
    state.pending = null;
    state.phase = "action";
    state.active = attackerIndex;
    const attackAbilityResult = resolveServerAttackAbility(state, attackerIndex, attacker);
    if (attackAbilityResult?.pending) {
      state.pending.forcedActionOwner = actorIndex;
      return { ok: true, event: { type: "ability-pending", ability: attackAbilityResult.ability ?? "attack", pending: state.pending, sourceCard: { id: attacker.id, name: attacker.name }, defeatedIds: attackAbilityResult.defeatedIds ?? [], defeatedEffects: attackAbilityResult.defeatedEffects ?? [] } };
    }
    if (state.winner !== null) {
      return {
        ok: true,
        event: {
          type: "attack-face",
          ability: attackAbilityResult?.ability ?? "attack",
          actorIndex: attackerIndex,
          defenderIndex: 1 - attackerIndex,
          attackerId: attacker.id,
          sourceCard: { id: attacker.id, name: attacker.name }
        }
      };
    }
    const forcedAbilityEventData = attackAbilityResult?.ability
      ? {
        ability: attackAbilityResult.ability,
        sourceCard: { id: attacker.id, name: attacker.name },
        defeatedIds: attackAbilityResult.defeatedIds ?? [],
        defeatedEffects: attackAbilityResult.defeatedEffects ?? []
      }
      : {};
    const result = continueServerAttackAfterAbility(state, attackerIndex, attacker.id);
    if (state.pending) state.pending.forcedActionOwner = actorIndex;
    else if (state.winner === null) {
      state.active = actorIndex;
      endServerTurn(state);
    }
    if (result?.event && attackAbilityResult?.ability) {
      result.event = { ...result.event, ...forcedAbilityEventData };
    }
    return result;
  }
  if (type === "attack") {
    if (state.phase !== "action" || state.active !== actorIndex) return { ok: false, message: "Chưa đến lượt." };
    const attacker = state.players[actorIndex].board.find(card => card.id === action.cardId);
    if (!canAttackServer(attacker, state, actorIndex)) return { ok: false, message: "Lá này không thể tấn công." };
    const forcedActionOwner = attacker.forcedCakeActionOwner;
    delete attacker.forcedCakeActionOwner;
    const defenderIndex = 1 - actorIndex;
    const attackAbilityResult = resolveServerAttackAbility(state, actorIndex, attacker);
    if (attackAbilityResult?.pending) {
      if (forcedActionOwner !== undefined) state.pending.forcedActionOwner = forcedActionOwner;
      return { ok: true, event: { type: "ability-pending", ability: attackAbilityResult.ability ?? "attack", pending: state.pending, sourceCard: { id: attacker.id, name: attacker.name }, defeatedIds: attackAbilityResult.defeatedIds ?? [], defeatedEffects: attackAbilityResult.defeatedEffects ?? [] } };
    }
    const abilityEventData = attackAbilityResult?.ability
      ? {
        ability: attackAbilityResult.ability,
        sourceCard: { id: attacker.id, name: attacker.name },
        defeatedIds: attackAbilityResult.defeatedIds ?? [],
        defeatedEffects: attackAbilityResult.defeatedEffects ?? [],
        discardAll: attackAbilityResult.discardAll ?? null,
        drawnToFive: attackAbilityResult.drawnToFive ?? null
      }
      : {};
    if (state.winner !== null) return { ok: true, event: { type: "attack-face", actorIndex, defenderIndex, attackerId: attacker.id, ...abilityEventData } };
    const result = continueServerAttackAfterAbility(state, actorIndex, attacker.id);
    if (forcedActionOwner !== undefined) {
      if (state.pending) state.pending.forcedActionOwner = forcedActionOwner;
      else if (state.winner === null) {
        state.active = forcedActionOwner;
        endServerTurn(state);
      }
    }
    if (result?.event && attackAbilityResult?.ability) {
      result.event = { ...result.event, ...abilityEventData };
    }
    return result;
  }
  if (type === "hunter-choice") {
    const pending = state.pending;
    if (state.phase !== "pending" || pending?.type !== "hunter" || pending.actorIndex !== actorIndex) {
      return { ok: false, message: "Không thể chọn HUNTER lúc này." };
    }
    if (action.choice === "face") {
      if (pending.mustTargetCreature) {
        return { ok: false, message: "Captain Hippo buộc Quái vật có BẮN TỈA phải tấn công nó." };
      }
      state.pending = null;
      state.phase = "action";
      const result = continueServerFaceAttack(state, pending.attackerIndex, pending.attackerId);
      if (pending.forcedActionOwner !== undefined) {
        if (state.pending) state.pending.forcedActionOwner = pending.forcedActionOwner;
        else if (state.winner === null) {
          state.active = pending.forcedActionOwner;
          endServerTurn(state);
        }
      }
      return result;
    }
    if (!pending.targetIds.includes(action.cardId)) return { ok: false, message: "Mục tiêu HUNTER không hợp lệ." };
    const result = continueServerCreatureAttack(state, pending.attackerIndex, action.cardId);
    if (pending.forcedActionOwner !== undefined) {
      if (state.pending) state.pending.forcedActionOwner = pending.forcedActionOwner;
      else if (state.winner === null) {
        state.active = pending.forcedActionOwner;
        endServerTurn(state);
      }
    }
    return result;
  }
  if (type === "block-choice") {
    const pending = state.pending;
    if (state.phase !== "pending" || pending?.type !== "block" || pending.actorIndex !== actorIndex) {
      return { ok: false, message: "Không thể chặn lúc này." };
    }
    let event = null;
    if (action.blockerId && pending.blockerIds.includes(action.blockerId)) {
      const combatResult = resolveServerCombat(state, pending.attackerIndex, action.blockerId);
      event = {
        type: "attack-creature",
        actorIndex: pending.attackerIndex,
        defenderIndex: actorIndex,
        attackerId: pending.attackerId,
        blockerId: action.blockerId,
        defeatedIds: combatResult.defeatedIds,
        drawnToFive: completeDelayedDrawToFive(state)
      };
      state.pending = null;
      if (state.winner === null) {
        const after = { type: "post-combat", attackerIndex: pending.attackerIndex, attackerId: pending.attackerId };
        const defeatedAbility = resolveServerDefeatedAbilities(state, combatResult.defeatedCards ?? [], after);
        event.defeatedIds.push(...(defeatedAbility.defeatedIds ?? []));
        event.defeatedEffects = defeatedAbility.defeatedEffects ?? [];
        if (defeatedAbility.pending) {
          event.pending = state.pending;
          return { ok: true, event };
        }
      }
    } else {
      const directResult = resolveServerDirectAttack(state, pending.attackerIndex, pending.attackerId);
      event = { type: "attack-face", actorIndex: pending.attackerIndex, defenderIndex: actorIndex, attackerId: pending.attackerId, drawnToFive: completeDelayedDrawToFive(state) };
      if (directResult.pending) {
        event.pending = state.pending;
        return { ok: true, event };
      }
      state.pending = null;
    }
    if (state.winner === null) {
      const attackerId = pending.attackerId;
      finalizeServerPostCombat(state, pending.attackerIndex, attackerId);
      if (pending.forcedActionOwner !== undefined && state.winner === null) {
        state.active = pending.forcedActionOwner;
        endServerTurn(state);
      }
    }
    return { ok: true, event };
  }
  if (type === "frenzy-choice") {
    const pending = state.pending;
    if (state.phase !== "pending" || pending?.type !== "frenzy" || pending.actorIndex !== actorIndex) {
      return { ok: false, message: "Không thể chọn đánh lần 2 lúc này." };
    }
    const attacker = state.players[actorIndex].board.find(card => card.id === pending.attackerId);
    state.pending = null;
    if (action.choice === "again" && attacker && canAttackServer(attacker, state, actorIndex)) {
      state.phase = "action";
      state.active = actorIndex;
      state.frenzyOnly = attacker.id;
      if (pending.forcedActionOwner !== undefined) attacker.forcedCakeActionOwner = pending.forcedActionOwner;
      return { ok: true, event: { type: "frenzy-again", actorIndex, attackerId: attacker.id } };
    }
    if (attacker) attacker.exhausted = true;
    state.frenzyOnly = null;
    if (pending.forcedActionOwner !== undefined) {
      state.active = pending.forcedActionOwner;
      endServerTurn(state);
    } else {
      endServerTurn(state);
    }
    return { ok: true, event: { type: "frenzy-stop", actorIndex, attackerId: pending.attackerId } };
  }
  if (type === "end-turn") {
    if (state.phase !== "action" || state.active !== actorIndex) return { ok: false, message: "Chưa đến lượt." };
    if (captainHippoForcedAttackersServer(state, actorIndex).length) {
      return { ok: false, message: "Bạn phải tấn công Captain Hippo bằng Quái vật có HUNTER." };
    }
    endServerTurn(state);
    return { ok: true, event: { type: "end-turn", actorIndex } };
  }
  return { ok: false, message: "Hành động không hợp lệ." };
}

function createRoomCode() {
  for (let i = 0; i < 40; i += 1) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    if (!rooms.has(code)) return code;
  }
  return String(Date.now()).slice(-4);
}

function sanitizeProfile(profile = {}) {
  const name = String(profile.name || "Bạn").trim().slice(0, 8) || "Bạn";
  const avatar = Number.isInteger(Number(profile.avatar))
    ? Math.max(1, Math.min(16, Number(profile.avatar)))
    : 1;
  return { name, avatar };
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    started: room.started,
    players: room.players.map(player => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      ready: player.ready,
      connected: player.connected !== false
    }))
  };
}

function emitRoom(room) {
  io.to(room.code).emit("room-update", publicRoom(room));
}

function removeSocketFromRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  socket.leave(code);
  socket.data.roomCode = "";
  if (!room) return;
  room.players = room.players.filter(player => player.id !== socket.data.playerSessionId);
  if (!room.players.length) {
    rooms.delete(code);
    return;
  }
  if (room.hostId === socket.data.playerSessionId) room.hostId = room.players[0].id;
  emitRoom(room);
}

function clearDisconnectTimer(player) {
  if (player?.disconnectTimer) clearTimeout(player.disconnectTimer);
  if (player) player.disconnectTimer = null;
}

function markPlayerDisconnected(socket) {
  const room = rooms.get(socket.data.roomCode);
  if (!room) return;
  const player = room.players.find(item => item.id === socket.data.playerSessionId);
  if (!player) return;
  player.connected = false;
  player.socketId = "";
  player.disconnectedAt = Date.now();
  clearDisconnectTimer(player);
  player.disconnectTimer = setTimeout(() => {
    if (player.connected || !rooms.has(room.code)) return;
    const opponent = room.players.find(item => item.id !== player.id && item.connected && item.socketId);
    if (opponent) {
      io.to(opponent.socketId).emit("opponent-away-timeout", {
        playerName: player.name,
        playerSessionId: player.id
      });
    }
  }, DISCONNECT_GRACE_MS);
  emitRoom(room);
}

function resumePlayerSession(socket, { sessionId, roomCode } = {}, reply) {
  const stableId = String(sessionId || "").trim();
  socket.data.playerSessionId = stableId || socket.id;
  const abandoned = abandonedSessions.get(socket.data.playerSessionId);
  if (abandoned && abandoned.expiresAt > Date.now()) {
    reply?.({ ok: false, reason: abandoned.reason, message: "Bạn đã thoát game" });
    return;
  }
  const requestedCode = String(roomCode || "").replace(/\D/g, "").slice(0, 4);
  const room = rooms.get(requestedCode);
  const player = room?.players.find(item => item.id === socket.data.playerSessionId);
  if (!room || !player) {
    reply?.({ ok: false, reason: "not-found" });
    return;
  }
  clearDisconnectTimer(player);
  player.connected = true;
  player.socketId = socket.id;
  player.disconnectedAt = 0;
  socket.join(room.code);
  socket.data.roomCode = room.code;
  emitRoom(room);
  reply?.({ ok: true, room: publicRoom(room), state: room.game ?? null });
  if (room.started && room.game) {
    const opponent = room.players.find(item => item.id !== player.id);
    if (opponent?.connected && opponent.socketId) {
      io.to(opponent.socketId).emit("opponent-returned", { playerName: player.name });
    } else if (opponent?.disconnectedAt && Date.now() - opponent.disconnectedAt >= DISCONNECT_GRACE_MS) {
      socket.emit("opponent-away-timeout", {
        playerName: opponent.name,
        playerSessionId: opponent.id
      });
    }
  }
}

const httpServer = createServer();
let debugCardId = 100000;
httpServer.on("request", (request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  if (request.url === "/api/bot-learning") {
    request.mindbugHandled = true;
    const origin = String(request.headers.origin || "");
    if (!isAllowedClientOrigin(origin)) {
      response.writeHead(403, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false }));
      return;
    }
    if (origin) {
      response.setHeader("access-control-allow-origin", origin);
      response.setHeader("vary", "Origin");
    }
    response.setHeader("access-control-allow-methods", "POST, OPTIONS");
    response.setHeader("access-control-allow-headers", "content-type");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method !== "POST") {
      response.writeHead(405, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false }));
      return;
    }
    let body = "";
    request.setEncoding("utf8");
    request.on("data", chunk => {
      body += chunk;
      if (body.length > 2_000_000) request.destroy();
    });
    request.on("end", () => {
      try {
        const payload = JSON.parse(body);
        if (!payload || typeof payload !== "object" || !Array.isArray(payload.games) || typeof payload.strategyMemory !== "object") {
          throw new Error("Invalid learning payload");
        }
        const normalized = {
          version: 1,
          updatedAt: new Date().toISOString(),
          games: payload.games.slice(-100),
          strategyMemory: payload.strategyMemory
        };
        botLearningWriteQueue = botLearningWriteQueue
          .catch(() => {})
          .then(() => writeFile(BOT_LEARNING_FILE_URL, `${JSON.stringify(normalized, null, 2)}\n`, "utf8"));
        botLearningWriteQueue.then(() => {
          response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ ok: true, games: normalized.games.length }));
        }).catch(() => {
          response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ ok: false }));
        });
      } catch {
        response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: false, message: "Dữ liệu học không hợp lệ." }));
      }
    });
    return;
  }
});
const vite = await createViteServer({
  server: {
    middlewareMode: true,
    hmr: { server: httpServer }
  },
  appType: "spa"
});
httpServer.on("request", (request, response) => {
  if (!request.mindbugHandled && !response.writableEnded) vite.middlewares(request, response);
});
const io = new Server(httpServer, {
  cors: {
    origin(origin, callback) {
      if (
        isAllowedClientOrigin(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin không được phép."));
    },
    methods: ["GET", "POST"]
  }
});

io.on("connection", socket => {
  socket.on("resume-session", (payload = {}, reply) => {
    resumePlayerSession(socket, payload, reply);
  });

  socket.on("create-room", (payload = {}, reply) => {
    const profile = payload?.profile ?? payload;
    socket.data.playerSessionId = String(payload.sessionId || socket.id);
    removeSocketFromRoom(socket);
    const code = createRoomCode();
    const room = {
      code,
      hostId: socket.data.playerSessionId,
      started: false,
      players: [{ id: socket.data.playerSessionId, socketId: socket.id, connected: true, ...sanitizeProfile(profile), ready: true }]
    };
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    emitRoom(room);
    reply?.({ ok: true, room: publicRoom(room) });
  });

  socket.on("join-room", ({ code, profile, sessionId: requestedSessionId } = {}, reply) => {
    const roomCode = String(code || "").replace(/\D/g, "").slice(0, 4);
    const room = rooms.get(roomCode);
    if (!room) {
      reply?.({ ok: false, message: "Không tìm thấy phòng." });
      return;
    }
    if (room.started) {
      reply?.({ ok: false, message: "Phòng đã bắt đầu." });
      return;
    }
    const sessionId = String(requestedSessionId || socket.id);
    socket.data.playerSessionId = sessionId;
    if (room.players.length >= 2 && !room.players.some(player => player.id === sessionId)) {
      reply?.({ ok: false, message: "Phòng đã đủ người." });
      return;
    }
    removeSocketFromRoom(socket);
    const existing = room.players.find(player => player.id === sessionId);
    if (existing) Object.assign(existing, sanitizeProfile(profile), { socketId: socket.id, connected: true, ready: true });
    else room.players.push({ id: sessionId, socketId: socket.id, connected: true, ...sanitizeProfile(profile), ready: true });
    socket.join(room.code);
    socket.data.roomCode = room.code;
    emitRoom(room);
    reply?.({ ok: true, room: publicRoom(room) });
  });

  socket.on("profile-update", profile => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const player = room.players.find(item => item.id === socket.data.playerSessionId);
    if (!player) return;
    Object.assign(player, sanitizeProfile(profile));
    emitRoom(room);
  });

  socket.on("start-room", reply => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.data.playerSessionId) {
      reply?.({ ok: false, message: "Chỉ chủ phòng mới bắt đầu được." });
      return;
    }
    if (room.players.length < 2) {
      reply?.({ ok: false, message: "Cần đủ 2 người chơi." });
      return;
    }
    room.started = true;
    room.seed = Date.now();
    room.game = makeGame(room, room.seed);
    io.to(room.code).emit("room-start", { room: publicRoom(room), seed: room.seed, state: room.game });
    reply?.({ ok: true });
  });

  socket.on("duel-action", (action, reply) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !room.started || !room.game) {
      reply?.({ ok: false, message: "Phòng chưa bắt đầu." });
      return;
    }
    const result = applyGameAction(room, socket, action);
    reply?.(result);
    if (result.ok) emitGame(room, result.event ?? { type: action?.type ?? "action" });
  });

  socket.on("leave-room", () => {
    removeSocketFromRoom(socket);
  });

  socket.on("player-away", () => {
    markPlayerDisconnected(socket);
  });

  socket.on("player-active", () => {
    resumePlayerSession(socket, {
      sessionId: socket.data.playerSessionId,
      roomCode: socket.data.roomCode
    });
  });

  socket.on("disconnect-choice", ({ choice, playerSessionId } = {}, reply) => {
    const room = rooms.get(socket.data.roomCode);
    const actor = room?.players.find(player => player.id === socket.data.playerSessionId);
    const awayPlayer = room?.players.find(player => player.id === playerSessionId && player.connected === false);
    if (!room || !actor || !awayPlayer) {
      reply?.({ ok: false, message: "Người chơi đã quay lại hoặc phòng không còn tồn tại." });
      return;
    }
    if (choice === "wait") {
      reply?.({ ok: true });
      return;
    }
    if (choice === "bot") {
      const expiresAt = Date.now() + 6 * 60 * 60 * 1000;
      abandonedSessions.set(awayPlayer.id, { reason: "taken-over", expiresAt });
      setTimeout(() => {
        const abandoned = abandonedSessions.get(awayPlayer.id);
        if (abandoned?.expiresAt === expiresAt) abandonedSessions.delete(awayPlayer.id);
      }, expiresAt - Date.now());
      clearDisconnectTimer(awayPlayer);
      io.to(socket.id).emit("bot-takeover", {
        room: publicRoom(room),
        state: room.game,
        botPlayerIndex: room.players.indexOf(awayPlayer)
      });
      rooms.delete(room.code);
      socket.leave(room.code);
      socket.data.roomCode = "";
      reply?.({ ok: true });
      return;
    }
    if (choice === "lobby") {
      removeSocketFromRoom(socket);
      reply?.({ ok: true });
      return;
    }
    reply?.({ ok: false, message: "Lựa chọn không hợp lệ." });
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);
    if (room?.started) markPlayerDisconnected(socket);
    else removeSocketFromRoom(socket);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Mindbug Socket.IO dev server: http://localhost:${PORT}`);
});
