const canvas = document.getElementById("pitch");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GOAL_WIDTH = 240;
const PLAYER_RADIUS = 12;
const PLAYER_SPEED = 180;
const USER_SPEED = 230;
const SPRINT_SPEED = 320;
const STAMINA_MAX = 100;
const STAMINA_DRAIN_RATE = 28;
const STAMINA_RECOVERY_RATE = 16;
const BALL_RADIUS = 8;
const BALL_FRICTION = 0.98;
const BALL_MAX_SPEED = 520;
const KICK_STRENGTH = 400;
const MATCH_LENGTH = 4 * 60; // 4 perces mérkőzés
const PITCH_MARGIN_X = 40;
const PITCH_MARGIN_Y = 40;
const GAME_VERSION = "v1.4.0";
const GAMEPAD_DEADZONE = 0.2;

const homeScoreEl = document.getElementById("home-score");
const awayScoreEl = document.getElementById("away-score");
const timeEl = document.getElementById("match-time");
const possessionEl = document.getElementById("possession-meter");
const versionEl = document.getElementById("game-version");

const keys = new Set();
let lastKickTime = 0;
let matchTime = 0;
let gameOver = false;
let lastFrame = performance.now();
let controlledPlayer = null;
let previousInputState = null;
let activeGamepadIndex = null;

const possessionTotals = {
  home: 0,
  away: 0,
};

class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  clone() {
    return new Vector2(this.x, this.y);
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  subtract(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  scale(s) {
    this.x *= s;
    this.y *= s;
    return this;
  }

  length() {
    return Math.hypot(this.x, this.y);
  }

  normalize() {
    const len = this.length() || 1;
    this.x /= len;
    this.y /= len;
    return this;
  }

  static from(v) {
    return new Vector2(v.x, v.y);
  }

  static subtract(a, b) {
    return new Vector2(a.x - b.x, a.y - b.y);
  }
}

class Ball {
  constructor() {
    this.position = new Vector2(WIDTH / 2, HEIGHT / 2);
    this.velocity = new Vector2();
  }

  reset(direction = 1) {
    this.position = new Vector2(WIDTH / 2, HEIGHT / 2);
    this.velocity = new Vector2(direction * 90, 0);
  }

  update(dt) {
    this.position.add(Vector2.from(this.velocity).scale(dt));
    this.velocity.scale(BALL_FRICTION);

    if (this.velocity.length() > BALL_MAX_SPEED) {
      this.velocity.normalize().scale(BALL_MAX_SPEED);
    }

    // Falak
    if (this.position.y < BALL_RADIUS) {
      this.position.y = BALL_RADIUS;
      this.velocity.y *= -0.8;
    }
    if (this.position.y > HEIGHT - BALL_RADIUS) {
      this.position.y = HEIGHT - BALL_RADIUS;
      this.velocity.y *= -0.8;
    }

    // Oldalvonalak (kapuk kivételével)
    const goalTop = HEIGHT / 2 - GOAL_WIDTH / 2;
    const goalBottom = HEIGHT / 2 + GOAL_WIDTH / 2;

    if (this.position.x < BALL_RADIUS) {
      if (this.position.y >= goalTop && this.position.y <= goalBottom) {
        scoreGoal("away");
      } else {
        this.position.x = BALL_RADIUS;
        this.velocity.x *= -0.9;
      }
    }

    if (this.position.x > WIDTH - BALL_RADIUS) {
      if (this.position.y >= goalTop && this.position.y <= goalBottom) {
        scoreGoal("home");
      } else {
        this.position.x = WIDTH - BALL_RADIUS;
        this.velocity.x *= -0.9;
      }
    }
  }

  draw() {
    ctx.save();
    ctx.fillStyle = "#f7f7f7";
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#222";
    ctx.stroke();
    ctx.restore();
  }
}

class Player {
  constructor(team, index, basePosition, color, isUser = false) {
    this.team = team;
    this.index = index;
    this.basePosition = { ...basePosition };
    this.position = pitchFromNormalized(basePosition, team.isHome);
    this.velocity = new Vector2();
    this.color = color;
    this.isUser = isUser;
    this.lastDirection = new Vector2(team.isHome ? 1 : -1, 0);
    this.stamina = STAMINA_MAX;
    this.passHeld = false;
    this.shootHeld = false;
  }

