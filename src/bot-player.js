export function createMindbugBot(botIndex = 1, config = {}) {
  const delay = config.delay ?? 1000;
  const afterActionDelay = config.afterActionDelay ?? 900;
  const searchLimitMs = config.searchLimitMs ?? 900;
  const searchDepth = config.searchDepth ?? 4;
  const branchLimit = config.branchLimit ?? 7;
  const mindbugDepth = config.mindbugDepth ?? Math.max(2, searchDepth - 1);
  const memory = loadStrategyMemory(botIndex);
  let learningEpisode = [];

  function chooseTurnAction(state, helpers) {
    try {
      return chooseOptimalTurnAction(state, helpers, botIndex, { searchLimitMs, searchDepth, branchLimit, memory });
    } catch (error) {
      console.warn("Bot search failed, using fast fallback.", error);
      return chooseFastFallbackAction(state, helpers, botIndex);
    }
  }

  function chooseOption(context, state, helpers) {
    if (!context || context.actorIndex !== botIndex) return null;
    const options = context.options || [];

    if (context.type === "mindbug") {
      if (
        helpers.creatureAbilitiesEnabled
        && context.card?.name === "Goreagle Alpha"
        && state.players[botIndex]?.life <= 1
      ) {
        return "pass";
      }
      return chooseMindbug(context.card, state, helpers, botIndex, { searchLimitMs, mindbugDepth, branchLimit });
    }

    if (context.type === "hunter") {
      const enemy = state.players[1 - botIndex];
      if (enemy.life <= helpers.directDamage(context.card)) return "face";
      const bestTarget = chooseHunterTarget(context.card, enemy.board, state, helpers, botIndex);
      const facePressure = 9 + Math.max(0, 2 - enemy.life) * 4;
      return bestTarget.score > facePressure ? "creature" : "face";
    }

    if (context.type === "frenzy") return "again";

    if (context.type === "block") {
      const best = context.cards
        .map(card => ({ card, score: scoreBlock(card, context.attacker, state, helpers) }))
        .sort((a, b) => b.score - a.score)[0];
      const avoidableDamage = 1;
      const botLifeAfterPass = state.players[botIndex].life - avoidableDamage;
      if (best && botLifeAfterPass <= 0) return best.card.id;
      const enemyThreatAfterPass = realTotalFaceThreat(state, 1 - botIndex, helpers);
      if (best && enemyThreatAfterPass >= state.players[botIndex].life - 1 && !hasImmediateWin(state, helpers, botIndex)) return best.card.id;
      if (best && state.players[botIndex].life <= 2 && best.score > -6) return best.card.id;
      return best && best.score > 12 ? best.card.id : "";
    }

    if (context.type === "hunterTarget") {
      return chooseHunterTarget(context.attacker, context.cards, state, helpers, botIndex).card?.id ?? context.cards[0]?.id ?? "";
    }

    if (context.type === "discard") {
      const worst = context.cards
        .map(card => ({ card, score: scoreCard(card, state, helpers, context.ownerIndex ?? botIndex) }))
        .sort((a, b) => a.score - b.score)[0];
      return worst?.card.id ?? options[0]?.value ?? "";
    }

    if (context.type === "defeat") {
      const best = context.cards
        .map(card => ({ card, score: scoreCard(card, state, helpers, context.ownerIndex ?? 1 - botIndex) }))
        .sort((a, b) => b.score - a.score)[0];
      return best?.card.id ?? options[0]?.value ?? "";
    }

    if (context.type === "pick") {
      const best = context.cards
        .map(card => ({ card, score: scoreCard(card, state, helpers, context.ownerIndex ?? botIndex) }))
        .sort((a, b) => b.score - a.score)[0];
      return best ? best.card.id : options[0]?.value ?? "";
    }

    return null;
  }

  function startLearningGame() {
    learningEpisode = [];
  }

  function recordGameAction(state, action, actorIndex) {
    if (!state || !action || action.type === "pass" || !Number.isInteger(actorIndex)) return;
    const perspective = actorIndex === botIndex ? cloneState(state) : mirrorStateForBot(state, actorIndex, botIndex);
    const signature = strategySignature(perspective, action, botIndex);
    const actor = state.players[actorIndex];
    const card = action.type === "play"
      ? actor?.hand.find(item => item.id === action.cardId)
      : actor?.board.find(item => item.id === action.cardId);
    learningEpisode.push({
      signature,
      actorIndex,
      actionType: action.type,
      cardName: card?.name ?? "",
      actorLife: actor?.life ?? 0,
      enemyLife: state.players[1 - actorIndex]?.life ?? 0,
      recordedAt: Date.now()
    });
  }

  function completeLearningGame(winnerIndex) {
    if (!learningEpisode.length || !Number.isInteger(winnerIndex)) {
      learningEpisode = [];
      return Number(memory.completedGames ?? 0);
    }
    learnFromCompletedGame(memory, learningEpisode, winnerIndex, botIndex);
    learningEpisode = [];
    return Number(memory.completedGames ?? 0);
  }

  return {
    botIndex,
    delay,
    afterActionDelay,
    searchLimitMs,
    searchDepth,
    branchLimit,
    chooseTurnAction,
    chooseOption,
    startLearningGame,
    recordGameAction,
    completeLearningGame
  };
}

export function runBotSelfPlay(initialState, helpers = {}, config = {}) {
  const searchLimitMs = config.searchLimitMs ?? 90;
  const searchDepth = config.searchDepth ?? 3;
  const branchLimit = config.branchLimit ?? 6;
  const maxTurns = config.maxTurns ?? 120;
  const memory = config.memory ?? {
    version: 1,
    botIndex: "self-play",
    completedGames: 0,
    entries: {}
  };
  let sim = cloneState(initialState);
  const actions = [];
  const learningEpisode = [];

  readySimTurn(sim, sim.active);
  updateSimActionLoss(sim, sim.active, helpers);
  while (sim.winner === null && actions.length < maxTurns) {
    const actorIndex = sim.active;
    const actor = sim.players[actorIndex];
    const action = chooseOptimalTurnAction(sim, helpers, actorIndex, {
      searchLimitMs,
      searchDepth,
      branchLimit,
      memory
    });
    const source = action.type === "play"
      ? actor.hand.find(card => card.id === action.cardId)
      : actor.board.find(card => card.id === action.cardId);
    if (action.type !== "pass") {
      learningEpisode.push({
        signature: strategySignature(sim, action, actorIndex),
        actorIndex,
        actionType: action.type,
        cardName: source?.name ?? "",
        actorLife: actor.life,
        enemyLife: sim.players[1 - actorIndex].life,
        recordedAt: Date.now()
      });
    }
    const before = {
      life: sim.players.map(player => player.life),
      board: sim.players.map(player => player.board.length),
      hand: sim.players.map(player => player.hand.length),
      mindbugs: sim.players.map(player => player.mindbugs)
    };
    const next = applyAction(sim, action, actorIndex, helpers);
    actions.push({
      turn: actions.length + 1,
      actorIndex,
      type: action.type,
      card: source?.name ?? "",
      before,
      after: {
        life: next.players.map(player => player.life),
        board: next.players.map(player => player.board.length),
        hand: next.players.map(player => player.hand.length),
        mindbugs: next.players.map(player => player.mindbugs)
      }
    });
    sim = next;
  }
  if (config.learn !== false && Number.isInteger(sim.winner)) {
    learnFromCompletedGame(memory, learningEpisode, sim.winner, 0);
  }

  return {
    winnerIndex: sim.winner,
    ended: sim.winner !== null,
    turns: actions.length,
    actions,
    finalState: cloneState(sim),
    memory
  };
}

function mirrorStateForBot(state, actorIndex, botIndex) {
  const mirrored = cloneState(state);
  if (actorIndex === botIndex) return mirrored;
  mirrored.players = [mirrored.players[1], mirrored.players[0]];
  mirrored.active = botIndex;
  if (Number.isInteger(mirrored.winner)) mirrored.winner = 1 - mirrored.winner;
  return mirrored;
}

function chooseOptimalTurnAction(state, helpers, botIndex, config) {
  const { searchLimitMs, searchDepth, branchLimit, memory } = config;
  const deadline = Date.now() + searchLimitMs;
  const sim = cloneState(state);
  const forcedWin = findForcedWinAction(sim, botIndex, helpers, {
    deadline: Date.now() + Math.min(900, Math.max(220, searchLimitMs * 0.45)),
    maxDepth: Math.max(2, Math.min(searchDepth + 2, 7)),
    branchLimit
  });
  if (forcedWin) {
    rememberStrategy(memory, sim, forcedWin, 10000, botIndex);
    return forcedWin;
  }

  const candidates = generateActions(sim, botIndex, helpers)
    .map(action => ({ action, score: quickActionScore(sim, action, botIndex, botIndex, helpers) + strategyMemoryBias(memory, sim, action, botIndex) }))
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return { type: "pass" };

  let best = candidates[0];
  for (const candidate of candidates) {
    if (Date.now() >= deadline) break;
    const next = applyAction(sim, candidate.action, botIndex, helpers);
    const score = searchPath(next, 1 - botIndex, botIndex, helpers, deadline, searchDepth, branchLimit, -Infinity, Infinity)
      + strategyMemoryBias(memory, sim, candidate.action, botIndex);
    if (score > best.score) best = { action: candidate.action, score };
  }

  rememberStrategy(memory, sim, best.action, best.score, botIndex);
  return best.action;
}

function findForcedWinAction(sim, botIndex, helpers, config) {
  const { deadline, maxDepth, branchLimit } = config;
  const cache = new Map();
  let best = null;
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    if (Date.now() >= deadline) break;
    const action = findForcedWinAtDepth(sim, botIndex, helpers, deadline, depth, branchLimit, cache);
    if (action) {
      best = action;
      break;
    }
  }
  return best;
}

function findForcedWinAtDepth(sim, botIndex, helpers, deadline, depth, branchLimit, cache) {
  const actions = generateForcedActions(sim, botIndex, botIndex, helpers, branchLimit);
  for (const action of actions) {
    if (Date.now() >= deadline) return null;
    if (action.type === "pass") continue;
    const next = applyAction(sim, action, botIndex, helpers);
    if (forcedWinSearch(next, 1 - botIndex, botIndex, helpers, deadline, depth - 1, branchLimit, cache)) {
      return action;
    }
  }
  return null;
}

function forcedWinSearch(sim, activeIndex, botIndex, helpers, deadline, depth, branchLimit, cache) {
  if (Date.now() >= deadline) return false;
  sim.active = activeIndex;
  updateSimActionLoss(sim, activeIndex, helpers);
  if (sim.winner === botIndex) return true;
  if (sim.winner === 1 - botIndex) return false;
  if (depth <= 0) return false;

  const key = `${depth}|${activeIndex}|${forcedStateKey(sim)}`;
  if (cache.has(key)) return cache.get(key);

  const actions = generateForcedActions(sim, activeIndex, botIndex, helpers, branchLimit);
  let result;
  if (activeIndex === botIndex) {
    result = actions.some(action => forcedWinSearch(
      applyAction(sim, action, activeIndex, helpers),
      1 - activeIndex,
      botIndex,
      helpers,
      deadline,
      depth - 1,
      branchLimit,
      cache
    ));
  } else {
    result = actions.every(action => forcedWinSearch(
      applyAction(sim, action, activeIndex, helpers),
      1 - activeIndex,
      botIndex,
      helpers,
      deadline,
      depth - 1,
      branchLimit,
      cache
    ));
  }
  cache.set(key, result);
  return result;
}

