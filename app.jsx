// src/App.jsx
import React, { useRef, useEffect, useState } from "react";

const BIRD_IMG_URL = "/mnt/data/48f4b915-3e4a-4727-9fa1-059084c8f09e.png"; // <- uploaded file path

export default function App() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  // Game settings
  const width = 480;
  const height = 640;
  const gravity = 0.1;
  const jumpV = -3;
  const pipeGap = 175;
  const pipeWidth = 60;
  const pipeSpacing = 220; // horizontal spacing between pipes
  const pipeSpeed = 1.6;

  // State held in refs for performant animation loop
  const bird = useRef({ x: 100, y: height / 2, vy: 0, w: 34, h: 24 });
  const pipes = useRef([]);
  const frame = useRef(0);
  const scoreRef = useRef(0);
  const started = useRef(false);
  const gameOver = useRef(false);

  const [score, setScore] = useState(0);
  const [showInstructions, setShowInstructions] = useState(true);

  // Load bird image
  const birdImgRef = useRef(new Image());
  useEffect(() => {
    const img = birdImgRef.current;
    img.src = BIRD_IMG_URL;
    // if image fails, we still draw a rectangle as fallback
  }, []);

  // Reset game
  function resetGame() {
    bird.current = { x: 100, y: height / 2, vy: 0, w: 34, h: 24 };
    pipes.current = [];
    frame.current = 0;
    scoreRef.current = 0;
    setScore(0);
    started.current = false;
    gameOver.current = false;
    setShowInstructions(true);
  }

  // Create pipe pair
  function pushPipe(xPos) {
    const minTop = 40;
    const maxTop = height - pipeGap - 80;
    const topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
    pipes.current.push({ x: xPos, top: topHeight, passed: false });
  }

  // Input: jump
  function jump() {
    if (gameOver.current) {
      resetGame();
      return;
    }
    started.current = true;
    setShowInstructions(false);
    bird.current.vy = jumpV;
  }

  // Hook: keyboard + click/tap listeners
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        jump();
      }
    };
    const onClick = () => {
      // click on canvas should jump
      jump();
    };

    window.addEventListener("keydown", onKey);
    const canvas = canvasRef.current;
    canvas.addEventListener("mousedown", onClick);
    canvas.addEventListener("touchstart", onClick, { passive: true });

    return () => {
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("mousedown", onClick);
      canvas.removeEventListener("touchstart", onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Main animation loop
  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      update();
      draw(ctx);
    }

    function update() {
      if (!started.current || gameOver.current) {
        return;
      }

      // Bird physics
      bird.current.vy += gravity;
      bird.current.y += bird.current.vy;

      // Pipes movement and generation
      frame.current++;
      if (frame.current % Math.floor(pipeSpacing / pipeSpeed) === 0) {
        pushPipe(width + 20);
      }

      for (let i = pipes.current.length - 1; i >= 0; i--) {
        const p = pipes.current[i];
        p.x -= pipeSpeed;

        // scoring: when pipe center passes bird.x and not yet counted
        if (!p.passed && p.x + pipeWidth < bird.current.x) {
          p.passed = true;
          scoreRef.current += 1;
          setScore(scoreRef.current);
        }

        // remove off-screen pipes
        if (p.x + pipeWidth < -50) {
          pipes.current.splice(i, 1);
        }
      }

      // Collisions
      const bx = bird.current.x;
      const by = bird.current.y;
      const bw = bird.current.w;
      const bh = bird.current.h;

      // floor/ceiling
      if (by + bh > height || by < 0) {
        onGameOver();
        return;
      }

      for (const p of pipes.current) {
        // top pipe rect: x -> p.x, y -> 0, width -> pipeWidth, height -> p.top
        // bottom pipe rect: x -> p.x, y -> p.top + pipeGap, width -> pipeWidth, height -> Infinity
        if (
          rectIntersect(bx, by, bw, bh, p.x, 0, pipeWidth, p.top) ||
          rectIntersect(
            bx,
            by,
            bw,
            bh,
            p.x,
            p.top + pipeGap,
            pipeWidth,
            height - (p.top + pipeGap)
          )
        ) {
          onGameOver();
          return;
        }
      }
    }

    function onGameOver() {
      gameOver.current = true;
      started.current = false;
    }

    function draw(ctx) {
      // background
      ctx.fillStyle = "#70c5ce";
      ctx.fillRect(0, 0, width, height);

      // ground
      ctx.fillStyle = "#ded895";
      ctx.fillRect(0, height - 80, width, 80);

      // pipes
      for (const p of pipes.current) {
        // top
        ctx.fillStyle = "#2ecc71";
        ctx.fillRect(p.x, 0, pipeWidth, p.top);
        // bottom
        ctx.fillRect(p.x, p.top + pipeGap, pipeWidth, height - (p.top + pipeGap));
        // pipe caps
        ctx.fillStyle = "#1e8f3e";
        ctx.fillRect(p.x - 4, p.top - 12, pipeWidth + 8, 12);
        ctx.fillRect(p.x - 4, p.top + pipeGap, pipeWidth + 8, 12);
      }

      // bird (image or fallback)
      const img = birdImgRef.current;
      if (img.complete && img.naturalWidth !== 0) {
        ctx.save();
        // rotate a bit based on velocity
        const angle = Math.max(-0.6, Math.min(0.8, bird.current.vy / 15));
        ctx.translate(bird.current.x + bird.current.w / 2, bird.current.y + bird.current.h / 2);
        ctx.rotate(angle);
        ctx.drawImage(img, -bird.current.w / 2, -bird.current.h / 2, bird.current.w, bird.current.h);
        ctx.restore();
      } else {
        ctx.fillStyle = "yellow";
        ctx.fillRect(bird.current.x, bird.current.y, bird.current.w, bird.current.h);
      }

      // score
      ctx.fillStyle = "#fff";
      ctx.font = "38px Arial";
      ctx.textAlign = "center";
      ctx.fillText(scoreRef.current, width / 2, 80);

      // instructions / game over
      if (showInstructions && !started.current) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(30, height / 2 - 80, width - 60, 140);
        ctx.fillStyle = "#fff";
        ctx.font = "18px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Click / Tap or press Space to flap", width / 2, height / 2 - 20);
        ctx.fillText("Avoid pipes — tap to start", width / 2, height / 2 + 10);
        ctx.fillText("Click after Game Over to restart", width / 2, height / 2 + 40);
      }

      if (gameOver.current) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(40, height / 2 - 60, width - 80, 120);
        ctx.fillStyle = "#fff";
        ctx.font = "28px Arial";
        ctx.fillText("Game Over", width / 2, height / 2 - 10);
        ctx.font = "18px Arial";
        ctx.fillText(`Score: ${scoreRef.current}`, width / 2, height / 2 + 20);
        ctx.fillText("Click or press Space to restart", width / 2, height / 2 + 50);
      }
    }

    // start loop
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper: rectangle intersection (AABB)
  function rectIntersect(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // Canvas inline style to center on page
  const containerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: 12,
    marginTop: 18,
  };

  return (
    <div style={{ textAlign: "center", padding: 12 }}>
      <h2 style={{ margin: 6 }}>Flappy Bird — React Canvas</h2>
      <div style={containerStyle}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            border: "3px solid #333",
            borderRadius: 8,
            touchAction: "manipulation",
          }}
        />
        <div style={{ color: "#555" }}>
          <strong>Score:</strong> {score}
        </div>
        <div style={{ color: "#777", fontSize: 13 }}>
          Controls: <em>Space</em> or <em>Click / Tap</em>
        </div>
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => {
              // start or flap
              jump();
            }}
          >
            Flap / Start
          </button>{" "}
          <button
            onClick={() => {
              resetGame();
            }}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
