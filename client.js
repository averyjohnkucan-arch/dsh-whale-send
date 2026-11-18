window.__ModuleLoader__.load({
  id: "dsh-whale-send",
  factory(require) {
    const React = require("react");
    const atlasUrl = require.asset(
      "plugins/@deepseek-ai/dsh-client-ui-brand-official/assets/breach-atlas-43c5305a3d4d.webp",
    );
    const duration = 5700;
    const fadeDuration = 250;
    const width = 192,
      height = 108,
      columns = 12,
      frames = 137;

    // Decode the host's own breach atlas. Red is dot size, green is opacity.
    async function readAtlas() {
      const image = new Image();
      image.src = atlasUrl;
      await image.decode();
      const sheet = document.createElement("canvas");
      sheet.width = image.naturalWidth;
      sheet.height = image.naturalHeight;
      try {
        if (
          sheet.width !== columns * width ||
          sheet.height !== Math.ceil(frames / columns) * height
        )
          throw Error("Unexpected whale atlas dimensions");
        const context = sheet.getContext("2d");
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, sheet.width, sheet.height).data;
      } finally {
        sheet.width = sheet.height = 0;
      }
    }

    // RC4's first (dot-fill) breach, with the same geometry, cadence and water fade.
    function paint(ctx, pixels, frame, progress, w, h) {
      ctx.clearRect(0, 0, w, h);
      const scene = Math.min(Math.max(w * 0.94, 720), h * 1.6, 1120) * 1.12;
      const cell = scene / width;
      const left = (w - scene) / 2,
        top = h * 0.43 - (height * cell) / 2;
      const stride = width * columns;
      const offset =
        (Math.floor(frame / columns) * height * stride +
          (frame % columns) * width) *
        4;
      const alpha =
        0.65 * 0.8 * Math.min(1, progress * 15, (1 - progress) * 10);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = offset + (y * stride + x) * 4;
          const mask = pixels[i + 1] / 255;
          if (mask < 0.015) continue;
          ctx.globalAlpha = mask * alpha;
          ctx.beginPath();
          ctx.arc(
            left + (x + 0.5) * cell,
            top + (y + 0.5) * cell,
            (pixels[i] / 255) * cell,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    function attach(anchor) {
      const body = anchor.closest("[data-conversation-content]");
      if (!body) return;
      const media = matchMedia("(prefers-reduced-motion: reduce)");
      const events = new AbortController();
      let atlas, intent, active, timer, raf;
      function reset() {
        clearTimeout(timer);
        cancelAnimationFrame(raf);
        if (active) active.layer.remove();
        active = intent = undefined;
      }
      function eligible() {
        return (
          !document.hidden &&
          !media.matches &&
          body.dataset.contentPhase === "hero" &&
          body.querySelector("canvas[data-home-whale]")
        );
      }
      function prepare() {
        if (!atlas)
          atlas = readAtlas().catch(() => {
            atlas = undefined;
            return null;
          });
        return atlas;
      }
      function arm(event) {
        const native = eligible();
        if (!native || !(event.target instanceof Element)) return;
        // The primary Send button has an aria-busy flag in every RC4 language.
        const send = event.target.closest(
          "[data-composer-card] button[aria-busy][class$=_primary]",
        );
        const editor = event.target.closest("[data-composer-input]");
        if (
          event.type === "click"
            ? !send || send.disabled || event.button !== 0
            : !editor ||
              event.key !== "Enter" ||
              event.shiftKey ||
              event.isComposing ||
              event.repeat
        )
          return;
        const session = body.dataset.conversationSession;
        if (!session) return;
        reset();
        const style = getComputedStyle(native);
        intent = {
          session,
          color: style.color,
          opacity: Math.min(1, Number(style.opacity) * 2),
          atlas: prepare(),
        };
        // A rejected submission must not arm a later page change.
        timer = setTimeout(reset, 5000);
      }

      async function start(attempt) {
        // Do not put a blank cover over a working chat while loading an asset.
        clearTimeout(timer);
        const pixels = await attempt.atlas;
        if (attempt !== intent) return;
        if (
          !pixels ||
          media.matches ||
          document.hidden ||
          !body.isConnected ||
          body.dataset.contentPhase !== "active" ||
          body.dataset.conversationSession !== attempt.session
        )
          return reset();
        const layer = document.createElement("div"),
          canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return reset();
        layer.dataset.whaleSend = "";
        layer.setAttribute("aria-hidden", "true");
        layer.style.cssText =
          "position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden;background:var(--dsw-alias-bg-base)";
        canvas.style.cssText =
          "display:block;width:100%;height:100%;filter:grayscale(1)";
        canvas.style.opacity = String(attempt.opacity);
        layer.append(canvas);
        body.append(layer);
        active = { session: attempt.session, layer };
        intent = undefined;
        const began = performance.now();
        let lastFrame = -1;
        function tick(now) {
          const elapsed = now - began,
            w = layer.clientWidth,
            h = layer.clientHeight;
          if (
            elapsed >= duration + fadeDuration ||
            !w ||
            !h ||
            !body.isConnected
          )
            return reset();
          const dpr = Math.min(devicePixelRatio, 2);
          const px = Math.round(w * dpr),
            py = Math.round(h * dpr);
          if (lastFrame < 0 || canvas.width !== px || canvas.height !== py) {
            canvas.width = px;
            canvas.height = py;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = attempt.color;
            lastFrame = -1;
          }
          const progress = Math.min(1, elapsed / duration);
          const frame = Math.min(frames - 1, Math.floor(progress * frames));
          if (frame !== lastFrame) {
            paint(ctx, pixels, frame, progress, w, h);
            lastFrame = frame;
          }
          const t = Math.min(
            1,
            Math.max(0, (duration + fadeDuration - elapsed) / fadeDuration),
          );
          layer.style.opacity = String(t * t * (3 - 2 * t));
          raf = requestAnimationFrame(tick);
        }
        tick(began);
      }

      const observer = new MutationObserver(() => {
        const session = body.dataset.conversationSession;
        if (
          active &&
          (active.session !== session || body.dataset.contentPhase !== "active")
        )
          reset();
        if (!intent) return;
        if (
          intent.session !== session ||
          body.dataset.contentPhase === "settling"
        )
          return reset();
        if (body.dataset.contentPhase === "active" && !intent.started) {
          intent.started = true;
          start(intent).catch(reset);
        } else if (intent.started && body.dataset.contentPhase !== "active")
          reset();
      });
      observer.observe(body, {
        attributes: true,
        attributeFilter: ["data-content-phase", "data-conversation-session"],
      });
      const listen = (el, type, handler) =>
        el.addEventListener(type, handler, {
          capture: true,
          signal: events.signal,
        });
      listen(body, "click", arm);
      listen(body, "keydown", arm);
      listen(body, "focusin", (event) => {
        if (eligible() && event.target.closest("[data-composer-card]"))
          prepare();
      });
      // Interaction reveals chat immediately, including Stop. Never intercept input.
      const skip = () => {
        if (active || intent?.started) reset();
      };
      listen(document, "pointerdown", skip);
      listen(document, "keydown", skip);
      listen(document, "visibilitychange", reset);
      listen(media, "change", reset);
      return () => {
        events.abort();
        observer.disconnect();
        reset();
        atlas = undefined;
      };
    }

    function Frame({ children }) {
      const anchor = React.useRef(null);
      React.useLayoutEffect(() => attach(anchor.current), []);
      return React.createElement(
        React.Fragment,
        null,
        React.createElement("span", { ref: anchor, hidden: true }),
        children,
      );
    }
    return {
      inject: ["slots"],
      apply(ctx) {
        ctx.slots.inject("conversation.hero.frame", () =>
          ctx.slots.register(
            { name: "conversation.hero.frame", id: "whale-send" },
            Frame,
          ),
        );
      },
    };
  },
});
