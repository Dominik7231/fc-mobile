const canvas = document.getElementById("pitch");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GOAL_WIDTH = 240;
const PLAYER_RADIUS = 12;
const PLAYER_SPEED = 150;
const USER_SPEED = 180;
const SPRINT_SPEED = 240;
const STAMINA_MAX = 100;
const STAMINA_DRAIN_RATE = 28;
const STAMINA_RECOVERY_RATE = 16;
const BALL_RADIUS = 8;
const BALL_FRICTION = 0.983;
const BALL_MAX_SPEED = 360;
const KICK_STRENGTH = 320;
const PASS_RELEASE_TIME = 0.2;
const SHOT_RELEASE_TIME = 0.38;
const DRIBBLE_RELEASE_TIME = 0.06;
const DRIBBLE_MIN_SPEED = 110;
const DRIBBLE_LOCK_DISTANCE = PLAYER_RADIUS + BALL_RADIUS + 1.4;
const MATCH_LENGTH = 4 * 60; // 4 perces mérkőzés
const PITCH_MARGIN_X = 40;
const PITCH_MARGIN_Y = 40;
const GAME_VERSION = "v1.8.0";
const GAMEPAD_DEADZONE = 0.2;
const PITCH_LEFT = PITCH_MARGIN_X;
const PITCH_RIGHT = WIDTH - PITCH_MARGIN_X;
const PITCH_TOP = PITCH_MARGIN_Y;
const PITCH_BOTTOM = HEIGHT - PITCH_MARGIN_Y;

const homeScoreEl = document.getElementById("home-score");
const awayScoreEl = document.getElementById("away-score");
const timeEl = document.getElementById("match-time");
const possessionEl = document.getElementById("possession-meter");
const versionEl = document.getElementById("game-version");
const menuVersionEl = document.getElementById("menu-version");
const gameContainer = document.getElementById("game-container");
const fullscreenBtn = document.getElementById("fullscreen-btn");
const menuToggleBtn = document.getElementById("menu-toggle-btn");
const joystickBase = document.getElementById("joystick-base");
const joystickKnob = document.getElementById("joystick-knob");
const mobileButtons = {
  pass: document.getElementById("mobile-pass"),
  shoot: document.getElementById("mobile-shoot"),
  sprint: document.getElementById("mobile-sprint"),
  switch: document.getElementById("mobile-switch"),
};
const menuOverlay = document.getElementById("main-menu");
const startBtn = document.getElementById("menu-start");
const resumeBtn = document.getElementById("menu-resume");
const restartBtn = document.getElementById("menu-restart");

let pseudoFullscreenActive = false;

