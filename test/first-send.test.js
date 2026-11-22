import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import puppeteer from "puppeteer";

const require = createRequire(import.meta.url);
const sheet =
  require.resolve("@deepseek-ai/dsh-client-ui-brand-official/assets/breach-atlas-43c5305a3d4d.webp");
const html = `<!doctype html><style>body{margin:0;display:flex;--dsw-alias-bg-base:white}aside{width:160px;background:#445566;height:100vh}main{flex:1;height:100vh;position:relative}canvas[data-home-whale]{opacity:.18;font-family:monospace;--home-whale-code-ink:#123456}</style>
<aside><a href="#sidebar" onclick="event.preventDefault();this.dataset.clicked=1">Sidebar action</a><div id="settings"></div></aside><main data-conversation-content data-content-phase="hero" data-conversation-session="1"><div id="frame"></div>
<div class="native_titleGroup"><span>Welcome heading</span></div><canvas data-home-whale style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></canvas><div data-composer-card><textarea data-composer-input></textarea><button aria-busy="false" class="test_primary">Send</button></div></main>
<script src="/react.js"></script><script src="/react-dom.js"></script>
<script>
const body=document.querySelector('main'),button=document.querySelector('button');
function send(){document.querySelector('textarea').value='';body.querySelector('.native_titleGroup')?.remove();body.dataset.contentPhase='active';body.querySelector('[data-home-whale]')?.remove();}
button.onclick=()=>setTimeout(send,750);
document.querySelector('textarea').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey)send()};
window.__ModuleLoader__={load(spec){
 const dependency=()=>React;dependency.asset=()=>'/atlas.webp';
 spec.factory(dependency).apply({slots:{inject:(key,fn)=>fn(),register:(opts,Component)=>{
  const frame=opts.name==='conversation.hero.frame';
  const root=ReactDOM.createRoot(document.getElementById(frame?'frame':'settings'));
  ReactDOM.flushSync(()=>root.render(React.createElement(Component)));
  if(frame)window.dispose=()=>root.unmount();
 }}});
}};
</script><script src="/client.js"></script>`;

