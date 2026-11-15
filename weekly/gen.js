// Еженедельный контент «Свободные даты»: тексты постов, карусели и сторис по категориям.
// Данные — живые: TravelLine (глэмпинг) и HotBot (бани, гриль-дома, чум, шатёр, зал). Запуск: node weekly/gen.js [--days=14]
// Результат: weekly/<дата понедельника>/ (+ копия в weekly/latest/), страница-просмотр index.html.
const fs = require("fs"), path = require("path"), { pathToFileURL } = require("url");
const ROOT = path.resolve(__dirname, "..");
const DAYS = +((process.argv.find(a => a.startsWith("--days=")) || "").split("=")[1] || 14);
const OFF = 5 * 3600e3;                                   // Салехард, UTC+5, без перехода на летнее время
const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const SITE = "yamalpark.ru", PHONE = "+7 900 399-10-33", MAX = "max.ru/id8901036776_biz";
const localISO = ms => new Date(ms + OFF).toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(Date.parse(iso + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const rub = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0") + "\u00a0₽";
const plural = (n, a, b, c) => { const m = n % 100, d = n % 10; return m > 10 && m < 20 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c; };

// ---------- объекты ----------
const TL_HOTEL = "45485";
const CATS = [
  { id: "glamping", title: "Глэмпинг", emoji: "🏔", page: "glamping", tags: "#глэмпинг #северноесияние", objects: [
    { id: "dome", name: "Купольный домик", tl: "286117", img: "dome-aurora-arc", spec: "30 м² · 2–4 гостя · заезд с 14:00", unit: "за ночь" },
    { id: "volk", name: "Дом «Волк»", tl: "311503", img: "volk-night", spec: "50 м² · терраса, вид на сияние · заезд с 15:00", unit: "за ночь" },
    { id: "medved", name: "Дом «Медведь»", tl: "311497", img: "medved-living", spec: "50 м² · терраса, вид на сияние · заезд с 15:00", unit: "за ночь" } ] },
  { id: "bani", title: "Бани", emoji: "🔥", page: "bani", tags: "#баня #банявСалехарде", objects: [
    { id: "moroshka", name: "Баня «Морошка»", hb: "6703b01c9209f3001e9b7487", cat: "bath-complex", img: "moroshka-steam", spec: "100 м² · до 10 гостей · аромасауна", unit: "за сеанс" },
    { id: "brusnika", name: "Баня «Брусника»", hb: "6703b3e49209f3001e9b7ad1", cat: "bath-complex", img: "brusnika-parnaya", spec: "до 10 гостей · хаммам · управление голосом (Алиса)", unit: "за сеанс" },
    { id: "chernika", name: "Баня «Черника»", hb: "6724ddd3f30425d64654da2b", cat: "bath-complex", img: "chernika-parnaya", spec: "64 м² · до 8 гостей · на дровах", unit: "за сеанс" } ] },
  { id: "grill", title: "Гриль-дома и беседка", emoji: "🍖", page: "grill", tags: "#грильдом #отдых", objects: [
    { id: "g1", name: "Гриль-дом №1", hb: "66d83883884559001edf5427", cat: "at-home", img: "grill1-ext", spec: "15–20 гостей · 12:00–22:00", unit: "за день" },
    { id: "g2", name: "Гриль-дом №2", hb: "66d83951884559001edf54d4", cat: "at-home", img: "grill-aurora-b", spec: "15–20 гостей · 12:00–22:00", unit: "за день" },
    { id: "g3", name: "Гриль-дом №3", hb: "66d839f8884559001edf5582", cat: "at-home", img: "grill-aurora-c", spec: "15–20 гостей · 12:00–22:00", unit: "за день" },
    { id: "h1", name: "Гостевой дом №1", hb: "670386589209f3001e9b1748", res: "66d82f1f884559001edf4933", cat: "at-home", img: "guest1-ext", spec: "20–25 гостей · 12:00–22:00", unit: "за день" },
    { id: "h2", name: "Гостевой дом №2", hb: "670386589209f3001e9b1748", res: "66d83141884559001edf4c5e", cat: "at-home", img: "guest2-ext", spec: "20–25 гостей · 12:00–22:00", unit: "за день" },
    { id: "b1", name: "Летняя беседка", hb: "66d83447884559001edf4fb2", cat: "at-home", img: "besedka", spec: "до 15 гостей · 12:00–22:00", unit: "за день" } ] },
  { id: "fest", title: "Чум, шатёр и банкетный зал", emoji: "🎉", page: "events", tags: "#банкет #праздник #корпоратив", objects: [
    { id: "chum", name: "Этно-чум на террасе", hb: "6ac5e30e93714c44cd6cf783", cat: "at-home", img: "chum-terrace", spec: "аренда на день · терраса с видом", unit: "за день" },
    { id: "tent", name: "Шатёр «Сияние севера»", hb: "6800b971aa3e1d17e7fc6ff5", cat: "at-home", img: "tent-ext", spec: "до 20 гостей · купольный шатёр", unit: "за день" },
    { id: "hall", name: "Банкетный зал", hb: "6a4ba66a524b79aaa65737d3", cat: "at-home", img: "banquet-hall-wide", spec: "100–150 гостей · под куполом", unit: "за день" } ] },
];

// ---------- данные ----------
async function jget(u, opt) { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, Object.assign({ signal: AbortSignal.timeout(25000) }, opt)); if (!r.ok) throw new Error(r.status); return await r.json(); } catch (e) { if (i === 2) throw e; await new Promise(r => setTimeout(r, 2000)); } } }
async function tlNights(dates) {
  const out = {};
  for (let b = 0; b < dates.length; b += 10) {
    const list = dates.slice(b, b + 10); let u = "https://ru-ibe.tlintegration.ru/ApiWebDistribution/BookingForm/hotel_availability?language=ru-ru";
    list.forEach((d, i) => { u += `&criterions%5B${i}%5D.hotels%5B0%5D.code=${TL_HOTEL}&criterions%5B${i}%5D.dates=${d};${addDays(d, 1)}&criterions%5B${i}%5D.adults=2`; });
    const j = await jget(u);
    (j.room_stays || []).forEach(s => { const d = list[+s.criterion_ref], rt = s.room_types && s.room_types[0]; if (!d || !rt) return; const p = s.total && s.total.price_after_tax; (out[rt.code] = out[rt.code] || {}); if (out[rt.code][d] == null || p < out[rt.code][d]) out[rt.code][d] = p; });
  }
  return out;
}
async function hbSlots(o, startISO) {
  const from = startISO + "T00:00:00+05:00", to = addDays(startISO, DAYS) + "T00:00:00+05:00";
  const j = await jget(`https://api.hotbot.ai/v1/shop/products/${o.hb}/availableSlots?lang=ru&property=yamalpark`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from, to, quantity: 1, resource: null, categoryId: o.cat }) });
  let sl = (j.slots || []).map(s => { const ids = []; (s.resourceGroups || []).forEach(g => g.forEach(x => ids.push(x.id))); return { from: new Date(s.from).getTime(), to: new Date(s.to).getTime(), price: Math.round((s.price || 0) / 100), res: ids }; });
  if (o.res) sl = sl.filter(s => s.res.indexOf(o.res) >= 0);
  return sl;
}
const hhmm = ms => new Date(ms + OFF).toISOString().slice(11, 16);
function windows(arr) {                                    // свободные слоты дня → объединённые окна «10:00–23:00»
  const a = arr.slice().sort((x, y) => x.from - y.from), out = [];
  a.forEach(s => { const l = out[out.length - 1]; if (l && s.from <= l[1]) l[1] = Math.max(l[1], s.to); else out.push([s.from, s.to]); });
  return out.map(([f, t]) => hhmm(f) + "–" + hhmm(t));
}
async function collect(startISO) {
  const dates = [...Array(DAYS)].map((_, i) => addDays(startISO, i));
  const tl = await tlNights(dates);
  for (const c of CATS) for (const o of c.objects) {
    const free = {}, det = {}; let min = Infinity, hours = null;
    if (o.tl) { Object.entries(tl[o.tl] || {}).forEach(([d, p]) => { free[d] = true; det[d] = { price: Math.round(p) }; if (p < min) min = p; }); }
    else {
      const sl = await hbSlots(o, startISO), per = {};
      sl.forEach(s => { const d = localISO(s.from); if (dates.includes(d)) { free[d] = true; (per[d] = per[d] || []).push(s); if (s.price && s.price < min) { min = s.price; hours = Math.round((s.to - s.from) / 3600e3); } } });
      Object.entries(per).forEach(([d, arr]) => { det[d] = { win: windows(arr), n: arr.length }; });
    }
    o.det = det; o.dates = dates; o.free = dates.filter(d => free[d]); o.min = isFinite(min) ? min : null; o.hours = hours;
  }
  return dates;
}

