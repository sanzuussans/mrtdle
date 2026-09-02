const linecolour = {ns:'var(--ns)', ew:'var(--ew)', ne:'var(--ne)', cc:'var(--cc)', dt:'var(--dt)', te:'var(--te)'};
const linename = {ns:'North South', ew:'East West', ne:'North East', cc:'Circle', dt:'Downtown', te:'Thomson-East Coast'};
const maxguesses = 8;

let stations = [];
let graph = {};
let target = null;
let guesses = [];
let over = false;

async function loaddata() {
  const res = await fetch('stations.json');
  const data = await res.json();

  stations = data.stations.map(([name, lines, area, lat, lng]) => ({
    name, lines, area, region: data.region[area] || 'Central', lat, lng
  }));

  graph = {};
  stations.forEach(s => graph[s.name] = new Set());
  Object.values(data.lineSequences).forEach(seq => {
    for (let i = 0; i < seq.length - 1; i++) {
      const a = seq[i], b = seq[i + 1];
      if (!graph[a]) graph[a] = new Set();
      if (!graph[b]) graph[b] = new Set();
      graph[a].add(b);
      graph[b].add(a);
    }
  });
}

function stopsaway(a, b) {
  if (a === b) return 0;
  const visited = new Set([a]);
  let queue = [[a, 0]];
  while (queue.length) {
    const [cur, d] = queue.shift();
    for (const n of graph[cur]) {
      if (n === b) return d + 1;
      if (!visited.has(n)) { visited.add(n); queue.push([n, d + 1]); }
    }
  }
  return null;
}

function torad(d) {
  return d * Math.PI / 180;
}