const keys = new Set();
let matchTime = 0;
let gameOver = false;
let lastFrame = performance.now();
let controlledPlayer = null;
let previousInputState = null;
let activeGamepadIndex = null;
let restartState = null;
let joystickPointerId = null;
let joystickOrigin = { x: 0, y: 0 };
let isPaused = true;
let matchHasStarted = false;

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
    this.lastTouchTeam = null;
    this.lastTouchPlayer = null;
  }

  reset(direction = 1) {
    this.position = new Vector2(WIDTH / 2, HEIGHT / 2);
    this.velocity = new Vector2(direction * 90, 0);
    this.lastTouchTeam = null;
    this.lastTouchPlayer = null;
  }

  update(dt) {
    this.position.add(Vector2.from(this.velocity).scale(dt));
    const damping = Math.pow(BALL_FRICTION, dt * 60);
    this.velocity.scale(damping);

    if (this.velocity.length() > BALL_MAX_SPEED) {
      this.velocity.normalize().scale(BALL_MAX_SPEED);
    }

    // Falak
    const topBoundary = PITCH_TOP + BALL_RADIUS;
    const bottomBoundary = PITCH_BOTTOM - BALL_RADIUS;
    if (this.position.y <= PITCH_TOP) {
      if (handleBallOutOfPlay(this, { kind: "sideline", edge: "top" })) {
        return;
      }
    }
    if (this.position.y >= PITCH_BOTTOM) {
      if (handleBallOutOfPlay(this, { kind: "sideline", edge: "bottom" })) {
        return;
      }
    }
    if (this.position.y < topBoundary) {
      this.position.y = topBoundary;
      if (this.velocity.y < 0) this.velocity.y *= -0.7;
    }
    if (this.position.y > bottomBoundary) {
      this.position.y = bottomBoundary;
      if (this.velocity.y > 0) this.velocity.y *= -0.7;
    }

    const goalTop = HEIGHT / 2 - GOAL_WIDTH / 2;
    const goalBottom = HEIGHT / 2 + GOAL_WIDTH / 2;
    const leftGoalPlane = PITCH_LEFT;
    const rightGoalPlane = PITCH_RIGHT;
    if (this.position.x <= leftGoalPlane) {
      if (this.position.y >= goalTop && this.position.y <= goalBottom) {
        scoreGoal("away");
        return;
      }
      if (handleBallOutOfPlay(this, { kind: "goalLine", side: "left" })) {
        return;
      }
    }
    if (this.position.x >= rightGoalPlane) {
      if (this.position.y >= goalTop && this.position.y <= goalBottom) {
        scoreGoal("home");
        return;
      }
      if (handleBallOutOfPlay(this, { kind: "goalLine", side: "right" })) {
        return;
      }
    }

    const innerLeft = PITCH_LEFT + BALL_RADIUS;
    const innerRight = PITCH_RIGHT - BALL_RADIUS;
    if (this.position.x < innerLeft) {
      this.position.x = innerLeft;
      if (this.velocity.x < 0) this.velocity.x *= -0.75;
    }
    if (this.position.x > innerRight) {
      this.position.x = innerRight;
      if (this.velocity.x > 0) this.velocity.x *= -0.75;
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
  recordTouch(player) {
    this.lastTouchTeam = player?.team || null;
    this.lastTouchPlayer = player || null;
  }
}

const mobileInput = {
  move: new Vector2(),
  sprint: false,
  shoot: false,
  pass: false,
  switch: false,
};

function detectTouchEnvironment() {
  if (
    typeof navigator !== "undefined" &&
    (navigator.maxTouchPoints > 0 || "ontouchstart" in window)
  ) {
    document.body.classList.add("touch-enabled");
    return;
  }
  if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
    document.body.classList.add("touch-enabled");
  }
}

function updateJoystickPosition(dx, dy) {
  if (!joystickKnob) return;
  const maxDistance = 48;
  const distance = Math.hypot(dx, dy);
  const scale = distance > maxDistance && distance > 0 ? maxDistance / distance : 1;
  const clampedDx = dx * scale;
  const clampedDy = dy * scale;
  joystickKnob.style.setProperty("--dx", `${clampedDx}px`);
  joystickKnob.style.setProperty("--dy", `${clampedDy}px`);
  mobileInput.move.x = Math.max(-1, Math.min(1, clampedDx / maxDistance));
  mobileInput.move.y = Math.max(-1, Math.min(1, clampedDy / maxDistance));
}

function resetJoystick() {
  mobileInput.move.x = 0;
  mobileInput.move.y = 0;
  joystickPointerId = null;
  if (joystickKnob) {
    joystickKnob.style.setProperty("--dx", "0px");
    joystickKnob.style.setProperty("--dy", "0px");
  }
}

function bindMobileControls() {
  detectTouchEnvironment();
  if (window.matchMedia) {
    const coarseQuery = window.matchMedia("(pointer: coarse)");
    const activate = (event) => {
      if (event.matches) {
        document.body.classList.add("touch-enabled");
      }
    };
    if (coarseQuery.addEventListener) {
      coarseQuery.addEventListener("change", activate);
    } else if (coarseQuery.addListener) {
      coarseQuery.addListener(activate);
    }
  }

  window.addEventListener("touchstart", () => {
    document.body.classList.add("touch-enabled");
  }, { once: true });

  if (joystickBase) {
    joystickBase.addEventListener("pointerdown", (event) => {
      document.body.classList.add("touch-enabled");
      joystickPointerId = event.pointerId;
      joystickOrigin = { x: event.clientX, y: event.clientY };
      if (joystickBase.setPointerCapture) {
        joystickBase.setPointerCapture(event.pointerId);
      }
      updateJoystickPosition(0, 0);
      event.preventDefault();
    });
  }

  window.addEventListener("pointermove", (event) => {
    if (joystickPointerId !== null && event.pointerId === joystickPointerId) {
      updateJoystickPosition(event.clientX - joystickOrigin.x, event.clientY - joystickOrigin.y);
      event.preventDefault();
    }
  });

  const finishJoystick = (event) => {
    if (joystickPointerId !== null && event.pointerId === joystickPointerId) {
      if (joystickBase && joystickBase.releasePointerCapture) {
        joystickBase.releasePointerCapture(event.pointerId);
      }
      resetJoystick();
      event.preventDefault();
    }
  };

  window.addEventListener("pointerup", finishJoystick);
  window.addEventListener("pointercancel", finishJoystick);

  Object.entries(mobileButtons).forEach(([key, button]) => {
    if (!button) return;
    button.addEventListener("click", (event) => event.preventDefault());
    button.addEventListener("pointerdown", (event) => {
      document.body.classList.add("touch-enabled");
      mobileInput[key] = true;
      button.classList.add("pressed");
      if (button.setPointerCapture) {
        button.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
    });
    const release = (event) => {
      mobileInput[key] = false;
      button.classList.remove("pressed");
      const pointerId = event?.pointerId;
      if (pointerId !== undefined && button.releasePointerCapture) {
        try {
          button.releasePointerCapture(pointerId);
        } catch (err) {
          // ignore release failures
        }
      }
    };
    button.addEventListener("pointerup", (event) => {
      release(event);
      event.preventDefault();
    });
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
    button.addEventListener("lostpointercapture", release);
  });
}

function nativeFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null
  );
}