  maxSpeed() {
    return this.isUser ? USER_SPEED : PLAYER_SPEED;
  }

  update(dt, ball, inputState = null) {
    if (this.isUser) {
      this.handleUserControl(dt, ball, inputState);
    } else {
      this.handleAI(dt, ball);
    }
    this.position.add(Vector2.from(this.velocity).scale(dt));
    this.keepInsidePitch();
  }

  handleUserControl(dt, ball, inputState) {
    const moveInput = inputState?.move ? inputState.move.clone() : new Vector2();

    if (moveInput.length() > 0) {
      moveInput.normalize();
      const wantsSprint = Boolean(inputState?.sprint);
      let speed = this.maxSpeed();
      if (wantsSprint && this.stamina > 5) {
        speed = SPRINT_SPEED;
        this.stamina = Math.max(0, this.stamina - STAMINA_DRAIN_RATE * dt);
      } else {
        if (!wantsSprint) {
          this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_RECOVERY_RATE * dt);
        }
        if (this.stamina <= 0) {
          speed *= 0.75;
        }
      }
      this.velocity = moveInput.scale(speed);
      this.lastDirection = Vector2.from(moveInput);
    } else {
      this.velocity.scale(0.85);
      this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_RECOVERY_RATE * dt);
    }

    const shootPressed = Boolean(inputState?.shoot);
    if (shootPressed && !this.shootHeld) {
      const now = performance.now();
      if (now - lastKickTime > 220) {
        this.tryKick(ball, 1.1);
        lastKickTime = now;
      }
    }
    this.shootHeld = shootPressed;