function distancekm(a, b) {
  const r = 6371;
  const dlat = torad(b.lat - a.lat);
  const dlng = torad(b.lng - a.lng);
  const s = Math.sin(dlat / 2) ** 2 + Math.cos(torad(a.lat)) * Math.cos(torad(b.lat)) * Math.sin(dlng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function bearing(a, b) {
  const y = Math.sin(torad(b.lng - a.lng)) * Math.cos(torad(b.lat));
  const x = Math.cos(torad(a.lat)) * Math.sin(torad(b.lat)) - Math.sin(torad(a.lat)) * Math.cos(torad(b.lat)) * Math.cos(torad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function arrowfor(deg) {
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  return arrows[Math.round(deg / 45) % 8];
}

function compassfor(deg) {
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return labels[Math.round(deg / 45) % 8];
}

function proximityclass(stops) {
  if (stops <= 2) return 'hit';
  if (stops <= 8) return 'near';
  return 'miss';
}

function picktarget() {
  target = stations[Math.floor(Math.random() * stations.length)];
  guesses = [];
  over = false;
  render();
}

function makeguess(name) {
  const station = stations.find(s => s.name.toLowerCase() === name.toLowerCase());
  if (!station || over) return;
  if (guesses.some(g => g.name === station.name)) return;

  const dist = distancekm(station, target);
  const brg = bearing(station, target);
  const stops = stopsaway(station.name, target.name);
  const sharedlines = station.lines.filter(l => target.lines.includes(l));
  const iswin = station.name === target.name;
  const areaexact = station.area === target.area;
  const arearegion = !areaexact && station.region === target.region;

  guesses.push({ station, dist, brg, stops, sharedlines, iswin, areaexact, arearegion });

  if (iswin || guesses.length >= maxguesses) over = true;
  render();
}

let guessinput, suggestionsel, submitbtn, guessesel, bannerel, guesscountel;

function chiphtml(line, dim) {
  return `<span class="chip ${dim ? 'dim' : ''}" style="background:${linecolour[line]}">${line}</span>`;
}

function cardhtml(g) {
  const distclass = g.iswin ? 'hit' : proximityclass(g.stops);
  const linesclass = g.sharedlines.length ? 'hit' : 'miss';
  const areaclass = g.areaexact ? 'hit' : (g.arearegion ? 'near' : 'miss');

  const linechips = g.station.lines.map(l => chiphtml(l, !g.sharedlines.includes(l))).join('');

  const distvalue = g.iswin ? 'Here!' : `<span class="arrow">${arrowfor(g.brg)}</span>${compassfor(g.brg)}`;
  const stopsvalue = g.iswin ? '0' : `${g.stops}`;
  const areavalue = g.areaexact ? g.station.area : (g.arearegion ? `${g.station.area}*` : g.station.area);

  return `
  <div class="card ${g.iswin ? 'win' : ''}">
    <div class="card-top">
      <span class="name">${g.station.name}</span>
      <span class="area">${g.station.lines.join(' · ')}</span>
    </div>
    <div class="clues">
      <div class="clue ${linesclass}">
        <div class="label">Line</div>
        <div class="value lines-wrap">${linechips}</div>
      </div>
      <div class="clue ${distclass}">
        <div class="label">Direction</div>
        <div class="value">${distvalue}</div>
      </div>
      <div class="clue ${distclass}">
        <div class="label">Stops away</div>
        <div class="value">${stopsvalue}</div>
      </div>
      <div class="clue full-row ${areaclass}" style="grid-column:1/-1;">
        <div class="label">Planning area</div>
        <div class="value">${areavalue}${g.arearegion ? ' — same region' : ''}</div>
      </div>
    </div>
  </div>`;
}

function render() {
  guesscountel.textContent = guesses.length;
  guessesel.innerHTML = guesses.map(cardhtml).join('');

  const won = guesses.some(g => g.iswin);
  if (over) {
    if (won) {
      bannerel.innerHTML = `<div class="banner">
        <h2>Solved in ${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}</h2>
        <p>${target.name} — ${target.area} planning area.</p>
        <div class="lines-wrap">${target.lines.map(l => chiphtml(l, false)).join('')}</div>
      </div>`;
    } else {
      bannerel.innerHTML = `<div class="banner">
        <h2>Out of guesses</h2>
        <p>The station was <strong style="color:#fff">${target.name}</strong> — ${target.area} planning area.</p>
        <div class="lines-wrap">${target.lines.map(l => chiphtml(l, false)).join('')}</div>
      </div>`;
    }
  } else {
    bannerel.innerHTML = '';
  }

  guessinput.disabled = over;
  submitbtn.disabled = true;
  guessinput.value = '';
  suggestionsel.style.display = 'none';
}

let activeindex = -1;
let currentmatches = [];

function showsuggestions() {
  const q = guessinput.value.trim().toLowerCase();
  if (!q) {
    suggestionsel.style.display = 'none';
    submitbtn.disabled = true;
    return;
  }
  const guessednames = new Set(guesses.map(g => g.station.name));
  currentmatches = stations
    .filter(s => !guessednames.has(s.name) && s.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.toLowerCase().indexOf(q) - b.name.toLowerCase().indexOf(q))
    .slice(0, 8);

  activeindex = -1;
  const exact = stations.some(s => s.name.toLowerCase() === q && !guessednames.has(s.name));
  submitbtn.disabled = !exact;

  if (!currentmatches.length) {
    suggestionsel.style.display = 'none';
    return;
  }
  suggestionsel.innerHTML = currentmatches.map((s, i) => `
    <div data-name="${s.name}" class="${i === activeindex ? 'active' : ''}">
      <span>${s.name}</span>
      <span class="chips">${s.lines.map(l => chiphtml(l, false)).join('')}</span>
    </div>`).join('');
  suggestionsel.style.display = 'block';
}

function updateactive() {
  [...suggestionsel.children].forEach((el, i) => el.classList.toggle('active', i === activeindex));
  if (activeindex >= 0) guessinput.value = currentmatches[activeindex].name;
}

async function init() {
  guessinput = document.getElementById('guessinput');
  suggestionsel = document.getElementById('suggestions');
  submitbtn = document.getElementById('submitbtn');
  guessesel = document.getElementById('guesses');
  bannerel = document.getElementById('banner');
  guesscountel = document.getElementById('guesscount');

  suggestionsel.addEventListener('click', e => {
    const row = e.target.closest('[data-name]');
    if (row) {
      guessinput.value = row.dataset.name;
      submitbtn.disabled = false;
      suggestionsel.style.display = 'none';
      makeguess(row.dataset.name);
    }
  });

  guessinput.addEventListener('input', showsuggestions);
  guessinput.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeindex = Math.min(activeindex + 1, currentmatches.length - 1);
      updateactive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeindex = Math.max(activeindex - 1, 0);
      updateactive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeindex >= 0 && currentmatches[activeindex]) {
        makeguess(currentmatches[activeindex].name);
      } else if (!submitbtn.disabled) {
        makeguess(guessinput.value.trim());
      }
    }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.guess-row')) suggestionsel.style.display = 'none';
  });

  submitbtn.addEventListener('click', () => makeguess(guessinput.value.trim()));
  document.getElementById('newgamebtn').addEventListener('click', picktarget);
  document.getElementById('giveupbtn').addEventListener('click', () => {
    if (over) return;
    over = true;
    render();
  });

  document.getElementById('datetag').textContent = new Date().toLocaleDateString('en-sg', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  await loaddata();
  picktarget();
}

document.addEventListener('domcontentloaded', init);