function isFullscreenActive() {
  const nativeEl = nativeFullscreenElement();
  return (
    pseudoFullscreenActive ||
    nativeEl === gameContainer ||
    nativeEl === document.documentElement
  );
}

function enablePseudoFullscreen() {
  if (!document.body.classList.contains("pseudo-fullscreen")) {
    document.body.classList.add("pseudo-fullscreen");
  }
  pseudoFullscreenActive = true;
  updateFullscreenButtonState();
}

function disablePseudoFullscreen() {
  if (document.body.classList.contains("pseudo-fullscreen")) {
    document.body.classList.remove("pseudo-fullscreen");
  }
  pseudoFullscreenActive = false;
  updateFullscreenButtonState();
}

function updateFullscreenButtonState() {
  if (!fullscreenBtn) return;
  const active = isFullscreenActive();
  fullscreenBtn.classList.toggle("active", active);
  fullscreenBtn.textContent = active ? "Kilépés" : "Teljes képernyő";
}

async function enterFullscreen() {
  if (!gameContainer) {
    enablePseudoFullscreen();
    return;
  }

  const target = gameContainer.requestFullscreen ? gameContainer : document.documentElement;
  if (target && target.requestFullscreen) {
    try {
      await target.requestFullscreen();
      pseudoFullscreenActive = false;
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("landscape").catch(() => {});
      }
    } catch (err) {
      if (gameContainer.webkitRequestFullscreen) {
        gameContainer.webkitRequestFullscreen();
        pseudoFullscreenActive = false;
      } else {
        enablePseudoFullscreen();
      }
    }
  } else if (gameContainer.webkitRequestFullscreen) {
    gameContainer.webkitRequestFullscreen();
    pseudoFullscreenActive = false;
  } else {
    enablePseudoFullscreen();
  }
  updateFullscreenButtonState();
}

function exitFullscreen() {
  const nativeEl = nativeFullscreenElement();
  if (nativeEl) {
    const exit =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.mozCancelFullScreen ||
      document.msExitFullscreen;
    if (exit) {
      try {
        exit.call(document);
      } catch (err) {
        disablePseudoFullscreen();
      }
    }
  } else {
    disablePseudoFullscreen();
  }
}