// ---------- форматирование ----------
function ranges(list) {                                    // ["2026-11-16","2026-11-17","2026-11-19"] → "16–17, 19 ноября"
  if (!list.length) return "";
  const groups = []; let cur = [list[0]];
  for (let i = 1; i < list.length; i++) { if (addDays(cur[cur.length - 1], 1) === list[i]) cur.push(list[i]); else { groups.push(cur); cur = [list[i]]; } }
  groups.push(cur);
  const byMonth = []; groups.forEach(g => { const m = +g[0].slice(5, 7); let last = byMonth[byMonth.length - 1]; if (!last || last.m !== m) byMonth.push(last = { m, parts: [] }); const a = +g[0].slice(8), b = +g[g.length - 1].slice(8); last.parts.push(g.length === 1 ? String(a) : g.length === 2 ? a + ", " + b : a + "–" + b); });
  return byMonth.map(x => x.parts.join(", ") + " " + MON[x.m - 1]).join(" · ");
}
const period = dates => { const a = dates[0], b = dates[dates.length - 1], ma = +a.slice(5, 7), mb = +b.slice(5, 7); return ma === mb ? `${+a.slice(8)}–${+b.slice(8)} ${MON[ma - 1]}` : `${+a.slice(8)} ${MON[ma - 1]} – ${+b.slice(8)} ${MON[mb - 1]}`; };
const priceLine = o => o.min == null ? "" : `от ${rub(o.min)}` + (o.unit === "за сеанс" && o.hours ? ` за ${o.hours} ${plural(o.hours, "час", "часа", "часов")}` : o.unit === "за ночь" ? " за ночь" : " за день");

