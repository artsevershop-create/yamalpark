// Запускается раз в час в GitHub Actions (.github/workflows/snap.yml): обновляет snap.json — запасной снимок погоды (Open-Meteo) и Kp (NOAA SWPC).
// Сайт берёт этот файл, когда источники недоступны из сети посетителя. Если источник молчит, остаётся прежнее значение.
const fs = require("fs");
const LAT = 66.568, LON = 66.860, TZ = "Asia%2FYekaterinburg";
const OM = "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON;
const SRC = {
  current: OM + "&current=temperature_2m,wind_speed_10m,cloud_cover,is_day,weather_code,snowfall,precipitation&wind_speed_unit=ms&timezone=" + TZ,
  hourly: OM + "&hourly=cloud_cover,is_day&forecast_days=4&timezone=" + TZ,
  daily: OM + "&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,precipitation_probability_max,sunrise,sunset&wind_speed_unit=ms&forecast_days=4&timezone=" + TZ,
  kp: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
  kpf: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json",
};
(async () => {
  const snap = { time: new Date().toISOString() }, bad = [];
  for (const [k, u] of Object.entries(SRC)) {
    for (let i = 0; i < 3 && !snap[k]; i++) {
      try { const r = await fetch(u, { signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error(r.status); snap[k] = await r.json(); }
      catch (e) { if (i === 2) bad.push(k + ": " + e.message); else await new Promise(r => setTimeout(r, 3000)); }
    }
  }
  if (bad.length) console.log("не получилось:", bad.join("; "));
  const old = fs.existsSync("snap.json") ? JSON.parse(fs.readFileSync("snap.json", "utf8")) : {};
  for (const k of Object.keys(SRC)) if (!snap[k] && old[k]) snap[k] = old[k];
  if (Array.isArray(snap.kp)) snap.kp = snap.kp.slice(0, 1).concat(snap.kp.slice(-24));
  if (!snap.current || !snap.kp) { console.log("данных недостаточно, файл не обновлён"); process.exit(1); }
  fs.writeFileSync("snap.json", JSON.stringify(snap));
  console.log("snap.json обновлён", snap.time);
})();