function toggleFullscreen() {
  if (isFullscreenActive()) {
    exitFullscreen();
    disablePseudoFullscreen();
  } else {
    enterFullscreen();
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
    this.pendingRestart = false;
    this.controlCooldown = 0;
  }

  maxSpeed() {
    return this.isUser ? USER_SPEED : PLAYER_SPEED;
  }

  update(dt, ball, inputState = null) {
    if (this.controlCooldown > 0) {
      this.controlCooldown = Math.max(0, this.controlCooldown - dt);
    }
    if (this.isUser) {
      this.handleUserControl(dt, ball, inputState);
    } else {
      this.handleAI(dt, ball);
    }
    this.position.add(Vector2.from(this.velocity).scale(dt));
    this.keepInsidePitch();
  }

  handleUserControl(dt, ball, inputState) {
    if (restartState && restartState.taker === this) {
      this.velocity = new Vector2();
      this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_RECOVERY_RATE * dt);
      return;
    }

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
    if (shootPressed && !this.shootHeld && this.controlCooldown <= 0) {
      if (this.tryKick(ball, 1.18)) {
        this.controlCooldown = SHOT_RELEASE_TIME;
      }
    }
    this.shootHeld = shootPressed;

    const passPressed = Boolean(inputState?.pass);
    if (passPressed && !this.passHeld && this.controlCooldown <= 0) {
      if (this.tryPass(ball)) {
        this.controlCooldown = PASS_RELEASE_TIME;
      }
    }
    this.passHeld = passPressed;
  }

  handleAI(dt, ball) {
    if (this.pendingRestart) {
      this.velocity = new Vector2();
      return;
    }
    if (restartState) {
      if (restartState.team === this.team) {
        this.velocity = new Vector2();
        return;
      }
      const baseSpot = pitchFromNormalized(this.basePosition, this.team.isHome);
      const retreat = Vector2.subtract(baseSpot, this.position);
      if (retreat.length() > 2) {
        retreat.normalize().scale(this.maxSpeed() * 0.55);
        this.velocity = retreat;
      } else {
        this.velocity.scale(0.7);
      }
      return;
    }

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

    const scoreDiff = homeScore - awayScore;
    const isHome = this.team.isHome;
    const matchProgress = Math.min(1, matchTime / MATCH_LENGTH);
    const isLosing = isHome ? scoreDiff < 0 : scoreDiff > 0;
    const isWinning = isHome ? scoreDiff > 0 : scoreDiff < 0;

    if (isLosing && matchProgress > 0.45) {
      targetNorm.x += 0.08 * homeMirror;
      targetNorm.y += (ball.position.y / HEIGHT - 0.5) * 0.18;
    }

    if (isWinning && matchProgress > 0.75) {
      targetNorm.x -= 0.05 * homeMirror;
    }

    targetNorm.x = Math.max(0.04, Math.min(0.96, targetNorm.x));
    targetNorm.y = Math.max(0.08, Math.min(0.92, targetNorm.y));

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
        if (this.tryKick(ball, 0.82, towardGoal)) {
          this.controlCooldown = Math.max(this.controlCooldown, PASS_RELEASE_TIME * 0.6);
        }
      }
    }
  }

  tryKick(ball, powerMultiplier = 1, directionOverride = null) {
    const toBall = Vector2.subtract(ball.position, this.position);
    const distance = toBall.length();
    if (distance > PLAYER_RADIUS + BALL_RADIUS + 4) return false;

    let direction;
    if (directionOverride) {
      direction = directionOverride.clone();
    } else if (this.lastDirection.length() > 0.1) {
      direction = this.lastDirection.clone();
    } else {
      direction = toBall;
    }

    if (direction.length() === 0) {
      direction = new Vector2(1, 0);
    }
    direction.normalize();

    const strength = Math.min(BALL_MAX_SPEED, KICK_STRENGTH * powerMultiplier);
    ball.position = this.position.clone().add(direction.clone().scale(DRIBBLE_LOCK_DISTANCE));
    ball.velocity = direction.clone().scale(strength);
    ball.recordTouch(this);
    this.lastDirection = direction.clone();
    this.controlCooldown = Math.max(this.controlCooldown, DRIBBLE_RELEASE_TIME);
    return true;
  }

  tryPass(ball) {
    const teammates = this.team.players.filter((mate) => mate !== this);
    if (!teammates.length) return false;

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

    if (!bestTarget) return false;

    const direction = Vector2.subtract(bestTarget.position, this.position).normalize();
    const distance = Vector2.subtract(bestTarget.position, this.position).length();
    const power = Math.min(1.12, 0.48 + distance / 520);
    return this.tryKick(ball, power, direction);
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
    if (!restartState) {
      this.assignChasers(ball);
    } else {
      this.currentChasers = [];
    }
    this.players.forEach((p) => {
      const playerInput =
        p === controlledPlayer && (!restartState || restartState.team === this)
          ? inputState
          : null;
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
  let pause = keys.has("Escape");

  if (mobileInput.move.length() > 0.01) {
    moveX = mobileInput.move.x;
    moveY = mobileInput.move.y;
  }

  sprint = sprint || mobileInput.sprint;
  shoot = shoot || mobileInput.shoot;
  pass = pass || mobileInput.pass;
  switchPlayer = switchPlayer || mobileInput.switch;

  const gamepad = getActiveGamepad();
  if (gamepad) {
    const axisX = applyDeadzone(gamepad.axes[0] || 0);
    const axisY = applyDeadzone(gamepad.axes[1] || 0);
    moveX += axisX;
    moveY += axisY;

    const rtPressed = gamepad.buttons[7] && gamepad.buttons[7].value > 0.4;
    const rbPressed = Boolean(gamepad.buttons[5]?.pressed);
    sprint = sprint || rtPressed || rbPressed;
    pass =
      pass ||
      Boolean(gamepad.buttons[0]?.pressed) ||
      Boolean(gamepad.buttons[2]?.pressed);
    shoot =
      shoot ||
      Boolean(gamepad.buttons[1]?.pressed) ||
      Boolean(gamepad.buttons[3]?.pressed);
    switchPlayer = switchPlayer || Boolean(gamepad.buttons[4]?.pressed);
    pause = pause || Boolean(gamepad.buttons[8]?.pressed) || Boolean(gamepad.buttons[9]?.pressed);
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
    pause,
  };
}

function update(dt) {
  const prevState = previousInputState;
  const inputState = pollInputState();

  const pausePressed = inputState.pause && !(prevState && prevState.pause);
  if (pausePressed) {
    if (isPaused || gameOver) {
      if (gameOver) {
        restartMatch();
      } else {
        if (matchHasStarted) {
          resumeMatch();
        } else {
          startNewMatch();
        }
      }
    } else {
      pauseMatch();
    }
  }

  if (!isPaused && !gameOver && inputState.switch && !(prevState && prevState.switch)) {
    switchToClosestPlayer();
  }

  previousInputState = {
    ...inputState,
    move: inputState.move.clone(),
  };

  if (isPaused || gameOver) {
    updateStaminaBar();
    return;
  }

  matchTime += dt;
  if (matchTime >= MATCH_LENGTH) {
    matchTime = MATCH_LENGTH;
    gameOver = true;
    updateClock();
    pauseMatch(false);
    showMenu("fulltime");
    return;
  }

  updateClock();
  updateStaminaBar();

  homeTeam.update(dt, ball, inputState);
  awayTeam.update(dt, ball);
  if (!restartState) {
    resolveCollisions();
  }
  trackPossession(dt);
  if (restartState) {
    handleRestart(dt);
  } else {
    ball.update(dt);
  }
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
      let normal =
        distance === 0
          ? new Vector2(Math.random() - 0.5, Math.random() - 0.5).normalize()
          : delta.normalize();
      ball.position.add(Vector2.from(normal).scale(overlap + 0.6));

      const approachSpeed = player.velocity.length();
      const canCarry = player === controlledPlayer && player.controlCooldown <= 0;
      if (canCarry) {
        let carryDir = player.lastDirection.clone();
        if (!carryDir || carryDir.length() < 0.1) {
          carryDir = Vector2.from(delta);
        }
        carryDir.normalize();
        const lockDistance = DRIBBLE_LOCK_DISTANCE;
        ball.position = player.position.clone().add(carryDir.clone().scale(lockDistance));
        const movementSpeed = player.velocity.length();
        const carrySpeed =
          movementSpeed < 15 ? 0 : Math.max(DRIBBLE_MIN_SPEED, movementSpeed * 0.9);
        ball.velocity = carryDir.clone().scale(carrySpeed);
      } else {
        let deflectDir = player.lastDirection.clone();
        if (!deflectDir || deflectDir.length() < 0.1) {
          deflectDir = Vector2.from(normal);
        }
        deflectDir.normalize();
        const deflectPower = Math.max(160, approachSpeed * 1.55);
        ball.position = player.position.clone().add(deflectDir.clone().scale(PLAYER_RADIUS + BALL_RADIUS + 0.5));
        ball.velocity = deflectDir.clone().scale(Math.min(BALL_MAX_SPEED, deflectPower));
        if (player === controlledPlayer) {
          player.controlCooldown = Math.max(player.controlCooldown, DRIBBLE_RELEASE_TIME * 1.5);
        }
      }

      const newDir = Vector2.from(ball.velocity);
      if (newDir.length() > 0.01) {
        player.lastDirection = newDir.normalize();
      }
      ball.recordTouch(player);
    }
  }
}