async function openFixture(t) {
  const scripts = new Map([
    ["/client.js", await readFile(new URL("../client.js", import.meta.url))],
  ]);
  for (const pkg of ["react", "react-dom"]) {
    const dir = dirname(require.resolve(pkg + "/package.json"));
    scripts.set(
      "/" + pkg + ".js",
      await readFile(join(dir, "umd", pkg + ".production.min.js")),
    );
  }
  const atlas = await readFile(sheet);
  const server = createServer((req, res) => {
    if (req.url === "/atlas.webp")
      res.writeHead(200, { "content-type": "image/webp" }).end(atlas);
    else if (scripts.has(req.url))
      res
        .writeHead(200, { "content-type": "text/javascript" })
        .end(scripts.get(req.url));
    else res.writeHead(200, { "content-type": "text/html" }).end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => server.close());
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const url = "http://127.0.0.1:" + server.address().port;
  await page.goto(url);
  return { page, url };
}

test("the whale moves during both fades and the submitted text floats to the screen center", async (t) => {
  const { page, url } = await openFixture(t);
  await page.evaluate(() => {
    window.samples = [];
    window.ditherPaints = [];
    const watch = new MutationObserver(() => {
      const layer = document.querySelector("[data-whale-send]");
      if (!layer) return;
      watch.disconnect();
      const start = performance.now();
      const ctx = layer
        .querySelector("canvas:not([data-whale-water])")
        .getContext("2d");
      const { clearRect, arc, fill } = ctx;
      let paint;
      ctx.clearRect = function (...args) {
        const elapsed = performance.now() - start;
        paint =
          elapsed > 1000 && elapsed < 2000
            ? { elapsed, pose: [], alphas: [] }
            : undefined;
        if (paint) ditherPaints.push(paint);
        clearRect.apply(this, args);
      };
      ctx.arc = function (x, y, radius, ...angles) {
        if (paint) paint.pose.push(x, y, radius);
        arc.call(this, x, y, radius, ...angles);
      };
      ctx.fill = function (...args) {
        if (paint) paint.alphas.push(this.globalAlpha);
        fill.apply(this, args);
      };
      function sample(now) {
        const elapsed = now - start;
        samples.push([
          elapsed,
          Number(layer.style.opacity),
          layer.isConnected,
          Number(layer.querySelector("[data-whale-chrome]").style.opacity),
          new DOMMatrix(
            getComputedStyle(layer.querySelector("[data-whale-text]"))
              .transform,
          ).m41,
          document.querySelector("main").dataset.contentPhase,
          (() => {
            if (!(elapsed < 500 || (elapsed > 5200 && elapsed < 5600)))
              return false;
            const c = layer.querySelector("canvas:not([data-whale-water])");
            return c
              .getContext("2d")
              .getImageData(0, 0, c.width, c.height)
              .data.some((v, i) => i % 4 === 3 && v > 0);
          })(),
        ]);
        if (layer.isConnected) requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    watch.observe(document.querySelector("main"), { childList: true });
  });
  const sidebarPixels = () =>
    page.screenshot({
      clip: { x: 0, y: 0, width: 140, height: 120 },
      captureBeyondViewport: false,
    });
  const sidebarBefore = await sidebarPixels();
  await page.type("textarea", "My first message");
  await page.click("button");
  await page.waitForSelector("[data-whale-text]");
  await page.waitForSelector("[data-whale-water]");
  assert.equal(
    await page.$eval("[data-whale-text]", (e) => e.textContent),
    "My first message",
  );
  assert.ok(
    await page.$eval("[data-whale-chrome]", (e) =>
      e.textContent.includes("Welcome heading"),
    ),
  );
  await page.waitForSelector(
    "[data-whale-send] canvas:not([data-whale-water])",
  );
  assert.equal(
    await page.$eval(
      "[data-whale-send] canvas:not([data-whale-water])",
      (c) => getComputedStyle(c).opacity,
    ),
    "0.27",
  );
  await page.waitForFunction(() => {
    const c = document.querySelector(
      "[data-whale-send] canvas:not([data-whale-water])",
    );
    return (
      c &&
      c
        .getContext("2d")
        .getImageData(0, 0, c.width, c.height)
        .data.some((v, i) => i % 4 === 3 && v > 0)
    );
  });
  await page.waitForFunction(
    () =>
      Number(document.querySelector("[data-whale-chrome]")?.style.opacity) ===
      0,
  );
  assert.deepEqual(await sidebarPixels(), sidebarBefore);
  assert.ok(
    await page.$eval(
      "[data-whale-send]",
      (el) =>
        el.getBoundingClientRect().left >=
        document.querySelector("aside").getBoundingClientRect().right,
    ),
  );
  await page.click("aside a");
  assert.equal(await page.$eval("aside a", (a) => a.dataset.clicked), "1");
  assert.ok(await page.$("[data-whale-send]"));
  const offset = await page.$eval("[data-whale-text] > div", (e) => {
    const r = document.createRange();
    r.selectNodeContents(e);
    const bounds = r.getBoundingClientRect();
    return [
      bounds.x + bounds.width / 2 - innerWidth / 2,
      bounds.y + bounds.height / 2 - innerHeight / 2,
    ];
  });
  assert.ok(
    offset.every((n) => Math.abs(n) < 1),
    JSON.stringify(offset),
  );
  await page.waitForFunction(() => samples.some((s) => !s[2]), {
    timeout: 10000,
  });
  const samples = await page.evaluate(() => window.samples);
  const paints = await page.evaluate(() => window.ditherPaints);
  assert.ok(
    paints.length > 24,
    "The dots repaint faster than the pose advances",
  );
  assert.ok(
    paints.some((current, index) => {
      const previous = paints[index - 1];
      return (
        previous &&
        previous.pose.length === current.pose.length &&
        previous.pose.every((value, i) => value === current.pose[i]) &&
        previous.alphas.some((value, i) => value > current.alphas[i]) &&
        previous.alphas.some((value, i) => value < current.alphas[i])
      );
    }),
    "Different dots brighten and dim independently while the whale pose holds",
  );
  const fade = samples.filter(
    ([, opacity, connected]) => connected && opacity < 1 && opacity > 0,
  );
  assert.ok(fade.length > 1);
  assert.ok(
    samples.some(
      ([ms, , , chrome, dx, phase, ink]) =>
        ms < 500 &&
        chrome > 0 &&
        chrome < 1 &&
        dx > 0 &&
        phase === "hero" &&
        ink,
    ),
  );
  assert.ok(
    fade.some((s) => s[6]),
    "The closing fade overlaps painted whale frames",
  );
  assert.ok(
    samples.some(
      ([ms, , , chrome]) => ms > 50 && ms < 450 && chrome > 0 && chrome < 1,
    ),
  );
  assert.ok(
    samples.some(
      ([ms, opacity, , chrome]) =>
        ms > 500 && ms < 5200 && opacity === 1 && chrome === 0,
    ),
  );
  assert.ok(fade[0][0] > 5050 && fade[0][0] < 5350);
  assert.ok(Math.abs(samples.at(-1)[0] - fade[0][0] - 500) < 90);
  await page.click("button");
  assert.equal(await page.$("[data-whale-send]"), null);
  await page.goto(url);
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await page.click("button");
  assert.equal(await page.$("[data-whale-send]"), null);
  await page.emulateMediaFeatures([]);
  await page.goto(url);
  await page.evaluate(
    () => (document.querySelector("main").dataset.contentPhase = "active"),
  );
  assert.equal(await page.$("[data-whale-send]"), null);
  await page.goto(url);
  await page.focus("textarea");
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-whale-send]");
  await page.evaluate(() => window.dispose());
  assert.equal(await page.$("[data-whale-send]"), null);

  await page.evaluate(() => {
    localStorage.setItem(
      "dsh-whale-send.preferences",
      '{"dithering":false,"water":true}',
    );
  });
  await page.reload();
  await page.click("button");
  await page.waitForFunction(() => {
    const water = document.querySelector("[data-whale-water]");
    return (
      water &&
      document.querySelector("[data-whale-chrome]").style.opacity === "0"
    );
  });
  const result = await page.evaluate(async () => {
    const water = document.querySelector("[data-whale-water]");
    const waterContext = water.getContext("2d");
    const sampleField = () =>
      waterContext.getImageData(0, 0, water.width, water.height).data;
    const start = {
      opacity: Number(water.style.opacity),
      pixels: sampleField(),
    };
    const context = document
      .querySelector("[data-whale-send] canvas:not([data-whale-water])")
      .getContext("2d");
    const clearRect = context.clearRect;
    let paintCount = 0;
    context.clearRect = function (...args) {
      paintCount++;
      clearRect.apply(this, args);
    };
    await new Promise((resolve) => setTimeout(resolve, 1000));
    context.clearRect = clearRect;
    const pixels = sampleField();
    return {
      mask: getComputedStyle(water).maskImage,
      spansPane:
        water.offsetWidth === water.parentElement.offsetWidth &&
        water.offsetHeight === water.parentElement.offsetHeight,
      movedAndFaded:
        pixels.some(
          (value, index) => index % 4 === 3 && value !== start.pixels[index],
        ) && Number(water.style.opacity) < start.opacity,
      subtle:
        pixels.some((value, index) => index % 4 === 3 && value > 50) &&
        pixels.every((value, index) => index % 4 !== 3 || value < 75),
      paintCount,
    };
  });
  assert.match(result.mask, /radial-gradient/);
  assert.ok(result.spansPane);
  assert.ok(result.movedAndFaded);
  assert.ok(result.subtle);
  assert.ok(
    result.paintCount > 8 && result.paintCount < 24,
    "Disabling dithering uses the atlas frame rate",
  );

  await page.evaluate(() => {
    localStorage.setItem("dsh-whale-send.preferences", '{"water":false}');
  });
  await page.reload();
  await page.click("button");
  await page.waitForSelector("[data-whale-send] canvas");
  assert.equal(
    await page.$("[data-whale-water]"),
    null,
    "A saved Off choice is preserved",
  );
});

test("the style selector persists and random picks one renderer per first send", async (t) => {
  const { page } = await openFixture(t);
  const key = "dsh-whale-send.preferences";
  const selector = "#settings select";
  // Upgrade from 0.1.7 with both effects switched off.
  await page.evaluate((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({ dithering: false, water: false }),
    );
  }, key);
  await page.reload();
  assert.equal(await page.$eval(selector, (el) => el.value), "led");
  await page.select(selector, "code");
  await page.reload();
  assert.equal(await page.$eval(selector, (el) => el.value), "code");
  assert.deepEqual(
    await page.$$eval("#settings input", (inputs) =>
      inputs.map(({ checked, disabled }) => [checked, disabled]),
    ),
    [
      [false, true],
      [false, false],
    ],
  );

  await page.evaluate(() => {
    const body = document.querySelector("main");
    const native = body.querySelector("[data-home-whale]").cloneNode();
    window.newChat = (roll) => {
      body.querySelector("[data-home-whale]")?.remove();
      body.append(native.cloneNode());
      body.dataset.conversationSession = String(
        Number(body.dataset.conversationSession) + 1,
      );
      body.dataset.contentPhase = "hero";
      window.trace = {
        frames: 0,
        dots: false,
        masks: 0,
        lettering: false,
        rolls: 0,
      };
      Math.random = () => {
        trace.rolls++;
        return roll;
      };
    };
    const proto = CanvasRenderingContext2D.prototype;
    const { clearRect, arc, drawImage, fillText } = proto;
    const isWhale = (ctx) =>
      ctx.canvas.matches("[data-whale-send] > canvas:not([data-whale-water])");
    proto.clearRect = function (...args) {
      if (isWhale(this)) trace.frames++;
      return clearRect.apply(this, args);
    };
    proto.arc = function (...args) {
      if (isWhale(this)) trace.dots = true;
      return arc.apply(this, args);
    };
    proto.drawImage = function (...args) {
      if (isWhale(this) && this.globalCompositeOperation === "destination-in")
        trace.masks++;
      return drawImage.apply(this, args);
    };
    proto.fillText = function (phrase, ...args) {
      if (phrase === "ctx.plugin(Agent)" && this.fillStyle === "#123456")
        trace.lettering = true;
      return fillText.call(this, phrase, ...args);
    };
  });

  async function checkPlayback(expected, roll, expectedRolls) {
    await page.evaluate((roll) => window.newChat(roll), roll);
    await page.focus("textarea");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.trace.frames >= 4);
    const result = await page.$eval("[data-whale-send] > canvas", (canvas) => ({
      ...window.trace,
      opacity: getComputedStyle(canvas).opacity,
      visibleInk: canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height)
        .data.some((value, index) => index % 4 === 3 && value > 0),
    }));
    assert.equal(result.opacity, "0.27");
    assert.ok(result.visibleInk);
    assert.equal(result.lettering, expected === "code");
    assert.equal(result.masks, expected === "code" ? result.frames : 0);
    assert.equal(result.dots, expected === "led");
    assert.equal(result.rolls, expectedRolls);
    assert.equal(await page.$("[data-whale-water]"), null);
  }
  await checkPlayback("code", 0.75, 0);
  await page.select(selector, "led");
  await checkPlayback("led", 0.25, 0);
  await page.select(selector, "random");
  await checkPlayback("code", 0.25, 1);
  await checkPlayback("led", 0.75, 1);
  assert.deepEqual(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key),
    { style: "random", dithering: false, water: false },
  );
  await page.click("#settings input");
  await page.reload();
  assert.equal(await page.$eval(selector, (el) => el.value), "random");
  assert.equal(await page.$eval("#settings input", (el) => el.checked), true);

  await page.evaluate((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({ style: "unknown", water: false }),
    );
  }, key);
  await page.reload();
  assert.equal(await page.$eval(selector, (el) => el.value), "led");
});
