import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import puppeteer from "puppeteer";

const require = createRequire(import.meta.url);
const sheet =
  require.resolve("@deepseek-ai/dsh-client-ui-brand-official/assets/breach-atlas-43c5305a3d4d.webp");
const html = `<!doctype html><style>body{margin:0;display:flex;--dsw-alias-bg-base:white}aside{width:160px;background:#445566;height:100vh}main{flex:1;height:100vh;position:relative}canvas[data-home-whale]{opacity:.18}</style>
<aside><a href="#sidebar" onclick="event.preventDefault();this.dataset.clicked=1">Sidebar action</a></aside><main data-conversation-content data-content-phase="hero" data-conversation-session="1"><span hidden></span>
<div class="native_titleGroup"><span>Welcome heading</span></div><canvas data-home-whale style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></canvas><div data-composer-card><textarea data-composer-input></textarea><button aria-busy="false" class="test_primary">Send</button></div></main>
<script>
const body=document.querySelector('main'),button=document.querySelector('button');
function send(){document.querySelector('textarea').value='';body.querySelector('.native_titleGroup')?.remove();body.dataset.contentPhase='active';body.querySelector('[data-home-whale]')?.remove();}
button.onclick=()=>setTimeout(send,750);
document.querySelector('textarea').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey)send()};
window.__ModuleLoader__={load(spec){
 const react={useRef:()=>({current:document.querySelector('span')}),useLayoutEffect:fn=>{window.dispose=fn()},createElement:()=>null};
 const dependency=()=>react;dependency.asset=()=>'/atlas.webp';
 spec.factory(dependency).apply({slots:{inject:(key,fn)=>fn(),register:(opts,frame)=>frame({})}});
}};
</script><script src="/client.js"></script>`;

test("the whale moves during both fades and the submitted text floats to the screen center", async (t) => {
  const client = await readFile(new URL("../client.js", import.meta.url));
  const atlas = await readFile(sheet);
  const server = createServer((req, res) => {
    if (req.url === "/atlas.webp")
      res.writeHead(200, { "content-type": "image/webp" }).end(atlas);
    else if (req.url === "/client.js")
      res.writeHead(200, { "content-type": "text/javascript" }).end(client);
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
  await page.evaluate(() => {
    window.samples = [];
    window.ditherPaints = [];
    const watch = new MutationObserver(() => {
      const layer = document.querySelector("[data-whale-send]");
      if (!layer) return;
      watch.disconnect();
      const start = performance.now();
      const ctx = layer.querySelector("canvas").getContext("2d");
      const { clearRect, arc, fill } = ctx;
      let paint;
      ctx.clearRect = function (...args) {
        const elapsed = performance.now() - start;
        paint = elapsed > 1000 && elapsed < 2000
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
            const c = layer.querySelector("canvas");
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
  assert.equal(
    await page.$eval("[data-whale-text]", (e) => e.textContent),
    "My first message",
  );
  assert.ok(
    await page.$eval("[data-whale-chrome]", (e) =>
      e.textContent.includes("Welcome heading"),
    ),
  );
  await page.waitForSelector("[data-whale-send] canvas");
  assert.equal(
    await page.$eval(
      "[data-whale-send] canvas",
      (c) => getComputedStyle(c).opacity,
    ),
    "0.36",
  );
  await page.waitForFunction(() => {
    const c = document.querySelector("[data-whale-send] canvas");
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
  assert.ok(paints.length > 24, "The dots repaint faster than the pose advances");
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
});
