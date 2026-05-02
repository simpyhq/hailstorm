const COLORS = {
  teal: "#00d4ff",
  amber: "#ffa500",
  gold: "#ffd700",
};

const STATE_CONFIG = {
  idle: { speed: 1, pulse: 0.18, color: COLORS.teal, scan: false, talk: false },
  listening: { speed: 3, pulse: 0.4, color: COLORS.teal, scan: false, talk: false },
  processing: { speed: 5, pulse: 0.28, color: COLORS.teal, scan: true, talk: false },
  speaking: { speed: 1.6, pulse: 0.5, color: COLORS.teal, scan: false, talk: true },
  alert: { speed: 1.2, pulse: 0.32, color: COLORS.gold, scan: false, talk: false },
};

export class JarvisOrb {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = "idle";
    this.theme = "default";
    this.revealProgress = 1;
    this.revealStart = null;
    this.revealDuration = 1000;
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.dimensions = { cssSize: 600, center: 300 };

    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);

    this.resize();
    window.addEventListener("resize", this.resize);
    this.frame = requestAnimationFrame(this.loop);
  }

  setState(nextState) {
    if (STATE_CONFIG[nextState]) {
      this.state = nextState;
    }
  }

  setNightMode(enabled) {
    this.theme = enabled ? "night" : "default";
  }

  playBootReveal() {
    this.revealProgress = 0;
    this.revealStart = performance.now();
  }

  toggleListening() {
    this.setState(this.state === "listening" ? "idle" : "listening");
  }

  resize() {
    const parentWidth = this.canvas.parentElement?.clientWidth ?? 600;
    const size = Math.min(600, Math.max(260, parentWidth - 40));
    const dpr = window.devicePixelRatio || 1;

    this.dimensions.cssSize = size;
    this.dimensions.center = 300;

    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.canvas.width = 600 * dpr;
    this.canvas.height = 600 * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  getPalette() {
    const palette = STATE_CONFIG[this.state];
    if (this.theme === "night") {
      return {
        ...palette,
        color: COLORS.amber,
        accentColor: palette.color === COLORS.gold ? COLORS.gold : "#ffd27a",
      };
    }

    return {
      ...palette,
      accentColor: this.state === "alert" ? palette.color : COLORS.gold,
    };
  }

  drawCore(ctx, time, palette) {
    const basePulse = palette.talk
      ? 1 + Math.sin(time * 0.008) * palette.pulse
      : 1 + Math.sin(time * 0.004) * palette.pulse;
    const radius = 60 * basePulse;
    const gradient = ctx.createRadialGradient(300, 300, 12, 300, 300, 110);
    gradient.addColorStop(0, palette.color);
    gradient.addColorStop(0.45, palette.color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.shadowColor = palette.color;
    ctx.shadowBlur = this.state === "listening" ? 48 : 32;
    ctx.beginPath();
    ctx.arc(300, 300, radius + 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.color;
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(300, 300, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawFullRing(ctx, radius, rotation, width, color, alpha = 1, progress = 1) {
    ctx.save();
    ctx.translate(300, 300);
    ctx.rotate(rotation);
    ctx.strokeStyle = this.withAlpha(color, alpha);
    ctx.lineWidth = width;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
    ctx.restore();
  }

  drawSegmentRing(ctx, radius, rotation, color, progress = 1) {
    ctx.save();
    ctx.translate(300, 300);
    ctx.rotate(rotation);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;

    const segments = 12;
    const segmentArc = (Math.PI * 2) / segments;
    const visibleArc = segmentArc * 0.55;

    const visibleSegments = Math.max(0, Math.floor(segments * progress));
    const partialProgress = (segments * progress) % 1;

    for (let i = 0; i < visibleSegments; i += 1) {
      const start = i * segmentArc;
      ctx.beginPath();
      ctx.arc(0, 0, radius, start, start + visibleArc);
      ctx.stroke();
    }

    if (visibleSegments < segments && partialProgress > 0) {
      const start = visibleSegments * segmentArc;
      ctx.beginPath();
      ctx.arc(0, 0, radius, start, start + visibleArc * partialProgress);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawTickRing(ctx, radius, color, progress = 1) {
    ctx.save();
    ctx.translate(300, 300);
    ctx.strokeStyle = this.withAlpha(color, 0.7);
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    const totalTicks = 36;
    const tickCount = Math.max(0, Math.round(totalTicks * progress));

    for (let index = 0; index < tickCount; index += 1) {
      const deg = index * 10;
      const rad = (deg * Math.PI) / 180;
      const inner = radius - 8;
      const outer = radius + 8;

      ctx.beginPath();
      ctx.moveTo(Math.cos(rad) * inner, Math.sin(rad) * inner);
      ctx.lineTo(Math.cos(rad) * outer, Math.sin(rad) * outer);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawOuterArc(ctx, radius, rotation, color, accentColor, progress = 1) {
    ctx.save();
    ctx.translate(300, 300);
    ctx.rotate(rotation);
    ctx.lineWidth = 8;
    ctx.shadowBlur = 18;

    ctx.strokeStyle = this.withAlpha(color, 0.86);
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, ((Math.PI * 3) / 2) * progress);
    ctx.stroke();

    if (progress > 0.6) {
      const accentProgress = Math.min(1, (progress - 0.6) / 0.4);
      ctx.strokeStyle = accentColor;
      ctx.shadowColor = accentColor;
      ctx.beginPath();
      ctx.arc(0, 0, radius, Math.PI / 7, Math.PI / 7 + (Math.PI / 6) * accentProgress);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawDashedRing(ctx, radius, rotation, color, progress = 1) {
    ctx.save();
    ctx.translate(300, 300);
    ctx.rotate(rotation);
    ctx.strokeStyle = this.withAlpha(color, 0.32);
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 12]);
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
    ctx.restore();
  }

  drawScanningSweep(ctx, time, color) {
    if (!STATE_CONFIG[this.state].scan) {
      return;
    }

    const angle = (time * 0.006) % (Math.PI * 2);
    ctx.save();
    ctx.translate(300, 300);
    ctx.rotate(angle);
    const sweep = ctx.createLinearGradient(0, 0, 220, 0);
    sweep.addColorStop(0, "rgba(0,0,0,0)");
    sweep.addColorStop(1, this.withAlpha(color, 0.35));
    ctx.fillStyle = sweep;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(220, -1);
    ctx.lineTo(220, 1);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  withAlpha(hex, alpha) {
    const normalized = hex.replace("#", "");
    const bigint = parseInt(normalized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  clear() {
    this.ctx.clearRect(0, 0, 600, 600);
  }

  loop(now) {
    const ctx = this.ctx;
    const elapsed = now - this.startTime;
    const palette = this.getPalette();
    const accentColor = palette.accentColor ?? COLORS.gold;
    const innerRotation = (elapsed / 20000) * Math.PI * 2 * palette.speed;
    const middleRotation = (-elapsed / 15000) * Math.PI * 2 * palette.speed;
    const outerRotation = (elapsed / 30000) * Math.PI * 2 * palette.speed;
    const dashRotation = (-elapsed / 60000) * Math.PI * 2 * palette.speed;

    if (this.revealStart !== null) {
      const progress = Math.min(1, (now - this.revealStart) / this.revealDuration);
      this.revealProgress = progress;
      if (progress >= 1) {
        this.revealStart = null;
      }
    }

    const ring1Progress = Math.max(0, Math.min(1, this.revealProgress / 0.25));
    const ring2Progress = Math.max(0, Math.min(1, (this.revealProgress - 0.2) / 0.25));
    const ring3Progress = Math.max(0, Math.min(1, (this.revealProgress - 0.4) / 0.2));
    const ring4Progress = Math.max(0, Math.min(1, (this.revealProgress - 0.58) / 0.22));
    const ring5Progress = Math.max(0, Math.min(1, (this.revealProgress - 0.76) / 0.24));

    this.clear();
    this.drawScanningSweep(ctx, elapsed, palette.color);
    if (this.revealProgress > 0) {
      this.drawCore(ctx, elapsed, {
        ...palette,
        pulse: palette.pulse * Math.max(this.revealProgress, 0.35),
      });
    }
    this.drawFullRing(ctx, 90, innerRotation, 3, palette.color, 1, ring1Progress);
    this.drawSegmentRing(ctx, 130, middleRotation, palette.color, ring2Progress);
    this.drawTickRing(ctx, 160, palette.color, ring3Progress);
    this.drawOuterArc(ctx, 200, outerRotation, palette.color, accentColor, ring4Progress);
    this.drawDashedRing(ctx, 220, dashRotation, palette.color, ring5Progress);

    this.lastTime = now;
    this.frame = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    window.removeEventListener("resize", this.resize);
  }
}