    const passPressed = Boolean(inputState?.pass);
    if (passPressed && !this.passHeld) {
      const now = performance.now();
      if (now - lastKickTime > 160) {
        this.tryPass(ball);
        lastKickTime = now;
      }
    }
    this.passHeld = passPressed;
  }

  handleAI(dt, ball) {
    const influence = (ball.position.x / WIDTH - 0.5) * (this.team.isHome ? 0.35 : -0.35);
    const homeMirror = this.team.isHome ? 1 : -1;
    const targetNorm = {
      x: this.basePosition.x + influence * homeMirror,
      y: this.basePosition.y + (ball.position.y / HEIGHT - 0.5) * 0.15,
    };

    const teamInPossession = this.team.hasPossession(ball);
    const isAttacker = this.team.attackingPlayers.includes(this);
    if (teamInPossession && isAttacker) {
      targetNorm.x += 0.06 * homeMirror;
      targetNorm.y += (ball.position.y / HEIGHT - 0.5) * 0.12;
    }

    const target = pitchFromNormalized(targetNorm, this.team.isHome);
    const desired = Vector2.subtract(target, this.position);

    if (desired.length() > 4) {
      desired.normalize().scale(this.maxSpeed() * (0.8 + Math.random() * 0.2));
      this.velocity = desired;
      this.lastDirection = Vector2.from(desired).normalize();
    } else {
      this.velocity.scale(0.8);
    }

    const distanceToBall = Vector2.subtract(ball.position, this.position).length();
    const isDesignatedChaser = this.team.currentChasers.includes(this);
    const pressingRadius = isDesignatedChaser ? 260 : 120;
    const shouldChaseBall =
      distanceToBall < PLAYER_RADIUS * 3 ||
      (isDesignatedChaser && distanceToBall < pressingRadius);

    if (shouldChaseBall) {
      const chase = Vector2.subtract(ball.position, this.position).normalize().scale(this.maxSpeed());
      this.velocity = chase;
      this.lastDirection = Vector2.from(chase).normalize();

      if (distanceToBall < PLAYER_RADIUS + BALL_RADIUS + 2) {
        const towardGoal = this.team.isHome
          ? new Vector2(1, (ball.position.y < HEIGHT / 2 ? -0.2 : 0.2))
          : new Vector2(-1, (ball.position.y < HEIGHT / 2 ? -0.2 : 0.2));
        this.tryKick(ball, 0.75, towardGoal);
      }
    }
  }

  tryKick(ball, powerMultiplier = 1, directionOverride = null) {
    const toBall = Vector2.subtract(ball.position, this.position);
    const distance = toBall.length();
    if (distance > PLAYER_RADIUS + BALL_RADIUS + 4) return;

    let direction;
    if (directionOverride) {
      direction = directionOverride.clone().normalize();
    } else if (this.lastDirection.length() > 0.1) {
      direction = this.lastDirection.clone().normalize();
    } else {
      direction = toBall.normalize();
    }

    const strength = KICK_STRENGTH * powerMultiplier;
    ball.velocity = direction.scale(strength);
  }

  tryPass(ball) {
    const teammates = this.team.players.filter((mate) => mate !== this);
    if (!teammates.length) return;

    let bestTarget = null;
    let bestScore = Infinity;
    for (const mate of teammates) {
      const toMate = Vector2.subtract(mate.position, this.position);
      const distance = toMate.length();
      const alignment = Math.abs(Vector2.subtract(ball.position, this.position).length() - distance);
      const score = distance + alignment * 0.25;
      if (score < bestScore) {
        bestScore = score;
        bestTarget = mate;
      }
    }

    if (!bestTarget) return;

    const direction = Vector2.subtract(bestTarget.position, this.position).normalize();
    const distance = Vector2.subtract(bestTarget.position, this.position).length();
    const power = Math.min(1, 0.45 + distance / 480);
    this.tryKick(ball, power, direction);
  }

  keepInsidePitch() {
    const minX = PITCH_MARGIN_X + PLAYER_RADIUS;
    const maxX = WIDTH - PITCH_MARGIN_X - PLAYER_RADIUS;
    const minY = PITCH_MARGIN_Y + PLAYER_RADIUS;
    const maxY = HEIGHT - PITCH_MARGIN_Y - PLAYER_RADIUS;
    this.position.x = Math.max(minX, Math.min(maxX, this.position.x));
    this.position.y = Math.max(minY, Math.min(maxY, this.position.y));
  }

  draw() {
    ctx.save();
    const gradient = ctx.createRadialGradient(
      this.position.x,
      this.position.y,
      4,
      this.position.x,
      this.position.y,
      PLAYER_RADIUS
    );
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(1, this.color);
    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = this.isUser ? 4 : 2;
    ctx.strokeStyle = this.isUser ? "#ffd600" : "rgba(255,255,255,0.7)";
    ctx.stroke();
    ctx.restore();
  }
}

class Team {
  constructor(isHome, color) {
    this.isHome = isHome;
    this.color = color;
    this.players = [];
    this.attackingPlayers = [];
    this.currentChasers = [];
  }

  init(formation) {
    formation.forEach((pos, index) => {
      const base = { ...pos };
      const isUserControlled = this.isHome && index === formation.length - 1;
      const player = new Player(this, index, base, this.color, isUserControlled);
      this.players.push(player);
      if (index >= formation.length - 4) {
        this.attackingPlayers.push(player);
      }
    });
  }

  update(dt, ball, inputState = null) {
    this.assignChasers(ball);
    this.players.forEach((p) => {
      const playerInput = p === controlledPlayer ? inputState : null;
      p.update(dt, ball, playerInput);
    });
  }

  draw() {
    this.players.forEach((p) => p.draw());
  }

  hasPossession(ball) {
    return this.players.some(
      (player) => Vector2.subtract(ball.position, player.position).length() < PLAYER_RADIUS * 2.6
    );
  }

  assignChasers(ball) {
    const ranked = this.players
      .map((player) => ({
        player,
        distance: Vector2.subtract(ball.position, player.position).length(),
      }))
      .sort((a, b) => a.distance - b.distance);

    this.currentChasers = ranked
      .slice(0, Math.min(2, ranked.length))
      .map((entry) => entry.player);
  }
}

