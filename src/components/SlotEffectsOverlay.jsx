import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// Thời gian hiển thị hiệu ứng Vệt chém (đơn vị: ms; 1000ms = 1 giây)
const SLASH_TIMINGS = {
  trailLifeMs: 260,
  slashCutBaseMs: 485,
  slashCutJitterMs: 75,
  flarePrimaryMs: 170,
  flareSecondaryMs: 150,
  sparkTrailBaseMs: 200,
  sparkTrailJitterMs: 110,
  sparkBurstBaseMs: 220,
  sparkBurstJitterMs: 120,
};

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function drawLeaf(ctx, size) {
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.bezierCurveTo(size * 0.75, -size * 0.45, size * 0.75, size * 0.45, 0, size);
  ctx.bezierCurveTo(-size * 0.75, size * 0.45, -size * 0.75, -size * 0.45, 0, -size);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -size * 0.75);
  ctx.lineTo(0, size * 0.75);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

function drawPetal(ctx, size) {
  ctx.beginPath();
  ctx.moveTo(0, size * 0.4);
  ctx.bezierCurveTo(size * 0.9, -size * 0.2, size * 0.55, -size * 1.1, 0, -size * 0.8);
  ctx.bezierCurveTo(-size * 0.55, -size * 1.1, -size * 0.9, -size * 0.2, 0, size * 0.4);
  ctx.closePath();
  ctx.fill();
}

function drawBlossom(ctx, size, centerColor) {
  const petals = 5;
  for (let i = 0; i < petals; i += 1) {
    ctx.save();
    ctx.rotate((i * Math.PI * 2) / petals);
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.55, size * 0.34, size * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.24, 0, Math.PI * 2);
  ctx.fillStyle = centerColor;
  ctx.fill();
}

function drawTaperedSlash(ctx, x, y, angle, length, thickness, fillStyle, glowColor) {
  const halfLen = length * 0.5;
  const halfThick = thickness * 0.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12;
  }
  ctx.beginPath();
  ctx.moveTo(-halfLen, 0);
  ctx.lineTo(0, -halfThick);
  ctx.lineTo(halfLen, 0);
  ctx.lineTo(0, halfThick);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
}

function drawStarFlare(ctx, x, y, radius, alpha, outerColor) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.shadowColor = outerColor;
  ctx.shadowBlur = 14;

  // 4-point crisp light flare
  for (let i = 0; i < 2; i += 1) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2 + Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(-radius, 0);
    ctx.lineTo(0, -radius * 0.16);
    ctx.lineTo(radius, 0);
    ctx.lineTo(0, radius * 0.16);
    ctx.closePath();
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = outerColor;
  ctx.fill();
  ctx.restore();
}

const BRUSH_STRANDS = [
  { offset: 0, widthScale: 0.72, alpha: 0.96, jitterScale: 1.0 },
  { offset: -4.2, widthScale: 0.34, alpha: 0.85, jitterScale: 1.5 },
  { offset: 4.0, widthScale: 0.3, alpha: 0.82, jitterScale: 1.5 },
  { offset: -8.5, widthScale: 0.16, alpha: 0.62, jitterScale: 2.2 },
  { offset: 8.2, widthScale: 0.15, alpha: 0.58, jitterScale: 2.2 },
  { offset: -12.5, widthScale: 0.1, alpha: 0.4, jitterScale: 2.8 },
  { offset: 12.0, widthScale: 0.1, alpha: 0.36, jitterScale: 2.8 },
];

