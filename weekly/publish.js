// Публикация недельного контента (после weekly/gen.js). Запускается в GitHub Actions по понедельникам.
// ВКонтакте: посты-карусели по категориям (ОТЛОЖЕННЫЕ записи в 10:00, 12:00, 14:00, 16:00 по Салехарду — их видно и можно поправить в группе до выхода) + сторис.
// Telegram: альбомы с подписью по категориям. Ключи берутся из секретов репозитория; нет ключей — шаг тихо пропускается.
//   VK_TOKEN, VK_GROUP_ID — ключ доступа сообщества (фото, стена, истории) и номер группы
//   TG_BOT_TOKEN, TG_CHAT_ID — бот и канал (например @yamalpark), бот должен быть администратором канала
//   POST_HOURS="10,12,14,16" — часы отложенных постов; VK_PUBLISH_NOW=1 — публиковать сразу; VK_STORIES=0 — без сторис
// Запуск вручную: node weekly/publish.js [--dry]
const fs = require("fs"), path = require("path");
const DRY = process.argv.includes("--dry");
const E = process.env;
const VK_API = E.VK_API_BASE || "https://api.vk.com/method", TG_API = E.TG_API_BASE || "https://api.telegram.org";
const GID = (E.VK_GROUP_ID || "").replace(/\D/g, ""), VKT = E.VK_TOKEN || "", TGT = E.TG_BOT_TOKEN || "", TGC = E.TG_CHAT_ID || "";
const HOURS = (E.POST_HOURS || "10,12,14,16").split(",").map(Number);
const CATS = ["glamping", "bani", "grill", "fest"];
const TITLES = { glamping: "Глэмпинг", bani: "Бани", grill: "Гриль-дома и беседка", fest: "Чум, шатёр и банкетный зал" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);

const week = fs.readdirSync(__dirname).filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort().pop();
if (!week) { log("Нет папки недели — нечего публиковать"); process.exit(0); }
const dir = path.join(__dirname, week), markFile = path.join(dir, "published.json");
const mark = fs.existsSync(markFile) ? JSON.parse(fs.readFileSync(markFile, "utf8")) : { vk: {}, vkStories: {}, tg: {} };
const save = () => fs.writeFileSync(markFile, JSON.stringify(mark, null, 1));
const text = c => fs.readFileSync(path.join(dir, `post-${c}.txt`), "utf8");
const slides = c => fs.readdirSync(dir).filter(n => n.startsWith(`carousel-${c}-`) && n.endsWith(".jpg")).sort().map(n => path.join(dir, n));
const blob = f => new Blob([fs.readFileSync(f)], { type: "image/jpeg" });

// ---------- ВКонтакте ----------
async function vk(method, params) {
  const r = await fetch(`${VK_API}/${method}`, { method: "POST", body: new URLSearchParams(Object.assign({}, params, { access_token: VKT, v: "5.199" })) });
  const j = await r.json(); if (j.error) throw new Error(`${method}: ${j.error.error_code} ${j.error.error_msg}`); return j.response;
}
async function vkUpload(url, field, file) { const fd = new FormData(); fd.append(field, blob(file), path.basename(file)); const r = await fetch(url, { method: "POST", body: fd }); return r.json(); }
async function vkPhoto(file) {
  const srv = await vk("photos.getWallUploadServer", { group_id: GID });
  const up = await vkUpload(srv.upload_url, "photo", file);
  const saved = await vk("photos.saveWallPhoto", { group_id: GID, photo: up.photo, server: up.server, hash: up.hash });
  return `photo${saved[0].owner_id}_${saved[0].id}`;
}
function publishDate(hour) {                                   // «сегодня в HH:00 по Салехарду» (UTC+5); если время прошло — через 10 минут
  const [y, m, d] = week.split("-").map(Number);
  const ts = Math.floor(Date.UTC(y, m - 1, d, hour - 5) / 1000), min = Math.floor(Date.now() / 1000) + 600;
  return Math.max(ts, min);
}
async function publishVK() {
  if (!VKT || !GID) { log("ВКонтакте: ключ или номер группы не заданы — пропускаю"); return; }
  for (let i = 0; i < CATS.length; i++) {
    const c = CATS[i]; if (mark.vk[c]) { log("ВК: уже опубликовано", c); continue; }
    try {
      if (DRY) { log("[dry] ВК пост", c, slides(c).length, "слайдов"); continue; }
      const atts = []; for (const f of slides(c).slice(0, 10)) atts.push(await vkPhoto(f));
      const p = { owner_id: "-" + GID, from_group: 1, message: text(c), attachments: atts.join(",") };
      if (E.VK_PUBLISH_NOW !== "1") p.publish_date = publishDate(HOURS[i % HOURS.length]);
      const r = await vk("wall.post", p); mark.vk[c] = { post_id: r.post_id, scheduled: p.publish_date || null }; save(); log("ВК: пост", c, "→", r.post_id, p.publish_date ? "(отложен)" : "");
    } catch (e) { log("ВК: ошибка поста", c, "—", e.message); }
  }
  if (E.VK_STORIES === "0") return;
  for (const c of CATS) {
    if (mark.vkStories[c]) continue;
    try {
      if (DRY) { log("[dry] ВК сторис", c); continue; }
      const srv = await vk("stories.getPhotoUploadServer", { add_to_news: 1, group_id: GID });
      const up = await vkUpload(srv.upload_url, "file", path.join(dir, `story-${c}.jpg`));
      const res = up.response && up.response.upload_result; if (!res) throw new Error("нет upload_result: " + JSON.stringify(up).slice(0, 120));
      await vk("stories.save", { upload_results: res }); mark.vkStories[c] = true; save(); log("ВК: сторис", c);
    } catch (e) { log("ВК: ошибка сторис", c, "—", e.message, "(для сторис нужен ключ с правом «Истории»)"); }
  }
}

// ---------- Telegram ----------
async function tg(method, body) { const r = await fetch(`${TG_API}/bot${TGT}/${method}`, { method: "POST", body }); const j = await r.json(); if (!j.ok) throw new Error(`${method}: ${j.description}`); return j.result; }
async function publishTG() {
  if (!TGT || !TGC) { log("Telegram: бот или канал не заданы — пропускаю"); return; }
  for (const c of CATS) {
    if (mark.tg[c]) { log("TG: уже опубликовано", c); continue; }
    try {
      if (DRY) { log("[dry] TG альбом", c); continue; }
      const files = slides(c).slice(0, 10), caption = text(c), short = caption.length <= 1024;
      const fd = new FormData(); fd.append("chat_id", TGC);
      fd.append("media", JSON.stringify(files.map((f, i) => Object.assign({ type: "photo", media: `attach://f${i}` }, i === 0 && short ? { caption } : {}))));
      files.forEach((f, i) => fd.append(`f${i}`, blob(f), path.basename(f)));
      await tg("sendMediaGroup", fd);
      if (!short) { const t = new FormData(); t.append("chat_id", TGC); t.append("text", caption); await tg("sendMessage", t); }
      mark.tg[c] = true; save(); log("TG: альбом", c); await sleep(+E.TG_PAUSE || 15000);
    } catch (e) { log("TG: ошибка", c, "—", e.message); }
  }
}

(async () => {
  log("Публикация недели", week, DRY ? "(пробный запуск)" : "");
  await publishVK(); await publishTG();
  if (!DRY) save();
})().catch(e => { console.error(e); process.exit(0); });   // сбой публикации не должен ронять сборку контента