const formation = [
  { x: 0.04, y: 0.5 }, // GK
  { x: 0.18, y: 0.2 },
  { x: 0.18, y: 0.4 },
  { x: 0.18, y: 0.6 },
  { x: 0.18, y: 0.8 },
  { x: 0.38, y: 0.15 },
  { x: 0.34, y: 0.35 },
  { x: 0.34, y: 0.65 },
  { x: 0.38, y: 0.85 },
  { x: 0.5, y: 0.35 },
  { x: 0.5, y: 0.65 },
];

const homeColor = getComputedStyle(document.documentElement)
  .getPropertyValue("--home-color")
  .trim();
const awayColor = getComputedStyle(document.documentElement)
  .getPropertyValue("--away-color")
  .trim();

const homeTeam = new Team(true, homeColor);
const awayTeam = new Team(false, awayColor);

homeTeam.init(formation.map((pos) => ({ ...pos })));
awayTeam.init(formation.map((pos) => ({ ...pos })));

controlledPlayer = homeTeam.players.find((player) => player.isUser) || homeTeam.players[homeTeam.players.length - 1];

function setControlledPlayer(player) {
  if (!player || player === controlledPlayer) return;
  if (controlledPlayer) {
    controlledPlayer.isUser = false;
  }
  player.isUser = true;
  controlledPlayer = player;
  updateStaminaBar();
}

const ball = new Ball();

function pitchFromNormalized({ x, y }, isHome) {
  const clampedX = Math.max(0.05, Math.min(0.95, x));
  const clampedY = Math.max(0.1, Math.min(0.9, y));
  const px = clampedX * WIDTH;
  const py = clampedY * HEIGHT;
  if (!isHome) {
    return new Vector2(WIDTH - px, py);
  }
  return new Vector2(px, py);
}

function applyDeadzone(value, threshold = GAMEPAD_DEADZONE) {
  return Math.abs(value) < threshold ? 0 : value;
}

function getActiveGamepad() {
  if (!navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  if (activeGamepadIndex !== null) {
    const existing = pads[activeGamepadIndex];
    if (existing && existing.connected) {
      return existing;
    }
  }
  for (const pad of pads) {
    if (pad && pad.connected) {
      activeGamepadIndex = pad.index;
      return pad;
    }
  }
  activeGamepadIndex = null;
  return null;
}

function pollInputState() {
  let moveX = 0;
  let moveY = 0;
  if (keys.has("KeyD") || keys.has("ArrowRight")) moveX += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) moveX -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) moveY += 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) moveY -= 1;

  let sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
  let shoot = keys.has("Space");
  let pass = keys.has("KeyF");
  let switchPlayer = keys.has("KeyQ");

  const gamepad = getActiveGamepad();
  if (gamepad) {
    const axisX = applyDeadzone(gamepad.axes[0] || 0);
    const axisY = applyDeadzone(gamepad.axes[1] || 0);
    moveX += axisX;
    moveY += axisY;

    sprint = sprint || (gamepad.buttons[7] && gamepad.buttons[7].value > 0.4);
    shoot = shoot || Boolean(gamepad.buttons[0]?.pressed);
    pass = pass || Boolean(gamepad.buttons[1]?.pressed);
    switchPlayer = switchPlayer || Boolean(gamepad.buttons[4]?.pressed);
  }

  const move = new Vector2(moveX, moveY);
  if (move.length() > 1) {
    move.normalize();
  }

  return {
    move,
    sprint,
    shoot,
    pass,
    switch: switchPlayer,
  };
}

function update(dt) {
  const inputState = pollInputState();
  if (inputState.switch && !(previousInputState && previousInputState.switch)) {
    switchToClosestPlayer();
  }
  previousInputState = {
    ...inputState,
    move: inputState.move.clone(),
  };

  if (gameOver) return;

  matchTime += dt;
  if (matchTime >= MATCH_LENGTH) {
    matchTime = MATCH_LENGTH;
    gameOver = true;
  }

  updateClock();
  updateStaminaBar();

  homeTeam.update(dt, ball, inputState);
  awayTeam.update(dt, ball);
  resolveCollisions();
  trackPossession(dt);
  ball.update(dt);
  updatePossessionDisplay();
}