function postText(c, dates) {
  const lines = [`${c.emoji} ${c.title} · свободные даты на ${period(dates)}`, ""];
  c.objects.forEach(o => { lines.push(o.free.length ? `• ${o.name}: ${ranges(o.free)}${o.min ? " · " + priceLine(o) : ""}` : `• ${o.name}: на эти недели занято`); });
  if (c.objects.every(o => !o.free.length)) lines.push("", "Ближайшие даты заняты — следующие свободные смотрите на сайте.");
  if (c.id === "glamping") lines.push("", "С террас «Волка» и «Медведя» видно северное сияние (сентябрь–апрель).");
  if (c.id === "bani") lines.push("", "Сеанс от 3 часов, от 2 500 ₽ в час.");
  lines.push("", `Бронь онлайн: ${SITE}/${c.page}`, `Телефон: ${PHONE} · Max: ${MAX}`, "", `#ЯмалПарк #Салехард #Ямал ${c.tags}`);
  return lines.join("\n");
}
function overviewText(dates) {
  const lines = [`📅 Ямал Парк · свободные даты на ${period(dates)}`, ""];
  CATS.forEach(c => { lines.push(`${c.emoji} ${c.title}`); c.objects.forEach(o => lines.push(`   ${o.name}: ${o.free.length ? ranges(o.free) : "занято"}`)); lines.push(""); });
  lines.push(`Бронь онлайн: ${SITE} · ${PHONE} · Max: ${MAX}`, "", "#ЯмалПарк #Салехард #глэмпинг #баня #северноесияние");
  return lines.join("\n");
}

