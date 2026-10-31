// Optional real-browser checks via Chrome's local debugging protocol. No package
// install, external browser service, real customer approval or real email.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function checkAdminBrowser(email, { credit = false } = {}) {
  const browserPath = [process.env.ADMIN_TEST_BROWSER, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(value => value && existsSync(value));
  assert.ok(browserPath, "A local Chrome or Edge installation is required for ADMIN_BROWSER_TEST=1");
  const directory = path.resolve("verification", `admin-${randomUUID()}`);
  mkdirSync(directory, { recursive: true });
  const port = 9400 + Math.floor(Math.random() * 500);
  const browser = spawn(browserPath, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions", `--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1", `--user-data-dir=${directory}/profile`, "about:blank"], { stdio: "ignore", windowsHide: true });
  let socket;
  let stage = "startup";
  const pending = new Map();
  let counter = 0;
  try {
    let target;
    for (let attempt = 0; attempt < 80; attempt++) {
      try { target = (await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json())).find(item => item.type === "page"); if (target) break; } catch { /* Browser is starting. */ }
      await sleep(250);
    }
    assert.ok(target, "Headless browser must expose a page target");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    socket.onmessage = message => {
      const value = JSON.parse(message.data);
      if (!value.id || !pending.has(value.id)) return;
      const item = pending.get(value.id); pending.delete(value.id); clearTimeout(item.timer);
      if (value.error) item.reject(new Error("Browser protocol command failed")); else item.resolve(value.result);
    };
    function command(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++counter;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error("Browser protocol timeout")); }, 20_000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }
    async function evaluate(expression) {
      const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error("Browser evaluation failed");
      return result.result.value;
    }
    async function waitFor(expression) {
      for (let attempt = 0; attempt < 180; attempt++) { if (await evaluate(expression)) return; await sleep(500); }
      throw new Error("Browser UI did not reach the expected state");
    }
    await command("Page.enable");
    await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1024, deviceScaleFactor: 1, mobile: false });
    await command("Page.navigate", { url: "http://localhost:3000/sberbank/admin" });
    stage = "search";
    await waitFor("!!document.querySelector('#admin-search')");
    // Wait for data loaded by the client effect, not just the server-rendered
    // input: interacting before hydration can legitimately lose typed text.
    await waitFor("!!document.querySelector('section[aria-label=\"Список клиентов\"] li button')");
    if (credit) await evaluate("[...document.querySelectorAll('div[role=\"group\"][aria-label=\"Статус KYC\"] button')].find(button => button.textContent.trim() === 'Все').click()");
    await evaluate("document.querySelector('#admin-search').focus()");
    await command("Input.insertText", { text: email });
    await waitFor(`document.querySelector('#admin-search').value === ${JSON.stringify(email)}`);
    await evaluate("document.querySelector('#admin-search').closest('form').requestSubmit()");
    const row = `[...document.querySelectorAll('section[aria-label="Список клиентов"] li button')].find(button => button.textContent.includes(${JSON.stringify(email)}))`;
    await waitFor(`!!(${row})`);
    await waitFor("document.querySelectorAll('section[aria-label=\"Список клиентов\"] li button').length === 1");
    await evaluate(`(${row}).click()`);
    stage = "private photos";
    await waitFor("[...document.querySelectorAll('section[aria-label=\"Данные выбранного клиента\"] img')].length === 3 && [...document.querySelectorAll('section[aria-label=\"Данные выбранного клиента\"] img')].every(image => image.complete && image.naturalWidth > 0)");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, "Desktop layout must not overflow horizontally");
    const desktop = await command("Page.captureScreenshot", { format: "png" });
    writeFileSync(path.join(directory, "desktop.png"), Buffer.from(desktop.data, "base64"));
    if (credit) {
      stage = "credit confirmation";
      await waitFor("!!document.querySelector('#admin-credit-amount')");
      await evaluate("document.querySelector('#admin-credit-amount').focus()");
      await command("Input.insertText", { text: "12,34" });
      await evaluate("document.querySelector('#admin-credit-amount').closest('form').requestSubmit()");
      await waitFor("[...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Подтвердить зачисление')");
      assert.equal(await evaluate(`document.querySelector('section[aria-labelledby="credit-title"]').textContent.includes(${JSON.stringify(email)})`), true);
      // A refresh must retain the same operation instead of minting a new key.
      await command("Page.reload");
      await waitFor("!!document.querySelector('#admin-search') && !!document.querySelector('section[aria-label=\"Список клиентов\"] li button')");
      await evaluate("[...document.querySelectorAll('div[role=\"group\"][aria-label=\"Статус KYC\"] button')].find(button => button.textContent.trim() === 'Все').click()");
      await evaluate("document.querySelector('#admin-search').focus()");
      await command("Input.insertText", { text: email });
      await evaluate("document.querySelector('#admin-search').closest('form').requestSubmit()");
      await waitFor(`!!(${row})`);
      await evaluate(`(${row}).click()`);
      await waitFor("[...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Подтвердить зачисление')");
      await evaluate("[...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Подтвердить зачисление').click()");
      await waitFor("[...document.querySelectorAll('[role=\"status\"]')].some(element => element.textContent.includes('зачислено 12,34'))");
      await waitFor("!!document.querySelector('#admin-credit-amount')");
      assert.equal(await evaluate("[...Object.keys(sessionStorage)].filter(key => key.startsWith('bank_admin_credit:')).length"), 0);
    } else {
      stage = "rejection confirmation";
      await evaluate("[...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Отклонить KYC').click()");
      await waitFor("!!document.querySelector('#kyc-rejection-reason')");
      assert.equal(await evaluate("[...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Подтвердить отказ').disabled"), true);
      await evaluate("document.querySelector('#kyc-rejection-reason').focus()");
      await command("Input.insertText", { text: "Фотографии нечёткие. Повторите загрузку" });
      await waitFor("![...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Подтвердить отказ').disabled");
      await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await evaluate("document.querySelector('#kyc-rejection-reason').scrollIntoView({block:'center'})");
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      const rejection = await command("Page.captureScreenshot", { format: "png" });
      writeFileSync(path.join(directory, "rejection-mobile.png"), Buffer.from(rejection.data, "base64"));
      await evaluate("document.querySelector('#kyc-rejection-reason').closest('form').querySelector('button[type=\"button\"]').click()");
      await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1024, deviceScaleFactor: 1, mobile: false });
      stage = "approval confirmation";
      await evaluate("[...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Одобрить KYC').click()");
      await waitFor("[...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Подтвердить одобрение')");
      await evaluate("[...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Отмена').click()");
    }
    await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    stage = "mobile layout";
    await evaluate("window.scrollTo(0, 0)");
    await sleep(300);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, "Mobile layout must not overflow horizontally");
    const mobile = await command("Page.captureScreenshot", { format: "png" });
    writeFileSync(path.join(directory, "mobile.png"), Buffer.from(mobile.data, "base64"));
    stage = "photo viewer opening";
    await evaluate("document.querySelector('button[aria-label=\"Открыть: Лицевая сторона\"]').click()");
    await waitFor("!!document.querySelector('dialog[open] img')?.naturalWidth");
    await evaluate("document.querySelector('dialog[open] button[aria-label=\"Закрыть фотографию\"]').click()");
    stage = "photo viewer closing";
    await waitFor("!document.querySelector('dialog[open]')");
    console.log(`PASS: real browser search, dossier selection, ${credit ? 'credit confirmation with reload recovery' : 'approval confirmation'}, photo viewer and responsive widths 1440/390. Screenshots: ${path.relative(process.cwd(), directory)}.`);
  } catch (error) {
    console.error(`Browser verification failed at: ${stage}`);
    throw error;
  } finally {
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error("Browser closed")); }
    socket?.close(); browser.kill();
  }
}