function resolveCollisions() {
  const players = [...homeTeam.players, ...awayTeam.players];
  for (const player of players) {
    const delta = Vector2.subtract(ball.position, player.position);
    const distance = delta.length();
    const minDist = PLAYER_RADIUS + BALL_RADIUS;

    if (distance < minDist) {
      const overlap = minDist - distance;
      const normal =
        distance === 0
          ? new Vector2(Math.random() - 0.5, Math.random() - 0.5).normalize()
          : delta.normalize();
      ball.position.add(Vector2.from(normal).scale(overlap + 1));
      ball.velocity = Vector2.from(normal).scale(KICK_STRENGTH * 0.6);
      player.lastDirection = Vector2.from(normal);
    }
  }
}

function drawPitch() {
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--pitch-green");
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--pitch-lines");
  ctx.lineWidth = 4;

  ctx.strokeRect(40, 40, WIDTH - 80, HEIGHT - 80);

  ctx.beginPath();
  ctx.moveTo(WIDTH / 2, 40);
  ctx.lineTo(WIDTH / 2, HEIGHT - 40);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(WIDTH / 2, HEIGHT / 2, 90, 0, Math.PI * 2);
  ctx.stroke();

  // Tizenhatosok
  drawBox(40, HEIGHT / 2 - 160, 140, 320);
  drawBox(WIDTH - 180, HEIGHT / 2 - 160, 140, 320);

  // Kapuelőterek
  drawBox(40, HEIGHT / 2 - 80, 60, 160);
  drawBox(WIDTH - 100, HEIGHT / 2 - 80, 60, 160);

  // Kör a kezdőkörben
  ctx.beginPath();
  ctx.arc(WIDTH / 2, HEIGHT / 2, 6, 0, Math.PI * 2);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--pitch-lines");
  ctx.fill();

  // Büntetőpontok
  drawSpot(160, HEIGHT / 2);
  drawSpot(WIDTH - 160, HEIGHT / 2);

  // Sarokrúgás körjelek
  drawQuarterCircle(40, 40, 12, 0);
  drawQuarterCircle(WIDTH - 40, 40, 12, Math.PI / 2);
  drawQuarterCircle(40, HEIGHT - 40, 12, (Math.PI * 3) / 2);
  drawQuarterCircle(WIDTH - 40, HEIGHT - 40, 12, Math.PI);

  ctx.restore();
}

function drawBox(x, y, w, h) {
  ctx.strokeRect(x, y, w, h);
}

