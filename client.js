window.__ModuleLoader__.load({
  id: "dsh-whale-send",
  factory(require) {
    const React = require("react");
    const atlasUrl = require.asset(
      "plugins/@deepseek-ai/dsh-client-ui-brand-official/assets/breach-atlas-43c5305a3d4d.webp",
    );
    const duration = 5700;
    const fadeDuration = 500;
    const ditherHz = 40;
    const settingsKey = "dsh-whale-send.preferences";
    let preferences = { dithering: true, water: false };
    try {
      const saved = JSON.parse(localStorage.getItem(settingsKey));
      preferences = {
        dithering: saved?.dithering !== false,
        water: saved?.water === true,
      };
    } catch {
      // Defaults still work when storage is unavailable.
    }

    function Settings() {
      const [values, setValues] = React.useState(() => preferences);
      const h = React.createElement;
      function toggle(key, label, description) {
        return h(
          "label",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              alignItems: "start",
              gap: "12px",
              cursor: "pointer",
            },
          },
          h("input", {
            type: "checkbox",
            checked: values[key],
            onChange(event) {
              preferences = {
                ...preferences,
                [key]: event.currentTarget.checked,
              };
              setValues(preferences);
              try {
                localStorage.setItem(settingsKey, JSON.stringify(preferences));
              } catch {
                // The choice remains active for the current page.
              }
            },
          }),
          h(
            "span",
            null,
            label,
            h(
              "small",
              { style: { display: "block", marginTop: "4px", opacity: 0.7 } },
              description,
            ),
          ),
        );
      }
      return h(
        "section",
        {
          "aria-label": "Whale Send settings",
          style: {
            display: "grid",
            gap: "20px",
            paddingBlock: "8px",
            font: "inherit",
          },
        },
        toggle(
          "dithering",
          "Dithering",
          "Flicker the whale’s dots independently.",
        ),
        toggle(
          "water",
          "Water ripple background",
          "Add a faint, shifting pool-light pattern to the grey dots.",
        ),
      );
    }
    // The RC4 sheet has a long transparent tail. These frames span the
    // visible emergence and final splash, including both crossfades.
    const firstFrame = 12,
      lastVisibleFrame = 106;
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

    function dotGrid(w, h) {
      const scene = Math.min(Math.max(w * 0.94, 720), h * 1.6, 1120) * 1.12;
      const cell = scene / width;
      return {
        cell,
        left: (w - scene) / 2,
        top: h * 0.43 - (height * cell) / 2,
      };
    }

    // Draw RC4's dot-fill artwork in the original home canvas geometry.
    function paint(ctx, pixels, frame, ditherStep, w, h, { cell, left, top }) {
      ctx.clearRect(0, 0, w, h);
      const stride = width * columns;
      const offset =
        (Math.floor(frame / columns) * height * stride +
          (frame % columns) * width) *
        4;
      const alpha = 0.65 * 0.8;
      const phaseSeed =
        ditherStep === null ? 0 : Math.imul(ditherStep + 1, 0x9e3779b1);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = offset + (y * stride + x) * 4;
          const mask = pixels[i + 1] / 255;
          if (mask < 0.015) continue;
          // The mean of the two levels retains the atlas opacity. Hash each
          // dot separately so brightening and dimming happen side by side.
          let brightness = 1;
          if (ditherStep !== null) {
            let hash = (y * width + x) ^ phaseSeed;
            hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
            hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
            brightness = ((hash ^ (hash >>> 16)) & 1) === 0 ? 0.2 : 1.8;
          }
          ctx.globalAlpha = mask * alpha * brightness;
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

    function makeWater(color) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      canvas.dataset.whaleWater = "";
      canvas.style.cssText = `
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        pointer-events:none;
        filter:grayscale(1);
        mask-image:radial-gradient(circle at center, black 0.8px, transparent 1.35px);
      `;

      const sampleSize = 8;
      const cellSize = 124;
      let field, columns, sites;
      let lastStep = -1;
      function resize(w, h) {
        canvas.width = w;
        canvas.height = h;
        field = ctx.createImageData(w, h);
        columns = Math.ceil((w * sampleSize) / cellSize) + 4;
        const rows = Math.ceil((h * sampleSize) / cellSize) + 4;
        let seed = 271828;
        function sample() {
          seed ^= seed << 13;
          seed ^= seed >>> 17;
          seed ^= seed << 5;
          return (seed >>> 0) / 0x100000000;
        }
        sites = Array.from({ length: rows * columns }, (_, i) => ({
          x: (i % columns) - 2 + 0.1 + sample() * 0.8,
          y: Math.floor(i / columns) - 2 + 0.1 + sample() * 0.8,
          phase: sample() * Math.PI * 2,
        }));
      }

      function draw(elapsed) {
        const step = Math.floor(elapsed / 50);
        const w = Math.max(1, Math.ceil(canvas.clientWidth / sampleSize));
        const h = Math.max(1, Math.ceil(canvas.clientHeight / sampleSize));
        if (!field || w !== field.width || h !== field.height) resize(w, h);
        else if (step === lastStep) return;
        lastStep = step;
        const time = elapsed / 1000;
        for (const site of sites) {
          site.movedX = site.x + 0.19 * Math.sin(time * 0.56 + site.phase);
          site.movedY = site.y + 0.16 * Math.cos(time * 0.42 + site.phase);
        }

        // Light collects between drifting sites. Warp the coordinates so
        // the bright seams bend and flow like light on a pool floor.
        for (let y = 0; y < h; y++) {
          const row = (y * sampleSize) / cellSize;
          for (let x = 0; x < w; x++) {
            const column = (x * sampleSize) / cellSize;
            const warpedX =
              column + 0.19 * Math.sin(row * 3.3 + column * 0.9 - time * 0.47);
            const warpedY =
              row + 0.18 * Math.sin(column * 4.1 - row * 1.3 + time * 0.45);
            const origin =
              (Math.floor(warpedY) + 1) * columns + Math.floor(warpedX) + 1;
            let nearest = Infinity,
              next = Infinity;
            for (let dy = 0; dy < 3; dy++) {
              for (let dx = 0; dx < 3; dx++) {
                const site = sites[origin + dy * columns + dx];
                const distance =
                  (warpedX - site.movedX) ** 2 + (warpedY - site.movedY) ** 2;
                if (distance < nearest) {
                  next = nearest;
                  nearest = distance;
                } else if (distance < next) {
                  next = distance;
                }
              }
            }
            const gap = (next - nearest) / 0.13;
            const intensity =
              0.76 + 0.24 * Math.sin(column * 2.3 + row * 1.8 - time * 0.51);
            const index = (y * w + x) * 4;
            field.data[index + 3] = 7 + 42 * intensity * Math.exp(-gap * gap);
          }
        }
        ctx.putImageData(field, 0, 0);
        ctx.globalCompositeOperation = "source-in";
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
      }
      return { canvas, draw };
    }

    const visualStyle = (node, source, properties) => {
      for (const property of properties.split(" "))
        node.style.setProperty(property, source.getPropertyValue(property));
    };

    const typography =
      "font-family font-size font-weight font-style font-variant line-height letter-spacing word-spacing text-align text-transform white-space direction overflow-wrap tab-size";

    // Capture only painted shapes and text. No duplicate controls, IDs, handlers,
    // embeds, or editable fields are mounted alongside the real composer.
    function captureScene(body, native) {
      const pane = body.closest('[data-phase="hero"]') || body;
      const origin = pane.getBoundingClientRect();
      function place(node, rect) {
        Object.assign(node.style, {
          position: "absolute",
          left: rect.left - origin.left - pane.clientLeft + "px",
          top: rect.top - origin.top - pane.clientTop + "px",
          width: rect.width + "px",
          height: rect.height + "px",
          boxSizing: "border-box",
          margin: "0",
          pointerEvents: "none",
        });
        return node;
      }

      const editor = body.querySelector("[data-composer-input]");
      const layer = document.createElement("div");
      layer.dataset.whaleSend = "";
      layer.inert = true;
      layer.setAttribute("aria-hidden", "true");
      layer.style.cssText =
        "position:absolute;inset:0;z-index:2147483646;pointer-events:none;overflow:hidden;isolation:isolate;";
      const base =
        getComputedStyle(body).getPropertyValue("--dsw-alias-bg-base").trim() ||
        "Canvas";
      layer.style.backgroundColor = base;
      const canvas = place(
        document.createElement("canvas"),
        native.getBoundingClientRect(),
      );
      canvas.style.filter = "grayscale(1)";
      canvas.style.opacity = String(
        Math.min(1, Number(getComputedStyle(native).opacity) * 2),
      );
      const chrome = document.createElement("div");
      chrome.dataset.whaleChrome = "";
      const text = document.createElement("div");
      text.dataset.whaleText = "";
      layer.append(canvas, chrome, text);

      function capture(node) {
        if (node === native || !(node instanceof Element)) return;
        const style = getComputedStyle(node);
        // display:contents wrappers have no rectangle but can have visible children.
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0"
        )
          return;
        const rect = node.getBoundingClientRect();
        const visible =
          rect.width &&
          rect.height &&
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < innerHeight &&
          rect.left < innerWidth;
        if (visible && node === editor) {
          const label = place(document.createElement("div"), rect);
          visualStyle(
            label,
            style,
            typography + " padding border-width border-style",
          );
          label.style.borderColor = "transparent";
          label.style.color = style.color;
          label.style.overflow = "hidden";
          label.style.textShadow = "0 0 4px " + base + ", 0 0 10px " + base;
          label.textContent = node.value ?? node.innerText;
          text.append(label);
          return;
        }
        if (visible && node instanceof SVGSVGElement) {
          // RC4 uses local paths and sprite references for its toolbar icons.
          const icon = document.createElementNS(node.namespaceURI, "svg");
          icon.setAttribute(
            "viewBox",
            node.getAttribute("viewBox") || "0 0 16 16",
          );
          for (const shape of node.querySelectorAll("path,rect,circle,use")) {
            const copy = document.createElementNS(
              node.namespaceURI,
              shape.localName,
            );
            for (const attr of [
              "d",
              "x",
              "y",
              "width",
              "height",
              "rx",
              "ry",
              "cx",
              "cy",
              "r",
              "transform",
              "fill-rule",
              "stroke-linecap",
              "stroke-linejoin",
            ])
              if (shape.hasAttribute(attr))
                copy.setAttribute(attr, shape.getAttribute(attr));
            const href =
              shape.getAttribute("href") || shape.getAttribute("xlink:href");
            if (href?.startsWith("#")) copy.setAttribute("href", href);
            visualStyle(
              copy,
              getComputedStyle(shape),
              "fill stroke stroke-width opacity",
            );
            icon.append(copy);
          }
          visualStyle(icon, style, "color opacity");
          chrome.append(place(icon, rect));
          return;
        }
        if (
          visible &&
          (style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
            style.boxShadow !== "none" ||
            parseFloat(style.borderTopWidth) ||
            parseFloat(style.borderBottomWidth))
        ) {
          const box = place(document.createElement("div"), rect);
          visualStyle(
            box,
            style,
            "background-color border-radius border-color border-width border-style box-shadow opacity",
          );
          chrome.append(box);
        }
        for (const child of node.childNodes) {
          if (child.nodeType !== Node.TEXT_NODE) {
            capture(child);
            continue;
          }
          if (!child.textContent.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(child);
          const rect = range.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          const label = place(document.createElement("div"), rect);
          visualStyle(label, style, typography + " color opacity");
          label.style.lineHeight = rect.height + "px";
          label.textContent = child.textContent;
          chrome.append(label);
        }
      }
      // The layer supplies the pane background. Other app panels stay live.
      for (const child of pane.children) capture(child);
      return { pane, layer, canvas, chrome, text };
    }

    // Measure the visible glyphs, since a short message may occupy only a
    // few pixels of the full-width editor. Keep its wrapping while it moves.
    function travelToCenter(group, layer) {
      const label = group.firstElementChild;
      if (!label?.textContent) return { x: 0, y: 0 };
      const range = document.createRange();
      range.selectNodeContents(label);
      const glyphs = range.getBoundingClientRect();
      const box = label.getBoundingClientRect();
      const x =
        (Math.max(glyphs.left, box.left) + Math.min(glyphs.right, box.right)) /
        2;
      const y =
        (Math.max(glyphs.top, box.top) + Math.min(glyphs.bottom, box.bottom)) /
        2;
      const pane = layer.getBoundingClientRect();
      // Keep the existing screen-center destination wherever the text fits.
      // In narrow split layouts the center of the conversation is visible.
      const halfWidth =
        (Math.min(glyphs.right, box.right) - Math.max(glyphs.left, box.left)) /
        2;
      const targetX = innerWidth / 2;
      const fits =
        targetX - halfWidth >= pane.left && targetX + halfWidth <= pane.right;
      return {
        x: (fits ? targetX : pane.left + pane.width / 2) - x,
        y: pane.top + pane.height / 2 - y,
      };
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
          scene: captureScene(body, native),
          atlas: prepare(),
          preferences,
        };
        // A click on the enabled Send control is unambiguous. Enter can mean
        // a newline in some configurations, so let the host confirm that case.
        if (send) {
          start(intent).catch(reset);
          return;
        }
        // A rejected submission must not arm a later page change.
        timer = setTimeout(reset, 5000);
      }

      async function start(attempt) {
        clearTimeout(timer);
        const { pane, layer, canvas, chrome, text } = attempt.scene;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reset();
        const water = attempt.preferences.water
          ? makeWater(attempt.color)
          : null;
        if (water) layer.prepend(water.canvas);
        // Attach before the next paint, even while the atlas is decoding.
        // RC4 owns the live session underneath and submits immediately.
        pane.append(layer);
        const playback = { session: attempt.session, layer };
        active = playback;
        intent = undefined;
        const travel = travelToCenter(text, layer);
        const pixels = await attempt.atlas;
        if (active !== playback) return;
        if (!pixels || media.matches || document.hidden) return reset();
        const began = performance.now();
        let lastFrame = -1;
        let lastDitherStep = -1;
        let grid;
        function tick(now) {
          const elapsed = now - began,
            w = canvas.clientWidth,
            h = canvas.clientHeight;
          if (elapsed >= duration || !w || !h || !body.isConnected)
            return reset();
          const dpr = Math.min(devicePixelRatio, 2);
          const px = Math.round(w * dpr),
            py = Math.round(h * dpr);
          if (lastFrame < 0 || canvas.width !== px || canvas.height !== py) {
            canvas.width = px;
            canvas.height = py;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = attempt.color;
            grid = dotGrid(w, h);
            if (water) {
              water.canvas.style.maskSize = `${grid.cell}px ${grid.cell}px`;
              water.canvas.style.maskPosition = `${canvas.offsetLeft + grid.left}px ${canvas.offsetTop + grid.top}px`;
            }
            lastFrame = -1;
          }
          const progress = Math.min(1, elapsed / duration);
          const frame =
            firstFrame +
            Math.min(
              lastVisibleFrame - firstFrame,
              Math.floor(progress * (lastVisibleFrame - firstFrame + 1)),
            );
          const ditherStep = attempt.preferences.dithering
            ? Math.floor((elapsed * ditherHz) / 1000)
            : null;
          if (frame !== lastFrame || ditherStep !== lastDitherStep) {
            paint(ctx, pixels, frame, ditherStep, w, h, grid);
            lastFrame = frame;
            lastDitherStep = ditherStep;
          }
          const opening = Math.min(1, elapsed / fadeDuration);
          const mix = opening * opening * (3 - 2 * opening);
          text.style.transform = `translate(${travel.x * mix}px, ${travel.y * mix}px)`;
          chrome.style.opacity = String(1 - mix);
          if (water) {
            water.draw(elapsed);
            water.canvas.style.opacity = String(mix * (0.92 - 0.56 * progress));
          }
          const t = Math.min(
            1,
            Math.max(0, (duration - elapsed) / fadeDuration),
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
        if (eligible()) prepare();
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
      const conversation = body.closest("[data-phase]") || body;
      listen(conversation, "pointerdown", skip);
      listen(conversation, "keydown", skip);
      listen(window, "resize", reset);
      listen(document, "visibilitychange", reset);
      listen(media, "change", reset);
      if (eligible()) prepare();
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
        ctx.slots.inject("settings.section", () =>
          ctx.slots.register(
            {
              name: "settings.section",
              id: "whale-send",
              order: 69,
              label: () => "Whale Send",
            },
            Settings,
          ),
        );
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