export const SlotEffectsOverlay = forwardRef(function SlotEffectsOverlay(
  { effectStyle },
  ref,
) {
  const canvasRef = useRef(null);
  const effectStyleRef = useRef(effectStyle);
  effectStyleRef.current = effectStyle;

  const stateRef = useRef({
    trail: [],
    particles: [],
    slashes: [],
    flares: [],
    ripples: [],
    lastSlashAt: 0,
    lastSlashPos: null,
    rafId: null,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (stateRef.current.rafId) {
        cancelAnimationFrame(stateRef.current.rafId);
      }
    };
  }, []);

  const ensureLoop = () => {
    if (stateRef.current.rafId) return;

    const tick = (now) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const s = stateRef.current;

      if (!canvas || !ctx) {
        s.rafId = null;
        return;
      }

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      // 1. Prune and render pointer trails
      const trailLifetime =
        effectStyleRef.current === 'ink'
          ? 540
          : effectStyleRef.current === 'slash'
            ? SLASH_TIMINGS.trailLifeMs
            : 260;
      s.trail = s.trail.filter((pt) => now - pt.t < trailLifetime);

      if (s.trail.length >= 2) {
        const currentStyle = effectStyleRef.current;
        if (currentStyle === 'slash') {
          for (let i = 1; i < s.trail.length; i += 1) {
            const p0 = s.trail[i - 1];
            const p1 = s.trail[i];
            if (p1.strokeId !== p0.strokeId) continue;
            const age = (now - p1.t) / trailLifetime;
            const alpha = Math.max(0, 1 - age);
            const progress = i / s.trail.length;
            const width = Math.max(1, progress * 11 * alpha);
            const isRemove = p1.mode === 'remove';

            ctx.save();
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.strokeStyle = isRemove
              ? `rgba(239, 68, 68, ${alpha * 0.58})`
              : `rgba(34, 197, 94, ${alpha * 0.62})`;
            ctx.lineWidth = width * 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.strokeStyle = isRemove
              ? `rgba(254, 226, 226, ${alpha * 0.95})`
              : `rgba(240, 253, 244, ${alpha * 0.95})`;
            ctx.lineWidth = Math.max(1, width * 0.65);
            ctx.stroke();
            ctx.restore();
          }
        } else if (currentStyle === 'ink') {
          for (let i = 1; i < s.trail.length; i += 1) {
            const p0 = s.trail[i - 1];
            const p1 = s.trail[i];
            if (p1.strokeId !== p0.strokeId) continue;
            const age = (now - p1.t) / trailLifetime;
            const alpha = Math.max(0, 1 - age);
            const taper = Math.sin(Math.min(1, (i / s.trail.length) * 0.9 + 0.1) * Math.PI * 0.65);

            const dx = p1.x - p0.x;
            const dy = p1.y - p0.y;
            const dist = Math.hypot(dx, dy) || 1;
            const nx = -dy / dist;
            const ny = dx / dist;

            // Speed-sensitive brush pressure (slower = fuller ink, faster = sharper dry bristles)
            const speedThickness = Math.max(10, Math.min(24, 25 - dist * 0.22));
            const brushWidth = speedThickness * alpha * (0.45 + 0.55 * taper);
            const isRemove = p1.mode === 'remove';

            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Wide soft pastel wash under the black ink (matching screenshot halo)
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.strokeStyle = isRemove
              ? `rgba(248, 113, 113, ${alpha * 0.3})`
              : `rgba(244, 114, 182, ${alpha * 0.28})`;
            ctx.lineWidth = brushWidth * 2.05;
            ctx.stroke();

            // Multi-bristle sumi-e ink strands following cursor with organic hair jitter
            for (let b = 0; b < BRUSH_STRANDS.length; b += 1) {
              const strand = BRUSH_STRANDS[b];
              const j0 = p0.jitter[b % p0.jitter.length] * strand.jitterScale;
              const j1 = p1.jitter[b % p1.jitter.length] * strand.jitterScale;
              const o0 = (strand.offset + j0) * (0.5 + 0.5 * alpha);
              const o1 = (strand.offset + j1) * (0.5 + 0.5 * alpha);

              ctx.beginPath();
              ctx.moveTo(p0.x + nx * o0, p0.y + ny * o0);
              ctx.lineTo(p1.x + nx * o1, p1.y + ny * o1);
              ctx.strokeStyle = `rgba(15, 23, 42, ${(alpha * strand.alpha).toFixed(3)})`;
              ctx.lineWidth = Math.max(0.8, brushWidth * strand.widthScale);
              ctx.stroke();
            }

            ctx.restore();
          }
        }
      }

      // 2. Render tapered glowing slashes + impact flares
      s.slashes = s.slashes.filter((sl) => now - sl.t < sl.life);
      for (const sl of s.slashes) {
        const elapsed = now - sl.t;
        if (elapsed < 0) continue;
        const p = elapsed / sl.life;
        const alpha = Math.sin(p * Math.PI);
        const len = sl.len * (0.35 + 0.65 * Math.min(1, p * 2.6));
        const thick = sl.thick * (1 - p * 0.55);
        const isRemove = sl.mode === 'remove';

        drawTaperedSlash(
          ctx,
          sl.x,
          sl.y,
          sl.angle,
          len,
          thick * 2.4,
          isRemove
            ? `rgba(239, 68, 68, ${alpha * 0.78})`
            : `rgba(34, 197, 94, ${alpha * 0.82})`,
          isRemove ? 'rgba(251, 146, 60, 0.85)' : 'rgba(134, 239, 172, 0.9)',
        );
        drawTaperedSlash(
          ctx,
          sl.x,
          sl.y,
          sl.angle,
          len * 0.94,
          Math.max(1.2, thick * 0.85),
          `rgba(255, 255, 255, ${Math.min(1, alpha * 1.1)})`,
          null,
        );
      }

      s.flares = s.flares.filter((fl) => now - fl.t < fl.life);
      for (const fl of s.flares) {
        const elapsed = now - fl.t;
        if (elapsed < 0) continue;
        const p = elapsed / fl.life;
        const radius = fl.radius * (p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75);
        const alpha = 1 - p;
        drawStarFlare(ctx, fl.x, fl.y, Math.max(1, radius), alpha, fl.color);
      }

      // 3. Render expanding ripples (Bloom)
      s.ripples = s.ripples.filter((rp) => now - rp.t < rp.life);
      for (const rp of s.ripples) {
        const p = (now - rp.t) / rp.life;
        const ease = 1 - Math.pow(1 - p, 3);
        const radius = rp.startR + (rp.endR - rp.startR) * ease;
        const alpha = (1 - p) * rp.alpha;

        ctx.save();
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = rp.color.replace('{A}', alpha.toFixed(3));
        ctx.lineWidth = rp.lineWidth * (1 - p * 0.6);
        ctx.stroke();
        ctx.restore();
      }

      // 4. Render particles (velocity-streak sparks, leaves, petals, blossoms, ink splatters)
      const nextParticles = [];
      for (const pt of s.particles) {
        const age = now - pt.t;
        if (age < 0) {
          nextParticles.push(pt);
          continue;
        }
        if (age >= pt.life) continue;
        nextParticles.push(pt);

        const p = age / pt.life;
        const frames = age / 16;
        const dragFactor = pt.drag ? (1 - Math.pow(pt.drag, frames)) / (1 - pt.drag) : frames;
        const x =
          pt.x +
          pt.vx * dragFactor +
          (pt.sway ? Math.sin(age * 0.012 + pt.phase) * pt.sway : 0);
        const y =
          pt.y +
          pt.vy * dragFactor +
          0.5 * pt.gravity * Math.pow(frames, 2);

        const flicker = pt.flicker ? 0.65 + 0.35 * Math.sin(age * 0.1 + pt.phase) : 1;
        const alpha =
          (p < 0.15 ? p / 0.15 : Math.max(0, 1 - (p - 0.15) / 0.85)) * flicker;

        if (pt.kind === 'spark') {
          const speedNowX = pt.vx * Math.pow(pt.drag || 1, frames);
          const speedNowY =
            pt.vy * Math.pow(pt.drag || 1, frames) + pt.gravity * frames;
          const tailLen = Math.max(4, Math.hypot(speedNowX, speedNowY) * 2.6);
          const streakAngle = Math.atan2(speedNowY, speedNowX);

          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(streakAngle);
          ctx.globalAlpha = alpha;
          ctx.shadowColor = pt.color;
          ctx.shadowBlur = 8;

          ctx.beginPath();
          ctx.moveTo(-tailLen, 0);
          ctx.lineTo(0, -pt.size * 0.55);
          ctx.lineTo(tailLen * 0.35, 0);
          ctx.lineTo(0, pt.size * 0.55);
          ctx.closePath();
          ctx.fillStyle = pt.color;
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(-tailLen * 0.55, 0);
          ctx.lineTo(tailLen * 0.25, 0);
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = Math.max(0.9, pt.size * 0.45);
          ctx.stroke();
          ctx.restore();
          continue;
        }

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(pt.rot + pt.vRot * frames);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = pt.color;

        if (pt.kind === 'leaf') {
          drawLeaf(ctx, pt.size);
        } else if (pt.kind === 'petal') {
          drawPetal(ctx, pt.size);
        } else if (pt.kind === 'blossom') {
          drawBlossom(ctx, pt.size, pt.centerColor || '#FEF08A');
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, pt.size * (1 - p * 0.3), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      s.particles = nextParticles;

      if (
        s.trail.length > 0 ||
        s.particles.length > 0 ||
        s.slashes.length > 0 ||
        s.flares.length > 0 ||
        s.ripples.length > 0
      ) {
        s.rafId = requestAnimationFrame(tick);
      } else {
        s.rafId = null;
      }
    };

    stateRef.current.rafId = requestAnimationFrame(tick);
  };

  useImperativeHandle(ref, () => ({
    addTrailPoint(x, y, mode = 'add', strokeId = 0) {
      if (prefersReducedMotion()) return;
      const now = performance.now();
      const s = stateRef.current;
      s.trail.push({
        x,
        y,
        t: now,
        mode,
        strokeId,
        jitter: [
          (Math.random() - 0.5) * 2.2,
          (Math.random() - 0.5) * 2.6,
          (Math.random() - 0.5) * 2.6,
          (Math.random() - 0.5) * 3.0,
        ],
      });

      const style = effectStyleRef.current;
      const isRemove = mode === 'remove';

      if (style === 'slash') {
        const dist = s.lastSlashPos
          ? Math.hypot(x - s.lastSlashPos.x, y - s.lastSlashPos.y)
          : 999;
        if (now - s.lastSlashAt >= 18 && dist >= 7) {
          const moveAngle = s.lastSlashPos
            ? Math.atan2(y - s.lastSlashPos.y, x - s.lastSlashPos.x)
            : 0;
          s.lastSlashAt = now;
          s.lastSlashPos = { x, y };
          const burstCount = dist > 22 ? 3 : 2;
          for (let i = 0; i < burstCount; i += 1) {
            s.slashes.push({
              x: x + (Math.random() - 0.5) * 34,
              y: y + (Math.random() - 0.5) * 34,
              len: 32 + Math.random() * 44,
              thick: 2.6 + Math.random() * 2.6,
              angle: Math.random() * Math.PI,
              mode,
              t: now + i * 14,
              life:
                SLASH_TIMINGS.slashCutBaseMs +
                Math.random() * SLASH_TIMINGS.slashCutJitterMs,
            });
          }

          // Shower of glowing sparks trailing along & behind the blade
          for (let i = 0; i < 4; i += 1) {
            const sparkAngle =
              moveAngle + Math.PI + (Math.random() - 0.5) * 1.9;
            const speed = 2.6 + Math.random() * 4.4;
            s.particles.push({
              kind: 'spark',
              x: x + (Math.random() - 0.5) * 14,
              y: y + (Math.random() - 0.5) * 14,
              vx: Math.cos(sparkAngle) * speed,
              vy: Math.sin(sparkAngle) * speed,
              drag: 0.9,
              gravity: 0,
              sway: 0,
              flicker: true,
              phase: Math.random() * Math.PI * 2,
              rot: 0,
              vRot: 0,
              size: 1.8 + Math.random() * 1.8,
              color: isRemove
                ? i % 2 === 0
                  ? '#FDBA74'
                  : '#F87171'
                : i % 2 === 0
                  ? '#FEF08A'
                  : '#4ADE80',
              t: now,
              life:
                SLASH_TIMINGS.sparkTrailBaseMs +
                Math.random() * SLASH_TIMINGS.sparkTrailJitterMs,
            });
          }
        }
      } else if (style === 'bloom' && Math.random() < 0.72) {
        const spawnCount = Math.random() < 0.45 ? 2 : 1;
        for (let i = 0; i < spawnCount; i += 1) {
          const roll = Math.random();
          const kind = roll < 0.48 ? 'leaf' : roll < 0.8 ? 'petal' : 'blossom';
          const color =
            kind === 'leaf'
              ? isRemove
                ? '#86EFAC'
                : Math.random() < 0.6
                  ? '#16A34A'
                  : '#4ADE80'
              : isRemove
                ? '#FDA4AF'
                : Math.random() < 0.65
                  ? '#F472B6'
                  : '#FDE047';

          s.particles.push({
            kind,
            x: x + (Math.random() - 0.5) * 16,
            y: y + (Math.random() - 0.5) * 16,
            vx: (Math.random() - 0.5) * 1.4,
            vy: isRemove ? 0.7 + Math.random() * 1.1 : -0.7 - Math.random() * 1.1,
            gravity: isRemove ? 0.04 : 0.015,
            sway: 6,
            phase: Math.random() * Math.PI * 2,
            rot: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 0.08,
            size: kind === 'blossom' ? 5.5 : 4.5 + Math.random() * 3,
            color,
            centerColor: '#FEF08A',
            t: now,
            life: 520 + Math.random() * 220,
          });
        }
      } else if (style === 'ink') {
        const spawnCount = Math.random() < 0.6 ? 2 : 1;
        for (let i = 0; i < spawnCount; i += 1) {
          const isBlackDrop = Math.random() < 0.55;
          s.particles.push({
            kind: isBlackDrop ? 'dot' : 'petal',
            x: x + (Math.random() - 0.5) * 26,
            y: y + (Math.random() - 0.5) * 26,
            vx: (Math.random() - 0.5) * 1.4,
            vy: (Math.random() - 0.5) * 1.4,
            gravity: isBlackDrop ? 0.025 : 0.012,
            sway: isBlackDrop ? 0 : 4,
            phase: Math.random() * Math.PI * 2,
            rot: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 0.06,
            size: isBlackDrop ? 1.6 + Math.random() * 3.0 : 4 + Math.random() * 2.5,
            color: isBlackDrop
              ? '#0F172A'
              : isRemove
                ? '#FCA5A5'
                : Math.random() < 0.5
                  ? '#FB7185'
                  : '#FDA4AF',
            t: now,
            life: 480 + Math.random() * 240,
          });
        }
      }

      ensureLoop();
    },

    emitCellBurst(rect, mode = 'add', originX = null, originY = null) {
      if (prefersReducedMotion() || !rect) return;
      const now = performance.now();
      const s = stateRef.current;
      const style = effectStyleRef.current;
      const cx = originX ?? rect.left + rect.width / 2;
      const cy = originY ?? rect.top + rect.height / 2;
      const isRemove = mode === 'remove';

      if (style === 'slash') {
        const slashCount = 7;
        for (let i = 0; i < slashCount; i += 1) {
          s.slashes.push({
            x: cx + (Math.random() - 0.5) * 38,
            y: cy + (Math.random() - 0.5) * 32,
            len: 36 + Math.random() * 46,
            thick: 2.8 + Math.random() * 2.8,
            angle: (i / slashCount) * Math.PI + (Math.random() - 0.5) * 0.55,
            mode,
            t: now + i * 15,
            life:
              SLASH_TIMINGS.slashCutBaseMs +
              Math.random() * SLASH_TIMINGS.slashCutJitterMs,
          });
        }

        // Sharp cross light flares at impact points
        s.flares.push({
          x: cx,
          y: cy,
          radius: 26,
          color: isRemove ? '#FB923C' : '#FEF08A',
          t: now,
          life: SLASH_TIMINGS.flarePrimaryMs,
        });
        s.flares.push({
          x: cx + (Math.random() - 0.5) * 20,
          y: cy + (Math.random() - 0.5) * 18,
          radius: 17,
          color: isRemove ? '#F87171' : '#86EFAC',
          t: now + 30,
          life: SLASH_TIMINGS.flareSecondaryMs,
        });

        // High-velocity streaking sparks with flicker & gravity arc
        for (let i = 0; i < 18; i += 1) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 3.2 + Math.random() * 5.2;
          s.particles.push({
            kind: 'spark',
            x: cx + (Math.random() - 0.5) * 10,
            y: cy + (Math.random() - 0.5) * 10,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            drag: 0.89,
            gravity: 0,
            sway: 0,
            flicker: true,
            phase: Math.random() * Math.PI * 2,
            rot: angle,
            vRot: 0,
            size: 2.0 + Math.random() * 2.2,
            color: isRemove
              ? i % 3 === 0
                ? '#FEF08A'
                : i % 2 === 0
                  ? '#FB923C'
                  : '#F87171'
              : i % 3 === 0
                ? '#FEF08A'
                : i % 2 === 0
                  ? '#86EFAC'
                  : '#4ADE80',
            t: now + (i % 3) * 10,
            life:
              SLASH_TIMINGS.sparkBurstBaseMs +
              Math.random() * SLASH_TIMINGS.sparkBurstJitterMs,
          });
        }
      } else if (style === 'bloom') {
        const cellCx = rect.left + rect.width / 2;
        const cellCy = rect.top + rect.height / 2;

        s.ripples.push({
          x: cellCx,
          y: cellCy,
          startR: 4,
          endR: Math.max(rect.width, rect.height) * 0.65,
          alpha: 0.55,
          lineWidth: 2.5,
          color: isRemove ? 'rgba(239, 68, 68, {A})' : 'rgba(22, 163, 74, {A})',
          t: now,
          life: 380,
        });

        const count = 13;
        for (let i = 0; i < count; i += 1) {
          const baseAngle = (i / count) * Math.PI * 2 + Math.random() * 0.45;
          const speed = isRemove ? 0.75 + Math.random() * 1.15 : 1.15 + Math.random() * 1.8;
          const mod = i % 3;
          const kind = mod === 0 ? 'leaf' : mod === 1 ? 'blossom' : 'petal';

          const color =
            kind === 'leaf'
              ? isRemove
                ? '#4ADE80'
                : i % 2 === 0
                  ? '#16A34A'
                  : '#22C55E'
              : kind === 'blossom'
                ? isRemove
                  ? '#FDA4AF'
                  : i % 2 === 0
                    ? '#F472B6'
                    : '#FBBF24'
                : isRemove
                  ? '#FECDD3'
                  : '#F9A8D4';

          s.particles.push({
            kind,
            x: cellCx + (Math.random() - 0.5) * 10,
            y: cellCy + (Math.random() - 0.5) * 10,
            vx: Math.cos(baseAngle) * speed,
            vy: isRemove
              ? 0.8 + Math.random() * 1.2
              : Math.sin(baseAngle) * speed - 0.85,
            gravity: isRemove ? 0.042 : 0.02,
            sway: 7,
            phase: Math.random() * Math.PI * 2,
            rot: baseAngle,
            vRot: (Math.random() - 0.5) * 0.09,
            size: kind === 'blossom' ? 6.2 : 5 + Math.random() * 2.8,
            color,
            centerColor: '#FEF08A',
            t: now + (i % 4) * 14,
            life: 580 + Math.random() * 240,
          });
        }
      } else if (style === 'ink') {
        // Ink splatter & floating flecks right around cursor without spawning a ring
        for (let i = 0; i < 14; i += 1) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.6 + Math.random() * 2.1;
          const isInkDrop = i < 8;

          s.particles.push({
            kind: isInkDrop ? 'dot' : 'petal',
            x: cx + (Math.random() - 0.5) * 18,
            y: cy + (Math.random() - 0.5) * 18,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (isInkDrop ? 0 : 0.35),
            gravity: isInkDrop ? 0.025 : 0.012,
            sway: isInkDrop ? 0 : 4,
            phase: Math.random() * Math.PI * 2,
            rot: angle + Math.random(),
            vRot: (Math.random() - 0.5) * 0.07,
            size: isInkDrop ? 1.8 + Math.random() * 3.4 : 4.2 + Math.random() * 2.4,
            color: isInkDrop
              ? '#0F172A'
              : isRemove
                ? '#FCA5A5'
                : i % 2 === 0
                  ? '#FB7185'
                  : '#FDA4AF',
            t: now + (i % 4) * 12,
            life: 460 + Math.random() * 220,
          });
        }
      }

      ensureLoop();
    },
  }));

  return <canvas ref={canvasRef} className="slot-effects-canvas" aria-hidden="true" />;
});