function drawSpot(x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawQuarterCircle(x, y, r, startAngle) {
  ctx.beginPath();
  ctx.arc(x, y, r, startAngle, startAngle + Math.PI / 2);
  ctx.stroke();
}

function draw() {
  drawPitch();
  homeTeam.draw();
  awayTeam.draw();
  ball.draw();

  if (gameOver) {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "48px 'Segoe UI', sans-serif";
    const result = parseInt(homeScoreEl.textContent, 10) > parseInt(awayScoreEl.textContent, 10)
      ? "Győzelem!"
      : parseInt(homeScoreEl.textContent, 10) === parseInt(awayScoreEl.textContent, 10)
      ? "Döntetlen"
      : "Vereség";
    ctx.fillText(result, WIDTH / 2, HEIGHT / 2 - 20);
    ctx.font = "28px 'Segoe UI', sans-serif";
    ctx.fillText("Nyomd meg az R gombot az újrakezdéshez", WIDTH / 2, HEIGHT / 2 + 30);
    ctx.restore();
  }
}

function updateClock() {
  const remaining = Math.max(0, MATCH_LENGTH - matchTime);
  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(Math.floor(remaining % 60)).padStart(2, "0");
  timeEl.textContent = `${minutes}:${seconds}`;
}

const staminaFillEl = document.getElementById("stamina-fill");

function updateStaminaBar() {
  if (!staminaFillEl || !controlledPlayer) return;
  const width = (controlledPlayer.stamina / STAMINA_MAX) * 100;
  staminaFillEl.style.width = `${Math.max(0, Math.min(100, width))}%`;
}

function trackPossession(dt) {
  const homeHas = homeTeam.hasPossession(ball);
  const awayHas = awayTeam.hasPossession(ball);
  if (homeHas && !awayHas) {
    possessionTotals.home += dt;
  } else if (awayHas && !homeHas) {
    possessionTotals.away += dt;
  }
}

function updatePossessionDisplay() {
  if (!possessionEl) return;
  const total = possessionTotals.home + possessionTotals.away;
  if (total <= 0) {
    possessionEl.textContent = "Birtoklás: 50% - 50%";
    return;
  }
  const homePct = Math.round((possessionTotals.home / total) * 100);
  const awayPct = 100 - homePct;
  possessionEl.textContent = `Birtoklás: ${homePct}% - ${awayPct}%`;
}

let homeScore = 0;
let awayScore = 0;

function scoreGoal(side) {
  if (side === "home") {
    homeScore += 1;
    homeScoreEl.textContent = homeScore;
    resetTeamsAfterGoal(-1);
  } else {
    awayScore += 1;
    awayScoreEl.textContent = awayScore;
    resetTeamsAfterGoal(1);
  }
}

function resetTeamsAfterGoal(direction) {
  [...homeTeam.players, ...awayTeam.players].forEach((player) => {
    player.position = pitchFromNormalized(player.basePosition, player.team.isHome);
    player.velocity = new Vector2();
    player.stamina = STAMINA_MAX;
    player.passHeld = false;
    player.shootHeld = false;
  });
  ball.reset(direction);
  updateStaminaBar();
}

function resetGame() {
  matchTime = 0;
  gameOver = false;
  homeScore = 0;
  awayScore = 0;
  homeScoreEl.textContent = "0";
  awayScoreEl.textContent = "0";
  ball.reset(1);
  updateClock();
  possessionTotals.home = 0;
  possessionTotals.away = 0;
  previousInputState = null;
  [...homeTeam.players, ...awayTeam.players].forEach((player) => {
    player.position = pitchFromNormalized(player.basePosition, player.team.isHome);
    player.velocity = new Vector2();
    player.stamina = STAMINA_MAX;
    player.passHeld = false;
    player.shootHeld = false;
  });
  updateStaminaBar();
  updatePossessionDisplay();
}

function gameLoop(timestamp) {
  const dt = Math.min(0.033, (timestamp - lastFrame) / 1000);
  lastFrame = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

function handleKeyDown(e) {
  if (e.code === "KeyR" && gameOver) {
    resetGame();
  }
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
    e.preventDefault();
  }
  keys.add(e.code);
}

function handleKeyUp(e) {
  keys.delete(e.code);
}

document.addEventListener("keydown", handleKeyDown);
document.addEventListener("keyup", handleKeyUp);

window.addEventListener("gamepadconnected", (event) => {
  activeGamepadIndex = event.gamepad.index;
  previousInputState = null;
});

window.addEventListener("gamepaddisconnected", (event) => {
  if (event.gamepad.index === activeGamepadIndex) {
    activeGamepadIndex = null;
  }
});

if (versionEl) {
  versionEl.textContent = GAME_VERSION;
}
updatePossessionDisplay();

resetGame();
requestAnimationFrame(gameLoop);

function switchToClosestPlayer() {
  if (!controlledPlayer) return;
  let bestPlayer = controlledPlayer;
  let bestDistance = Infinity;
  for (const player of homeTeam.players) {
    if (player === controlledPlayer) continue;
    const distance = Vector2.subtract(ball.position, player.position).length();
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPlayer = player;
    }
  }
  if (bestPlayer && bestPlayer !== controlledPlayer) {
    setControlledPlayer(bestPlayer);
  }
}
