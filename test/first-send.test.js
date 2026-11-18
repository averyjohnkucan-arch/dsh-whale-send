import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import puppeteer from "puppeteer";

const require = createRequire(import.meta.url);
const sheet =
  require.resolve("@deepseek-ai/dsh-client-ui-brand-official/assets/breach-atlas-43c5305a3d4d.webp");
const html = `<!doctype html><style>body{--dsw-alias-bg-base:white}main{width:480px;height:320px;position:relative}canvas[data-home-whale]{opacity:.18}</style>
<main data-conversation-content data-content-phase="hero" data-conversation-session="1"><span hidden></span>
<canvas data-home-whale></canvas><div data-composer-card><textarea data-composer-input></textarea><button aria-busy="false" class="test_primary">Send</button></div></main>
<script>
const body=document.querySelector('main'),button=document.querySelector('button');
function send(){body.dataset.contentPhase='active';body.querySelector('[data-home-whale]')?.remove();}
button.onclick=send;
document.querySelector('textarea').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey)send()};
window.__ModuleLoader__={load(spec){
 const react={useRef:()=>({current:document.querySelector('span')}),useLayoutEffect:fn=>{window.dispose=fn()},createElement:()=>null};
 const dependency=()=>react;dependency.asset=()=>'/atlas.webp';
 spec.factory(dependency).apply({slots:{inject:(key,fn)=>fn(),register:(opts,frame)=>frame({})}});
}};
</script><script src="/client.js"></script>`;

test("first send paints the host artwork at 36% and reveals the live chat in 250 ms", async (t) => {
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
    const watch = new MutationObserver(() => {
      const layer = document.querySelector("[data-whale-send]");
      if (!layer) return;
      watch.disconnect();
      const start = performance.now();
      function sample(now) {
        const elapsed = now - start;
        samples.push([elapsed, Number(layer.style.opacity), layer.isConnected]);
        if (layer.isConnected) requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    watch.observe(document.querySelector("main"), { childList: true });
  });
  await page.click("button");
  await page.waitForSelector("[data-whale-send] canvas");
  assert.equal(
    await page.$eval(
      "[data-whale-send] canvas",
      (c) => getComputedStyle(c).opacity,
    ),
    "0.36",
  );
  assert.equal(
    await page.$eval("main", (e) => e.dataset.contentPhase),
    "active",
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
  await page.waitForFunction(() => samples.some((s) => !s[2]), {
    timeout: 10000,
  });
  const samples = await page.evaluate(() => window.samples);
  const fade = samples.filter(
    ([, opacity, connected]) => connected && opacity < 1 && opacity > 0,
  );
  assert.ok(fade.length > 1);
  assert.ok(fade[0][0] > 5550 && fade[0][0] < 5850);
  assert.ok(Math.abs(samples.at(-1)[0] - fade[0][0] - 250) < 90);
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