function getOpposingTeam(team) {
  return team === homeTeam ? awayTeam : homeTeam;
}

function defaultRestartDirection(team, spot, curve = 0.006) {
  const horizontal = team.isHome ? 1 : -1;
  const vertical = (HEIGHT / 2 - spot.y) * curve;
  return new Vector2(horizontal, vertical);
}

function scheduleRestart({ type, team, spot, direction, power }) {
  const timer = type === "goalKick" ? 0.85 : type === "corner" ? 0.75 : 0.6;
  team.players.forEach((p) => {
    p.pendingRestart = false;
  });
  const taker = findNearestPlayer(team, spot);
  if (taker) {
    taker.pendingRestart = true;
    taker.velocity = new Vector2();
    taker.lastDirection = direction.clone().normalize();
  }
  restartState = {
    type,
    team,
    spot: spot.clone(),
    direction: direction.clone(),
    power,
    timer,
    taker: taker || null,
    settle: 0.2,
  };
  ball.velocity = new Vector2();
  ball.position = spot.clone();
}

function findNearestPlayer(team, targetSpot) {
  let best = null;
  let bestDistance = Infinity;
  team.players.forEach((player) => {
    const distance = Vector2.subtract(targetSpot, player.position).length();
    if (distance < bestDistance) {
      bestDistance = distance;
      best = player;
    }
  });
  return best;
}