function chooseFastFallbackAction(state, helpers, botIndex) {
  const player = state.players[botIndex];
  const enemyIndex = 1 - botIndex;
  const attackers = player.board.filter(card => helpers.canAttack(card, botIndex));
  const bestAttack = attackers
    .map(card => ({ card, score: scoreAttack(card, state, helpers) }))
    .sort((a, b) => b.score - a.score)[0];
  const bestPlay = player.hand
    .map(card => ({ card, score: scorePlay(card, state, helpers) }))
    .sort((a, b) => b.score - a.score)[0];

  const lethal = attackers.find(card => helpers.canDealDirectDamage(card, botIndex, enemyIndex)
    && state.players[enemyIndex].life <= helpers.directDamage(card));
  if (lethal) return { type: "attack", cardId: lethal.id };
  if (bestAttack && (!bestPlay || bestAttack.score >= bestPlay.score + 3)) return { type: "attack", cardId: bestAttack.card.id };
  if (bestPlay) return { type: "play", cardId: bestPlay.card.id };
  if (bestAttack) return { type: "attack", cardId: bestAttack.card.id };
  return { type: "pass" };
}

function chooseHunterTarget(attacker, targets, state, helpers, botIndex) {
  const enemyIndex = 1 - botIndex;
  return targets
    .map(card => ({ card, score: scoreHunterTarget(attacker, card, state, helpers, botIndex, enemyIndex) }))
    .sort((a, b) => b.score - a.score)[0] ?? { card: null, score: -Infinity };
}

function scoreHunterTarget(attacker, target, state, helpers, attackerIndex, defenderIndex) {
  const attackerPower = helpers.cardPower(attacker, attackerIndex);
  const targetPower = helpers.cardPower(target, defenderIndex);
  const attackerKeywords = helpers.cardKeywords(attacker, attackerIndex);
  const targetKeywords = helpers.cardKeywords(target, defenderIndex);
  const killsTarget = attackerKeywords.includes("POISONOUS") || attackerPower >= targetPower;
  const losesAttacker = targetKeywords.includes("POISONOUS") || targetPower >= attackerPower;
  let score = scoreCard(target, state, helpers, defenderIndex);
  score += hunterSneakyTargetBonus(target, state, helpers, attackerIndex, defenderIndex);
  if (!killsTarget) score -= 8;
  if (losesAttacker) score -= scoreCard(attacker, state, helpers, attackerIndex) * 0.7;
  if (attackerKeywords.includes("TOUGH") && losesAttacker && attacker.damage < 1) score += 4;
  if (targetKeywords.includes("POISONOUS")) score += 2;
  return score;
}

function hunterSneakyTargetBonus(target, state, helpers, attackerIndex, defenderIndex) {
  const targetKeywords = helpers.cardKeywords(target, defenderIndex);
  if (!targetKeywords.includes("SNEAKY")) return 0;
  const attackerHasSneakyBlocker = state.players[attackerIndex].board
    .some(card => helpers.cardKeywords(card, attackerIndex).includes("SNEAKY"));
  const targetCanAttack = helpers.canAttack(target, defenderIndex);
  const life = state.players[attackerIndex].life;
  let bonus = 42;
  if (!attackerHasSneakyBlocker) bonus += 36;
  if (targetCanAttack) bonus += 18;
  if (life <= 2) bonus += 30;
  if (life <= helpers.directDamage(target)) bonus += 160;
  return bonus;
}

