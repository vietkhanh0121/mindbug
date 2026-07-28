export class GameAnimations {
  constructor({ hitDuration = 420, lifeDuration = 760, attackDuration = 360, screenShakeDuration = 220 } = {}) {
    this.hitDuration = hitDuration;
    this.lifeDuration = lifeDuration;
    this.attackDuration = attackDuration;
    this.screenShakeDuration = screenShakeDuration;
  }

  wait(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  scaledDuration(ms) {
    const value = window.getComputedStyle(document.documentElement).getPropertyValue("--card-hit-duration").trim();
    const scaledHit = Number.parseFloat(value);
    if (!scaledHit || !this.hitDuration) return ms;
    return ms * (scaledHit / this.hitDuration);
  }

  cardElement(cardId) {
    return document.querySelector(`.fieldCards [data-card-id="${cardId}"]`);
  }

  makeAttackClone(source) {
    const rect = source.getBoundingClientRect();
    const clone = source.cloneNode(true);
    clone.removeAttribute("data-card-id");
    clone.className = "card attackFlyClone";
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    document.body.append(clone);
    return { clone, rect };
  }

  center(rect) {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  async attackFace(attackerId, attackerIndex) {
    if (attackerIndex === 1) {
      await this.screenImpact();
      return;
    }
    const app = document.querySelector(".app");
    app?.classList.add("screenShake");
    await this.wait(this.scaledDuration(this.screenShakeDuration));
    app?.classList.remove("screenShake");
  }

  async screenImpact() {
    const app = document.querySelector(".app");
    app?.classList.remove("directHitFlash");
    void app?.offsetWidth;
    app?.classList.add("directHitFlash");
    app?.classList.add("screenShake");
    await this.wait(this.scaledDuration(this.screenShakeDuration));
    app?.classList.remove("screenShake");
    app?.classList.remove("directHitFlash");
  }

  async attackCreature(attackerId, targetId) {
    const target = this.cardElement(targetId);
    if (!target) return;

    target.classList.add("cardHitShake");
    await this.wait(this.scaledDuration(this.hitDuration));
    target.classList.remove("cardHitShake");
  }

  async lifeLoss(playerIndex, amount) {
    const target = document.querySelector(`[data-life-player="${playerIndex}"]`);
    if (!target) return;
    const tag = target.querySelector(".lifeCountTag");
    tag?.classList.remove("lifeCountHit");
    void tag?.offsetWidth;
    tag?.classList.add("lifeCountHit");

    const marker = document.createElement("span");
    marker.className = "lifeLossFloat";
    marker.textContent = `-${amount}`;
    target.append(marker);
    await this.wait(this.lifeDuration);
    tag?.classList.remove("lifeCountHit");
    marker.remove();
  }

  async lifeGain(playerIndex, amount) {
    const target = document.querySelector(`[data-life-player="${playerIndex}"]`);
    if (!target) return;
    const tag = target.querySelector(".lifeCountTag");
    tag?.classList.remove("lifeCountHit");
    void tag?.offsetWidth;
    tag?.classList.add("lifeCountHit");

    const marker = document.createElement("span");
    marker.className = "lifeGainFloat";
    marker.textContent = `+${amount}`;
    target.append(marker);
    await this.wait(this.lifeDuration);
    tag?.classList.remove("lifeCountHit");
    marker.remove();
  }

  async cardHit(cardIds) {
    const cards = cardIds
      .map(id => document.querySelector(`[data-card-id="${id}"]`))
      .filter(Boolean);

    if (!cards.length) return;
    for (const card of cards) card.classList.add("cardHitShake");
    await this.wait(this.hitDuration);
    for (const card of cards) card.classList.remove("cardHitShake");
  }
}