function handleRestart(dt) {
  if (!restartState) return;
  const spot = restartState.spot.clone();
  ball.position = spot;
  ball.velocity = new Vector2();

  const direction = restartState.direction.clone();
  if (direction.length() < 0.01) {
    direction.x = restartState.team.isHome ? 1 : -1;
  }
  const normDir = direction.clone().normalize();

  let taker = restartState.taker;
  if (!taker || taker.team !== restartState.team) {
    taker = findNearestPlayer(restartState.team, spot);
    restartState.taker = taker;
    if (taker) {
      taker.pendingRestart = true;
    }
  }
  if (taker) {
    const offset = normDir.clone().scale(PLAYER_RADIUS * 1.6);
    taker.position = spot.clone().subtract(offset);
    taker.velocity = new Vector2();
    taker.lastDirection = normDir.clone();
    if (restartState.team === homeTeam) {
      setControlledPlayer(taker);
    }
  }

  if (restartState.settle > 0) {
    restartState.settle = Math.max(0, restartState.settle - dt);
    return;
  }

  restartState.timer -= dt;
  if (restartState.timer <= 0) {
    if (taker) {
      taker.pendingRestart = false;
      ball.recordTouch(taker);
    } else {
      ball.lastTouchTeam = restartState.team;
      ball.lastTouchPlayer = null;
    }
    const kickDir = normDir.length() > 0 ? normDir.clone() : defaultRestartDirection(restartState.team, spot);
    ball.velocity = kickDir.normalize().scale(restartState.power);
    restartState = null;
  }
}

function handleBallOutOfPlay(ball, context) {
  if (restartState) return true;

  const fallbackTeam = ball.position.x < WIDTH / 2 ? awayTeam : homeTeam;
  let awardingTeam = ball.lastTouchTeam ? getOpposingTeam(ball.lastTouchTeam) : fallbackTeam;

  if (context.kind === "sideline") {
    const y = context.edge === "top" ? PITCH_TOP + BALL_RADIUS : PITCH_BOTTOM - BALL_RADIUS;
    const x = Math.max(PITCH_LEFT + BALL_RADIUS, Math.min(PITCH_RIGHT - BALL_RADIUS, ball.position.x));
    const spot = new Vector2(x, y);
    const direction = defaultRestartDirection(awardingTeam, spot, 0.008);
    scheduleRestart({
      type: "throwIn",
      team: awardingTeam,
      spot,
      direction,
      power: KICK_STRENGTH * 0.35,
    });
    return true;
  }

  if (context.kind === "goalLine") {
    const side = context.side;
    const defendingTeam = side === "left" ? homeTeam : awayTeam;
    const attackingTeam = getOpposingTeam(defendingTeam);
    const y = Math.max(PITCH_TOP + BALL_RADIUS, Math.min(PITCH_BOTTOM - BALL_RADIUS, ball.position.y));
    const nearTop = y < HEIGHT / 2;

    if (ball.lastTouchTeam === defendingTeam) {
      awardingTeam = attackingTeam;
    } else if (ball.lastTouchTeam === attackingTeam) {
      awardingTeam = defendingTeam;
    } else {
      awardingTeam = attackingTeam;
    }

    if (awardingTeam === attackingTeam) {
      const cornerY = nearTop ? PITCH_TOP + BALL_RADIUS : PITCH_BOTTOM - BALL_RADIUS;
      const cornerX = side === "left" ? PITCH_LEFT + BALL_RADIUS : PITCH_RIGHT - BALL_RADIUS;
      const spot = new Vector2(cornerX, cornerY);
      const direction = defaultRestartDirection(awardingTeam, spot, 0.014);
      scheduleRestart({
        type: "corner",
        team: awardingTeam,
        spot,
        direction,
        power: KICK_STRENGTH * 0.42,
      });
    } else {
      const kickX = side === "left" ? PITCH_LEFT + 80 : PITCH_RIGHT - 80;
      const centeredY = Math.max(PITCH_TOP + BALL_RADIUS + 40, Math.min(PITCH_BOTTOM - BALL_RADIUS - 40, y));
      const spot = new Vector2(kickX, centeredY);
      const direction = defaultRestartDirection(awardingTeam, spot, 0.006);
      scheduleRestart({
        type: "goalKick",
        team: awardingTeam,
        spot,
        direction,
        power: KICK_STRENGTH * 0.55,
      });
    }
    return true;
  }

  return false;
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
  drawDirectionAssist();
  drawRadar();

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
    ctx.fillText(
      "Nyomd meg az R gombot, vagy válaszd a menü Újrakezdés opcióját",
      WIDTH / 2,
      HEIGHT / 2 + 30
    );
    ctx.restore();
  }
}