function searchPath(sim, activeIndex, botIndex, helpers, deadline, depth, branchLimit, alpha, beta) {
  sim.active = activeIndex;
  updateSimActionLoss(sim, activeIndex, helpers);
  if (Date.now() >= deadline || depth <= 0 || sim.winner !== null) {
    return evaluateState(sim, botIndex, helpers);
  }

  const actions = generateActions(sim, activeIndex, helpers)
    .map(action => ({ action, score: quickActionScore(sim, action, activeIndex, botIndex, helpers) }))
    .sort((a, b) => activeIndex === botIndex ? b.score - a.score : a.score - b.score)
    .slice(0, branchLimit);

  if (!actions.length) return evaluateState(sim, botIndex, helpers);

  if (activeIndex === botIndex) {
    let best = evaluateState(sim, botIndex, helpers);
    for (const { action } of actions) {
      if (Date.now() >= deadline) break;
      const score = searchPath(applyAction(sim, action, activeIndex, helpers), 1 - activeIndex, botIndex, helpers, deadline, depth - 1, branchLimit, alpha, beta);
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = evaluateState(sim, botIndex, helpers);
  for (const { action } of actions) {
    if (Date.now() >= deadline) break;
    const score = searchPath(applyAction(sim, action, activeIndex, helpers), 1 - activeIndex, botIndex, helpers, deadline, depth - 1, branchLimit, alpha, beta);
    best = Math.min(best, score);
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function cloneState(state) {
  return {
    winner: state.winner,
    active: state.active,
    players: state.players.map(player => ({
      life: player.life,
      mindbugs: player.mindbugs,
      hand: player.hand.map(cloneCard),
      board: player.board.map(cloneCard),
      deck: player.deck.map(cloneCard),
      discard: player.discard.map(cloneCard)
    }))
  };
}

function cloneCard(card) {
  return {
    id: card.id,
    name: card.name,
    basePower: card.basePower,
    keywords: [...card.keywords],
    ability: card.ability,
    exhausted: card.exhausted,
    attacksThisTurn: card.attacksThisTurn,
    damage: card.damage,
    cannotBlockThisTurn: Boolean(card.cannotBlockThisTurn),
    lurkerSneakyThisTurn: Boolean(card.lurkerSneakyThisTurn),
    mindbuggedThisTurn: Boolean(card.mindbuggedThisTurn),
    originalOwnerIndex: Number.isInteger(card.originalOwnerIndex) ? card.originalOwnerIndex : undefined
  };
}

function forcedStateKey(sim) {
  return sim.players.map(player => {
    const hand = player.hand.map(card => card.name).sort().join(",");
    const board = player.board
      .map(card => [
        card.name,
        card.exhausted ? "x" : "r",
        card.attacksThisTurn ?? 0,
        card.damage ?? 0,
        card.cannotBlockThisTurn ? "cb" : "",
        card.lurkerSneakyThisTurn ? "ls" : ""
      ].join(":"))
      .sort()
      .join(",");
    const discard = player.discard.map(card => card.name).sort().join(",");
    return [
      player.life,
      player.mindbugs,
      player.deck.length,
      `h[${hand}]`,
      `b[${board}]`,
      `d[${discard}]`
    ].join("/");
  }).join("||");
}

function readySimTurn(sim, activeIndex) {
  sim.active = activeIndex;
  for (const card of sim.players[activeIndex]?.board ?? []) {
    card.exhausted = false;
    card.attacksThisTurn = 0;
  }
}

function generateActions(sim, activeIndex, helpers) {
  return generateCandidateActions(sim, activeIndex, helpers)
    .sort((a, b) => quickActionScore(sim, b, activeIndex, activeIndex, helpers) - quickActionScore(sim, a, activeIndex, activeIndex, helpers));
}

function generateCandidateActions(sim, activeIndex, helpers) {
  const player = sim.players[activeIndex];
  const actions = [];

  for (const card of player.board) {
    if (!canSimAttack(card, sim, activeIndex, helpers)) continue;
    actions.push({ type: "attack", cardId: card.id });
  }

  for (const card of player.board) {
    if (canSimUseAction(card, sim, activeIndex, helpers)) actions.push({ type: "action", cardId: card.id });
  }

  for (const card of player.hand) {
    actions.push({ type: "play", cardId: card.id });
  }

  if (!actions.length) actions.push({ type: "pass" });
  return actions;
}

function generateForcedActions(sim, activeIndex, perspectiveIndex, helpers, branchLimit) {
  const actions = generateCandidateActions(sim, activeIndex, helpers);
  if (actions.length <= 1) return actions;
  const scored = actions
    .map(action => ({ action, score: forcedActionOrderingScore(sim, action, activeIndex, perspectiveIndex, helpers) }))
    .sort((a, b) => activeIndex === perspectiveIndex ? b.score - a.score : a.score - b.score);
  const maxActions = activeIndex === perspectiveIndex
    ? Math.max(branchLimit, actions.length)
    : actions.length;
  return scored.slice(0, maxActions).map(item => item.action);
}

function forcedActionOrderingScore(sim, action, activeIndex, perspectiveIndex, helpers) {
  const player = sim.players[activeIndex];
  const enemyIndex = 1 - activeIndex;
  const enemy = sim.players[enemyIndex];
  if (action.type === "pass") return -Infinity;
  if (action.type === "attack") {
    const attacker = player.board.find(card => card.id === action.cardId);
    if (!attacker) return 0;
    const directDamage = simProjectedFaceDamage(attacker, sim, activeIndex, enemyIndex, helpers);
    let score = directDamage >= enemy.life ? 1000 : directDamage * 80;
    const keywords = simKeywords(attacker, sim, activeIndex, helpers);
    if (keywords.includes("SNEAKY")) score += 70;
    if (keywords.includes("HUNTER") && enemy.board.length) score += 45;
    if (keywords.includes("FRENZY")) score += 35;
    return activeIndex === perspectiveIndex ? score : -score;
  }
  if (action.type === "action") {
    const card = player.board.find(item => item.id === action.cardId);
    if (!card) return 0;
    const nextName = simEvolutionNextName(card.name);
    return activeIndex === perspectiveIndex
      ? 140 + scoreSimCard(card, sim, activeIndex, helpers) + (nextName ? 40 : 0)
      : -140;
  }
  if (action.type === "play") {
    const card = player.hand.find(item => item.id === action.cardId);
    if (!card) return 0;
    let score = scoreSimCard(card, sim, activeIndex, helpers) + playPatternScore(card, sim, activeIndex, helpers);
    if (simPlayAbilitySwing(card, sim, activeIndex, enemyIndex, helpers) >= 50) score += 120;
    return activeIndex === perspectiveIndex ? score : -score;
  }
  return 0;
}

function applyAction(sim, action, activeIndex, helpers) {
  const next = cloneState(sim);
  next.active = activeIndex;
  const player = next.players[activeIndex];
  const enemyIndex = 1 - activeIndex;
  const enemy = next.players[enemyIndex];

  if (action.type === "pass") {
    updateSimActionLoss(next, activeIndex, helpers);
    return next;
  }

  if (action.type === "action") {
    const card = player.board.find(item => item.id === action.cardId);
    if (card && canSimUseAction(card, next, activeIndex, helpers)) {
      applySimAction(next, card.id, activeIndex, helpers);
    }
  } else if (action.type === "play") {
    const handIndex = player.hand.findIndex(card => card.id === action.cardId);
    if (handIndex >= 0) {
      const [card] = player.hand.splice(handIndex, 1);
      if (shouldSimMindbug(card, next, enemyIndex, helpers)) {
        enemy.mindbugs -= 1;
        enemy.board.push(card);
        applySimPlayAbility(next, card, enemyIndex, activeIndex, helpers);
      } else {
        player.board.push(card);
        applySimPlayAbility(next, card, activeIndex, enemyIndex, helpers);
      }
    }
  } else if (action.type === "attack") {
    const attacker = player.board.find(card => card.id === action.cardId);
    if (attacker && canSimAttack(attacker, next, activeIndex, helpers)) {
      resolveSimAttack(next, action.cardId, activeIndex, helpers);
    }
  }

  drawSimToFive(next.players[activeIndex]);
  updateSimWinner(next);
  readySimTurn(next, 1 - activeIndex);
  updateSimActionLoss(next, 1 - activeIndex, helpers);
  return next;
}

function quickActionScore(sim, action, activeIndex, perspectiveIndex, helpers) {
  const next = applyAction(sim, action, activeIndex, helpers);
  return evaluateState(next, perspectiveIndex, helpers) + actionHeuristicScore(sim, action, activeIndex, perspectiveIndex, helpers);
}

function actionHeuristicScore(sim, action, activeIndex, perspectiveIndex, helpers) {
  const player = sim.players[activeIndex];
  const enemyIndex = 1 - activeIndex;
  const enemy = sim.players[enemyIndex];
  let score = tacticalActionScore(sim, action, activeIndex, perspectiveIndex, helpers);
  if (action.type === "play") {
    const card = player.hand.find(item => item.id === action.cardId);
    if (!card) return 0;
    const cardValue = scoreSimCard(card, sim, activeIndex, helpers);
    const enemyWillSteal = shouldSimMindbug(card, sim, enemyIndex, helpers);
    if (enemy.mindbugs > 0) {
      if (enemyWillSteal) {
        score -= cardValue * 1.7;
        if (cardValue <= 5) score += 22;
        if (cardValue <= 3) score += 12;
        if (card.name === "Ferret Bomber" || card.name === "Killer Bee") score -= 18;
        if (activeIndex === perspectiveIndex && cardValue <= 6 && enemy.mindbugs >= 2) score += 16;
      } else if (cardValue <= 5) {
        score += 4;
      }
    }
    if (activeIndex === perspectiveIndex) {
      const incoming = simTotalFaceDamage(sim, enemyIndex, helpers);
      if (incoming >= player.life - 1) {
        score += simKeywords(card, sim, activeIndex, helpers).includes("SNEAKY") ? 6 : 14;
        if (simKeywords(card, sim, activeIndex, helpers).includes("TOUGH")) score += 10;
        if (simKeywords(card, sim, activeIndex, helpers).includes("POISONOUS")) score += 8;
      }
    }
  }
  if (action.type === "attack") {
    const attacker = player.board.find(item => item.id === action.cardId);
    if (!attacker) return score;
    if (activeIndex === perspectiveIndex && simTotalFaceDamage(sim, enemyIndex, helpers) >= player.life) {
      score -= 8;
      if (simKeywords(attacker, sim, activeIndex, helpers).includes("SNEAKY")) score += 10;
    }
  }
  if (action.type === "action") {
    const card = player.board.find(item => item.id === action.cardId);
    if (!card) return score;
    score += 40 + playPatternScore(card, sim, activeIndex, helpers);
  }
  score += learnedSelfPlayActionBias(sim, action, activeIndex, helpers);
  score += learnedComebackActionBias(sim, action, activeIndex, helpers);
  return activeIndex === perspectiveIndex ? score : -score * 0.5;
}

function learnedComebackActionBias(sim, action, activeIndex, helpers) {
  const player = sim.players[activeIndex];
  const enemy = sim.players[1 - activeIndex];
  const card = action.type === "play"
    ? player.hand.find(item => item.id === action.cardId)
    : player.board.find(item => item.id === action.cardId);
  if (!card) return 0;
  const lifeDeficit = enemy.life - player.life;
  const boardDeficit = enemy.board.length - player.board.length;
  if (lifeDeficit <= 0 && boardDeficit <= 0) return 0;
  let bias = 0;

  if (action.type === "play") {
    if (card.name === "Mysterious Mermaid" && lifeDeficit > 0) bias += 55 + lifeDeficit * 20;
    if (card.name === "Axolotl Healer" && lifeDeficit > 0) bias += 38;
    if (card.name === "Bugserker" && player.life === 1) bias += 34;
    if (card.name === "Lone Yeti" && player.board.length === 0) bias += 28;
    if (card.name === "Brain Fly" && enemy.board.some(
      target => simPower(target, sim, 1 - activeIndex, helpers) >= 6
    )) bias += 42;
    if (card.name === "Kangasaurus Rex" && enemy.board.filter(
      target => simPower(target, sim, 1 - activeIndex, helpers) <= 4
    ).length >= 2) bias += 48;
    if (card.name === "Dr. Orange U. Tan" && player.life > 1 && boardDeficit >= 2) bias += 64;
    if (card.name === "Turtle Toaster" && enemy.board.filter(target => {
      const power = simPower(target, sim, 1 - activeIndex, helpers);
      return power >= 4 && power <= 6;
    }).length >= 2) bias += 44;
  }
  if (action.type === "action") {
    if (card.name === "Dragon Inn" && boardDeficit > 0) bias += 55;
    if (card.name === "Infernostrich" && enemy.board.some(
      target => simPower(target, sim, 1 - activeIndex, helpers) >= 7
    )) bias += 48;
  }
  if (action.type === "attack") {
    if (card.name === "Turbo Bug" && enemy.life > 1) bias += 90;
    if (card.name === "Chameleon Sniper" && enemy.life <= 2) bias += 45;
    if (card.name === "Bugserker" && player.life === 1) bias += 30;
  }
  return bias;
}

function learnedSelfPlayActionBias(sim, action, activeIndex, helpers) {
  const player = sim.players[activeIndex];
  const enemy = sim.players[1 - activeIndex];
  const card = action.type === "play"
    ? player.hand.find(item => item.id === action.cardId)
    : player.board.find(item => item.id === action.cardId);
  if (!card) return 0;
  const keywords = simKeywords(card, sim, activeIndex, helpers);
  let bias = 0;

  // Self-play consistently rewards taking tempo and keeping durable pressure.
  if (action.type === "attack") {
    bias += 5;
    if (keywords.includes("TOUGH")) bias += 6;
    if (keywords.includes("FRENZY") && enemy.life <= 2) bias += 14;
    if (keywords.includes("SNEAKY") && !enemy.board.some(
      blocker => simKeywords(blocker, sim, 1 - activeIndex, helpers).includes("SNEAKY")
    )) bias += 12;
  }
  if (action.type === "play") {
    if (keywords.includes("TOUGH")) bias += 7;
    if (keywords.includes("FRENZY")) bias += enemy.life <= 2 ? 12 : 5;
    if (keywords.includes("SNEAKY") && !enemy.board.some(
      blocker => simKeywords(blocker, sim, 1 - activeIndex, helpers).includes("SNEAKY")
    )) bias += 9;
    // Preserve the final card when another legal action exists, avoiding
    // endgames lost solely because no action remains.
    if (player.deck.length === 0 && player.hand.length === 1
      && player.board.some(boardCard => canSimAttack(boardCard, sim, activeIndex, helpers))) {
      bias -= 16;
    }
  }
  return bias;
}

function tacticalActionScore(sim, action, activeIndex, perspectiveIndex, helpers) {
  const before = evaluateState(sim, perspectiveIndex, helpers);
  const next = applyAction(sim, action, activeIndex, helpers);
  const after = evaluateState(next, perspectiveIndex, helpers);
  const player = sim.players[activeIndex];
  const enemyIndex = 1 - activeIndex;
  const enemy = sim.players[enemyIndex];
  const isOwnAction = activeIndex === perspectiveIndex;
  let score = (after - before) * 0.25;

  if (next.winner === activeIndex) score += isOwnAction ? 5000 : -5000;
  if (next.winner === enemyIndex) score += isOwnAction ? -5000 : 5000;

  const incomingBefore = simTotalFaceDamage(sim, enemyIndex, helpers);
  const incomingAfter = simTotalFaceDamage(next, enemyIndex, helpers);
  const ownLife = player.life;
  if (isOwnAction) {
    if (incomingBefore >= ownLife && incomingAfter < ownLife) score += 420;
    if (incomingAfter >= ownLife) score -= 900;
    if (incomingAfter >= ownLife - 1) score -= 240;
    if (ownLife <= 2 && incomingAfter > incomingBefore) score -= 180;
  }

  const outgoingBefore = simTotalFaceDamage(sim, activeIndex, helpers);
  const outgoingAfter = simTotalFaceDamage(next, activeIndex, helpers);
  if (isOwnAction) {
    if (outgoingAfter >= enemy.life) score += 520;
    score += Math.max(0, outgoingAfter - outgoingBefore) * 55;
  }

  if (action.type === "attack") {
    const attacker = sim.players[activeIndex].board.find(card => card.id === action.cardId);
    if (attacker) {
      const keywords = simKeywords(attacker, sim, activeIndex, helpers);
      if (keywords.includes("SNEAKY") && !sim.players[enemyIndex].board.some(card => simKeywords(card, sim, enemyIndex, helpers).includes("SNEAKY"))) {
        score += isOwnAction ? 95 : -95;
      }
      if (keywords.includes("FRENZY")) score += isOwnAction ? 42 : -42;
      if (keywords.includes("HUNTER") && enemy.board.length) score += isOwnAction ? 36 : -36;
    }
  }

  if (action.type === "play") {
    const card = sim.players[activeIndex].hand.find(item => item.id === action.cardId);
    if (card) score += playPatternScore(card, sim, activeIndex, helpers) * (isOwnAction ? 1 : -0.5);
  }

  return score;
}

function playPatternScore(card, sim, ownerIndex, helpers) {
  const enemyIndex = 1 - ownerIndex;
  const owner = sim.players[ownerIndex];
  const enemy = sim.players[enemyIndex];
  const keywords = simKeywords(card, sim, ownerIndex, helpers);
  let score = 0;
  if (keywords.includes("SNEAKY") && !enemy.board.some(blocker => simKeywords(blocker, sim, enemyIndex, helpers).includes("SNEAKY"))) {
    score += 24 + Math.max(0, 3 - enemy.life) * 12;
  }
  if (keywords.includes("TOUGH") && owner.life <= 2) score += 20;
  if (keywords.includes("POISONOUS") && enemy.board.some(target => simPower(target, sim, enemyIndex, helpers) >= 6)) score += 18;
  if (keywords.includes("HUNTER") && enemy.board.length) score += 14;
  if (!helpers.creatureAbilitiesEnabled) return score;
  if (card.name === "Killer Bee" && enemy.life <= 1) score += 600;
  if (card.name === "Axolotl Healer" && owner.life <= 2) score += 36;
  if (card.name === "Mysterious Mermaid" && owner.life < enemy.life) score += (enemy.life - owner.life) * 22;
  if (card.name === "Ferret Bomber" && enemy.hand.length >= 2) score += 28;
  if (card.name === "Hungry Hungry Hamster" && enemy.hand.length) score += 24;
  if (card.name === "Deathweaver" && enemy.hand.some(handCard => handCard.ability !== "NONE")) score += 32;
  score += simAbilityComboScore(card, sim, ownerIndex, helpers);
  return score;
}

function simAbilityComboScore(card, sim, ownerIndex, helpers) {
  const owner = sim.players[ownerIndex];
  const enemy = sim.players[1 - ownerIndex];
  const allies = owner.board;
  let score = 0;
  if (card.name === "Snail Thrower") {
    score += allies.filter(ally => simPower(ally, sim, ownerIndex, helpers) <= 4).length * 14;
  }
  if (card.name === "Kitsunsei") {
    score += allies.filter(ally => !simKeywords(ally, sim, ownerIndex, helpers).includes("SNEAKY")).length * 11;
  }
  if (card.name === "Shield Bugs" || card.name === "Urchin Hurler") {
    score += allies.length * 7;
  }
  if (card.name === "Coach Panda" && allies.length === 1) score += 28;
  if (card.name === "Ferret Pacifier" || card.name === "Elephantopus" || card.name === "Mole Machine") {
    score += allies.filter(ally => canSimAttack(ally, sim, ownerIndex, helpers)).length * 9;
  }
  if (card.name === "Axolotl Healer" && owner.hand.some(handCard => (
    handCard.name === "Goreagle Alpha" || handCard.name === "Dr. Orange U. Tan"
  ))) score += 18;
  if (card.name === "Puffermech" && enemy.board.some(target => simPower(target, sim, 1 - ownerIndex, helpers) >= 8)) score += 24;
  if (card.name === "Dragon Inn" && owner.board.length < enemy.board.length) score += 26;
  if (card.name === "Infernostrich" && enemy.board.some(target => simPower(target, sim, 1 - ownerIndex, helpers) >= 7)) score += 28;
  if (card.name === "Octocopter") {
    const bestTargetValue = Math.max(0, ...enemy.board.map(
      target => scoreSimCard(target, sim, 1 - ownerIndex, helpers)
    ));
    const sacrificeValue = scoreSimCard(card, sim, ownerIndex, helpers);
    score += bestTargetValue >= sacrificeValue + 8 ? 28 : -24;
  }
  if (card.name === "Cake Trickster") {
    const countDraculeechLethal = enemy.life <= 1
      && enemy.board.some(target => target.name === "Count Draculeech" && canSimAttack(target, sim, 1 - ownerIndex, helpers));
    score += countDraculeechLethal ? 120 : -16;
  }
  return score;
}

function evaluateState(sim, botIndex, helpers) {
  updateSimWinner(sim);
  if (sim.winner === botIndex) return 10000;
  if (sim.winner === 1 - botIndex) return -10000;

  const bot = sim.players[botIndex];
  const enemy = sim.players[1 - botIndex];
  const botBoard = bot.board.reduce((sum, card) => sum + scoreSimCard(card, sim, botIndex, helpers), 0);
  const enemyBoard = enemy.board.reduce((sum, card) => sum + scoreSimCard(card, sim, 1 - botIndex, helpers), 0);
  const botThreat = bot.board.filter(card => canSimAttack(card, sim, botIndex, helpers)).length;
  const enemyThreat = enemy.board.filter(card => canSimAttack(card, sim, 1 - botIndex, helpers)).length;
  const botFacePressure = simFacePressure(sim, botIndex, helpers);
  const enemyFacePressure = simFacePressure(sim, 1 - botIndex, helpers);

  const botIncomingDamage = simTotalFaceDamage(sim, 1 - botIndex, helpers);
  const enemyIncomingDamage = simTotalFaceDamage(sim, botIndex, helpers);
  const botLifeDanger = defenseDangerScore(botIncomingDamage, bot.life, sim, botIndex, helpers);
  const enemyLifeDanger = offenseDangerScore(enemyIncomingDamage, enemy.life);
  const defenseCoverage = simDefenseCoverage(sim, botIndex, helpers) * 9;
  const sneakyThreatSwing = simSneakyThreatScore(sim, botIndex, helpers);

  return lifeScore(bot.life)
    - enemyLifeScore(enemy.life)
    + (botBoard - enemyBoard)
    + (bot.hand.length - enemy.hand.length) * 2
    + (bot.deck.length - enemy.deck.length) * 0.5
    + (bot.mindbugs - enemy.mindbugs) * 7
    + (botThreat - enemyThreat) * 3
    + botFacePressure
    - (enemyFacePressure * 1.75)
    + botLifeDanger
    + enemyLifeDanger
    + defenseCoverage
    + sneakyThreatSwing;
}

function lifeScore(life) {
  if (life <= 0) return -10000;
  return (life * 58)
    + (life === 1 ? -150 : 0)
    + (life === 2 ? -55 : 0);
}

function enemyLifeScore(life) {
  if (life <= 0) return -10000;
  return (life * 34)
    - (life === 1 ? 45 : 0)
    - (life === 2 ? 15 : 0);
}

function defenseDangerScore(incomingDamage, life, sim, botIndex, helpers) {
  if (life <= 0) return -10000;
  if (incomingDamage <= 0) return 20;
  const spareBlockers = simDefenseCoverage(sim, botIndex, helpers);
  let score = -(incomingDamage * 70);
  if (incomingDamage >= life) score -= 650;
  else if (incomingDamage >= life - 1) score -= 220;
  else if (incomingDamage >= life - 2) score -= 80;
  if (life <= 2) score -= incomingDamage * 45;
  score += spareBlockers * 18;
  return score;
}

function offenseDangerScore(incomingDamage, life) {
  if (incomingDamage >= life) return 420;
  if (incomingDamage >= life - 1) return 130;
  if (incomingDamage >= life - 2) return 50;
  return incomingDamage * 18;
}

function simSneakyThreatScore(sim, botIndex, helpers) {
  return simSneakyThreatFor(sim, botIndex, helpers) - simSneakyThreatFor(sim, 1 - botIndex, helpers);
}

function simSneakyThreatFor(sim, ownerIndex, helpers) {
  const defenderIndex = 1 - ownerIndex;
  const defenderHasSneaky = sim.players[defenderIndex].board
    .some(card => simKeywords(card, sim, defenderIndex, helpers).includes("SNEAKY"));
  return sim.players[ownerIndex].board.reduce((sum, card) => {
    if (!simKeywords(card, sim, ownerIndex, helpers).includes("SNEAKY")) return sum;
    const canPressureNow = canSimAttack(card, sim, ownerIndex, helpers);
    const defenderLife = sim.players[defenderIndex].life;
    let value = 24 + Math.max(0, 3 - defenderLife) * 12;
    if (!defenderHasSneaky) value += 34;
    if (canPressureNow) value += 24;
    if (defenderLife <= 2) value += 32;
    return sum + value;
  }, 0);
}

function updateSimWinner(sim) {
  if (sim.winner !== null) return;
  const lifeLoser = sim.players.findIndex(player => player.life <= 0);
  if (lifeLoser >= 0) {
    sim.winner = 1 - lifeLoser;
  }
}

function updateSimActionLoss(sim, activeIndex, helpers) {
  updateSimWinner(sim);
  if (sim.winner !== null) return;
  if (simCanPlayerAct(sim, activeIndex, helpers)) return;
  sim.winner = 1 - activeIndex;
}

function simCanPlayerAct(sim, playerIndex, helpers) {
  const player = sim.players[playerIndex];
  if (!player) return false;
  if (player.hand.length > 0) return true;
  return player.board.some(card => canSimAttack(card, sim, playerIndex, helpers));
}

function drawSimToFive(player) {
  while (player.hand.length < 5 && player.deck.length) {
    player.hand.push(player.deck.shift());
  }
}

function canSimAttack(card, sim = null, ownerIndex = -1, helpers = {}) {
  if (!card || card.exhausted || card.attacksThisTurn !== 0) return false;
  if (
    helpers.creatureAbilitiesEnabled
    && sim
    && ownerIndex >= 0
    && sim.players[1 - ownerIndex]?.board.some(enemyCard => enemyCard.name === "Hamster Lion")
  ) {
    const board = sim.players[ownerIndex]?.board ?? [];
    if (!board.length) return false;
    const lowestPower = Math.min(...board.map(boardCard => simPower(boardCard, sim, ownerIndex, helpers)));
    if (simPower(card, sim, ownerIndex, helpers) === lowestPower) return false;
  }
  return true;
}

function canSimUseAction(card, sim, ownerIndex, helpers) {
  if (!helpers.creatureAbilitiesEnabled || !card || !sim || ownerIndex < 0) return false;
  if (card.exhausted) return false;
  if (simEvolutionNextName(card.name)) return true;
  const enemy = sim.players[1 - ownerIndex];
  if (card.name === "Cake Trickster") {
    return enemy.life <= 1
      && enemy.board.some(target => target.name === "Count Draculeech" && canSimAttack(target, sim, 1 - ownerIndex, helpers));
  }
  if (card.name === "Dragon Inn") return sim.players[ownerIndex].board.length < enemy.board.length;
  if (card.name === "Infernostrich") {
    return enemy.board.some(target => simPower(target, sim, 1 - ownerIndex, helpers) >= 7);
  }
  if (card.name === "Octocopter") {
    const bestTargetValue = Math.max(0, ...enemy.board.map(
      target => scoreSimCard(target, sim, 1 - ownerIndex, helpers)
    ));
    return bestTargetValue >= scoreSimCard(card, sim, ownerIndex, helpers) + 8;
  }
  return false;
}

function simEvolutionNextName(cardName) {
  const map = {
    "Cloud Lady": "Typhoon Princess",
    "Typhoon Princess": "Thunder Queen",
    "Curious Tadpole": "Frog Prophet",
    "Frog Prophet": "World Eater",
    "Waddling Recruit": "Veteran Penguin",
    "Veteran Penguin": "Frosty Fortress"
  };
  return map[cardName] ?? "";
}

function applySimAction(sim, cardId, ownerIndex, helpers) {
  const player = sim.players[ownerIndex];
  const enemyIndex = 1 - ownerIndex;
  const enemy = sim.players[enemyIndex];
  const index = player.board.findIndex(card => card.id === cardId);
  if (index < 0) return;
  const card = player.board[index];
  if (card.name === "Cake Trickster") {
    const forcedCandidates = enemy.life <= 1
      ? enemy.board.filter(target => target.name === "Count Draculeech")
      : enemy.board;
    const forced = forcedCandidates
      .filter(target => canSimAttack(target, sim, enemyIndex, helpers))
      .map(target => ({ target, score: scoreSimCard(target, sim, enemyIndex, helpers) }))
      .sort((a, b) => b.score - a.score)[0]?.target;
    card.exhausted = true;
    if (forced) resolveSimAttack(sim, forced.id, enemyIndex, helpers);
    return;
  }
  if (card.name === "Dragon Inn") {
    enemy.life -= 1;
    card.exhausted = true;
    updateSimWinner(sim);
    return;
  }
  if (card.name === "Infernostrich") {
    defeatBestSimTarget(sim, enemyIndex, helpers, target => simPower(target, sim, enemyIndex, helpers) >= 7);
    card.exhausted = true;
    return;
  }
  if (card.name === "Octocopter") {
    simDefeatCreature(sim, card.id, ownerIndex, helpers);
    stealBestSimCreature(sim, ownerIndex, enemyIndex, helpers);
    return;
  }
  if (card.name === "Cloud Lady") {
    defeatBestSimTarget(sim, enemyIndex, helpers, target => simPower(target, sim, enemyIndex, helpers) <= 4);
  }
  if (card.name === "Typhoon Princess") {
    defeatBestSimTarget(sim, enemyIndex, helpers, target => simPower(target, sim, enemyIndex, helpers) <= 6);
  }
  if (card.name === "Curious Tadpole" || card.name === "Frog Prophet") {
    player.life += 1;
  }
  if (card.name === "Waddling Recruit" || card.name === "Veteran Penguin") {
    discardWorstSimCard(sim, enemyIndex, helpers);
  }
  const nextName = simEvolutionNextName(card.name);
  const nextSpec = simEvolutionSpec(nextName);
  if (!nextSpec) return;
  const evolved = cloneCard({
    id: card.id,
    name: nextSpec.name,
    basePower: nextSpec.power,
    keywords: nextSpec.keywords,
    ability: nextSpec.ability,
    exhausted: true,
    attacksThisTurn: 0,
    damage: 0,
    originalOwnerIndex: card.originalOwnerIndex
  });
  player.board[index] = evolved;
  updateSimWinner(sim);
}

function simEvolutionSpec(cardName) {
  const specs = {
    "Typhoon Princess": { name: "Typhoon Princess", power: 6, keywords: [], ability: "Action: Defeat an enemy creature with power 6 or less. Evolve into Thunder Queen." },
    "Thunder Queen": { name: "Thunder Queen", power: 9, keywords: [], ability: "Attack: Defeat an enemy creature." },
    "Frog Prophet": { name: "Frog Prophet", power: 3, keywords: ["POISONOUS", "TOUGH"], ability: "Action: Gain 1 life point. Evolve into World Eater." },
    "World Eater": { name: "World Eater", power: 8, keywords: ["POISONOUS", "TOUGH"], ability: "Attack: The opponent loses 1 life point." },
    "Veteran Penguin": { name: "Veteran Penguin", power: 5, keywords: ["TOUGH"], ability: "Action: The opponent discards a card. Evolve into Frosty Fortress." },
    "Frosty Fortress": { name: "Frosty Fortress", power: 10, keywords: ["TOUGH"], ability: "Attack: The opponent discards their hand." }
  };
  return specs[cardName] ?? null;
}

function applySimPlayAbility(sim, card, ownerIndex, enemyIndex, helpers) {
  if (!helpers.creatureAbilitiesEnabled) return;
  if (sim.players[enemyIndex].board.some(enemyCard => enemyCard.name === "Deathweaver") && card.name !== "Deathweaver") return;
  if (card.name === "Mysterious Mermaid") {
    sim.players[ownerIndex].life = sim.players[enemyIndex].life;
  }
  if (card.name === "Ferret Bomber") {
    discardWorstSimCards(sim, enemyIndex, helpers, 2);
  }
  if (card.name === "Axolotl Healer") {
    sim.players[ownerIndex].life += 2;
  }
  if (card.name === "Killer Bee") {
    sim.players[enemyIndex].life -= 1;
  }
  if (card.name === "Brain Fly") {
    stealBestSimCreature(sim, ownerIndex, enemyIndex, helpers, card => simPower(card, sim, enemyIndex, helpers) >= 6);
  }
  if (card.name === "Kangasaurus Rex") {
    for (const target of [...sim.players[enemyIndex].board]) {
      if (simPower(target, sim, enemyIndex, helpers) <= 4) simDamageOrDefeat(sim, target.id, enemyIndex, helpers);
    }
  }
  if (card.name === "Tiger Squirrel") {
    defeatBestSimTarget(sim, enemyIndex, helpers, target => simPower(target, sim, enemyIndex, helpers) >= 7);
  }
  if (card.name === "Compost Dragon") {
    playBestSimDiscardCreature(sim, ownerIndex, ownerIndex, helpers);
  }
  if (card.name === "Grave Robber") {
    playBestSimDiscardCreature(sim, ownerIndex, enemyIndex, helpers);
  }
  if (card.name === "Giraffodile") {
    sim.players[ownerIndex].hand.push(...sim.players[ownerIndex].discard.splice(0));
  }
  if (card.name === "Goreagle Alpha") {
    sim.players[ownerIndex].life -= 1;
  }
  if (card.name === "Hungry Hungry Hamster") {
    stealBestSimCards(sim, ownerIndex, enemyIndex, helpers, 1);
  }
  if (
    card.name === "Dr. Orange U. Tan"
    && sim.players[ownerIndex].life > 1
    && sim.players[enemyIndex].board.length >= 2
  ) {
    sim.players[ownerIndex].life -= 1;
    while (sim.players[enemyIndex].board.length) {
      const returned = sim.players[enemyIndex].board.shift();
      returned.exhausted = false;
      returned.attacksThisTurn = 0;
      sim.players[enemyIndex].hand.push(returned);
    }
  }
  if (card.name === "Turtle Toaster") {
    const targets = sim.players[enemyIndex].board
      .filter(target => {
        const power = simPower(target, sim, enemyIndex, helpers);
        return power >= 4 && power <= 6;
      })
      .map(target => ({ target, score: scoreSimCard(target, sim, enemyIndex, helpers) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    for (const { target } of targets) simDefeatCreature(sim, target.id, enemyIndex, helpers);
  }
  if (card.name === "Chuckling Chimpborg") {
    sim.players[enemyIndex].life -= sim.players[enemyIndex].mindbugs;
  }
  updateSimWinner(sim);
}

function stealBestSimCreature(sim, toIndex, fromIndex, helpers, predicate = () => true) {
  const fromBoard = sim.players[fromIndex].board;
  const target = fromBoard
    .filter(predicate)
    .map(card => ({ card, score: scoreSimCard(card, sim, fromIndex, helpers) }))
    .sort((a, b) => b.score - a.score)[0]?.card;
  if (!target) return;
  const index = fromBoard.findIndex(card => card.id === target.id);
  if (index < 0) return;
  const [card] = fromBoard.splice(index, 1);
  card.exhausted = true;
  sim.players[toIndex].board.push(card);
}

function playBestSimDiscardCreature(sim, toIndex, sourceIndex, helpers) {
  const discard = sim.players[sourceIndex].discard;
  const target = discard
    .map(card => ({ card, score: scoreSimCard(card, sim, sourceIndex, helpers) }))
    .sort((a, b) => b.score - a.score)[0]?.card;
  if (!target) return;
  const index = discard.findIndex(card => card.id === target.id);
  if (index < 0) return;
  const [card] = discard.splice(index, 1);
  card.exhausted = false;
  card.attacksThisTurn = 0;
  sim.players[toIndex].board.push(card);
}

function resolveSimAttack(sim, attackerId, attackerIndex, helpers) {
  resolveSingleSimAttack(sim, attackerId, attackerIndex, helpers);
  updateSimWinner(sim);
  if (sim.winner !== null) return;
  const attacker = sim.players[attackerIndex].board.find(card => card.id === attackerId);
  if (!attacker) return;

  const keywords = simKeywords(attacker, sim, attackerIndex, helpers);
  if (keywords.includes("FRENZY") && attacker.attacksThisTurn === 1 && !attacker.exhausted) {
    resolveSingleSimAttack(sim, attackerId, attackerIndex, helpers);
    updateSimWinner(sim);
  }

  const finalAttacker = sim.players[attackerIndex].board.find(card => card.id === attackerId);
  if (finalAttacker) finalAttacker.exhausted = true;
}

function resolveSingleSimAttack(sim, attackerId, attackerIndex, helpers) {
  const defenderIndex = 1 - attackerIndex;
  const attacker = sim.players[attackerIndex].board.find(card => card.id === attackerId);
  if (!attacker) return;

  applySimAttackAbility(sim, attacker, attackerIndex, defenderIndex, helpers);
  updateSimWinner(sim);
  if (sim.winner !== null) return;

  const before = evaluateState(sim, attackerIndex, helpers);
  let best = { sim: null, score: -Infinity };
  const faceSim = cloneState(sim);
  resolveSimFaceAttack(faceSim, attackerId, attackerIndex, helpers);
  best = { sim: faceSim, score: evaluateState(faceSim, attackerIndex, helpers) };

  if (simKeywords(attacker, sim, attackerIndex, helpers).includes("HUNTER")) {
    for (const target of sim.players[defenderIndex].board) {
      const hunterSim = cloneState(sim);
      simCombat(hunterSim, attackerId, target.id, attackerIndex, defenderIndex, helpers);
      const stillThere = hunterSim.players[attackerIndex].board.find(card => card.id === attackerId);
      if (stillThere) stillThere.attacksThisTurn += 1;
      const score = evaluateState(hunterSim, attackerIndex, helpers)
        + simHunterSneakyTargetBonus(target, sim, helpers, attackerIndex, defenderIndex);
      if (score > best.score) best = { sim: hunterSim, score };
    }
  }

  copySimInto(sim, best.score > before ? best.sim : faceSim);
}

function simHunterSneakyTargetBonus(target, sim, helpers, attackerIndex, defenderIndex) {
  const targetKeywords = simKeywords(target, sim, defenderIndex, helpers);
  if (!targetKeywords.includes("SNEAKY")) return 0;
  const hasSneakyBlocker = sim.players[attackerIndex].board
    .some(card => simKeywords(card, sim, attackerIndex, helpers).includes("SNEAKY"));
  let bonus = 38;
  if (!hasSneakyBlocker) bonus += 42;
  if (canSimAttack(target, sim, defenderIndex, helpers)) bonus += 18;
  if (sim.players[attackerIndex].life <= 2) bonus += 32;
  return bonus;
}

function applySimAttackAbility(sim, attacker, attackerIndex, defenderIndex, helpers) {
  if (!helpers.creatureAbilitiesEnabled) return;
  const defender = sim.players[defenderIndex];
  if (attacker.name === "Shark Dog") {
    defeatBestSimTarget(sim, defenderIndex, helpers, card => simPower(card, sim, defenderIndex, helpers) >= 6);
  }
  if (attacker.name === "Chameleon Sniper") {
    defender.life -= 1;
  }
  if (attacker.name === "Turbo Bug" && defender.life > 1) {
    defender.life = 1;
  }
  if (attacker.name === "Tusked Exporter") {
    discardWorstSimCard(sim, defenderIndex, helpers);
  }
  if (attacker.name === "Frosty Fortress") {
    while (defender.hand.length) defender.discard.push(defender.hand.shift());
    drawSimToFive(defender);
  }
  if (attacker.name === "Count Draculeech") {
    sim.players[attackerIndex].life -= 1;
    if (defender.board.length) {
      defeatBestSimTarget(sim, defenderIndex, helpers, () => true);
    } else {
      const ownTarget = sim.players[attackerIndex].board
        .map(card => ({ card, score: scoreSimCard(card, sim, attackerIndex, helpers) }))
        .sort((a, b) => a.score - b.score)[0]?.card;
      if (ownTarget) simDefeatCreature(sim, ownTarget.id, attackerIndex, helpers);
    }
  }
  if (attacker.name === "Majestic Manticore") {
    const creaturesInPlay = sim.players.flatMap((player, ownerIndex) => (
      player.board.map(card => ({
        card,
        ownerIndex,
        power: simPower(card, sim, ownerIndex, helpers)
      }))
    ));
    const lowestPower = Math.min(...creaturesInPlay.map(target => target.power));
    for (const target of creaturesInPlay) {
      if (target.power !== lowestPower) continue;
      const currentOwnerIndex = sim.players.findIndex(player => player.board.some(card => card.id === target.card.id));
      if (currentOwnerIndex >= 0) simDefeatCreature(sim, target.card.id, currentOwnerIndex, helpers);
    }
  }
  if (attacker.name === "Turf The Surfer") {
    const target = defender.board
      .map(card => ({ card, score: scoreSimCard(card, sim, defenderIndex, helpers) }))
      .sort((a, b) => b.score - a.score)[0]?.card;
    if (target) target.cannotBlockThisTurn = true;
  }
  if (attacker.name === "The Lurker" && sim.players[attackerIndex].board.length > defender.board.length) {
    attacker.lurkerSneakyThisTurn = true;
  }
}

function defeatBestSimTarget(sim, targetOwnerIndex, helpers, predicate) {
  const target = sim.players[targetOwnerIndex].board
    .filter(predicate)
    .map(card => ({ card, score: scoreSimCard(card, sim, targetOwnerIndex, helpers) }))
    .sort((a, b) => b.score - a.score)[0]?.card;
  if (target) simDamageOrDefeat(sim, target.id, targetOwnerIndex, helpers);
}

function discardWorstSimCard(sim, playerIndex, helpers) {
  discardWorstSimCards(sim, playerIndex, helpers, 1);
}

function discardWorstSimCards(sim, playerIndex, helpers, amount) {
  const player = sim.players[playerIndex];
  let discardedCount = 0;
  for (let i = 0; i < amount && player.hand.length; i += 1) {
    const worst = player.hand
      .map(card => ({ card, score: scoreSimCard(card, sim, playerIndex, helpers) }))
      .sort((a, b) => a.score - b.score)[0];
    const index = player.hand.findIndex(card => card.id === worst.card.id);
    if (index >= 0) {
      player.discard.push(player.hand.splice(index, 1)[0]);
      discardedCount += 1;
    }
  }
  if (discardedCount > 0) drawSimToFive(player);
}

function resolveSimFaceAttack(sim, attackerId, attackerIndex, helpers) {
  const defenderIndex = 1 - attackerIndex;
  const attacker = sim.players[attackerIndex].board.find(card => card.id === attackerId);
  if (!attacker) return;

  const blockers = simLegalBlockers(sim, attacker, attackerIndex, defenderIndex, helpers);
  const blocker = chooseBestSimBlocker(sim, blockers, attacker, attackerIndex, defenderIndex, helpers);
  if (blocker) {
    simCombat(sim, attacker.id, blocker.id, attackerIndex, defenderIndex, helpers);
  } else {
    sim.players[defenderIndex].life -= simUnblockedDamage(attacker, sim, attackerIndex, defenderIndex, helpers);
  }
  const stillThere = sim.players[attackerIndex].board.find(card => card.id === attackerId);
  if (stillThere) stillThere.attacksThisTurn += 1;
}

function copySimInto(target, source) {
  target.winner = source.winner;
  target.players = source.players;
}

function shouldSimMindbug(card, sim, opponentIndex, helpers) {
  const opponent = sim.players[opponentIndex];
  if (opponent.mindbugs <= 0) return false;
  // Learned from self-play: stealing Goreagle Alpha at 1 LP immediately loses
  // to its Play cost, so Power alone must never trigger a Mindbug here.
  if (helpers.creatureAbilitiesEnabled && card.name === "Goreagle Alpha" && opponent.life <= 1) return false;
  const value = scoreSimCard(card, sim, opponentIndex, helpers);
  const playerIndex = 1 - opponentIndex;
  const pressure = opponent.life <= 1 || sim.players[playerIndex].life <= 1;
  const passSim = cloneState(sim);
  passSim.players[playerIndex].board.push(cloneCard(card));
  applySimPlayAbility(passSim, card, playerIndex, opponentIndex, helpers);
  const passDanger = simTotalFaceDamage(passSim, playerIndex, helpers);
  const stealSim = cloneState(sim);
  stealSim.players[opponentIndex].board.push(cloneCard(card));
  applySimPlayAbility(stealSim, card, opponentIndex, playerIndex, helpers);
  const selfDanger = simTotalFaceDamage(stealSim, playerIndex, helpers);
  const abilityThreat = simPlayAbilitySwing(card, sim, playerIndex, opponentIndex, helpers);
  let threshold = pressure ? 7 : 10;
  if (opponent.mindbugs <= 1 && !pressure) threshold += 3;
  if (abilityThreat >= 25) threshold -= 2;
  if (passDanger >= opponent.life) threshold -= 5;
  if (selfDanger >= opponent.life && passDanger < opponent.life) threshold += 8;
  return value + abilityThreat * 0.35 + Math.max(0, passDanger - selfDanger) * 18 >= threshold;
}

function simPlayAbilitySwing(card, sim, playerIndex, opponentIndex, helpers) {
  if (!helpers.creatureAbilitiesEnabled || card.ability === "NONE") return 0;
  const player = sim.players[playerIndex];
  const opponent = sim.players[opponentIndex];
  switch (card.name) {
    case "Killer Bee":
      return opponent.life <= 1 ? 80 : 18;
    case "Ferret Bomber":
      return Math.min(2, opponent.hand.length) * 16;
    case "Hungry Hungry Hamster":
      return opponent.hand.length ? 18 : 0;
    case "Axolotl Healer":
      return player.life <= 2 ? 22 : 8;
    case "Mysterious Mermaid":
      return Math.max(0, opponent.life - player.life) * 18;
    case "Brain Fly":
      return opponent.board.some(target => simPower(target, sim, opponentIndex, helpers) >= 6) ? 32 : 0;
    case "Kangasaurus Rex":
      return opponent.board.filter(target => simPower(target, sim, opponentIndex, helpers) <= 4).length * 15;
    case "Tiger Squirrel":
      return opponent.board.some(target => simPower(target, sim, opponentIndex, helpers) >= 7) ? 28 : 0;
    case "Goreagle Alpha":
      return player.life <= 1 ? -60 : 6;
    default:
      return 6;
  }
}

function simLegalBlockers(sim, attacker, attackerIndex, defenderIndex, helpers) {
  const attackerKeywords = simKeywords(attacker, sim, attackerIndex, helpers);
  return sim.players[defenderIndex].board.filter(blocker => {
    if (blocker.cannotBlockThisTurn) return false;
    if (attackerKeywords.includes("SNEAKY") && !simKeywords(blocker, sim, defenderIndex, helpers).includes("SNEAKY")) return false;
    if (helpers.creatureAbilitiesEnabled && attacker.name === "Bee Bear" && simPower(blocker, sim, defenderIndex, helpers) <= 6) return false;
    if (helpers.creatureAbilitiesEnabled && sim.players[attackerIndex].board.some(card => card.name === "Elephantopus") && simPower(blocker, sim, defenderIndex, helpers) <= 4) return false;
    if (helpers.creatureAbilitiesEnabled && sim.players[attackerIndex].board.some(card => card.name === "Ferret Pacifier")) {
      const highestPower = Math.max(...sim.players[defenderIndex].board.map(card => simPower(card, sim, defenderIndex, helpers)));
      if (simPower(blocker, sim, defenderIndex, helpers) === highestPower) return false;
    }
    return true;
  });
}

function chooseBestSimBlocker(sim, blockers, attacker, attackerIndex, defenderIndex, helpers) {
  const scored = blockers
    .map(blocker => ({ blocker, score: scoreSimBlock(blocker, attacker, sim, attackerIndex, defenderIndex, helpers) }))
    .sort((a, b) => b.score - a.score)[0];
  const defenderLifeAfterPass = sim.players[defenderIndex].life - 1;
  if (scored && defenderLifeAfterPass <= 0) return scored.blocker;
  if (scored && !simHasImmediateWin(sim, defenderIndex, helpers)) return scored.blocker;
  return scored && scored.score > 0 ? scored.blocker : null;
}

function simCombat(sim, attackerId, blockerId, attackerIndex, blockerIndex, helpers) {
  const attacker = sim.players[attackerIndex].board.find(card => card.id === attackerId);
  const blocker = sim.players[blockerIndex].board.find(card => card.id === blockerId);
  if (!attacker || !blocker) return;

  const attackerPower = simPower(attacker, sim, attackerIndex, helpers);
  const blockerPower = simPower(blocker, sim, blockerIndex, helpers);
  const attackerPoison = simKeywords(attacker, sim, attackerIndex, helpers).includes("POISONOUS");
  const blockerPoison = simKeywords(blocker, sim, blockerIndex, helpers).includes("POISONOUS");
  const defeatAttacker = blockerPoison || blockerPower >= attackerPower;
  const defeatBlocker = attackerPoison || attackerPower >= blockerPower;

  if (defeatAttacker) simDamageOrDefeat(sim, attackerId, attackerIndex, helpers);
  if (defeatBlocker) simDamageOrDefeat(sim, blockerId, blockerIndex, helpers);
}

function simDamageOrDefeat(sim, cardId, ownerIndex, helpers) {
  const board = sim.players[ownerIndex].board;
  const index = board.findIndex(card => card.id === cardId);
  if (index < 0) return;
  const card = board[index];
  if (simKeywords(card, sim, ownerIndex, helpers).includes("TOUGH") && card.damage < 1) {
    card.damage += 1;
    return;
  }
  const [defeated] = board.splice(index, 1);
  defeated.damage = 0;
  defeated.exhausted = false;
  defeated.attacksThisTurn = 0;
  sim.players[ownerIndex].discard.push(defeated);
  applySimDefeatedAbility(sim, defeated, ownerIndex, helpers);
}

function simDefeatCreature(sim, cardId, ownerIndex, helpers) {
  const board = sim.players[ownerIndex].board;
  const index = board.findIndex(card => card.id === cardId);
  if (index < 0) return;
  const [defeated] = board.splice(index, 1);
  defeated.damage = 0;
  defeated.exhausted = false;
  defeated.attacksThisTurn = 0;
  sim.players[ownerIndex].discard.push(defeated);
  applySimDefeatedAbility(sim, defeated, ownerIndex, helpers);
}

function applySimDefeatedAbility(sim, defeated, ownerIndex, helpers) {
  if (!helpers.creatureAbilitiesEnabled) return;
  if (defeated.name === "Strange Barrel") {
    stealBestSimCards(sim, ownerIndex, 1 - ownerIndex, helpers, 2);
    return;
  }
  if (defeated.name !== "Explosive Toad") return;
  const targetOwnerIndex = 1 - ownerIndex;
  const target = sim.players[targetOwnerIndex].board
    .map(card => ({ card, score: scoreSimCard(card, sim, targetOwnerIndex, helpers) }))
    .sort((a, b) => b.score - a.score)[0]?.card;
  if (target) simDamageOrDefeat(sim, target.id, targetOwnerIndex, helpers);
}

function stealBestSimCards(sim, toIndex, fromIndex, helpers, amount) {
  const from = sim.players[fromIndex];
  const to = sim.players[toIndex];
  for (let i = 0; i < amount && from.hand.length; i += 1) {
    const best = from.hand
      .map(card => ({ card, score: scoreSimCard(card, sim, fromIndex, helpers) }))
      .sort((a, b) => b.score - a.score)[0];
    const index = from.hand.findIndex(card => card.id === best.card.id);
    if (index >= 0) to.hand.push(from.hand.splice(index, 1)[0]);
  }
}

function scoreSimBlock(blocker, attacker, sim, attackerIndex, blockerIndex, helpers) {
  const blockerPower = simPower(blocker, sim, blockerIndex, helpers);
  const attackerPower = simPower(attacker, sim, attackerIndex, helpers);
  const blockerKeywords = simKeywords(blocker, sim, blockerIndex, helpers);
  const attackerKeywords = simKeywords(attacker, sim, attackerIndex, helpers);
  const killsAttacker = blockerKeywords.includes("POISONOUS") || blockerPower >= attackerPower;
  const losesBlocker = attackerKeywords.includes("POISONOUS") || attackerPower >= blockerPower;
  const lifeAfterPass = sim.players[blockerIndex].life - 1;
  let score = 3 + 28;
  if (lifeAfterPass <= 0) score += 1000;
  if (lifeAfterPass === 1) score += 60;
  if (lifeAfterPass === 2) score += 20;
  if (killsAttacker) score += scoreSimCard(attacker, sim, attackerIndex, helpers);
  if (losesBlocker) score -= scoreSimCard(blocker, sim, blockerIndex, helpers);
  return score;
}

function scoreSimCard(card, sim, ownerIndex, helpers) {
  let score = simPower(card, sim, ownerIndex, helpers);
  const keywords = simKeywords(card, sim, ownerIndex, helpers);
  if (keywords.includes("POISONOUS")) score += 4;
  if (keywords.includes("TOUGH")) score += card.damage ? 1 : 3;
  if (keywords.includes("FRENZY")) score += 3;
  if (keywords.includes("SNEAKY")) score += 2 + simSneakyPressureBonus(card, sim, ownerIndex, helpers);
  if (keywords.includes("HUNTER")) score += 2;
  if (helpers.creatureAbilitiesEnabled && card.ability !== "NONE") score += 2;
  return score;
}

function simFacePressure(sim, ownerIndex, helpers) {
  const defenderIndex = 1 - ownerIndex;
  const defender = sim.players[defenderIndex];
  return sim.players[ownerIndex].board.reduce((sum, card) => {
    if (!canSimAttack(card, sim, ownerIndex, helpers)) return sum;
    const damage = simProjectedFaceDamage(card, sim, ownerIndex, defenderIndex, helpers);
    if (damage <= 0) return sum;
    return sum + damage * (14 + Math.max(0, 3 - defender.life) * 7);
  }, 0);
}

function simMaxFaceDamage(sim, ownerIndex, helpers) {
  const defenderIndex = 1 - ownerIndex;
  return sim.players[ownerIndex].board.reduce((maxDamage, card) => {
    if (!canSimAttack(card, sim, ownerIndex, helpers)) return maxDamage;
    return Math.max(maxDamage, simProjectedFaceDamage(card, sim, ownerIndex, defenderIndex, helpers));
  }, 0);
}

function simTotalFaceDamage(sim, ownerIndex, helpers) {
  const defenderIndex = 1 - ownerIndex;
  const attackers = sim.players[ownerIndex].board.filter(card => canSimAttack(card, sim, ownerIndex, helpers));
  let total = 0;
  const defender = cloneState(sim);
  for (const attacker of attackers) {
    const liveAttacker = defender.players[ownerIndex].board.find(card => card.id === attacker.id);
    if (!liveAttacker || !canSimAttack(liveAttacker, defender, ownerIndex, helpers)) continue;
    const blockers = simLegalBlockers(defender, liveAttacker, ownerIndex, defenderIndex, helpers);
    const blocker = chooseBestSimBlocker(defender, blockers, liveAttacker, ownerIndex, defenderIndex, helpers);
    if (blocker) {
      simCombat(defender, liveAttacker.id, blocker.id, ownerIndex, defenderIndex, helpers);
    } else {
      total += simUnblockedDamage(liveAttacker, defender, ownerIndex, defenderIndex, helpers);
      if (helpers.creatureAbilitiesEnabled && liveAttacker.name === "Chameleon Sniper") total += 1;
      if (helpers.creatureAbilitiesEnabled && liveAttacker.name === "Turbo Bug" && defender.players[defenderIndex].life - total > 1) {
        total += Math.max(0, defender.players[defenderIndex].life - total - 1);
      }
    }
  }
  return total;
}

function simDefenseCoverage(sim, defenderIndex, helpers) {
  const attackerIndex = 1 - defenderIndex;
  const incoming = sim.players[attackerIndex].board.filter(card => canSimAttack(card, sim, attackerIndex, helpers));
  if (!incoming.length) return 1;
  let covered = 0;
  for (const attacker of incoming) {
    if (simLegalBlockers(sim, attacker, attackerIndex, defenderIndex, helpers).length) covered += 1;
  }
  return covered / incoming.length;
}

function simProjectedFaceDamage(card, sim, ownerIndex, defenderIndex, helpers) {
  let damage = 0;
  if (helpers.creatureAbilitiesEnabled && card.name === "Chameleon Sniper") damage += 1;
  if (helpers.creatureAbilitiesEnabled && card.name === "Turbo Bug" && sim.players[defenderIndex].life > 1) {
    damage += sim.players[defenderIndex].life - 1;
  }
  if (simLegalBlockers(sim, card, ownerIndex, defenderIndex, helpers).length === 0) {
    damage += simUnblockedDamage(card, sim, ownerIndex, defenderIndex, helpers);
  }
  return damage;
}

function simUnblockedDamage(card, sim, ownerIndex, defenderIndex, helpers) {
  return 1;
}

function simSneakyPressureBonus(card, sim, ownerIndex, helpers) {
  const keywords = simKeywords(card, sim, ownerIndex, helpers);
  if (!keywords.includes("SNEAKY")) return 0;
  const defenderIndex = 1 - ownerIndex;
  const hasSneakyBlocker = sim.players[defenderIndex].board
    .some(blocker => simKeywords(blocker, sim, defenderIndex, helpers).includes("SNEAKY"));
  if (hasSneakyBlocker) return 3;
  const defenderLife = sim.players[defenderIndex].life;
  return 10 + Math.max(0, 3 - defenderLife) * 5;
}

function simPower(card, sim, ownerIndex, helpers) {
  if (!helpers.creatureAbilitiesEnabled) return card.basePower;
  const owner = sim.players[ownerIndex];
  let power = card.basePower;
  if (card.name === "Goblin Werewolf" && ownerIndex === sim.active) power += 6;
  if (card.name === "Lone Yeti" && owner.board.length === 1) power += 5;
  if (card.name === "Bugserker" && owner.life === 1) power += 8;
  if (card.name === "Froblin Instigator") power += Math.max(0, owner.board.length - 1) * 2;
  for (const ally of owner.board) {
    if (ally.id === card.id) continue;
    if (ally.name === "Shield Bugs") power += 1;
    if (ally.name === "Urchin Hurler" && ownerIndex === sim.active) power += 2;
  }
  return power;
}

function simKeywords(card, sim, ownerIndex, helpers, visited = new Set()) {
  const visitKey = `${ownerIndex}:${card.id}`;
  if (visited.has(visitKey)) return [...card.keywords];
  visited.add(visitKey);
  const set = new Set(card.keywords);
  if (!helpers.creatureAbilitiesEnabled) return [...set];
  const owner = sim.players[ownerIndex];
  const enemy = sim.players[1 - ownerIndex];
  if (card.name === "Lone Yeti" && owner.board.length === 1) set.add("FRENZY");
  if (card.name === "The Lurker" && card.lurkerSneakyThisTurn) set.add("SNEAKY");
  if (card.name === "Shark Crab-Dog Mummypus") {
    const enemyKeywords = enemy.board.flatMap(enemyCard => simKeywords(enemyCard, sim, 1 - ownerIndex, helpers, new Set(visited)));
    for (const keyword of ["HUNTER", "SNEAKY", "FRENZY", "POISONOUS"]) {
      if (enemyKeywords.includes(keyword)) set.add(keyword);
    }
  }
  const thrower = owner.board.find(ally => ally.name === "Snail Thrower");
  if (thrower && thrower.id !== card.id && simPower(card, sim, ownerIndex, helpers) <= 4) {
    set.add("HUNTER");
    set.add("POISONOUS");
  }
  return [...set];
}

function chooseMindbug(card, state, helpers, botIndex, config) {
  const { searchLimitMs, mindbugDepth, branchLimit } = config;
  const deadline = Date.now() + searchLimitMs;
  const enemyIndex = 1 - botIndex;
  const stealSim = cloneState(state);
  const passSim = cloneState(state);
  const stolenCard = cloneCard(card);
  const passedCard = cloneCard(card);

  stealSim.players[botIndex].mindbugs = Math.max(0, stealSim.players[botIndex].mindbugs - 1);
  stealSim.players[botIndex].board.push(stolenCard);
  passSim.players[enemyIndex].board.push(passedCard);

  const stealScore = searchPath(stealSim, enemyIndex, botIndex, helpers, deadline, mindbugDepth, branchLimit, -Infinity, Infinity);
  const passScore = Date.now() >= deadline
    ? evaluateState(passSim, botIndex, helpers)
    : searchPath(passSim, botIndex, botIndex, helpers, deadline, mindbugDepth, branchLimit, -Infinity, Infinity);

  const stolenDanger = simTotalFaceDamage(stealSim, enemyIndex, helpers);
  const passDanger = simTotalFaceDamage(passSim, enemyIndex, helpers);
  const mindbugCost = state.players[botIndex].mindbugs <= 1 ? 12 : 5;
  const emergencyBonus = passDanger >= state.players[botIndex].life ? 240 : passDanger >= state.players[botIndex].life - 1 ? 80 : 0;
  const stealPenalty = stolenDanger >= state.players[botIndex].life ? 160 : stolenDanger * 22;
  return stealScore + emergencyBonus - stealPenalty - mindbugCost > passScore ? "steal" : "pass";
}

function scoreAttack(card, state, helpers) {
  const enemyIndex = 0;
  const enemy = state.players[enemyIndex];
  let score = helpers.cardPower(card, 1) + 2;
  if (helpers.canDealDirectDamage(card, 1, enemyIndex)) score += 10 + Math.max(0, 3 - enemy.life) * 6;
  if (helpers.cardKeywords(card, 1).includes("FRENZY") && card.attacksThisTurn === 0) score += 3;
  if (helpers.cardKeywords(card, 1).includes("HUNTER") && enemy.board.length) score += 2;
  if (helpers.creatureAbilitiesEnabled) {
    if (card.name === "Shark Dog") score += enemy.board.filter(c => helpers.cardPower(c, enemyIndex) >= 6).length * 7;
    if (card.name === "Turbo Bug" && enemy.life > 1) score += 8;
    if (card.name === "Chameleon Sniper") score += 5;
    if (card.name === "Tusked Exporter" && enemy.hand.length) score += 3;
  }
  return score;
}

function scorePlay(card, state, helpers) {
  const bot = state.players[1];
  const enemy = state.players[0];
  let score = scoreCard(card, state, helpers, 1);
  if (helpers.creatureAbilitiesEnabled) {
    if (card.name === "Killer Bee" && enemy.life <= 1) score += 20;
    if (card.name === "Brain Fly" && enemy.board.some(c => helpers.cardPower(c, 0) >= 6)) score += 9;
    if (card.name === "Kangasaurus Rex") score += enemy.board.filter(c => helpers.cardPower(c, 0) <= 4).length * 4;
    if (card.name === "Tiger Squirrel" && enemy.board.some(c => helpers.cardPower(c, 0) >= 7)) score += 6;
    if (card.name === "Ferret Bomber" && enemy.hand.length >= 2) score += 5;
    if (card.name === "Axolotl Healer" && bot.life <= 2) score += 5;
    if (card.name === "Mysterious Mermaid" && bot.life < enemy.life) score += 4;
    if (card.name === "Giraffodile" && bot.discard.length >= 2) score += 5;
    if (card.name === "Compost Dragon" && bot.discard.length) score += 4;
  }
  return score;
}

function scoreBlock(blocker, attacker, state, helpers) {
  const blockerPower = helpers.cardPower(blocker, 1);
  const attackerPower = helpers.cardPower(attacker, 0);
  const blockerKeywords = helpers.cardKeywords(blocker, 1);
  const attackerKeywords = helpers.cardKeywords(attacker, 0);
  const attackerOutpowered = blockerPower >= attackerPower;
  const blockerOutpowered = attackerPower >= blockerPower;
  const killsAttacker = blockerKeywords.includes("POISONOUS") || attackerOutpowered;
  const losesBlocker = attackerKeywords.includes("POISONOUS") || blockerOutpowered;
  const lifeAfterPass = state.players[1].life - 1;
  let score = 3 + 28;
  if (lifeAfterPass <= 0) score += 1000;
  if (lifeAfterPass === 1) score += 60;
  if (lifeAfterPass === 2) score += 20;
  if (killsAttacker) score += scoreCard(attacker, state, helpers, 0);
  if (losesBlocker) score -= scoreCard(blocker, state, helpers, 1);
  return score;
}

function hasImmediateWin(state, helpers, attackerIndex) {
  const attacker = state.players[attackerIndex];
  const defenderIndex = 1 - attackerIndex;
  const defender = state.players[defenderIndex];
  if (attacker.board.some(card => helpers.canAttack(card, attackerIndex)
    && helpers.canDealDirectDamage(card, attackerIndex, defenderIndex)
    && defender.life <= helpers.directDamage(card))) {
    return true;
  }
  return attacker.hand.some(card => helpers.creatureAbilitiesEnabled
    && card.name === "Killer Bee"
    && defender.life <= 1);
}

function simHasImmediateWin(sim, attackerIndex, helpers) {
  const defenderIndex = 1 - attackerIndex;
  const defender = sim.players[defenderIndex];
  if (sim.players[attackerIndex].board.some(card => canSimAttack(card, sim, attackerIndex, helpers)
    && simProjectedFaceDamage(card, sim, attackerIndex, defenderIndex, helpers) >= defender.life)) {
    return true;
  }
  return sim.players[attackerIndex].hand.some(card => helpers.creatureAbilitiesEnabled
    && card.name === "Killer Bee"
    && defender.life <= 1);
}

function scoreCard(card, state, helpers, ownerIndex) {
  let score = helpers.cardPower(card, ownerIndex);
  const keywords = helpers.cardKeywords(card, ownerIndex);
  if (keywords.includes("POISONOUS")) score += 4;
  if (keywords.includes("TOUGH")) score += 3;
  if (keywords.includes("FRENZY")) score += 3;
  if (keywords.includes("SNEAKY")) score += 2 + realSneakyPressureBonus(card, state, helpers, ownerIndex);
  if (keywords.includes("HUNTER")) score += 2;
  if (helpers.creatureAbilitiesEnabled) {
    if (card.ability !== "NONE") score += 2;
    if (["Brain Fly", "Harpy Mother", "Kangasaurus Rex", "Turbo Bug", "Killer Bee"].includes(card.name)) score += 4;
  }
  return score;
}

function realSneakyPressureBonus(card, state, helpers, ownerIndex) {
  const keywords = helpers.cardKeywords(card, ownerIndex);
  if (!keywords.includes("SNEAKY")) return 0;
  const defenderIndex = 1 - ownerIndex;
  const hasSneakyBlocker = state.players[defenderIndex].board
    .some(blocker => helpers.cardKeywords(blocker, defenderIndex).includes("SNEAKY"));
  if (hasSneakyBlocker) return 3;
  return 10 + Math.max(0, 3 - state.players[defenderIndex].life) * 5;
}

function realTotalFaceThreat(state, attackerIndex, helpers) {
  const sim = cloneState(state);
  readySimTurn(sim, attackerIndex);
  return simTotalFaceDamage(sim, attackerIndex, helpers);
}

function loadStrategyMemory(botIndex) {
  if (typeof window === "undefined") return { botIndex, entries: {} };
  try {
    const raw = window.localStorage?.getItem(`mindbug.botStrategyMemory.${botIndex}`);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && parsed.entries) return parsed;
  } catch {
    // Strategy memory is optional.
  }
  return { botIndex, entries: {} };
}

function saveStrategyMemory(memory) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(`mindbug.botStrategyMemory.${memory.botIndex}`, JSON.stringify(memory));
  } catch {
    // localStorage can be unavailable; ignore memory persistence.
  }
}

function strategySignature(sim, action, botIndex) {
  const bot = sim.players[botIndex];
  const enemy = sim.players[1 - botIndex];
  const actionCard = action.type === "play"
    ? bot.hand.find(card => card.id === action.cardId)
    : bot.board.find(card => card.id === action.cardId);
  const botBoard = bot.board.map(card => card.name).sort().slice(0, 4).join(",");
  const enemyBoard = enemy.board.map(card => card.name).sort().slice(0, 4).join(",");
  return [
    action.type,
    actionCard?.name ?? "",
    `lp${bot.life}-${enemy.life}`,
    `mb${bot.mindbugs}-${enemy.mindbugs}`,
    `b:${botBoard}`,
    `e:${enemyBoard}`
  ].join("|");
}

function strategyMemoryBias(memory, sim, action, botIndex) {
  const entry = memory?.entries?.[strategySignature(sim, action, botIndex)];
  if (!entry) return 0;
  const searchBias = entry.score / 60;
  const outcomeBias = Number(entry.outcomeScore ?? 0) * Math.min(1, Number(entry.outcomeSamples ?? 0) / 4);
  return Math.max(-24, Math.min(24, searchBias + outcomeBias));
}

function rememberStrategy(memory, sim, action, score, botIndex) {
  if (!memory?.entries || !action || action.type === "pass") return;
  const key = strategySignature(sim, action, botIndex);
  const current = memory.entries[key] ?? { score: 0, uses: 0 };
  current.score = (current.score * 0.72) + (score * 0.28);
  current.uses = Math.min(999, current.uses + 1);
  current.updatedAt = Date.now();
  memory.entries[key] = current;
  const entries = Object.entries(memory.entries)
    .sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0))
    .slice(0, 300);
  memory.entries = Object.fromEntries(entries);
  saveStrategyMemory(memory);
}

function learnFromCompletedGame(memory, episode, winnerIndex, botIndex) {
  const totalMoves = episode.length;
  const decisiveMoves = [];
  for (let index = 0; index < totalMoves; index += 1) {
    const move = episode[index];
    const distanceFromEnd = totalMoves - 1 - index;
    if (distanceFromEnd > 11) continue;
    const didWin = move.actorIndex === winnerIndex;
    const recency = Math.exp(-distanceFromEnd / 4);
    const reward = (didWin ? 14 : -8) * recency;
    const entry = memory.entries[move.signature] ?? { score: 0, uses: 0 };
    const samples = Number(entry.outcomeSamples ?? 0);
    entry.outcomeScore = ((Number(entry.outcomeScore ?? 0) * Math.min(samples, 11)) + reward)
      / (Math.min(samples, 11) + 1);
    entry.outcomeSamples = Math.min(999, samples + 1);
    entry.wins = Number(entry.wins ?? 0) + (didWin ? 1 : 0);
    entry.losses = Number(entry.losses ?? 0) + (didWin ? 0 : 1);
    entry.updatedAt = Date.now();
    memory.entries[move.signature] = entry;
    if (didWin && distanceFromEnd <= 7) {
      decisiveMoves.push({
        action: move.actionType,
        card: move.cardName,
        actorLife: move.actorLife,
        enemyLife: move.enemyLife,
        distanceFromEnd,
        weight: Number(recency.toFixed(3))
      });
    }
  }
  memory.completedGames = Math.min(100, Number(memory.completedGames ?? 0) + 1);
  memory.lastCompletedAt = Date.now();
  const entries = Object.entries(memory.entries)
    .sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0))
    .slice(0, 300);
  memory.entries = Object.fromEntries(entries);
  saveStrategyMemory(memory);
  saveLearningGame({
    playedAt: Date.now(),
    winnerIndex,
    botWon: winnerIndex === botIndex,
    totalMoves,
    decisiveMoves
  });
}

function saveLearningGame(game) {
  if (typeof window === "undefined") return;
  try {
    const storageKey = "mindbug.botLearningGames.v1";
    const raw = window.localStorage?.getItem(storageKey);
    const games = raw ? JSON.parse(raw) : [];
    const next = [...(Array.isArray(games) ? games : []), game].slice(-100);
    window.localStorage?.setItem(storageKey, JSON.stringify(next));
  } catch {
    // Learning history is optional when storage is unavailable.
  }
}