// ---------- картинки ----------
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Unbounded:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}html,body{width:100%;height:100%}
body{font-family:Onest,"Segoe UI",Arial,sans-serif;color:#fff;background:#07101a;overflow:hidden;position:relative}
.bg{position:absolute;inset:0;background-size:cover;background-position:center}
.sh{position:absolute;inset:0}
.logo{position:absolute;left:64px;top:56px;height:44px}
.chip{position:absolute;right:64px;top:58px;padding:12px 22px;border-radius:999px;background:rgba(255,255,255,.14);backdrop-filter:blur(6px);font-weight:600;font-size:26px}
.f{font-family:Unbounded,Onest,Arial,sans-serif;font-weight:500;letter-spacing:-.02em}
.free{color:#5CFFC0}.mut{color:rgba(255,255,255,.72)}
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:10px}
.c{border-radius:14px;overflow:hidden;background:rgba(255,255,255,.07);text-align:center}
.c .h{padding:8px 0 6px;background:rgba(255,255,255,.16);font-size:27px;line-height:1.1}.c .h i{font-style:normal;font-size:19px;letter-spacing:.06em;text-transform:uppercase;opacity:.85}.c .h b{font-weight:700;font-size:32px}
.c .s{display:flex;align-items:center;justify-content:center;min-height:78px;padding:6px 4px;font-size:21px;line-height:1.2;font-weight:600;background:#3FAB3C;color:#fff}
.c.n{background:rgba(255,255,255,.05)}.c.n .h{background:rgba(255,255,255,.07);color:rgba(255,255,255,.4)}.c.n .s{background:transparent;color:rgba(255,255,255,.32);font-weight:500;font-size:18px}
.c .s u{text-decoration:none;font-size:.78em;opacity:.85;font-weight:500}.st.dn .c .h{font-size:22px;padding:4px 0 3px}.st.dn .c .h i{font-size:15px}.st.dn .c .h b{font-size:24px}.st.dn .c .s{min-height:46px;padding:2px;font-size:17px;letter-spacing:-.02em;white-space:nowrap}.st.dn .c .s br{display:none}.st.dn .c.n .s{font-size:13px}.st.dn .c .s u{margin-left:3px}
.c.big .s{min-height:92px;font-size:23px}
.cal.st{gap:6px}.cal.st .c .h{font-size:22px;padding:5px 0 4px}.cal.st .c .h i{font-size:15px}.cal.st .c .h b{font-size:25px}.cal.st .c .s{min-height:58px;font-size:17px;font-weight:600}.cal.st .c.n .s{font-size:15px}
.cta{display:inline-block;padding:20px 40px;border-radius:999px;background:#5CFFC0;color:#06121b;font-weight:700;font-size:34px}
`;
const imgUrl = n => pathToFileURL(path.join(ROOT, "img", "p", n + ".jpg")).href;
const logoUrl = pathToFileURL(path.join(ROOT, "img", "brand", "wordmark-white.png")).href;
const slotText = (o, d, short) => { const f = o.det && o.det[d]; if (!f) return ""; return f.price != null ? rub(f.price).replace(" ₽", " ₽") : (short && f.win.length > 1 ? f.win[0] + "<br><u>+" + (f.win.length - 1) + " окно</u>" : f.win.slice(0, 2).join("<br>")); };
const dayCell = (o, d, big, short) => { const wd = new Date(d + "T12:00:00Z").getUTCDay(), ok = o.free.includes(d), t = slotText(o, d, short);
  return `<div class="c ${ok ? "y" : "n"} ${big ? "big" : ""}"><div class="h"><i>${WD[wd]}</i> <b>${+d.slice(8)}</b></div><div class="s">${ok ? t : "занято"}</div></div>`; };
const calHTML = (o, days, big) => `<div class="cal">${(days || o.dates).map(d => dayCell(o, d, big, !!days)).join("")}</div>`;
const shell = (inner, w, h) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body style="width:${w}px;height:${h}px">${inner}</body></html>`;
const shade = "linear-gradient(180deg,rgba(7,16,26,.55) 0%,rgba(7,16,26,.1) 32%,rgba(7,16,26,.86) 66%,#07101a 100%)";

function slideCover(c, dates) {
  const o = c.objects[0], tot = c.objects.reduce((s, x) => s + x.free.length, 0);
  return shell(`<div class="bg" style="background-image:url(${imgUrl(o.img)})"></div><div class="sh" style="background:${shade}"></div>
  <img class="logo" src="${logoUrl}"><div class="chip">${period(dates)}</div>
  <div style="position:absolute;left:64px;right:64px;bottom:90px">
    <div class="mut" style="font-size:34px;margin-bottom:18px">Свободные даты</div>
    <div class="f" style="font-size:92px;line-height:1.02;margin-bottom:44px">${c.title}</div>
    ${c.objects.map(x => `<div style="display:flex;justify-content:space-between;font-size:36px;padding:14px 0;border-top:1px solid rgba(255,255,255,.18)"><span>${x.name}</span><b class="${x.free.length ? "free" : "mut"}">${x.free.length ? x.free.length + " " + plural(x.free.length, "день", "дня", "дней") : "занято"}</b></div>`).join("")}
    <div class="mut" style="font-size:28px;margin-top:26px">Листайте → ${tot ? "выбирайте дату" : "ближайшие даты заняты"}</div>
  </div>`, 1080, 1350);
}
function slideObject(c, o) {
  return shell(`<div class="bg" style="background-image:url(${imgUrl(o.img)})"></div><div class="sh" style="background:${shade}"></div>
  <img class="logo" src="${logoUrl}"><div class="chip">${c.title}</div>
  <div style="position:absolute;left:64px;right:64px;bottom:64px">
    <div class="f" style="font-size:78px;line-height:1.04;margin-bottom:14px">${o.name}</div>
    <div class="mut" style="font-size:30px;margin-bottom:30px">${o.spec}</div>
    <div style="display:flex;align-items:baseline;gap:22px;margin-bottom:26px"><b class="${o.free.length ? "free" : "mut"}" style="font-size:44px">${o.free.length ? "Свободно " + o.free.length + " из " + o.dates.length : "Ближайшие " + o.dates.length + " дн. заняты"}</b><span style="font-size:34px">${priceLine(o)}</span></div>
    ${calHTML(o, null, true)}
    <div class="mut" style="font-size:26px;margin-top:22px">Под датой — свободное время${o.det && Object.values(o.det).some(x => x.price != null) ? " и цена за ночь" : ""}. Бронь: ${SITE}/${c.page}</div>
  </div>`, 1080, 1350);
}
function slideCTA(c, dates) {
  return shell(`<div class="bg" style="background:radial-gradient(ellipse at 30% 20%,#12485a 0,#0a1d2b 45%,#07101a 100%)"></div>
  <img class="logo" src="${logoUrl}">
  <div style="position:absolute;left:64px;right:64px;top:300px">
    <div class="f" style="font-size:96px;line-height:1.04;margin-bottom:34px">Забронируйте<br>свою дату</div>
    <div class="mut" style="font-size:36px;margin-bottom:60px">${c.title} · ${period(dates)}</div>
    <div class="cta">${SITE}/${c.page}</div>
    <div style="margin-top:60px;font-size:40px;line-height:1.6">☎ ${PHONE}<br>Max: ${MAX}<br>Telegram: @yamalpark · VK: vk.com/yamalpark</div>
    <div class="mut" style="font-size:28px;margin-top:50px">16 минут от Салехарда · Полярный круг</div>
  </div>`, 1080, 1350);
}
function story(c, dates) {
  const o = c.objects[0], dn = c.objects.length > 4, rows = c.objects.map(x => `<div><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:${dn ? 6 : 12}px"><span style="font-size:${dn ? 36 : 44}px;font-weight:600">${x.name}</span><b class="${x.free.length ? "free" : "mut"}" style="font-size:${dn ? 28 : 34}px">${x.free.length ? x.free.length + " " + plural(x.free.length, "день", "дня", "дней") : "занято"}</b></div>
    <div class="st${dn ? " dn" : ""}">${calHTML(x, x.dates.slice(0, 7))}</div>
    <div class="mut" style="font-size:${dn ? 21 : 24}px;margin-top:${dn ? 4 : 8}px">${x.free.length ? "Ещё свободно: " + ranges(x.free.filter(d => d > x.dates[6])) : "ближайшие даты заняты"}${x.min ? " · " + priceLine(x) : ""}</div></div>`).join("");
  return shell(`<div class="bg" style="background-image:url(${imgUrl(o.img)});filter:blur(2px) brightness(.55)"></div><div class="sh" style="background:linear-gradient(180deg,rgba(7,16,26,.35),rgba(7,16,26,.78) 40%,#07101a 100%)"></div>
  <img class="logo" style="left:64px;top:120px" src="${logoUrl}">
  <div style="position:absolute;left:64px;right:64px;top:260px;bottom:360px;display:flex;flex-direction:column">
    <div class="mut" style="font-size:36px;margin-bottom:14px">Свободные даты · ${period(dates)}</div>
    <div class="f" style="font-size:${dn ? 64 : 84}px;line-height:1.04;margin-bottom:${dn ? 14 : 30}px">${c.title}</div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:space-evenly">${rows}</div>
  </div>
  <div style="position:absolute;left:64px;right:64px;bottom:170px;text-align:center"><div class="cta">Бронь на ${SITE}</div><div class="mut" style="font-size:28px;margin-top:22px">${PHONE}</div></div>`, 1080, 1920);
}

// ---------- сборка ----------
function viewer(date, dates, files) {
  const sec = CATS.map(c => `<section><h2>${c.emoji} ${c.title}</h2>
    <div class="row">${files.stories[c.id] ? `<figure><img src="${files.stories[c.id]}"><figcaption>Сторис · <a href="${files.stories[c.id]}" download>скачать</a></figcaption></figure>` : ""}
    ${files.carousel[c.id].map((f, i) => `<figure><img src="${f}"><figcaption>Карусель, слайд ${i + 1} · <a href="${f}" download>скачать</a></figcaption></figure>`).join("")}</div>
    <textarea readonly rows="${postText(c, dates).split("\n").length + 1}">${postText(c, dates).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</textarea><button onclick="navigator.clipboard.writeText(this.previousElementSibling.value);this.textContent='Скопировано ✓'">Скопировать текст поста</button></section>`).join("");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Свободные даты · ${period(dates)}</title>
<style>body{font:16px/1.5 system-ui,Segoe UI,Arial,sans-serif;background:#0b1520;color:#e8eef3;margin:0;padding:24px;max-width:1200px;margin-inline:auto}h1{font-size:28px}h2{margin:36px 0 12px}.row{display:flex;gap:14px;overflow-x:auto;padding-bottom:10px}figure{margin:0;flex:0 0 auto}figure img{height:360px;border-radius:12px;display:block}figcaption{font-size:13px;color:#9fb0bd;margin-top:6px}a{color:#5CFFC0}textarea{width:100%;background:#101e2c;color:#e8eef3;border:1px solid #223548;border-radius:10px;padding:14px;font:15px/1.5 inherit;margin-top:12px}button{margin-top:8px;padding:10px 18px;border:0;border-radius:999px;background:#5CFFC0;color:#06121b;font-weight:700;cursor:pointer}.all textarea{margin-top:8px}</style></head><body>
<h1>Свободные даты Ямал Парка · ${period(dates)}</h1><p>Собрано автоматически каждый понедельник из TravelLine и HotBot (${date}). Карусель — в порядке слайдов, сторис — вертикальные 1080×1920.</p>
<section class="all"><h2>📅 Общий пост на все объекты</h2><textarea readonly rows="24">${overviewText(dates).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</textarea><button onclick="navigator.clipboard.writeText(this.previousElementSibling.value);this.textContent='Скопировано ✓'">Скопировать</button></section>${sec}</body></html>`;
}

(async () => {
  const startISO = process.env.START || localISO(Date.now());
  console.log("Окно:", startISO, "+", DAYS, "дн.");
  const dates = await collect(startISO);
  const outDir = path.join(__dirname, startISO), tmp = path.join(__dirname, "_tmp");
  fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true }); fs.mkdirSync(tmp, { recursive: true });
  let pw; try { pw = require("playwright-core"); } catch (e) { pw = require("D:/dev/yamal-tools/node_modules/playwright-core"); }
  const exe = process.env.CHROME_PATH || [process.platform === "win32" ? "D:/cache/ms-playwright/chromium-1243/chrome-win64/chrome.exe" : "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"].find(p => fs.existsSync(p));
  const browser = await pw.chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  async function shot(html, w, h, name) {
    const f = path.join(tmp, "x.html"); fs.writeFileSync(f, html);
    await page.setViewportSize({ width: w, height: h }); await page.goto(pathToFileURL(f).href, { waitUntil: "load" });
    await page.evaluate(() => document.fonts && document.fonts.ready); await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, name), type: "jpeg", quality: 88 });
    return name;
  }
  const files = { carousel: {}, stories: {} };
  for (const c of CATS) {
    fs.writeFileSync(path.join(outDir, `post-${c.id}.txt`), postText(c, dates));
    const slides = [slideCover(c, dates), ...c.objects.map(o => slideObject(c, o)), slideCTA(c, dates)];
    files.carousel[c.id] = [];
    for (let i = 0; i < slides.length; i++) files.carousel[c.id].push(await shot(slides[i], 1080, 1350, `carousel-${c.id}-${String(i + 1).padStart(2, "0")}.jpg`));
    files.stories[c.id] = await shot(story(c, dates), 1080, 1920, `story-${c.id}.jpg`);
  }
  fs.writeFileSync(path.join(outDir, "post-all.txt"), overviewText(dates));
  fs.writeFileSync(path.join(outDir, "index.html"), viewer(startISO, dates, files));
  fs.writeFileSync(path.join(outDir, "data.json"), JSON.stringify(CATS.map(c => ({ id: c.id, objects: c.objects.map(o => ({ id: o.id, name: o.name, free: o.free, min: o.min })) })), null, 1));
  await browser.close(); fs.rmSync(tmp, { recursive: true, force: true });
  // latest + архив (храним 4 последние недели)
  const latest = path.join(__dirname, "latest"); fs.rmSync(latest, { recursive: true, force: true }); fs.cpSync(outDir, latest, { recursive: true });
  const weeks = fs.readdirSync(__dirname).filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
  weeks.slice(0, Math.max(0, weeks.length - 4)).forEach(n => fs.rmSync(path.join(__dirname, n), { recursive: true, force: true }));
  const left = weeks.slice(-4).reverse();
  fs.writeFileSync(path.join(__dirname, "index.html"), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Контент по неделям</title><body style="font:18px system-ui;background:#0b1520;color:#e8eef3;padding:24px"><h1>Свободные даты: контент по неделям</h1><p><a style="color:#5CFFC0" href="latest/">Последняя неделя</a></p><ul>${left.map(n => `<li><a style="color:#5CFFC0" href="${n}/">${n}</a></li>`).join("")}</ul></body>`);
  console.log("Готово:", outDir, "· файлов:", fs.readdirSync(outDir).length);
})().catch(e => { console.error(e); process.exit(1); });