function drawDirectionAssist() {
  if (!controlledPlayer) return;
  const facing = controlledPlayer.lastDirection.clone();
  if (facing.length() < 0.1) return;
  facing.normalize();
  const start = controlledPlayer.position.clone().add(facing.clone().scale(PLAYER_RADIUS + 4));
  const end = start.clone().add(facing.clone().scale(46));
  ctx.save();
  ctx.strokeStyle = "rgba(255, 214, 0, 0.75)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.fillStyle = "rgba(255, 214, 0, 0.75)";
  const arrowTip = end.clone();
  const perp = new Vector2(-facing.y, facing.x).normalize().scale(6);
  ctx.moveTo(arrowTip.x, arrowTip.y);
  ctx.lineTo(arrowTip.x - facing.x * 10 + perp.x, arrowTip.y - facing.y * 10 + perp.y);
  ctx.lineTo(arrowTip.x - facing.x * 10 - perp.x, arrowTip.y - facing.y * 10 - perp.y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRadar() {
  const radarWidth = 170;
  const radarHeight = 118;
  const margin = 20;
  const padding = 12;
  const originX = WIDTH - radarWidth - margin;
  const originY = HEIGHT - radarHeight - margin;

  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "rgba(6, 18, 6, 0.65)";
  ctx.fillRect(originX, originY, radarWidth, radarHeight);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(originX, originY, radarWidth, radarHeight);

  const pitchWidth = PITCH_RIGHT - PITCH_LEFT;
  const pitchHeight = PITCH_BOTTOM - PITCH_TOP;
  const scaleX = (radarWidth - padding * 2) / pitchWidth;
  const scaleY = (radarHeight - padding * 2) / pitchHeight;

  const project = (position) => ({
    x: originX + padding + (position.x - PITCH_LEFT) * scaleX,
    y: originY + padding + (position.y - PITCH_TOP) * scaleY,
  });

  const drawDot = (pos, color, size = 3) => {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
    ctx.fill();
  };

  homeTeam.players.forEach((player) => {
    const point = project(player.position);
    const size = player === controlledPlayer ? 5 : 3;
    drawDot(point, homeTeam.color, size);
  });

  awayTeam.players.forEach((player) => {
    const point = project(player.position);
    drawDot(point, awayTeam.color, 3);
  });

  const ballPoint = project(ball.position);
  drawDot(ballPoint, "#ffd54f", 3.5);

  ctx.restore();
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
  ball.lastTouchTeam = null;
  ball.lastTouchPlayer = null;
}

function resetTeamsAfterGoal(direction) {
  [...homeTeam.players, ...awayTeam.players].forEach((player) => {
    player.position = pitchFromNormalized(player.basePosition, player.team.isHome);
    player.velocity = new Vector2();
    player.stamina = STAMINA_MAX;
    player.passHeld = false;
    player.shootHeld = false;
    player.pendingRestart = false;
    player.controlCooldown = 0;
  });
  ball.reset(direction);
  restartState = null;
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
  restartState = null;
  updateClock();
  possessionTotals.home = 0;
  possessionTotals.away = 0;
  previousInputState = null;
  mobileInput.move = new Vector2();
  mobileInput.pass = false;
  mobileInput.shoot = false;
  mobileInput.sprint = false;
  mobileInput.switch = false;
  [...homeTeam.players, ...awayTeam.players].forEach((player) => {
    player.position = pitchFromNormalized(player.basePosition, player.team.isHome);
    player.velocity = new Vector2();
    player.stamina = STAMINA_MAX;
    player.passHeld = false;
    player.shootHeld = false;
    player.pendingRestart = false;
    player.controlCooldown = 0;
  });
  updateStaminaBar();
  updatePossessionDisplay();
}

function updateMenuButtons(mode = "pause") {
  if (!menuOverlay) return;
  menuOverlay.dataset.mode = mode;

  if (resumeBtn) {
    const canResume = matchHasStarted && !gameOver;
    resumeBtn.style.display = canResume ? "block" : "none";
  }

  if (startBtn) {
    startBtn.textContent = matchHasStarted ? "Új meccs indítása" : "Meccs indítása";
  }

  if (restartBtn) {
    restartBtn.style.display = matchHasStarted ? "block" : "none";
  }
}

function showMenu(mode = "pause") {
  if (!menuOverlay) return;
  updateMenuButtons(mode);
  menuOverlay.classList.add("visible");
}

function hideMenu() {
  if (!menuOverlay) return;
  menuOverlay.classList.remove("visible");
}

function resumeMatch() {
  if (gameOver) return;
  matchHasStarted = true;
  isPaused = false;
  hideMenu();
  lastFrame = performance.now();
  previousInputState = null;
}

function pauseMatch(showOverlay = true) {
  if (isPaused && showOverlay && menuOverlay?.classList.contains("visible")) {
    updateMenuButtons(gameOver ? "fulltime" : "pause");
    return;
  }
  isPaused = true;
  if (showOverlay) {
    showMenu(gameOver ? "fulltime" : "pause");
  } else {
    updateMenuButtons(gameOver ? "fulltime" : "pause");
  }
}

function startNewMatch() {
  resetGame();
  matchHasStarted = true;
  resumeMatch();
}

function restartMatch() {
  if (!matchHasStarted) {
    startNewMatch();
    return;
  }
  resetGame();
  resumeMatch();
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
    restartMatch();
  }
  if (e.code === "Enter" && menuOverlay?.classList.contains("visible")) {
    e.preventDefault();
    if (gameOver) {
      restartMatch();
    } else if (!matchHasStarted) {
      startNewMatch();
    } else {
      resumeMatch();
    }
  }
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Escape"].includes(
      e.code
    )
  ) {
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

window.addEventListener("blur", () => {
  if (!isPaused && !gameOver) {
    pauseMatch();
  }
});

if (versionEl) {
  versionEl.textContent = GAME_VERSION;
}
if (menuVersionEl) {
  menuVersionEl.textContent = GAME_VERSION;
}
updatePossessionDisplay();
bindMobileControls();
if (menuToggleBtn) {
  menuToggleBtn.addEventListener("click", (event) => {
    event.preventDefault();
    const menuVisible = menuOverlay?.classList.contains("visible");
    if (menuVisible) {
      if (gameOver) {
        restartMatch();
      } else if (!matchHasStarted) {
        startNewMatch();
      } else {
        resumeMatch();
      }
    } else {
      pauseMatch();
    }
  });
}
if (startBtn) {
  startBtn.addEventListener("click", (event) => {
    event.preventDefault();
    startNewMatch();
  });
}
if (resumeBtn) {
  resumeBtn.addEventListener("click", (event) => {
    event.preventDefault();
    resumeMatch();
  });
}
if (restartBtn) {
  restartBtn.addEventListener("click", (event) => {
    event.preventDefault();
    restartMatch();
  });
}
if (fullscreenBtn) {
  fullscreenBtn.addEventListener("click", (event) => {
    event.preventDefault();
    toggleFullscreen();
  });
  const handleFullscreenChange = () => {
    if (!nativeFullscreenElement()) {
      if (!document.body.classList.contains("pseudo-fullscreen")) {
        pseudoFullscreenActive = false;
      }
    } else {
      pseudoFullscreenActive = false;
    }
    updateFullscreenButtonState();
  };
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
  updateFullscreenButtonState();
}

resetGame();
showMenu("intro");
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
