(() => {
  "use strict";

  const WIDTH = 720;
  const HEIGHT = 480;
  const CELL = 24;
  const COLS = WIDTH / CELL;
  const ROWS = HEIGHT / CELL;
  const DIRECTIONS = {
    up: { x: 0, y: -1, opposite: "down" },
    right: { x: 1, y: 0, opposite: "left" },
    down: { x: 0, y: 1, opposite: "up" },
    left: { x: -1, y: 0, opposite: "right" }
  };
  const SPEEDS = { chill: 155, normal: 112, turbo: 78 };
  const $ = (selector) => document.querySelector(selector);
  const canvas = $("#game-canvas");
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const overlay = $("#overlay");
  const startButton = $("#start-button");
  const pauseButton = $("#pause-button");
  const soundButton = $("#sound-toggle");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let snake = [];
  let previousSnake = [];
  let direction = "right";
  let nextDirection = "right";
  let food = { x: 0, y: 0 };
  let particles = [];
  let score = 0;
  let best = readNumber("neon-snake-best");
  let foodsEaten = 0;
  let streak = 0;
  let speed = "normal";
  let mode = "walls";
  let state = "ready";
  let soundEnabled = readValue("neon-snake-sound", "true") !== "false";
  let accumulator = 0;
  let lastFrame = 0;
  let elapsed = 0;
  let runStartedAt = 0;
  let audioContext = null;
  let swipeStart = null;
  let lastHudUpdate = 0;
  let animationId = 0;

  $("#best-score").textContent = formatScore(best);
  soundButton.classList.toggle("muted", !soundEnabled);
  soundButton.setAttribute("aria-pressed", String(soundEnabled));

  function readValue(key, fallback) {
    try { return localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; }
  }
  function readNumber(key) {
    const value = Number(readValue(key, "0"));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  function saveValue(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) { /* storage can be disabled */ }
  }
  function formatScore(value) {
    return String(value).padStart(3, "0");
  }
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      ctx.setTransform(width / WIDTH, 0, 0, height / HEIGHT, 0, 0);
    }
  }

  function makeSnake() {
    const x = Math.floor(COLS / 2);
    const y = Math.floor(ROWS / 2);
    snake = [
      { x, y },
      { x: x - 1, y },
      { x: x - 2, y },
      { x: x - 3, y }
    ];
    previousSnake = snake.map((part) => ({ ...part }));
    direction = "right";
    nextDirection = "right";
  }

  function placeFood() {
    const free = [];
    const occupied = new Set(snake.map((part) => part.x + "," + part.y));
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (!occupied.has(x + "," + y)) free.push({ x, y });
      }
    }
    if (!free.length) {
      finish(true);
      return;
    }
    food = free[Math.floor(Math.random() * free.length)];
  }

  function resetGame() {
    score = 0;
    foodsEaten = 0;
    streak = 0;
    elapsed = 0;
    accumulator = 0;
    particles = [];
    makeSnake();
    placeFood();
    updateHud(true);
  }

  function startGame() {
    if (state === "running") return;
    if (state === "over" || state === "won" || state === "ready") resetGame();
    state = "running";
    runStartedAt = performance.now();
    lastFrame = runStartedAt;
    overlay.classList.add("hidden");
    $("#pause-indicator").hidden = true;
    pauseButton.disabled = false;
    pauseButton.innerHTML = "<span>Ⅱ</span> Pausar partida";
    setStatus("EN PARTIDA", true);
    ensureAudio();
    if (!animationId) animationId = requestAnimationFrame(frame);
  }

  function pauseGame() {
    if (state !== "running") return;
    state = "paused";
    pauseButton.innerHTML = "<span>▶</span> Continuar partida";
    $("#pause-indicator").hidden = false;
    setStatus("PARTIDA EN PAUSA", false);
    accumulator = 0;
  }

  function resumeGame() {
    if (state !== "paused") return;
    state = "running";
    lastFrame = performance.now();
    pauseButton.innerHTML = "<span>Ⅱ</span> Pausar partida";
    $("#pause-indicator").hidden = true;
    setStatus("EN PARTIDA", true);
    if (!animationId) animationId = requestAnimationFrame(frame);
  }

  function finish(won) {
    if (state === "over" || state === "won") return;
    state = won ? "won" : "over";
    pauseButton.disabled = true;
    $("#pause-indicator").hidden = true;
    if (score > best) {
      best = score;
      saveValue("neon-snake-best", best);
      $("#best-score").textContent = formatScore(best);
    }
    $("#overlay-symbol").textContent = won ? "🏆" : "✦";
    $("#overlay-kicker").textContent = won ? "¡INCREÍBLE!" : "FIN DE LA PARTIDA";
    $("#overlay-title").textContent = won ? "¡Tablero completo!" : "¡Casi lo tenías!";
    $("#overlay-copy").textContent = won
      ? "Has ocupado todo el tablero. Una partida perfecta."
      : "Has conseguido " + score + " puntos. Cada intento te hace mejor.";
    startButton.querySelector("span").textContent = "Jugar otra vez";
    overlay.classList.remove("hidden");
    setStatus(won ? "VICTORIA" : "PARTIDA FINALIZADA", false);
    tone(won ? 660 : 150, won ? 0.2 : 0.32, won ? "sine" : "triangle");
  }

  function setStatus(label, active) {
    $("#state-label").textContent = label;
    $(".state-dot").style.background = active ? "var(--lime)" : "#8b98ad";
    $(".state-dot").style.boxShadow = active ? "0 0 10px #b8f36b" : "none";
  }

  function setDirection(candidate) {
    if (!DIRECTIONS[candidate] || state === "over" || state === "won") return;
    if (candidate === DIRECTIONS[direction].opposite) return;
    if (candidate === nextDirection) return;
    nextDirection = candidate;
    if (state === "ready") {
      direction = candidate;
      nextDirection = candidate;
      startGame();
    }
  }

  function step() {
    direction = nextDirection;
    previousSnake = snake.map((part) => ({ ...part }));
    const vector = DIRECTIONS[direction];
    const head = { x: snake[0].x + vector.x, y: snake[0].y + vector.y };
    if (mode === "wrap") {
      head.x = (head.x + COLS) % COLS;
      head.y = (head.y + ROWS) % ROWS;
    } else if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      finish(false);
      return;
    }

    const eating = head.x === food.x && head.y === food.y;
    const collisionLimit = eating ? snake.length : snake.length - 1;
    for (let i = 0; i < collisionLimit; i += 1) {
      if (snake[i].x === head.x && snake[i].y === head.y) {
        finish(false);
        return;
      }
    }

    snake.unshift(head);
    if (eating) {
      score += 10;
      foodsEaten += 1;
      streak += 1;
      spawnParticles(food.x, food.y);
      placeFood();
      tone(520 + Math.min(streak, 8) * 35, 0.075, "sine");
      if (score > best) {
        best = score;
        saveValue("neon-snake-best", best);
        $("#best-score").textContent = formatScore(best);
      }
      updateHud(true);
    } else {
      snake.pop();
    }
  }

  function spawnParticles(x, y) {
    const centerX = x * CELL + CELL / 2;
    const centerY = y * CELL + CELL / 2;
    const amount = reducedMotion ? 5 : 11;
    for (let i = 0; i < amount; i += 1) {
      const angle = (Math.PI * 2 * i) / amount + Math.random() * 0.25;
      const velocity = 35 + Math.random() * 95;
      particles.push({
        x: centerX, y: centerY,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 0.38 + Math.random() * 0.22,
        maxLife: 0.6,
        size: 1.5 + Math.random() * 2.5
      });
    }
    if (particles.length > 90) particles.splice(0, particles.length - 90);
  }

  function updateParticles(delta) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.life -= delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vx *= 0.985;
      particle.vy *= 0.985;
      if (particle.life <= 0) particles.splice(i, 1);
    }
  }

  function drawBackground(time) {
    ctx.fillStyle = "#0b1422";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "rgba(133, 164, 199, .035)";
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if ((x + y) % 2 === 0) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    ctx.strokeStyle = "rgba(142, 171, 204, .055)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= WIDTH; x += CELL) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, HEIGHT);
    }
    for (let y = 0; y <= HEIGHT; y += CELL) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(WIDTH, y + 0.5);
    }
    ctx.stroke();
    const glow = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 40, WIDTH / 2, HEIGHT / 2, 420);
    glow.addColorStop(0, "rgba(61, 111, 89, .075)");
    glow.addColorStop(1, "rgba(7, 14, 24, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (mode === "walls") {
      ctx.strokeStyle = "rgba(184, 243, 107, .12)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, WIDTH - 2, HEIGHT - 2);
    }
  }

  function drawFood(time) {
    const x = food.x * CELL + CELL / 2;
    const y = food.y * CELL + CELL / 2;
    const pulse = 1 + Math.sin(time / 180) * 0.075;
    const radius = 7.2 * pulse;
    const halo = ctx.createRadialGradient(x, y, 1, x, y, 18);
    halo.addColorStop(0, "rgba(255, 111, 125, .32)");
    halo.addColorStop(1, "rgba(255, 111, 125, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(x - 18, y - 18, 36, 36);
    ctx.fillStyle = "#ff6f7d";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffc1a9";
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#9de27b";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + 1, y - 7);
    ctx.quadraticCurveTo(x + 2, y - 12, x + 7, y - 12);
    ctx.stroke();
  }

  function roundedRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawSnake(alpha) {
    for (let i = snake.length - 1; i >= 0; i -= 1) {
      const part = snake[i];
      const previous = previousSnake[i] || part;
      let x = (previous.x + (part.x - previous.x) * alpha) * CELL;
      let y = (previous.y + (part.y - previous.y) * alpha) * CELL;
      if (mode === "wrap" && Math.abs(part.x - previous.x) > 1) x = part.x * CELL;
      if (mode === "wrap" && Math.abs(part.y - previous.y) > 1) y = part.y * CELL;
      const inset = i === 0 ? 2 : 3;
      const size = CELL - inset * 2;
      const taper = i > snake.length - 4 ? (i - (snake.length - 4)) * 0.4 : 0;
      const radius = i === 0 ? 8 : Math.max(4, 7 - taper);
      const gradient = ctx.createLinearGradient(x, y, x + CELL, y + CELL);
      if (i === 0) {
        gradient.addColorStop(0, "#d8ff9b");
        gradient.addColorStop(1, "#91dc58");
      } else {
        const shade = Math.max(0, 1 - i / Math.max(20, snake.length * 1.5));
        gradient.addColorStop(0, shade > .5 ? "#8ee5a8" : "#5fc99b");
        gradient.addColorStop(1, shade > .5 ? "#54c99b" : "#328b78");
      }
      ctx.fillStyle = gradient;
      ctx.shadowColor = i === 0 ? "rgba(174, 245, 111, .4)" : "rgba(74, 207, 151, .12)";
      ctx.shadowBlur = i === 0 ? 13 : 4;
      roundedRect(x + inset, y + inset, size, size, radius);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (i === 0) drawEyes(x, y);
      else {
        ctx.fillStyle = "rgba(230, 255, 225, .12)";
        roundedRect(x + 6, y + 5, 5, 2, 1);
        ctx.fill();
      }
    }
  }

  function drawEyes(x, y) {
    let eyes;
    if (direction === "right") eyes = [[17, 8], [17, 16]];
    else if (direction === "left") eyes = [[7, 8], [7, 16]];
    else if (direction === "up") eyes = [[8, 7], [16, 7]];
    else eyes = [[8, 17], [16, 17]];
    ctx.fillStyle = "#173326";
    for (const eye of eyes) {
      ctx.beginPath();
      ctx.arc(x + eye[0], y + eye[1], 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles() {
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = "#caff83";
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function render(time, alpha) {
    drawBackground(time);
    drawFood(time);
    drawSnake(alpha);
    drawParticles();
  }

  function frame(now) {
    animationId = 0;
    resizeCanvas();
    const delta = Math.min((now - (lastFrame || now)) / 1000, 0.05);
    lastFrame = now;
    if (state === "running") {
      elapsed += delta;
      accumulator += delta * 1000;
      const interval = SPEEDS[speed];
      let safety = 0;
      while (accumulator >= interval && state === "running" && safety < 4) {
        step();
        accumulator -= interval;
        safety += 1;
      }
      updateParticles(delta);
      if (now - lastHudUpdate > 250) updateHud(false);
    } else {
      updateParticles(delta);
    }
    render(now, state === "running" ? Math.min(1, accumulator / SPEEDS[speed]) : 1);
    if (state === "running" || particles.length) animationId = requestAnimationFrame(frame);
  }

  function updateHud(force) {
    $("#score").textContent = formatScore(score);
    $("#food-count").textContent = String(foodsEaten);
    $("#level").textContent = String(Math.floor(score / 50) + 1).padStart(2, "0");
    $("#streak").innerHTML = String(streak) + " <small>×</small>";
    if (force || performance.now() - lastHudUpdate > 250) {
      $("#time-played").textContent = formatTime(elapsed);
      lastHudUpdate = performance.now();
    }
  }
  function formatTime(seconds) {
    const total = Math.floor(seconds);
    return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
  }

  function ensureAudio() {
    if (!soundEnabled || audioContext) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioCtor) {
      try { audioContext = new AudioCtor(); } catch (_) { audioContext = null; }
    }
  }
  function tone(frequency, duration, type) {
    if (!soundEnabled) return;
    ensureAudio();
    if (!audioContext) return;
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type || "sine";
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, audioContext.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration + 0.02);
  }

  function togglePause() {
    if (state === "running") pauseGame();
    else if (state === "paused") resumeGame();
    else if (state === "ready") startGame();
    else startGame();
  }

  startButton.addEventListener("click", startGame);
  pauseButton.addEventListener("click", togglePause);
  soundButton.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    saveValue("neon-snake-sound", soundEnabled);
    soundButton.classList.toggle("muted", !soundEnabled);
    soundButton.setAttribute("aria-pressed", String(soundEnabled));
    if (soundEnabled) {
      ensureAudio();
      tone(620, 0.07, "sine");
    }
  });

  document.querySelectorAll("[data-speed]").forEach((button) => {
    button.addEventListener("click", () => {
      speed = button.dataset.speed;
      document.querySelectorAll("[data-speed]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    });
  });
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state === "running") pauseGame();
      mode = button.dataset.mode;
      document.querySelectorAll("[data-mode]").forEach((item) => {
        const selected = item === button;
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      if (state !== "ready" && state !== "over" && state !== "won") {
        resetGame();
        state = "paused";
        $("#pause-indicator").hidden = false;
        pauseButton.disabled = false;
        pauseButton.innerHTML = "<span>▶</span> Continuar partida";
        setStatus("MODO ACTUALIZADO", false);
      }
      render(performance.now(), 1);
    });
  });

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const map = {
      arrowup: "up", w: "up",
      arrowright: "right", d: "right",
      arrowdown: "down", s: "down",
      arrowleft: "left", a: "left"
    };
    if (map[key]) {
      event.preventDefault();
      if (state === "paused") return;
      setDirection(map[key]);
    } else if (key === " " || key === "escape") {
      event.preventDefault();
      togglePause();
    } else if (key === "r") {
      event.preventDefault();
      resetGame();
      state = "ready";
      pauseButton.disabled = true;
      pauseButton.innerHTML = "<span>Ⅱ</span> Pausar partida";
      overlay.classList.remove("hidden");
      $("#overlay-symbol").textContent = "✦";
      $("#overlay-kicker").textContent = "NUEVA PARTIDA";
      $("#overlay-title").textContent = "¿Otra ronda?";
      $("#overlay-copy").textContent = "Tu récord sigue guardado. ¿Puedes superarlo?";
      startButton.querySelector("span").textContent = "Empezar partida";
      setStatus("LISTO PARA JUGAR", false);
      render(performance.now(), 1);
    }
  }, { passive: false });

  document.querySelectorAll("[data-direction]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      setDirection(button.dataset.direction);
    });
  });

  canvas.addEventListener("pointerdown", (event) => {
    swipeStart = { x: event.clientX, y: event.clientY };
    if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 18) {
      setDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    }
    swipeStart = null;
  });
  canvas.addEventListener("pointercancel", () => { swipeStart = null; });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") pauseGame();
  });
  window.addEventListener("resize", () => {
    resizeCanvas();
    render(performance.now(), 1);
  }, { passive: true });

  resetGame();
  resizeCanvas();
  render(0, 1);
  setStatus("LISTO PARA JUGAR", false);
})();