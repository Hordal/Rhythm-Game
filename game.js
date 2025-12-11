const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const scoreDisplay = document.getElementById('score-display');
const comboDisplay = document.getElementById('combo-display');
const gameAudio = document.getElementById('game-audio');
const memberSelectScreen = document.getElementById('member-select-screen');
const songSelectScreen = document.getElementById('song-select-screen');
const memberCatalogScreen = document.getElementById('member-catalog-screen');
const memberCatalogListEl = document.getElementById('member-catalog-list');
const memberSearchEl = document.getElementById('member-search');
const selectedSlotsEl = document.getElementById('selected-slots');
// characterListEl removed from member screen; catalog uses memberCatalogListEl
let characterListEl = null;
const startButton = document.getElementById('start-button');
const clearSelectionBtn = document.getElementById('clear-selection');
const openMemberButton = document.getElementById('open-member-button');
const openSongButton = document.getElementById('open-song-button');
const openSongFromMemberBtn = document.getElementById('open-song-from-member');
const backToStartFromMemberBtn = document.getElementById('back-to-start-from-member');
const backToMemberFromSongBtn = document.getElementById('back-to-member-from-song');
const confirmSongButton = document.getElementById('confirm-song-button');
const memberStatusEl = document.getElementById('member-status');

// --- 게임 설정 ---
const LANE_COUNT = 4;
// Adjusted LANE_WIDTH to match widened canvas (640px total)
const LANE_WIDTH = 160;
const CANVAS_WIDTH = LANE_WIDTH * LANE_COUNT; // 640
const CANVAS_HEIGHT = 600;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

let NOTE_HEIGHT = 20;
let NOTE_SPEED = 5; // 1프레임당 기본 이동 속도 (난이도로 변경 가능)
const JUDGEMENT_LINE_Y = CANVAS_HEIGHT - 50;

// --- 게임 상태 ---
let score = 0;
let combo = 0;
// formatted score shown in floating badge (top-left)
const scoreBadgeEl = document.getElementById('score-badge');
let displayedScore = 0; // what the badge currently shows
// Progress bar target: change to suit how fast you want the bar to fill.
// For quick testing set low (500) so the bar fills visibly with few hits.
const TARGET_SCORE = 500; // score value that corresponds to 100% progress (lower for testing)
const PROGRESS_DEBUG = false; // disable verbose progress logs for normal runs
// Cache whether progress elements are available to avoid repeated DOM queries/log spam
let PROGRESS_AVAILABLE = null; // null = unknown, false = not available, true = available

function updateProgressBarByScore(value) {
    // if a numeric value is provided, use it (useful during animated badge updates)
    const effective = (typeof value === 'number') ? value : score;
    // If we've previously determined progress UI is not present, skip quickly
    if (PROGRESS_AVAILABLE === false) return;
    const el = document.getElementById('progress-fill-new');
    const container = document.getElementById('progress-bar-new');
    if (!el || !container) {
        // mark unavailable and silently return (no noisy logs)
        PROGRESS_AVAILABLE = false;
        if (PROGRESS_DEBUG) console.warn('progress-fill-new or container not found', { el: !!el, container: !!container });
        return;
    }
    // mark available once found
    PROGRESS_AVAILABLE = true;
    // ensure element is visible
    try { el.style.display = el.style.display || ''; container.style.display = container.style.display || ''; } catch(e) {}
    const pct = Math.max(0, Math.min(100, Math.round((effective / (TARGET_SCORE || 1)) * 100)));
    el.style.width = pct + '%';
    // accessibility
    try { container.setAttribute('aria-valuenow', String(pct)); } catch(e) {}
    if (PROGRESS_DEBUG) console.debug('updateProgressBarByScore', { effective, pct, TARGET_SCORE, elWidth: el.style.width });
}

function formatScore(n, digits = 7) {
    const s = Math.max(0, Math.floor(n)).toString();
    return s.padStart(digits, '0');
}

function updateScoreBadgeInstant() {
    if (!scoreBadgeEl) return;
    const num = scoreBadgeEl.querySelector('.score-num');
    if (num) num.textContent = formatScore(displayedScore);
    else scoreBadgeEl.textContent = formatScore(displayedScore);
}

// animate badge value from displayedScore to target
function animateScoreTo(target, duration = 350) {
    if (!scoreBadgeEl) return;
    const start = displayedScore;
    const change = target - start;
    const startTime = performance.now();
    // visual pulse
    scoreBadgeEl.classList.add('score-badge-pulse');
    setTimeout(() => { scoreBadgeEl.classList.remove('score-badge-pulse'); }, duration + 40);
    function step(now) {
        const t = Math.min(1, (now - startTime) / duration);
        const ease = t<0.5 ? 2*t*t : -1 + (4-2*t)*t; // easeInOutQuad-like
        displayedScore = Math.round(start + change * ease);
        const num = scoreBadgeEl.querySelector('.score-num');
        if (num) num.textContent = formatScore(displayedScore); else scoreBadgeEl.textContent = formatScore(displayedScore);
        // update progress bar to reflect the animated displayed score so the fill animates smoothly
        try { updateProgressBarByScore(displayedScore); } catch (e) { if (PROGRESS_DEBUG) console.warn('progress update during animate failed', e); }
        if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function addScore(delta) {
    score = (score || 0) + (delta || 0);
    // clamp
    if (score < 0) score = 0;
    if (PROGRESS_DEBUG) console.debug('addScore called', { delta, score });
    // animate badge to new value
    animateScoreTo(score);
    // update progress bar based on score
    try { updateProgressBarByScore(); } catch(e) { console.warn('progress update failed', e); }
    // also update top bar textual display if exists
    if (scoreDisplay) scoreDisplay.textContent = 'Score: ' + score.toLocaleString();
}
let notes = [];
let gameStartTime = 0;
let isGameRunning = false;
let maxCombo = 0;

// HP
let hp = 100;
let MAX_HP = 100;

// game pause state
let isGamePaused = false;

// judgement counters for results
let perfectCount = 0;
let greatCount = 0;
let goodCount = 0;
let badCount = 0;
let missCount = 0;

// Settings (persisted)
const defaultSettings = {
    volume: 1.0,
    noteSize: 100, // percent (50..200)
    noteSpeed: 5.0, // default note speed (1..12)
    perfectMs: 50,
    greatMs: 100,
    goodMs: 150,
    badMs: 200,
    keymap: ['d','f','j','k']
};
// add difficulty default
defaultSettings.difficulty = 'Normal';
let settings = Object.assign({}, defaultSettings);

function loadSettings() {
    try {
        const raw = localStorage.getItem('rg_settings');
        if (raw) settings = Object.assign({}, defaultSettings, JSON.parse(raw));
    } catch (e) { settings = Object.assign({}, defaultSettings); }
    applySettings();
}
// Difficulty presets mapping
function getDifficultyPreset(name) {
    // Accept keys and normalize (easy, normal, hard)
    const key = (String(name || '').trim()).toLowerCase();
    const map = {
        // Made densities lower to make gameplay easier by default
        // density: probability to place a note on an 8th-note step
        easy: { speed: 3, density: 0.30, hp: 220 },
        normal: { speed: 4, density: 0.45, hp: 160 },
        hard: { speed: 5, density: 0.60, hp: 120 }
    };
    return map[key] || map['normal'];
}
function saveSettings() { localStorage.setItem('rg_settings', JSON.stringify(settings)); }
function applySettings() {
    try {
        if (gameAudio) gameAudio.volume = Number(settings.volume || 1);
    } catch (e) {}
    // apply keymap
    try {
        if (Array.isArray(settings.keymap)) {
            const map = {};
            for (let i = 0; i < settings.keymap.length; i++) map[settings.keymap[i]] = i;
            // copy into KEY_MAP keeping defaults for missing lanes
            const keys = Object.keys(KEY_MAP);
            for (const k of keys) delete KEY_MAP[k];
            for (const k in map) KEY_MAP[k] = map[k];
        }
    } catch (e) {}
    // apply note size (scale visual note height). settings.noteSize stored as percent (50..200)
    try { NOTE_HEIGHT = Math.max(8, Math.round(20 * ((Number(settings.noteSize || 100) || 100) / 100))); } catch (e) {}

    // apply note speed: prefer explicit user setting, otherwise apply difficulty preset
    try {
        if (typeof settings.noteSpeed === 'number' && !isNaN(settings.noteSpeed)) {
            NOTE_SPEED = Number(settings.noteSpeed);
        } else {
            const preset = getDifficultyPreset(settings.difficulty || 'Normal');
            if (preset && typeof preset.speed === 'number') NOTE_SPEED = preset.speed;
        }
        // HP still uses difficulty preset
        try { const preset = getDifficultyPreset(settings.difficulty || 'Normal'); if (preset && typeof preset.hp === 'number') MAX_HP = preset.hp; } catch(e){}
        // do not override user's judgement windows here; keep those in settings
    } catch (e) {}
}

// initialize settings on load
loadSettings();

// 멤버 선택 및 스킬은 멤버별로 관리
let selectedMembers = []; // 사용자가 선택한 캐릭터(최대 5)
let activeMembers = []; // 게임 시작 시 selectedMembers를 복사하여 스킬 상태 포함

// 슬롯 교체용 상태
let swapTargetSlot = null; // null 또는 0..4
let selectedSong = null;

// --- 플레이어(캐릭터) 데이터 ---
const characterData = [
    { id: 'c1', name: 'Yui', art: 'assets/chars/c1.png', skillName: '점수 2배', skillType: 'scoreMultiplier', duration: 7000, cooldown: 12000, multiplier: 2, description: '일정 시간 점수 획득량 2배', level:1 },
    { id: 'c2', name: 'Rimi', art: 'assets/chars/c2.png', skillName: 'Good → Perfect', skillType: 'goodToPerfect', duration: 6000, cooldown: 15000, description: '일정 시간 Good 판정을 Perfect로 변경', level:1 },
    { id: 'c3', name: 'Arisa', art: 'assets/chars/c3.png', skillName: '퍼펙트 보너스', skillType: 'perfectBoost', duration: 7000, cooldown: 14000, perfectBonus: 100, description: '퍼펙트 점수 추가 증가', level:1 },
    { id: 'c4', name: 'Kasumi', art: 'assets/chars/c4.png', skillName: '체력 회복', skillType: 'healAndSmallScore', duration: 0, cooldown: 10000, heal: 30, smallScore: 50, description: '즉시 체력 회복 및 소량 점수', level:1 },
    { id: 'c5', name: 'Saaya', art: 'assets/chars/c5.png', skillName: '점수 1.5배', skillType: 'scoreMultiplier', duration: 8000, cooldown: 12000, multiplier: 1.5, description: '일정 시간 점수 획득량 1.5배', level:1 },
    { id: 'c6', name: 'Hina', art: 'assets/chars/c6.png', skillName: '퍼펙트 보너스', skillType: 'perfectBoost', duration: 6000, cooldown: 13000, perfectBonus: 80, description: '퍼펙트 점수 추가 증가', level:1 },
    { id: 'c7', name: 'Tae', art: 'assets/chars/c7.png', skillName: 'Good → Perfect', skillType: 'goodToPerfect', duration: 5000, cooldown: 12000, description: '일정 시간 Good 판정을 Perfect로 변경', level:1 },
    { id: 'c8', name: 'Moca', art: 'assets/chars/c8.png', skillName: '체력 회복', skillType: 'healAndSmallScore', duration: 0, cooldown: 11000, heal: 20, smallScore: 40, description: '즉시 체력 회복 및 소량 점수', level:1 },
    { id: 'c9', name: 'Kokoro', art: 'assets/chars/c9.png', skillName: '점수 2배', skillType: 'scoreMultiplier', duration: 5000, cooldown: 15000, multiplier: 2, description: '일정 시간 점수 획득량 2배', level:1 },
    { id: 'c10', name: 'Aya', art: 'assets/chars/c10.png', skillName: '퍼펙트 보너스', skillType: 'perfectBoost', duration: 9000, cooldown: 18000, perfectBonus: 150, description: '퍼펙트 점수 추가 증가', level:1 },
    { id: 'c11', name: 'Lisa', art: 'assets/chars/c11.png', skillName: '점수 1.8배', skillType: 'scoreMultiplier', duration: 7000, cooldown: 14000, multiplier: 1.8, description: '일정 시간 점수 획득량 1.8배', level:1 },
    { id: 'c12', name: 'Eve', art: 'assets/chars/c12.png', skillName: 'Good → Perfect', skillType: 'goodToPerfect', duration: 7000, cooldown: 16000, description: '일정 시간 Good 판정을 Perfect로 변경', level:1 },
    { id: 'c13', name: 'Mina', art: 'assets/chars/c13.png', skillName: '퍼펙트 보너스', skillType: 'perfectBoost', duration: 6000, cooldown: 14000, perfectBonus: 90, description: '퍼펙트 점수 추가 증가', level:1 },
    { id: 'c14', name: 'Nana', art: 'assets/chars/c14.png', skillName: '체력 회복', skillType: 'healAndSmallScore', duration: 0, cooldown: 12000, heal: 25, smallScore: 45, description: '즉시 체력 회복 및 소량 점수', level:1 },
    { id: 'c15', name: 'Rin', art: 'assets/chars/c15.png', skillName: '점수 증가', skillType: 'scoreMultiplier', duration: 7000, cooldown: 15000, multiplier: 1.6, description: '일정 시간 점수 획득량 증가', level:1 }
];

// --- 곡 데이터: 비우기(사용자 요청)
// 라이브에서 곡을 전혀 보여주지 않도록 빈 배열로 설정합니다.
const songData = [];

// Load generated songs manifest (written by generator script) and merge into songData
async function loadGeneratedSongsManifest() {
    const path = './assets/songs/manifest.json';
    // Prefer inline manifest for file:// usage to avoid fetch/XHR noise
    try {
        const inline = tryInlineManifest();
        if (Array.isArray(inline) && inline.length > 0) {
            for (const e of inline) {
                if (!e || !e.audio) continue;
                if (songData.some(s => s.id === e.id || s.audio === e.audio)) continue;
                songData.push({ id: e.id || ('ai-' + Date.now()), name: e.name || 'AI Song', artist: e.artist || 'AI', thumb: '', bpm: e.bpm || 120, audio: e.audio, durationSec: e.durationSec || 20, tags: ['playable','ai'] });
            }
            try { renderSongList(); renderSongPreview(); } catch (err) {}
            return;
        }
    } catch (err) {
        // ignore inline parse errors and continue to try network/XHR
    }

    // if no inline manifest, attempt to load manifest from assets (http)
    try {
        const list = await tryLoadManifest(path);
        if (!Array.isArray(list)) return;
        for (const e of list) {
            if (!e || !e.audio) continue;
            if (songData.some(s => s.id === e.id || s.audio === e.audio)) continue;
            songData.push({ id: e.id || ('ai-' + Date.now()), name: e.name || 'AI Song', artist: e.artist || 'AI', thumb: '', bpm: e.bpm || 120, audio: e.audio, durationSec: e.durationSec || 20, tags: ['playable','ai'] });
        }
        try { renderSongList(); renderSongPreview(); } catch(e){}
    } catch (e) {
        if (typeof console !== 'undefined') console.debug('No generated songs manifest found', e && e.message ? e.message : e);
    }
}

// Attempt to load manifest using fetch, falling back to XHR for file:// cases
async function tryLoadManifest(path) {
    // First, try fetch (works on http/https and some file setups)
    try {
        const resp = await fetch(path, { cache: 'no-store' });
        if (resp && resp.ok) return await resp.json();
    } catch (e) {
        // ignore and try XHR
    }

    // Fallback: XMLHttpRequest (some browsers allow this on file://)
    return new Promise((resolve, reject) => {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', path, true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    // Many browsers return status 0 for file:// reads
                    if (xhr.status === 200 || (xhr.status === 0 && xhr.responseText)) {
                        try {
                            const json = JSON.parse(xhr.responseText);
                            resolve(json);
                        } catch (err) {
                            reject(err);
                        }
                    } else {
                        reject(new Error('XHR failed: ' + xhr.status));
                    }
                }
            };
            xhr.send();
        } catch (err) { reject(err); }
    });
}
// If manifest cannot be loaded via fetch/XHR (file protocol restrictions),
// attempt to read an inline JSON manifest placed in index.html with id="manifest-json".
function tryInlineManifest() {
    try {
        const el = document.getElementById('manifest-json');
        if (!el) return null;
        const txt = el.textContent || el.innerText || '';
        if (!txt) return null;
        return JSON.parse(txt);
    } catch (e) { return null; }
}

// Song select state
let songListSelectedIndex = 0;
let currentDifficulty = 'NORMAL';

// 렌더: 곡 리스트와 미리보기
function renderSongList() {
    const list = document.getElementById('song-list');
    if (!list) return;
    list.innerHTML = '';

    const activeTabEl = document.querySelector('.tab.active');
    const activeTab = activeTabEl ? activeTabEl.textContent.trim().toLowerCase() : 'all track';

    // 필터링된 곡 리스트
    const filtered = songData.filter(s => {
        if (activeTab === 'all track') return true;
        return s.tags.includes(activeTab);
    });

    // 선택된 곡이 리스트 범위를 벗어나지 않도록 조정
    if (songListSelectedIndex >= filtered.length) {
        songListSelectedIndex = filtered.length - 1;
    }

    filtered.forEach((s, idx) => {
        const songEl = document.createElement('div');
        songEl.className = 'song-item';
        songEl.textContent = `${s.name} - ${s.artist}`;
        songEl.dataset.index = idx;
        songEl.addEventListener('click', () => {
            songListSelectedIndex = idx;
            selectedSong = s;
            renderSongPreview();
        });
        list.appendChild(songEl);
    });

    // 선택된 곡이 보이도록 스크롤 조정
    requestAnimationFrame(() => {
        const selectedEl = list.querySelector(`.song-item[data-index="${songListSelectedIndex}"]`);
        if (selectedEl) {
            selectedEl.scrollIntoView({ block: 'nearest' });
        }
    });
}

function renderSongPreview() {
    const art = document.getElementById('selected-album-art');
    const title = document.getElementById('preview-title');
    const artist = document.getElementById('preview-artist');
    const stars = document.getElementById('preview-stars');
    const recordRate = document.getElementById('record-rate');
    const bestCombo = document.getElementById('best-combo');
    if (!title || !artist || !stars) return;
    if (!selectedSong) {
        title.textContent = '곡을 선택하세요';
        artist.textContent = '';
        stars.innerHTML = '';
        if (art) art.style.background = 'linear-gradient(135deg,#222,#444)';
        recordRate.textContent = '0%';
        bestCombo.textContent = '0';
        title.dataset.songId = '';
        return;
    }
    title.textContent = selectedSong.name;
    title.dataset.songId = selectedSong.id || '';
    artist.textContent = selectedSong.artist + ' • ' + (selectedSong.bpm || '');
    // stars based on selected difficulty
    let diff = (selectedSong.selectedDiff || currentDifficulty || 'NORMAL');
    let starCount = 7;
    if (selectedSong.stars && typeof selectedSong.stars === 'object') {
        starCount = selectedSong.stars[diff] || selectedSong.stars['NORMAL'] || 7;
    } else if (typeof selectedSong.stars === 'number') {
        starCount = selectedSong.stars;
    }
    stars.innerHTML = '';
    for (let i = 0; i < starCount; i++) {
        const st = document.createElement('span'); st.className = 'star'; stars.appendChild(st);
    }
    if (art) art.style.background = 'linear-gradient(135deg,#' + Math.floor(Math.random()*0xfffff).toString(16).padStart(5,'0') + ',#444)';
    recordRate.textContent = (selectedSong.recordRate || '0') + '%';
    bestCombo.textContent = (selectedSong.bestCombo || '0');
}

// 렌더 캐릭터 목록 & 선택 슬롯
// render full member catalog (used when assigning)
let selectedMemberInCatalog = null;
function renderCharacterList() {
    const list = memberCatalogListEl || characterListEl;
    if (!list) return;
    list.innerHTML = '';

    const query = (memberSearchEl && memberSearchEl.value) ? memberSearchEl.value.trim().toLowerCase() : '';

    for (const ch of characterData) {
        // filter by search
        if (query) {
            const hay = `${ch.name} ${ch.skillName} ${ch.description}`.toLowerCase();
            if (!hay.includes(query)) continue;
        }

        const item = document.createElement('div');
        item.className = 'char-card';
        item.dataset.id = ch.id;
        // determine art source: prefer provided art path, otherwise generate SVG data-uri
        const fallbackSrc = generateAvatarDataURI(ch.name, 72);
        const artSrc = ch.art || fallbackSrc;
        const initials = ch.name.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase();
        // compact skill badge text (prefer explicit short label)
        const skillBadgeText = ch.skillLabel || ch.skillShort || (ch.skillName ? (ch.skillName.length > 12 ? ch.skillName.slice(0,12)+'…' : ch.skillName) : '---');
        // use onerror to fall back to generated SVG if the provided art path fails to load
        item.innerHTML = `
            <div class="thumb-wrap" title="${ch.name}">
                <img class="char-thumb" src="${artSrc}" alt="${ch.name}" onerror="this.onerror=null;this.src='${fallbackSrc}'" />
            </div>
            <div class="char-info">
                <div class="char-meta">
                    <div class="char-name">${ch.name}</div>
                    <div class="char-level"><span class="level">Lv.${ch.level}</span></div>
                </div>
            </div>
            <div class="check-badge">✓</div>
            <button class="info-btn" title="정보">i</button>
        `;
        item.addEventListener('click', () => {
            // toggle selection: click to select, click again to deselect
            if (selectedMemberInCatalog === ch.id) {
                // deselect
                selectedMemberInCatalog = null;
                for (const child of list.children) child.classList.remove('selected');
            } else {
                // select this one (single-select behavior)
                selectedMemberInCatalog = ch.id;
                for (const child of list.children) child.classList.remove('selected');
                item.classList.add('selected');
            }
        });


        // double-click opens character detail
        item.addEventListener('dblclick', (e) => { openCharacterDetail(ch.id); e.stopPropagation(); });

        // info button inside card opens detail (prevent click toggling selection)
        const infoBtn = item.querySelector('.info-btn');
        if (infoBtn) {
            infoBtn.addEventListener('click', (ev) => { ev.stopPropagation(); openCharacterDetail(ch.id); });
        }

        // reflect previously selected member when opening catalog
        if (selectedMemberInCatalog && selectedMemberInCatalog === ch.id) {
            item.classList.add('selected');
        }
        list.appendChild(item);
    }
}

if (memberSearchEl) {
    memberSearchEl.addEventListener('input', () => { renderCharacterList(); });
}

function renderSelectedSlots() {
    selectedSlotsEl.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        const member = selectedMembers[i];
        if (member) {
            const fallback = generateAvatarDataURI(member.name || ('ch'+i), 72);
            const art = member.art || fallback;
            slot.innerHTML = `
                <div class="slot-card">
                    <div class="slot-thumb">
                        <img src="${art}" alt="${member.name}" onerror="this.onerror=null;this.src='${fallback}'" />
                    </div>
                    <div class="slot-level-pill">Lv.${member.level}</div>
                </div>
                <div class="slot-controls" style="width:100%;display:flex;gap:8px;justify-content:center;margin-top:8px;">
                    <button data-idx="${i}" class="remove small">제거</button>
                    <button data-idx="${i}" class="assign small">편성</button>
                </div>
            `;
            slot.querySelector('.remove').addEventListener('click', (e) => { e.stopPropagation(); selectedMembers.splice(i,1); renderSelectedSlots(); updateStageBand(); });
            slot.querySelector('.assign').addEventListener('click', (e) => { e.stopPropagation(); openMemberCatalogForSlot(i); });
            // clicking the slot (image) opens the detail modal
            slot.addEventListener('click', (ev) => { ev.stopPropagation(); openCharacterDetail(member.id); });
        } else {
            slot.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;gap:8px;justify-content:center;height:100%;width:100;">
                    <div class="empty-avatar" style="width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.04);">+</div>
                    <div class="slot-empty-label">${i+1}. 빈 슬롯</div>
                    <div class="slot-action"><button data-idx="${i}" class="assign small">편성</button></div>
                </div>
            `;
            slot.querySelector('.assign').addEventListener('click', (e) => { e.stopPropagation(); openMemberCatalogForSlot(i); });
        }
        // swap-target highlight
        if (swapTargetSlot === i) slot.classList.add('swap-target'); else slot.classList.remove('swap-target');
        // clicking existing member slot enters swap mode
        slot.addEventListener('dblclick', (e) => { if (selectedMembers[i]) setSwapTarget(i); });
        selectedSlotsEl.appendChild(slot);
    }
}

// Character detail modal: show name, level, level-up button, skill details
function openCharacterDetail(memberId) {
    const ch = characterData.find(c => c.id === memberId);
    if (!ch) return;
    // prevent duplicate modal
    if (document.getElementById('char-detail-modal')) return;

    const fallbackSrc = generateAvatarDataURI(ch.name, 120);
    const artSrc = ch.art || fallbackSrc;

    const modal = document.createElement('div');
    modal.id = 'char-detail-modal';
    modal.className = 'overlay';
    modal.innerHTML = `
        <div class="overlay-content char-detail">
            <div class="thumb-wrap large"><img src="${artSrc}" onerror="this.onerror=null;this.src='${fallbackSrc}'" /></div>
            <div class="char-name-large">${ch.name}</div>
            <div class="level-row">Level: <div class="level-value" id="char-level-value">${ch.level || 1}</div>
                <button id="char-level-up" class="level-up-btn">레벨업</button>
            </div>
            <h4>스킬: ${ch.skillName || '없음'}</h4>
            <div class="skill-info">${ch.skillDesc || ch.description || '상세 정보 없음'}</div>
            <button id="char-detail-close" class="close-btn">취소</button>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('char-detail-close').addEventListener('click', closeCharacterDetail);
    document.getElementById('char-level-up').addEventListener('click', () => {
        ch.level = (ch.level || 1) + 1;
        const lvEl = document.getElementById('char-level-value'); if (lvEl) lvEl.textContent = ch.level;
        // update visible lists/slots
        renderCharacterList(); renderSelectedSlots(); updateStageBand();
    });
}

function closeCharacterDetail() {
    const el = document.getElementById('char-detail-modal'); if (el) el.remove();
}

// initialize badge display
displayedScore = score || 0;
updateScoreBadgeInstant();

// update stage band silhouettes from selectedMembers (show names/initials)
function updateStageBand() {
    try {
        const container = document.querySelector('#stage-overlay .band-silhouettes');
        if (!container) return;
        // clear existing entries and only render selected members (in order)
        container.innerHTML = '';
        const visible = (selectedMembers || []).filter(Boolean);
        // if no members selected, leave container empty
        for (let i = 0; i < visible.length; i++) {
            const m = visible[i];
            const el = document.createElement('div');
            el.className = 'member';
            // generate a pleasant gradient per-character deterministically
            const gradient = generateGradientForName(m.name || ('ch' + i));
            el.style.background = gradient;
            // determine art source (use existing art or generated svg)
            const fallbackArt = generateAvatarDataURI(m.name || ('ch'+i), 72);
            const artSrc = m.art || fallbackArt;
            const initials = (m.name || '').split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase();
            const skill = m.skillName ? `<span class="skill-badge">${m.skillName}</span>` : '';
            const level = typeof m.level !== 'undefined' ? `<span class="level-badge">Lv.${m.level}</span>` : '';
            el.innerHTML = `
                <div class="avatar-art"><img src="${artSrc}" class="avatar-img" alt="${m.name}" onerror="this.onerror=null;this.src='${fallbackArt}'"/></div>
                <div class="info">
                    <div class="name">${m.name}</div>
                    <div class="meta">${level}${skill}</div>
                </div>
            `;
            container.appendChild(el);
        }
        // also render chibi sprites on stage floor
        try {
            let chibiContainer = document.querySelector('#stage-overlay .stage-chibis');
            if (!chibiContainer) {
                chibiContainer = document.createElement('div');
                chibiContainer.className = 'stage-chibis';
                const stageOverlay = document.getElementById('stage-overlay');
                if (stageOverlay) stageOverlay.appendChild(chibiContainer);
            }
            chibiContainer.innerHTML = '';
            const n = visible.length || 0;
            for (let i = 0; i < n; i++) {
                const m = visible[i];
                const fallbackArt = generateAvatarDataURI(m.name || ('ch'+i), 120);
                const artSrc = m.art || fallbackArt;
                const chDiv = document.createElement('div');
                chDiv.className = 'chibi';
                // distribute across stage: (i+1)/(n+1)
                const pct = ((i+1) / (n+1)) * 100;
                chDiv.style.left = pct + '%';
                chDiv.innerHTML = `<img src="${artSrc}" onerror="this.onerror=null;this.src='${fallbackArt}'" alt="${m.name}"/>`;
                chibiContainer.appendChild(chDiv);
            }
        } catch (e) { console.warn('stage chibis failed', e); }
    } catch (e) { console.warn('updateStageBand failed', e); }
}

// deterministic gradient generator based on name string
function generateGradientForName(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
    // derive two hues
    const h1 = Math.abs((h >>> 0) % 360);
    const h2 = (h1 + 40 + (h % 60)) % 360;
    const c1 = `hsl(${h1}deg 85% 60%)`;
    const c2 = `hsl(${h2}deg 70% 45%)`;
    return `linear-gradient(135deg, ${c1}, ${c2})`;
}

// Generate an SVG data URL avatar (gradient + initials) so the UI shows images
function generateAvatarDataURI(name, size = 128) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
    const h1 = Math.abs((h >>> 0) % 360);
    const h2 = (h1 + 40 + (h % 60)) % 360;
    const c1 = `hsl(${h1} 85% 60%)`;
    const c2 = `hsl(${h2} 70% 45%)`;
    const initials = (name || '').split(' ').map(s => s[0]).join('').slice(0,2).toUpperCase() || 'C';
    const fontSize = Math.floor(size * 0.42);
    const svg = `<?xml version='1.0' encoding='utf-8'?><svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='100%' height='100%' rx='12' ry='12' fill='url(#g)' /><text x='50%' y='54%' text-anchor='middle' font-family='Segoe UI, Arial, Helvetica, sans-serif' font-size='${fontSize}' font-weight='700' fill='white'>${initials}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function setSwapTarget(idx) {
    if (swapTargetSlot === idx) swapTargetSlot = null; else swapTargetSlot = idx;
    renderSelectedSlots();
    updateStageBand();
}

function assignToSlotFromList(memberId) {
    const ch = characterData.find(c => c.id === memberId);
    if (!ch) return;
    if (swapTargetSlot !== null) {
        // assign into target slot (replace or fill)
        selectedMembers[swapTargetSlot] = Object.assign({}, ch);
        swapTargetSlot = null;
        renderSelectedSlots();
        return;
    }
    // otherwise push into first empty slot
    if (selectedMembers.length < 5 && !selectedMembers.some(m=>m.id===memberId)) {
        selectedMembers.push(Object.assign({}, ch));
        renderSelectedSlots();
        updateStageBand();
    }
}

function openMemberCatalogForSlot(slotIndex) {
    swapTargetSlot = slotIndex;
    selectedMemberInCatalog = null;
    if (memberCatalogScreen) showOverlay(memberCatalogScreen);
    renderCharacterList();
}

const confirmAssignButton = document.getElementById('confirm-assign-button');
const cancelAssignButton = document.getElementById('cancel-assign-button');
if (confirmAssignButton) {
    confirmAssignButton.addEventListener('click', () => {
        if (selectedMemberInCatalog && swapTargetSlot !== null) {
                const ch = characterData.find(c => c.id === selectedMemberInCatalog);
                // Prevent duplicate across slots
                const already = selectedMembers.some((m, idx) => m && m.id === ch.id && idx !== swapTargetSlot);
                if (already) {
                    alert('같은 캐릭터는 여러 슬롯에 편성할 수 없습니다. 다른 멤버를 선택해주세요.');
                    return;
                }
                selectedMembers[swapTargetSlot] = Object.assign({}, ch);
                swapTargetSlot = null;
                selectedMemberInCatalog = null;
                renderSelectedSlots();
                if (memberCatalogScreen) hideOverlay(memberCatalogScreen);
            } else {
                alert('편성할 멤버를 선택하세요.');
            }
    });
}
if (cancelAssignButton) {
    cancelAssignButton.addEventListener('click', () => {
        swapTargetSlot = null;
        selectedMemberInCatalog = null;
        if (memberCatalogScreen) hideOverlay(memberCatalogScreen);
    });
}

function showCharacterDetail(id) {
    const ch = characterData.find(c => c.id === id);
    if (!ch) return;
    // simple inline detail modal using alert for now, with level up option
    const confirmUp = confirm(`${ch.name} (Lv.${ch.level})\n스킬: ${ch.skillName}\n${ch.description}\n\n레벨업 하시겠습니까? (레벨업은 즉시 적용)`);
    if (confirmUp) {
        ch.level = (ch.level || 1) + 1;
        // small scaling effect: increase multiplier or perfectBonus by level
        if (ch.skillType === 'scoreMultiplier') ch.multiplier = (ch.multiplier || 1) + 0.15;
        if (ch.skillType === 'perfectBoost') ch.perfectBonus = (ch.perfectBonus || 0) + 20;
        renderCharacterList();
        renderSelectedSlots();
    }
}

function prepareActiveMembers() {
    // Ensure we only copy valid member objects (avoid undefined/null entries)
    activeMembers = (selectedMembers || []).filter(m => m && typeof m === 'object').map(m => ({ ...m, skillState: { isActive:false, canUse:true, lastUsed:0, remaining:0 } }));
}

// 활성 멤버의 스킬 상태를 집계
function aggregateActiveEffects() {
    const result = { scoreMultiplier: 1, goodToPerfect: false, perfectBonus: 0 };
    for (const m of activeMembers) {
        if (!m || !m.skillState || !m.skillState.isActive) continue;
        if (m.skillType === 'scoreMultiplier') result.scoreMultiplier *= (m.multiplier || 1);
        if (m.skillType === 'goodToPerfect') result.goodToPerfect = true;
        if (m.skillType === 'perfectBoost') result.perfectBonus += (m.perfectBonus || 0);
    }
    return result;
}

function activateMemberSkill(slotIndex) {
    const member = activeMembers[slotIndex];
    if (!member) return;
    const s = member.skillState;
    if (!s.canUse) return;

    if (member.skillType === 'healAndSmallScore') {
        hp += (member.heal || 0);
        if (hp > MAX_HP) hp = MAX_HP;
        addScore(member.smallScore || 0);
        s.canUse = false;
        s.lastUsed = performance.now();
        setTimeout(() => { s.canUse = true; renderMemberStatus(); }, member.cooldown || 10000);
        renderMemberStatus();
        return;
    }

    s.isActive = true;
    s.canUse = false;
    s.lastUsed = performance.now();
    s.remaining = member.duration || 0;

    // 비활성화 타이머
    setTimeout(() => { s.isActive = false; s.remaining = 0; renderMemberStatus(); }, member.duration || 0);
    setTimeout(() => { s.canUse = true; renderMemberStatus(); }, member.cooldown || 10000);
    renderMemberStatus();
}

function renderMemberStatus() {
    if (!memberStatusEl) return;
    memberStatusEl.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const m = activeMembers[i];
        const chip = document.createElement('div');
        chip.style.padding = '6px 8px';
        chip.style.borderRadius = '8px';
        chip.style.fontSize = '12px';
        chip.style.color = '#072125';
        chip.style.background = 'rgba(255,255,255,0.06)';
        chip.style.minWidth = '60px';
        chip.style.textAlign = 'center';
        if (m) {
            const s = m.skillState;
            if (s.isActive) { chip.textContent = `${i+1}: ACTIVE`; chip.style.background = '#00ffff'; chip.style.color = '#072125'; }
            else if (!s.canUse) { chip.textContent = `${i+1}: COOLDOWN`; chip.style.background = '#666'; chip.style.color = '#ddd'; }
            else { chip.textContent = `${i+1}: READY`; chip.style.background = '#00bcd4'; chip.style.color = '#072125'; }
        } else {
            chip.textContent = `${i+1}: -`;
            chip.style.background = 'transparent';
            chip.style.color = '#ccc';
        }
        memberStatusEl.appendChild(chip);
    }
}

// --- 입력 설정 ---
const KEY_MAP = { 'd': 0, 'f': 1, 'j': 2, 'k': 3 };
const keyState = { 'd': false, 'f': false, 'j': false, 'k': false };

// ---------- Seeded RNG helpers for deterministic beatmaps per-song ----------
function hashStringToSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}
function mulberry32(a) {
    return function() {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// Simple BPM estimator: fetch audio, decode, compute energy envelope and autocorrelate
async function estimateBpmFromAudio(url) {
    try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp || !resp.ok) return null;
        const ab = await resp.arrayBuffer();
        const AudioCtx = window.OfflineAudioContext || window.AudioContext || window.webkitAudioContext;
        const ctx = new (AudioCtx)();
        const audioBuf = await ctx.decodeAudioData(ab.slice(0));
        const ch = audioBuf.numberOfChannels > 0 ? audioBuf.getChannelData(0) : null;
        if (!ch || ch.length === 0) return null;
        // downsample/envelope rate
        const targetRate = 200; // samples per second for envelope
        const factor = Math.max(1, Math.floor(audioBuf.sampleRate / targetRate));
        const env = [];
        for (let i = 0; i < ch.length; i += factor) {
            let sum = 0; let n = 0;
            for (let j = i; j < i + factor && j < ch.length; j++) { const v = ch[j]; sum += v * v; n++; }
            env.push(Math.sqrt(sum / Math.max(1, n)));
        }
        if (env.length < 20) return null;
        // autocorrelation over BPM range 60..180
        const minBpm = 50, maxBpm = 200;
        const minLag = Math.floor((60 / maxBpm) * targetRate);
        const maxLag = Math.ceil((60 / minBpm) * targetRate);
        let bestLag = -1; let bestVal = -Infinity;
        // normalize mean
        let mean = 0; for (let i = 0; i < env.length; i++) mean += env[i]; mean /= env.length;
        for (let lag = minLag; lag <= maxLag; lag++) {
            let v = 0;
            for (let i = 0; i < env.length - lag; i++) v += (env[i] - mean) * (env[i + lag] - mean);
            if (v > bestVal) { bestVal = v; bestLag = lag; }
        }
        if (bestLag <= 0) return null;
        const bpm = Math.round((60 * targetRate) / bestLag);
        if (bpm < minBpm || bpm > maxBpm) return null;
        return bpm;
    } catch (e) {
        console.debug('estimateBpmFromAudio failed', e && e.message ? e.message : e);
        return null;
    }
}


// --- 비트맵 (노트 데이터) ---
// beatmap will be replaced per-song at start. Format:
// { time: ms_from_song_start, lane: 0..(LANE_COUNT-1) }
let beatmap = [];
let nextNoteIndex = 0;

// Generate a simple beatmap for a song given BPM and duration (ms)
function generateBeatmapForSong({ bpm = 120, duration = 30000, density = 0.85, minGapMs = null, seed = null, difficultyName = 'Normal' } = {}) {
    const notes = [];
    if (!bpm || bpm <= 0) bpm = 120;
    const beatMs = 60000 / bpm; // ms per quarter note
    // Use a beat-aligned approach: iterate fine-grained subdivisions (16th notes)
    // and weight spawn probability by position in the beat (downbeat > 8th > 16th).
    const step = Math.max(4, Math.round(beatMs / 4)); // 16th note step (ms)
    if (minGapMs == null) {
        // default: prevent very tight bursts; allow roughly the length of an 16th note
        minGapMs = Math.max(60, Math.round(step * 0.9));
    }
    let lastSpawnTime = -Infinity;

    // convert difficulty to local weighting scheme
    let weightDown = 1.0, weight8 = 0.75, weight16 = 0.35, scaleFactor = 1.2;
    if (String(difficultyName || '').toLowerCase() === 'easy') {
        weightDown = 0.9; weight8 = 0.6; weight16 = 0.18; scaleFactor = 1.05; minGapMs = Math.max(minGapMs, Math.round(beatMs * 0.35));
    } else if (String(difficultyName || '').toLowerCase() === 'hard') {
        weightDown = 1.0; weight8 = 0.85; weight16 = 0.5; scaleFactor = 1.35; minGapMs = Math.max(40, Math.round(step * 0.6));
    }

    // create RNG: seeded if seed provided, otherwise fallback to Math.random
    let rng = Math.random;
    if (seed != null) {
        const s = (typeof seed === 'number') ? (seed >>> 0) : hashStringToSeed(String(seed));
        rng = mulberry32(s);
    }

    for (let t = Math.round(step); t < duration; t += step) {
        // determine position within the quarter-note (beatMs)
        const rem = t % beatMs;
        // consider small tolerance window for floating/rounding imprecision
        const tol = Math.min(8, Math.round(step * 0.5));
        let weight = weight16; // default for off-beat 16ths
        if (rem <= tol || Math.abs(rem - beatMs) <= tol) {
            // exact quarter note (downbeat)
            weight = weightDown;
        } else if (Math.abs(rem - beatMs / 2) <= tol) {
            // 8th note position
            weight = weight8;
        }

        // probability scaled by density and position weight
        const prob = Math.min(1, density * weight * scaleFactor);

        if (rng() <= prob && (t - lastSpawnTime) >= minGapMs) {
            const lane = Math.floor(rng() * LANE_COUNT);
            notes.push({ time: Math.round(t), lane });
            lastSpawnTime = t;
            // very occasional paired note for musical accents (keeps some variety)
            if (rng() < 0.04) {
                let altLane = Math.floor(rng() * LANE_COUNT);
                let tries = 0;
                while (altLane === lane && tries < 6) { altLane = Math.floor(rng() * LANE_COUNT); tries++; }
                notes.push({ time: Math.round(t), lane: altLane });
            }
        }
    }
    // ensure at least a few notes
    if (notes.length === 0) {
        for (let i = 0; i < Math.min(8, Math.floor(duration / (beatMs || 500))); i++) notes.push({ time: Math.round(i * beatMs), lane: i % LANE_COUNT });
    }
    return notes;
}

// Create a synthetic demo song (OfflineAudioContext) and return { url, durationMs }
async function createSyntheticSong({ bpm = 120, durationSec = 20, key = 440 } = {}) {
    // Simple synth: sequence of sine notes on an OfflineAudioContext
    const sampleRate = 44100;
    const offline = new OfflineAudioContext(2, sampleRate * durationSec, sampleRate);
    const master = offline.createGain(); master.gain.value = 0.8; master.connect(offline.destination);

    // chord-ish backing: periodic bass pluck
    function scheduleTone(startSec, freq, lengthSec, type = 'sine', gain = 0.15) {
        const osc = offline.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        const g = offline.createGain(); g.gain.value = gain;
        osc.connect(g); g.connect(master);
        osc.start(startSec);
        osc.stop(startSec + lengthSec);
    }

    // melody pattern derived from BPM
    const beatSec = 60 / bpm;
    for (let i = 0; i < Math.floor(durationSec / beatSec); i++) {
        const t = i * beatSec;
        const noteFreq = key * Math.pow(2, ((i % 7) - 3) / 12);
        const len = beatSec * 0.9;
        scheduleTone(t, noteFreq, len, (i % 2 === 0) ? 'sine' : 'triangle', 0.08);
        if (i % 4 === 0) scheduleTone(t + beatSec * 0.25, noteFreq * 2, beatSec * 0.5, 'sine', 0.05);
    }

    // render
    const rendered = await offline.startRendering();

    // convert to WAV blob
    function audioBufferToWav(buffer) {
        const numOfChan = buffer.numberOfChannels;
        const length = buffer.length * numOfChan * 2 + 44;
        const bufferArray = new ArrayBuffer(length);
        const view = new DataView(bufferArray);
        /* RIFF identifier */ writeString(view, 0, 'RIFF');
        /* file length */ view.setUint32(4, 36 + buffer.length * numOfChan * 2, true);
        /* RIFF type */ writeString(view, 8, 'WAVE');
        /* format chunk identifier */ writeString(view, 12, 'fmt ');
        /* format chunk length */ view.setUint32(16, 16, true);
        /* sample format (raw) */ view.setUint16(20, 1, true);
        /* channel count */ view.setUint16(22, numOfChan, true);
        /* sample rate */ view.setUint32(24, buffer.sampleRate, true);
        /* byte rate (sampleRate * blockAlign) */ view.setUint32(28, buffer.sampleRate * numOfChan * 2, true);
        /* block align (channel count * bytesPerSample) */ view.setUint16(32, numOfChan * 2, true);
        /* bits per sample */ view.setUint16(34, 16, true);
        /* data chunk identifier */ writeString(view, 36, 'data');
        /* data chunk length */ view.setUint32(40, buffer.length * numOfChan * 2, true);
        // write interleaved
        let offset = 44;
        const channels = [];
        for (let i = 0; i < numOfChan; i++) channels.push(buffer.getChannelData(i));
        for (let i = 0; i < buffer.length; i++) {
            for (let ch = 0; ch < numOfChan; ch++) {
                let sample = Math.max(-1, Math.min(1, channels[ch][i]));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
                view.setInt16(offset, sample, true);
                offset += 2;
            }
        }
        return new Blob([view], { type: 'audio/wav' });
    }
    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
    }

    const wavBlob = audioBufferToWav(rendered);
    const url = URL.createObjectURL(wavBlob);
    return { url, durationMs: Math.round(durationSec * 1000) };
}
// ability (yellow bar) system
let abilityBars = [];
let nextAbilitySpawn = 0; // ms relative to game start elapsed

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function spawnAbility(elapsedTime) {
    // choose lane and a target member index (prefer canUse members)
    const lane = randInt(0, LANE_COUNT - 1);
    // find candidate active members that canUse
    const candidates = activeMembers.map((m,i)=> ({m,i})).filter(x => x.m && x.m.skillState && x.m.skillState.canUse);
    let memberIndex = null;
    if (candidates.length > 0) memberIndex = candidates[randInt(0, candidates.length - 1)].i;
    else {
        // fallback: pick any selected member index
        const any = selectedMembers.map((m,i)=> m ? i : -1).filter(i=>i>=0);
        if (any.length > 0) memberIndex = any[randInt(0, any.length -1)];
    }
    const ability = {
        lane,
        y: -20,
        speed: NOTE_SPEED * 0.9,
        width: LANE_WIDTH - 24,
        height: 18,
        spawnedAt: elapsedTime,
        memberIndex,
        isHit:false
    };
    abilityBars.push(ability);
}


// --- 게임 루프 ---
function gameLoop(timestamp) {
    if (!isGameRunning) return;

    const elapsedTime = timestamp - gameStartTime;
    
    if (isGamePaused) {
        // still draw static frame so overlays look correct
        try { draw(elapsedTime); } catch (e) {}
        requestAnimationFrame(gameLoop);
        return;
    }

    update(elapsedTime);
    draw(elapsedTime);

    requestAnimationFrame(gameLoop);
}

// --- 게임 로직 업데이트 ---
function update(elapsedTime) {
    // 노트 생성
    while (nextNoteIndex < beatmap.length && elapsedTime >= beatmap[nextNoteIndex].time) {
        const noteData = beatmap[nextNoteIndex];
        notes.push({
            x: noteData.lane * LANE_WIDTH,
            y: -NOTE_HEIGHT,
            lane: noteData.lane,
            isHit: false
        });
        nextNoteIndex++;
    }

    // 노트 이동 및 판정
    for (let i = notes.length - 1; i >= 0; i--) {
        const note = notes[i];
        note.y += NOTE_SPEED;

        // 화면 밖으로 나간 노트 처리 (Miss)
        if (note.y > CANVAS_HEIGHT) {
            combo = 0;
            notes.splice(i, 1);
            missCount++;
            showJudgement('Miss', 'miss');
            hp -= 10;
            if (hp < 0) hp = 0;
            if (hp === 0) {
                // immediate end when HP depleted
                try { endGame(); } catch (e) {}
            }
        }
    }
    
    updateUI();

    // ability spawn: spawn first ability not too early
    if (nextAbilitySpawn === 0) {
        // initial spawn between 8s and 15s
        nextAbilitySpawn = randInt(8000, 15000);
    }
    if (elapsedTime >= nextAbilitySpawn) {
        spawnAbility(elapsedTime);
        // schedule next between 12s and 22s after this one
        nextAbilitySpawn = elapsedTime + randInt(12000, 22000);
    }

    // ability movement
    for (let i = abilityBars.length - 1; i >= 0; i--) {
        const a = abilityBars[i];
        a.y += a.speed;
        if (a.y > CANVAS_HEIGHT + 50) {
            abilityBars.splice(i,1);
        }
    }
}

// --- 그리기 ---
function draw(elapsedTime) {
    // 캔버스 초기화
    // 화면 색상은 활성 스킬이 있으면 다소 변화
    const anyActive = activeMembers.some(m => m && m.skillState && m.skillState.isActive);
    // background gradient (stage depth)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGrad.addColorStop(0, anyActive ? '#24303a' : '#121217');
    bgGrad.addColorStop(0.5, '#0f1012');
    bgGrad.addColorStop(1, '#0b0b0b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 레인 구분선 (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let i = 1; i < LANE_COUNT; i++) {
        const x = i * LANE_WIDTH;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
    }

    // 판정선 (glowing)
    ctx.save();
    ctx.strokeStyle = '#00e6d9';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00e6d9';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, JUDGEMENT_LINE_Y);
    ctx.lineTo(CANVAS_WIDTH, JUDGEMENT_LINE_Y);
    ctx.stroke();
    ctx.restore();

    // 키 눌림 효과
    for (const key in keyState) {
        if (keyState[key]) {
            const laneIndex = KEY_MAP[key];
            ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
            ctx.fillRect(laneIndex * LANE_WIDTH, 0, LANE_WIDTH, CANVAS_HEIGHT);
        }
    }

    // 노트 그리기 (rounded, gradient)
    for (const note of notes) {
        const nx = note.x + 6;
        const nw = LANE_WIDTH - 12;
        const nh = NOTE_HEIGHT;
        // gradient fill
        const g = ctx.createLinearGradient(0, note.y, 0, note.y + nh);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, '#e6e6e6');
        ctx.fillStyle = g;
        // rounded rect
        const r = 8;
        ctx.beginPath();
        ctx.moveTo(nx + r, note.y);
        ctx.arcTo(nx + nw, note.y, nx + nw, note.y + nh, r);
        ctx.arcTo(nx + nw, note.y + nh, nx, note.y + nh, r);
        ctx.arcTo(nx, note.y + nh, nx, note.y, r);
        ctx.arcTo(nx, note.y, nx + nw, note.y, r);
        ctx.closePath();
        ctx.fill();
        // slight inner shadow
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Draw ability bars (yellow) in middle of gameplay
    for (const a of abilityBars) {
        const ax = a.lane * LANE_WIDTH + 12;
        const aw = a.width;
        const ah = a.height;
        // glow
        ctx.save();
        ctx.fillStyle = 'rgba(255,220,130,0.95)';
        ctx.shadowColor = 'rgba(255,210,110,0.9)';
        ctx.shadowBlur = 20;
        // rounded rect
        const r = 10;
        ctx.beginPath();
        ctx.moveTo(ax + r, a.y);
        ctx.arcTo(ax + aw, a.y, ax + aw, a.y + ah, r);
        ctx.arcTo(ax + aw, a.y + ah, ax, a.y + ah, r);
        ctx.arcTo(ax, a.y + ah, ax, a.y, r);
        ctx.arcTo(ax, a.y, ax + aw, a.y, r);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        // thin highlight
        ctx.strokeStyle = 'rgba(255,240,200,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    }
}

// --- UI 업데이트 ---
function updateUI() {
    if (scoreDisplay) scoreDisplay.textContent = `Score: ${score}`;
    // show combo with label and big number
    if (comboDisplay) {
        comboDisplay.innerHTML = `<div style="font-size:14px;color:#ddd;">COMBO</div><div id=\"combo-value\" style=\"font-size:40px;color:#00e6d9;text-shadow:0 0 12px #00e6d9;\">${combo}</div>`;
    }
    if (combo > maxCombo) maxCombo = combo;

    // HP bar
    const hpBar = document.getElementById('hp-bar');
    if (hpBar) {
        hpBar.style.width = `${(hp / MAX_HP) * 100}%`;
    }

    // HP numeric text (e.g., "100 / 160")
    const hpTextEl = document.getElementById('hp-text');
    if (hpTextEl) {
        try {
            const display = `${Math.max(0, Math.floor(hp)).toLocaleString()} / ${Math.max(1, Math.floor(MAX_HP)).toLocaleString()}`;
            hpTextEl.textContent = display;
        } catch (e) {
            hpTextEl.textContent = String(hp) + ' / ' + String(MAX_HP);
        }
    }

    // Member status chips in top bar
    renderMemberStatus();
}

// Show realtime judgement popup (Perfect / Good / Miss)
function showJudgement(text, type) {
    try {
        const container = document.getElementById('judgement-display');
        if (!container) return;
        // Ensure only a single judgement element exists — reuse it if present
        let el = container.querySelector('.judgement-text');
        if (!el) {
            el = document.createElement('div');
            el.className = 'judgement-text judgement-anim';
            container.appendChild(el);
        }
        // clear other classes and set the proper type class
        el.classList.remove('judgement-perfect','judgement-good','judgement-miss','judgement-great','judgement-bad');
        if (type) el.classList.add('judgement-' + type);
        el.textContent = (text || '').toUpperCase();
        // ensure visible and retrigger animation
        el.style.opacity = '1';
        el.classList.remove('judgement-anim');
        // force reflow then re-add animation class
        // eslint-disable-next-line no-unused-expressions
        el.offsetHeight;
        el.classList.add('judgement-anim');
        // safety hide after animation completes (900ms) + small buffer
        setTimeout(() => { try { if (el) el.style.opacity = '0'; } catch(e){} }, 1000);
    } catch (e) {
        // ignore UI errors
        console.warn('showJudgement error', e);
    }
}


// --- 입력 처리 ---
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    
    // Note hit keys
    if (KEY_MAP.hasOwnProperty(key) && !keyState[key]) {
        keyState[key] = true;
        checkHit(KEY_MAP[key]);
    }

    // Skill activation via number keys 1-5
    if (['1','2','3','4','5'].includes(key)) {
        const idx = parseInt(key) - 1;
        activateMemberSkill(idx);
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (KEY_MAP.hasOwnProperty(key)) {
        keyState[key] = false;
    }
});


function checkHit(lane) {
    // check ability hit first
    // handleAbilityHit returns true when an ability was hit and already
    // awarded score/combo; in that case we should not treat this as a miss
    // later in this function — return early after updating UI.
    let hit = false;
    try {
        if (handleAbilityHit(lane)) {
            try { updateUI(); } catch (e) {}
            return;
        }
    } catch (e) { /* ignore ability handler errors */ }
    for (let i = notes.length - 1; i >= 0; i--) {
        const note = notes[i];
        if (note.lane === lane) {
            const distance = Math.abs(note.y - JUDGEMENT_LINE_Y);

            // 판정 범위 설정 (설정값 ms -> 거리 근사)
            const framePerMsFactor = (NOTE_SPEED * 60) / 1000; // approx px per ms
            const PERFECT_DIST = Math.max(4, Math.round((settings.perfectMs || 50) * framePerMsFactor));
            const GREAT_DIST = Math.max(PERFECT_DIST + 4, Math.round((settings.greatMs || 100) * framePerMsFactor));
            const GOOD_DIST = Math.max(GREAT_DIST + 6, Math.round((settings.goodMs || 150) * framePerMsFactor));
            const BAD_DIST = Math.max(GOOD_DIST + 8, Math.round((settings.badMs || 200) * framePerMsFactor));

            // 집계된 활성 스킬 효과
            const effects = aggregateActiveEffects();

            let judgement = 'miss';
            if (distance < PERFECT_DIST) judgement = 'perfect';
            else if (distance < GREAT_DIST) judgement = 'great';
            else if (distance < GOOD_DIST) judgement = 'good';
            else if (distance < BAD_DIST) judgement = 'bad';

            // good->perfect 스킬 적용 (great도 perfect로 승격)
            if ((judgement === 'good' || judgement === 'great') && effects.goodToPerfect) {
                judgement = 'perfect';
            }

            if (judgement === 'perfect') {
                const basePerfect = 100;
                const scoreToAdd = Math.round((basePerfect + (effects.perfectBonus || 0)) * (effects.scoreMultiplier || 1));
                addScore(scoreToAdd);
                perfectCount++;
                showJudgement('Perfect', 'perfect');
                combo++;
                notes.splice(i, 1);
                hit = true;
                break;
            } else if (judgement === 'great') {
                const baseGreat = 80;
                const scoreToAdd = Math.round(baseGreat * (effects.scoreMultiplier || 1));
                addScore(scoreToAdd);
                greatCount++;
                showJudgement('Great', 'great');
                combo++;
                notes.splice(i, 1);
                hit = true;
                break;
            } else if (judgement === 'good') {
                const baseGood = 50;
                const scoreToAdd = Math.round(baseGood * (effects.scoreMultiplier || 1));
                addScore(scoreToAdd);
                goodCount++;
                showJudgement('Good', 'good');
                combo++;
                notes.splice(i, 1);
                hit = true;
                break;
            } else if (judgement === 'bad') {
                const baseBad = 20;
                const scoreToAdd = Math.round(baseBad * (effects.scoreMultiplier || 1));
                addScore(scoreToAdd);
                badCount++;
                showJudgement('Bad', 'bad');
                combo = 0;
                damageHP(10);
                notes.splice(i, 1);
                hit = true;
                break;
            }
        }
    }

    if (!hit) {
        // 노트를 놓쳤을 때 (빈 키 입력은 Miss)
        combo = 0;
        showJudgement('Miss', 'miss');
    }
}

function handleAbilityHit(lane) {
    // if any ability in this lane is within judgement window, trigger its linked member skill
    for (let i = abilityBars.length - 1; i >= 0; i--) {
        const a = abilityBars[i];
        if (a.lane !== lane) continue;
        const dist = Math.abs(a.y - JUDGEMENT_LINE_Y);
        if (dist < 40 && !a.isHit) {
            a.isHit = true;
            // activate member skill if assigned
            if (typeof a.memberIndex === 'number' && activeMembers[a.memberIndex]) {
                activateMemberSkill(a.memberIndex);
            } else {
                // fallback: pick first active member
                for (let si = 0; si < activeMembers.length; si++) {
                    if (activeMembers[si]) { activateMemberSkill(si); break; }
                }
            }
            // visual feedback: remove ability
            abilityBars.splice(i,1);
            // award small score + combo
            addScore(50); combo++;
            showJudgement('Good', 'good');
            return true;
        }
    }
    return false;
}

// (removed unused global activateSkill helper)

// --- 게임 시작 ---
function startGame() {
    try {
        console.debug('startGame called', { isGameRunning, selectedMembers });
        if (isGameRunning) return;
        if (!Array.isArray(selectedMembers) || selectedMembers.filter(Boolean).length === 0) {
            alert('최소 1명 이상의 멤버를 선택하세요.');
            return;
        }

        // defensive log before preparing members
        try { console.debug('selectedMembers preview', selectedMembers.slice(0,5)); } catch(e){}
        try {
            prepareActiveMembers();
            console.debug('prepareActiveMembers OK');
        } catch (e) {
            console.error('prepareActiveMembers threw', e);
            throw e;
        }

        isGameRunning = true;
        if (settingsBtn) try { settingsBtn.style.display = 'none'; } catch(e){}
        gameStartTime = performance.now();
        nextNoteIndex = 0;
        notes = [];
        // ensure badge shows current score at start
        displayedScore = score || 0;
        updateScoreBadgeInstant();

        // initialize progress bar
        try { updateProgressBarByScore(); } catch(e) {}
        score = 0;
        combo = 0;
        maxCombo = 0;
        hp = MAX_HP;

        // hide member select overlay properly
        try {
            if (memberSelectScreen) hideOverlay(memberSelectScreen);
            console.debug('memberSelectScreen hidden');
        } catch (e) { console.error('hideOverlay(memberSelectScreen) threw', e); }

        if (gameAudio) {
                try {
                    // prepare audio source for the selected song (supports synthetic demo and file paths)
                    async function prepareAndPlayAudio() {
                        try {
                            if (gameAudio._generatedBlobUrl) { URL.revokeObjectURL(gameAudio._generatedBlobUrl); gameAudio._generatedBlobUrl = null; }
                            if (selectedSong && selectedSong.audio) {
                                if (selectedSong.audio.startsWith('demo:')) {
                                    const bpm = selectedSong.bpm || 120;
                                    const secs = selectedSong.durationSec || 20;
                                    const res = await createSyntheticSong({ bpm, durationSec: secs, key: 440 });
                                    gameAudio.src = res.url; gameAudio._generatedBlobUrl = res.url;
                                    const preset = getDifficultyPreset(settings.difficulty || 'Normal');
                                    beatmap = generateBeatmapForSong({ bpm, duration: res.durationMs, density: selectedSong.density || preset.density, seed: selectedSong.id || selectedSong.audio || ('demo-'+(selectedSong.name||'ai')), difficultyName: settings.difficulty || 'Normal' });
                                } else {
                                    gameAudio.src = selectedSong.audio;
                                    gameAudio.addEventListener('loadedmetadata', async function onMeta() {
                                        try {
                                            const dur = Math.round(gameAudio.duration * 1000);
                                            const preset = getDifficultyPreset(settings.difficulty || 'Normal');
                                            let bpmToUse = (typeof selectedSong.bpm === 'number' && selectedSong.bpm > 0) ? selectedSong.bpm : null;
                                            if (!bpmToUse) {
                                                try {
                                                    const est = await estimateBpmFromAudio(selectedSong.audio);
                                                    if (est && typeof est === 'number') { bpmToUse = est; selectedSong.bpm = est; }
                                                } catch (e) { /* ignore estimator failures */ }
                                            }
                                            beatmap = generateBeatmapForSong({ bpm: bpmToUse || 120, duration: dur, density: selectedSong.density || preset.density, seed: selectedSong.id || selectedSong.audio || ('song-'+(selectedSong.name||Date.now())), difficultyName: settings.difficulty || 'Normal' });
                                        } catch(e){}
                                        gameAudio.removeEventListener('loadedmetadata', onMeta);
                                    });
                                }
                            } else {
                                const preset = getDifficultyPreset(settings.difficulty || 'Normal');
                                beatmap = generateBeatmapForSong({ bpm: 120, duration: 30000, density: preset.density, seed: ('demo-default'), difficultyName: settings.difficulty || 'Normal' });
                            }
                            gameAudio.currentTime = 0;
                            const p = gameAudio.play();
                            if (p && typeof p.then === 'function') {
                                p.then(()=>{
                                    console.debug('gameAudio.play() resolved');
                                    // start timing from actual audio play to keep beatmap in sync
                                    gameStartTime = performance.now();
                                    try { requestAnimationFrame(gameLoop); } catch(e) { console.warn('requestAnimationFrame failed', e); }
                                }).catch(err => {
                                    console.warn('play() rejected', err);
                                    const ai = document.getElementById('audio-indicator'); if (ai) ai.textContent = 'Muted';
                                    // still start loop even if audio couldn't autoplay
                                    gameStartTime = performance.now();
                                    try { requestAnimationFrame(gameLoop); } catch(e) {}
                                });
                            } else {
                                // synchronous play start (older browsers)
                                gameStartTime = performance.now();
                                try { requestAnimationFrame(gameLoop); } catch(e) {}
                            }
                        } catch(e) { console.warn('prepareAndPlayAudio failed', e); }
                    }
                    prepareAndPlayAudio();
                } catch (e) { console.warn('gameAudio play sync threw', e); }
        }

        // show stage overlay visuals when game starts
        try {
            const stage = document.getElementById('stage-overlay');
            if (stage) stage.style.display = 'block';
            console.debug('stage-overlay shown');
        } catch (e) { console.error('show stage-overlay threw', e); }

        // game loop will be scheduled when audio begins playing (prepareAndPlayAudio sets gameStartTime)
    } catch (err) {
        console.error('startGame error', err);
        alert('게임 시작 중 오류가 발생했습니다. 콘솔을 확인하세요.\n' + (err && err.message ? err.message : String(err)));
    }
}

// Ensure start button triggers the proper startGame flow (with member checks)
if (startButton) {
    startButton.removeEventListener && startButton.removeEventListener('click', startGame);
    startButton.addEventListener('click', (e) => {
        // hide start screen overlay when starting from start
        if (startScreen && window.getComputedStyle(startScreen).display !== 'none') {
            startScreen.style.display = 'none';
        }
        // Require a song to be selected before starting from member-select
        if (!selectedSong) {
            // If song-select isn't already visible, open it so user can pick a track
            try {
                if (songSelectScreen) showOverlay(songSelectScreen);
            } catch (e) {}
            alert('라이브에서 곡을 선택한 후 게임을 시작하세요.');
            return;
        }
        // if song select is open, hide it
        if (songSelectScreen && window.getComputedStyle(songSelectScreen).display !== 'none') {
            hideOverlay(songSelectScreen);
        }
        // call standardized start
        startGame();
    });
}

// 밴드 버튼 동작 추가 (handled below with navigation-aware behavior)

// 라이브 버튼 동작 추가
if (openSongButton) {
    openSongButton.addEventListener('click', () => {
        showOverlay(songSelectScreen);
    });
}

const startScreen = document.getElementById('start-screen');
// New navigation handlers and overlay helpers
function showOverlay(el) {
    if (!el) return;
    // hide background game wrapper
    const gw = document.getElementById('game-wrapper');
    if (gw) gw.style.display = 'none';
    // hide stage visuals while overlays are open
    const stage = document.getElementById('stage-overlay');
    if (stage) stage.style.display = 'none';
    el.style.display = 'flex';
}
function hideOverlay(el) {
    const gw = document.getElementById('game-wrapper');
    if (el) {
        el.style.display = 'none';
    }
    // If there are no visible overlays remaining, restore the game wrapper
    const overlays = Array.from(document.querySelectorAll('.overlay'));
    const anyVisible = overlays.some(o => window.getComputedStyle(o).display !== 'none');
    if (!anyVisible) {
        if (gw) gw.style.display = '';
        // if game is running, keep stage visible; otherwise hide it
        const stage = document.getElementById('stage-overlay');
        if (stage) {
            if (isGameRunning) stage.style.display = 'block'; else stage.style.display = 'none';
        }
    }
}

if (openMemberButton) {
    openMemberButton.addEventListener('click', () => {
        console.log('openMemberButton (nav) clicked');
        // if opening from the start screen (lobby), hide the in-overlay start button
        try {
            const wasStartVisible = (startScreen && window.getComputedStyle(startScreen).display !== 'none');
            if (wasStartVisible) {
                if (startButton) startButton.style.display = 'none';
            } else {
                if (startButton) startButton.style.display = '';
            }
        } catch (e) {}
        if (startScreen) startScreen.style.display = 'none';
        if (memberSelectScreen) showOverlay(memberSelectScreen);
        renderCharacterList(); renderSelectedSlots();
        updateStageBand();
    });
}
if (openSongButton) {
    openSongButton.addEventListener('click', () => {
        if (startScreen) startScreen.style.display = 'none';
        if (songSelectScreen) showOverlay(songSelectScreen);
        renderSongList(); renderSongPreview();
    });
}
if (openSongFromMemberBtn) {
    openSongFromMemberBtn.addEventListener('click', () => {
        if (memberSelectScreen) hideOverlay(memberSelectScreen);
        if (songSelectScreen) showOverlay(songSelectScreen);
        renderSongList(); renderSongPreview();
    });
}
if (backToStartFromMemberBtn) {
    backToStartFromMemberBtn.addEventListener('click', () => {
        try {
            if (memberSelectScreen) hideOverlay(memberSelectScreen);
            // use showOverlay so game-wrapper remains hidden behind the lobby
            if (startScreen) showOverlay(startScreen);
        } catch (e) {
            if (memberSelectScreen) memberSelectScreen.style.display = 'none';
            if (startScreen) startScreen.style.display = 'flex';
        }
    });
}
if (backToMemberFromSongBtn) {
    backToMemberFromSongBtn.addEventListener('click', () => {
        // when navigating from song-select back to member-select, show start screen
        if (songSelectScreen) hideOverlay(songSelectScreen);
        if (startScreen) {
            startScreen.style.display = 'flex';
            // ensure startScreen is below member select
            startScreen.style.zIndex = '10000';
        }
        // Previously this returned to member-select; change to go back to start (lobby) instead
        // so pressing BACK from song-select opens the lobby rather than the band screen.
        // Hide song-select and show start overlay.
        try {
            if (songSelectScreen) hideOverlay(songSelectScreen);
            if (startScreen) showOverlay(startScreen);
        } catch (e) {
            if (memberSelectScreen) { memberSelectScreen.style.zIndex = '10001'; showOverlay(memberSelectScreen); }
        }
    });
}

// Fallback event delegation for `.assign` buttons in selected slots.
// Some dynamic re-renders may miss attaching handlers; delegate at document level to ensure clicks work.
document.addEventListener('click', (ev) => {
    try {
        const btn = ev.target.closest && ev.target.closest('.assign');
        if (!btn) return;
        ev.stopPropagation();
        const idxAttr = btn.getAttribute('data-idx');
        const idx = idxAttr ? Number(idxAttr) : null;
        if (typeof idx === 'number' && !Number.isNaN(idx)) {
            // open member catalog for this slot
            openMemberCatalogForSlot(idx);
        } else {
            // if no data-idx, try to find parent slot index by walking DOM
            const slot = btn.closest('.slot');
            if (slot) {
                const parent = slot.parentElement;
                if (parent) {
                    const idx2 = Array.prototype.indexOf.call(parent.children, slot);
                    if (idx2 >= 0) openMemberCatalogForSlot(idx2);
                }
            }
        }
    } catch (e) { /* ignore delegation errors */ }
}, true);
if (confirmSongButton) {
    confirmSongButton.addEventListener('click', () => {
        if (songSelectScreen) hideOverlay(songSelectScreen);
        if (memberSelectScreen) {
            showOverlay(memberSelectScreen);
            // when returning from song-select after choosing a track, ensure start button is visible
            try { if (startButton) startButton.style.display = ''; } catch(e) {}
        }
    });
}

// clear selection
if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener('click', () => { selectedMembers = []; renderSelectedSlots(); });
}

// 초기화: 먼저 generated songs manifest를 불러와 songData를 채운 뒤 UI를 렌더합니다.
(async function initializeUI() {
    try {
        await loadGeneratedSongsManifest();
    } catch (e) {
        // ignore manifest load errors — UI will render without generated songs
    }
    // 초기 렌더 (멤버 화면은 시작 스크린에서 오픈 시 렌더)
    renderCharacterList();
    renderSelectedSlots();
    renderSongList();
    renderSongPreview();
    // If any overlay (like the start-screen) is visible on load, hide the game wrapper
    try {
        const overlays = Array.from(document.querySelectorAll('.overlay'));
        const anyVisible = overlays.some(o => window.getComputedStyle(o).display !== 'none');
        const gw = document.getElementById('game-wrapper');
        const stage = document.getElementById('stage-overlay');
        if (anyVisible) {
            if (gw) gw.style.display = 'none';
            if (stage) stage.style.display = 'none';
        } else {
            if (gw) gw.style.display = '';
            if (stage) stage.style.display = (isGameRunning ? 'block' : 'none');
        }
    } catch (e) { /* ignore layout errors */ }
})();

// Initialize song select controls (tabs / difficulty buttons + keyboard nav)
function initSongSelectControls() {
    document.querySelectorAll('.tab').forEach(t => {
        t.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            songListSelectedIndex = 0;
            renderSongList();
        });
    });
    document.querySelectorAll('.diff-btn').forEach(d => {
        d.addEventListener('click', (ev) => {
            // clear active state and aria for all buttons
            document.querySelectorAll('.diff-btn').forEach(x => { x.classList.remove('active'); try { x.setAttribute('aria-pressed','false'); } catch(e){} });
            // set active on clicked button and mark pressed for accessibility
            d.classList.add('active'); try { d.setAttribute('aria-pressed','true'); d.focus && d.focus(); } catch(e) {}
            const label = (d.textContent || '').trim().toUpperCase();
            currentDifficulty = label;
            // map UI label to settings difficulty name used by presets
            let mapped = 'Normal';
            if (label === 'EASY') mapped = 'Easy';
            else if (label === 'NORMAL') mapped = 'Normal';
            else if (label === 'HARD') mapped = 'Hard';
            // apply immediately so starting game uses preset without opening settings
            try { settings.difficulty = mapped; saveSettings(); applySettings(); } catch(e) {}
            if (selectedSong) selectedSong.selectedDiff = currentDifficulty;
            renderSongPreview();
        });
    });

    // Also attach explicit logging listeners to diff buttons for debugging
    try {
        document.querySelectorAll('.diff-btn').forEach(b => {
            b.removeEventListener && b.removeEventListener('click', b._dbgListener);
            b._dbgListener = function (ev) {
                console.log('diff-btn clicked (dbg):', b.textContent.trim(), { visible: document.querySelector('#song-select-screen').style.display });
                // prevent accidental propagation from overlays
                ev.stopPropagation && ev.stopPropagation();
            };
            b.addEventListener('click', b._dbgListener);
        });
    } catch (e) { console.warn('attach dbg listeners failed', e); }

    // keyboard navigation for song list
    window.addEventListener('keydown', (e) => {
        const overlayVisible = document.querySelector('#song-select-screen').style.display !== 'none';
        if (!overlayVisible) return;
        if (e.key === 'ArrowDown') {
            songListSelectedIndex++;
            renderSongList();
            renderSongPreview();
            e.preventDefault();
        } else if (e.key === 'ArrowUp') {
            songListSelectedIndex = Math.max(0, songListSelectedIndex - 1);
            renderSongList();
            renderSongPreview();
            e.preventDefault();
        } else if (e.key === 'Enter') {
            // PLAY via Enter when in song select
            if (document.querySelector('#song-select-screen').style.display !== 'none') {
                // start game
                startGame();
            }
        }
    });
}

initSongSelectControls();

// Install a lightweight debug indicator to show last-clicked difficulty
// debug indicator removed

// Delegate diff button clicks as a fallback in case direct handlers are missed
document.body.addEventListener('click', (ev) => {
    try {
        const btn = ev.target.closest && ev.target.closest('.diff-btn');
        if (!btn) return;
        // ensure the song-select screen is visible
        const overlayVisible = document.querySelector('#song-select-screen') && document.querySelector('#song-select-screen').style.display !== 'none';
        if (!overlayVisible) return;
        // toggle active classes and aria-pressed for accessibility
        document.querySelectorAll('.diff-btn').forEach(x => { x.classList.remove('active'); try { x.setAttribute('aria-pressed','false'); } catch(e){} });
        btn.classList.add('active'); try { btn.setAttribute('aria-pressed','true'); btn.focus && btn.focus(); } catch(e) {}
        // normalize difficulty value and apply preset
        const label = (btn.textContent || '').trim().toUpperCase();
        currentDifficulty = label;
        let mapped = 'Normal';
        if (label === 'EASY') mapped = 'Easy';
        else if (label === 'NORMAL') mapped = 'Normal';
        else if (label === 'HARD') mapped = 'Hard';
        try { settings.difficulty = mapped; saveSettings(); applySettings(); } catch(e) {}
        if (selectedSong) selectedSong.selectedDiff = currentDifficulty;
        try { renderSongPreview(); } catch(e) {}
    } catch (e) { console.warn('diff-btn delegate error', e); }
});

// --- Pause / Settings / Result handlers ---
const pauseBtn = document.getElementById('pause-btn');
const pauseMenu = document.getElementById('pause-menu');
const pauseResume = document.getElementById('pause-resume');
const pauseRetry = document.getElementById('pause-retry');
const pauseExit = document.getElementById('pause-exit');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsSave = document.getElementById('settings-save');
const settingsCancel = document.getElementById('settings-cancel');
const settingsReset = document.getElementById('settings-reset');
const settingVolumeEl = document.getElementById('setting-volume');
const settingNoteSizeEl = document.getElementById('setting-note-size');
const settingPerfectMsEl = document.getElementById('setting-perfect-ms');
const settingGreatMsEl = document.getElementById('setting-great-ms');
const settingGoodMsEl = document.getElementById('setting-good-ms');
const settingBadMsEl = document.getElementById('setting-bad-ms');
const settingNoteSpeedEl = document.getElementById('setting-note-speed');
const settingKeymapEl = document.getElementById('setting-keymap');
// numeric control buttons for note size
const noteSizeDec10Btn = document.getElementById('setting-note-size-dec10');
const noteSizeDec1Btn = document.getElementById('setting-note-size-dec1');
const noteSizeInc1Btn = document.getElementById('setting-note-size-inc1');
const noteSizeInc10Btn = document.getElementById('setting-note-size-inc10');
// numeric control buttons for note speed
const noteSpeedDec10Btn = document.getElementById('setting-note-speed-dec10');
const noteSpeedDec1Btn = document.getElementById('setting-note-speed-dec1');
const noteSpeedInc1Btn = document.getElementById('setting-note-speed-inc1');
const noteSpeedInc10Btn = document.getElementById('setting-note-speed-inc10');
// key buttons and judge test controls
const settingKeyBtn = [
    document.getElementById('setting-key-btn-0'),
    document.getElementById('setting-key-btn-1'),
    document.getElementById('setting-key-btn-2'),
    document.getElementById('setting-key-btn-3')
];
// judge test controls (will be wired to the dedicated judge-test overlay when opened)
let settingTestBpmEl = null;
let settingTestStartBtn = null;
let settingTestStopBtn = null;
let settingTestAutosuggestBtn = null;
let settingJudgeCanvas = null;
let settingTestLast = null;
let settingTestSuggestPerfect = null;
let settingTestSuggestGood = null;
const settingsButtonMember = document.getElementById('settings-button');
const openJudgeTestBtn = document.getElementById('open-judge-test-btn');
const judgeTestScreen = document.getElementById('judge-test-screen');
const judgeStartBtn = document.getElementById('judge-start');
const judgeStopBtn = document.getElementById('judge-stop');
const judgeAutosuggestBtn = document.getElementById('judge-autosuggest');
const judgeCloseBtn = document.getElementById('judge-close');
const judgeBpmEl = document.getElementById('judge-bpm');
const judgeCanvasEl = document.getElementById('judge-canvas');
const judgeLastEl = document.getElementById('judge-last');
const judgeSuggestPerfectEl = document.getElementById('judge-suggest-perfect');
const judgeSuggestGoodEl = document.getElementById('judge-suggest-good');

// Helper to adjust numeric setting inputs, clamp, save and apply
function adjustNumericSetting(inputEl, delta, min, max, settingKey) {
    if (!inputEl) return;
    let val = parseFloat(inputEl.value || '0');
    if (isNaN(val)) val = 0;
    val = val + delta;
    if (typeof min === 'number') val = Math.max(min, val);
    if (typeof max === 'number') val = Math.min(max, val);
    // round to integer for these settings
    val = Math.round(val);
    inputEl.value = val;
    // update settings object and persist
    try {
        settings[settingKey] = val;
        saveSettings();
        applySettings();
    } catch (e) { console.warn('adjustNumericSetting failed', e); }
}

// Wire numeric control buttons
if (noteSizeDec10Btn) noteSizeDec10Btn.addEventListener('click', () => adjustNumericSetting(settingNoteSizeEl, -10, 50, 200, 'noteSize'));
if (noteSizeDec1Btn) noteSizeDec1Btn.addEventListener('click', () => adjustNumericSetting(settingNoteSizeEl, -1, 50, 200, 'noteSize'));
if (noteSizeInc1Btn) noteSizeInc1Btn.addEventListener('click', () => adjustNumericSetting(settingNoteSizeEl, +1, 50, 200, 'noteSize'));
if (noteSizeInc10Btn) noteSizeInc10Btn.addEventListener('click', () => adjustNumericSetting(settingNoteSizeEl, +10, 50, 200, 'noteSize'));

if (noteSpeedDec10Btn) noteSpeedDec10Btn.addEventListener('click', () => adjustNumericSetting(settingNoteSpeedEl, -10, 1, 12, 'noteSpeed'));
if (noteSpeedDec1Btn) noteSpeedDec1Btn.addEventListener('click', () => adjustNumericSetting(settingNoteSpeedEl, -1, 1, 12, 'noteSpeed'));
if (noteSpeedInc1Btn) noteSpeedInc1Btn.addEventListener('click', () => adjustNumericSetting(settingNoteSpeedEl, +1, 1, 12, 'noteSpeed'));
if (noteSpeedInc10Btn) noteSpeedInc10Btn.addEventListener('click', () => adjustNumericSetting(settingNoteSpeedEl, +10, 1, 12, 'noteSpeed'));

// Also handle manual input changes to clamp and apply
if (settingNoteSizeEl) {
    settingNoteSizeEl.addEventListener('change', () => {
        adjustNumericSetting(settingNoteSizeEl, 0, 50, 200, 'noteSize');
    });
}
if (settingNoteSpeedEl) {
    settingNoteSpeedEl.addEventListener('change', () => {
        // change with zero delta will parse, clamp, round and save
        adjustNumericSetting(settingNoteSpeedEl, 0, 1, 12, 'noteSpeed');
    });
}

function openSettingsModal() {
    if (!settingsModal) return;
    if (isGameRunning) {
        // prevent opening settings during gameplay
        try { alert('게임 중에는 설정을 변경할 수 없습니다. 게임을 종료하거나 일시정지 후 설정해주세요.'); } catch(e){}
        return;
    }
    // populate
    if (settingVolumeEl) settingVolumeEl.value = settings.volume || 1;
    if (settingNoteSizeEl) settingNoteSizeEl.value = (typeof settings.noteSize !== 'undefined' ? settings.noteSize : 100);
    if (settingNoteSpeedEl) settingNoteSpeedEl.value = (typeof settings.noteSpeed !== 'undefined' ? settings.noteSpeed : NOTE_SPEED);
    if (settingPerfectMsEl) settingPerfectMsEl.value = settings.perfectMs || 50;
    if (settingGreatMsEl) settingGreatMsEl.value = settings.greatMs || 100;
    if (settingGoodMsEl) settingGoodMsEl.value = settings.goodMs || 150;
    if (settingBadMsEl) settingBadMsEl.value = settings.badMs || 200;
    if (settingKeymapEl) settingKeymapEl.value = (Array.isArray(settings.keymap) ? settings.keymap.join(',') : (settings.keymap || 'd,f,j,k'));
    // populate key buttons
    try {
        const km = Array.isArray(settings.keymap) ? settings.keymap : (String(settingKeymapEl.value || 'd,f,j,k').split(',').map(s=>s.trim()).filter(Boolean));
        for (let i=0;i<4;i++) {
            const k = km[i] || ['d','f','j','k'][i];
            if (settingKeyBtn[i]) settingKeyBtn[i].textContent = (String(k)).toUpperCase();
        }
    } catch(e){}
    // reset any inline judge-test indicators (we use a separate overlay now)
    // nothing to do here for judge test
    showOverlay(settingsModal);
}
function closeSettingsModal() { if (settingsModal) hideOverlay(settingsModal); }

if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
// Also allow the settings button inside the member-select screen to open the same modal
if (settingsButtonMember) settingsButtonMember.addEventListener('click', (e) => { e.stopPropagation(); openSettingsModal(); });
if (settingsCancel) settingsCancel.addEventListener('click', closeSettingsModal);
if (settingsReset) settingsReset.addEventListener('click', () => {
    settings = Object.assign({}, defaultSettings); saveSettings(); applySettings(); openSettingsModal();
});
if (settingsSave) settingsSave.addEventListener('click', () => {
    try {
        if (settingVolumeEl) settings.volume = parseFloat(settingVolumeEl.value);
        if (settingNoteSizeEl) settings.noteSize = parseFloat(settingNoteSizeEl.value);
        if (settingNoteSpeedEl) settings.noteSpeed = parseFloat(settingNoteSpeedEl.value);
        if (settingPerfectMsEl) settings.perfectMs = parseInt(settingPerfectMsEl.value, 10);
        if (settingGreatMsEl) settings.greatMs = parseInt(settingGreatMsEl.value, 10);
        if (settingGoodMsEl) settings.goodMs = parseInt(settingGoodMsEl.value, 10);
        if (settingBadMsEl) settings.badMs = parseInt(settingBadMsEl.value, 10);
        if (settingKeymapEl) settings.keymap = settingKeymapEl.value.split(',').map(s=>s.trim()).filter(Boolean);
        saveSettings(); applySettings();
        // sync with song-select difficulty UI
        try {
            currentDifficulty = (settings.difficulty || 'Normal').toUpperCase();
            // update diff buttons UI (also sync aria-pressed)
            document.querySelectorAll('.diff-btn').forEach(d => { d.classList.remove('active'); try { d.setAttribute('aria-pressed','false'); } catch(e){} });
            const btn = Array.from(document.querySelectorAll('.diff-btn')).find(b => b.textContent.trim().toUpperCase() === currentDifficulty);
            if (btn) { btn.classList.add('active'); try { btn.setAttribute('aria-pressed','true'); } catch(e){} }
            if (selectedSong) selectedSong.selectedDiff = currentDifficulty;
            renderSongList(); renderSongPreview();
        } catch (e) { console.warn('sync difficulty UI failed', e); }
        closeSettingsModal();
    } catch (e) { console.warn('save settings failed', e); }
});

// Pause behaviour
if (pauseBtn) pauseBtn.addEventListener('click', () => {
    if (!isGameRunning) return; // only when playing
    isGamePaused = !isGamePaused;
    if (isGamePaused) {
        if (gameAudio) try{ gameAudio.pause(); }catch(e){}
        if (pauseMenu) showOverlay(pauseMenu);
    } else {
        if (pauseMenu) hideOverlay(pauseMenu);
        if (gameAudio) try{ gameAudio.play(); }catch(e){}
    }
});
if (pauseResume) pauseResume.addEventListener('click', () => { isGamePaused = false; hideOverlay(pauseMenu); if (gameAudio) try{ gameAudio.play(); }catch(e){} });
if (pauseRetry) pauseRetry.addEventListener('click', () => { hideOverlay(pauseMenu); restartGame(); });
if (pauseExit) pauseExit.addEventListener('click', () => { hideOverlay(pauseMenu); exitToLobby(); });

// ---------------- Settings: interactive key remap and judgement test ----------------
let settingsAwaitingKey = null;
function onSettingsAssignKey(e) {
    if (settingsAwaitingKey === null) return;
    // ignore modifier-only keys
    const k = String(e.key || '').trim();
    if (!k) return;
    // prevent interfering with other handlers while assigning
    e.preventDefault(); e.stopPropagation();
    const keyLower = k.length === 1 ? k.toLowerCase() : k.toLowerCase();
    settings.keymap = settings.keymap || ['d','f','j','k'];
    settings.keymap[settingsAwaitingKey] = keyLower;
    if (settingKeyBtn[settingsAwaitingKey]) settingKeyBtn[settingsAwaitingKey].textContent = keyLower.toUpperCase();
    if (settingKeymapEl) settingKeymapEl.value = settings.keymap.join(',');
    saveSettings(); applySettings();
    if (settingKeyBtn[settingsAwaitingKey]) settingKeyBtn[settingsAwaitingKey].classList.remove('listening');
    settingsAwaitingKey = null;
    document.removeEventListener('keydown', onSettingsAssignKey);
}

for (let i = 0; i < settingKeyBtn.length; i++) {
    const btn = settingKeyBtn[i];
    if (!btn) continue;
    btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        // start listening for next key
        settingsAwaitingKey = i;
        btn.classList.add('listening');
        btn.textContent = '...';
        // attach key listener
        document.addEventListener('keydown', onSettingsAssignKey);
    });
}

// Judge test state
const judgeTest = {
    running: false,
    bpm: 100,
    beatMs: 600,
    baseTime: 0,
    pressDeltas: [],
    audioCtx: null,
    intervalId: null,
    animationId: null
};

// remember which overlay was open before showing judge test so we can restore it on close
let judgePrevOverlay = null;

function playClickSound() {
    try {
        const ac = judgeTest.audioCtx || (judgeTest.audioCtx = new (window.AudioContext || window.webkitAudioContext)());
        // some browsers require a resume() after creation on first user gesture
        if (typeof ac.resume === 'function') { try { ac.resume(); } catch(e){} }
        const o = ac.createOscillator(); const g = ac.createGain();
        o.type = 'square'; o.frequency.value = 1000; g.gain.value = 0.06;
        o.connect(g); g.connect(ac.destination);
        o.start(); o.stop(ac.currentTime + 0.03);
    } catch (e) { /* ignore audio errors */ }
}

function startJudgeTest() {
    if (judgeTest.running) return;
    // get BPM from current judge BPM element (overlay) if available, otherwise fallback
    const bpmVal = (settingTestBpmEl && settingTestBpmEl.value) || (judgeBpmEl && judgeBpmEl.value) || 100;
    judgeTest.bpm = Math.max(40, Math.min(240, parseInt(bpmVal) || 100));
    judgeTest.beatMs = 60000 / judgeTest.bpm;
    judgeTest.pressDeltas = [];
    judgeTest.baseTime = performance.now() + 200; // small lead
    if (settingTestLast) settingTestLast.textContent = 'Running...';
    // schedule beats via interval for audio click
    judgeTest.intervalId = setInterval(() => { playClickSound(); }, judgeTest.beatMs);
    // also play immediate first click to align
    setTimeout(() => playClickSound(), 0);
    // attach key listener for test (listen for mapped keys)
    document.addEventListener('keydown', onJudgeTestKey);
    judgeTest.running = true;
    if (settingTestStartBtn) settingTestStartBtn.disabled = true;
    if (settingTestStopBtn) settingTestStopBtn.disabled = false;
    // start animation
    drawJudgeCanvasLoop();
}

function stopJudgeTest() {
    if (!judgeTest.running) return;
    judgeTest.running = false;
    if (judgeTest.intervalId) { clearInterval(judgeTest.intervalId); judgeTest.intervalId = null; }
    if (judgeTest.animationId) { cancelAnimationFrame(judgeTest.animationId); judgeTest.animationId = null; }
    document.removeEventListener('keydown', onJudgeTestKey);
    if (settingTestStartBtn) settingTestStartBtn.disabled = false;
    if (settingTestStopBtn) settingTestStopBtn.disabled = true;
}

// Open/close handlers for the dedicated judge test overlay
if (openJudgeTestBtn) {
    openJudgeTestBtn.addEventListener('click', (ev) => {
        // prevent any default navigation or bubbling that might trigger other overlays
        try { ev.preventDefault(); ev.stopPropagation(); } catch(e) {}
        // remember currently visible overlay (except judge-test) to restore later
        try {
            const overlays = Array.from(document.querySelectorAll('.overlay'));
            judgePrevOverlay = overlays.find(o => o !== judgeTestScreen && window.getComputedStyle(o).display !== 'none') || null;
        } catch(e) { judgePrevOverlay = null; }
        // hide settings modal (or other overlays) first so judge overlay appears on top
        try { if (settingsModal) hideOverlay(settingsModal); } catch(e) {}
        // wire overlay-specific elements to the generic variables used by test functions
        settingTestBpmEl = judgeBpmEl;
        settingTestStartBtn = judgeStartBtn;
        settingTestStopBtn = judgeStopBtn;
        settingTestAutosuggestBtn = judgeAutosuggestBtn;
        settingJudgeCanvas = judgeCanvasEl;
        settingTestLast = judgeLastEl;
        settingTestSuggestPerfect = judgeSuggestPerfectEl;
        settingTestSuggestGood = judgeSuggestGoodEl;
        // update UI
        if (settingTestLast) settingTestLast.textContent = '-';
        if (settingTestSuggestPerfect) settingTestSuggestPerfect.textContent = '-';
        if (settingTestSuggestGood) settingTestSuggestGood.textContent = '-';
        drawJudgeCanvasClear();
        // ensure any underlying selection overlays are hidden so judge test appears on top
        try { if (memberSelectScreen) hideOverlay(memberSelectScreen); } catch(e) {}
        try { if (memberCatalogScreen) hideOverlay(memberCatalogScreen); } catch(e) {}
        try { if (songSelectScreen) hideOverlay(songSelectScreen); } catch(e) {}
        // raise z-index to ensure this overlay is above other overlays
        try { if (judgeTestScreen) { judgeTestScreen.style.zIndex = '2000'; } } catch(e) {}
        if (judgeTestScreen) showOverlay(judgeTestScreen);
        // focus the overlay so keyboard presses and the Start button work immediately
        try { const oc = judgeTestScreen.querySelector('.overlay-content'); if (oc && typeof oc.focus === 'function') oc.focus(); } catch(e) {}
    });
}
if (judgeCloseBtn) judgeCloseBtn.addEventListener('click', () => {
    stopJudgeTest();
    if (judgeTestScreen) hideOverlay(judgeTestScreen);
    // restore previous overlay if any (e.g., settings modal)
    try {
        if (judgePrevOverlay) {
            showOverlay(judgePrevOverlay);
            // focus restored overlay if possible
            try { const oc = judgePrevOverlay.querySelector('.overlay-content'); if (oc && typeof oc.focus === 'function') oc.focus(); } catch(e) {}
        }
    } catch(e) {}
    judgePrevOverlay = null;
});
if (judgeStartBtn) judgeStartBtn.addEventListener('click', () => { startJudgeTest(); });
if (judgeStopBtn) judgeStopBtn.addEventListener('click', () => { stopJudgeTest(); });
if (judgeAutosuggestBtn) judgeAutosuggestBtn.addEventListener('click', () => {
    const s = autosuggestJudgeWindows();
    if (!s) { alert('테스트 데이터를 먼저 수집하세요.'); return; }
    if (judgeSuggestPerfectEl) judgeSuggestPerfectEl.textContent = s.perfect + 'ms';
    if (judgeSuggestGoodEl) judgeSuggestGoodEl.textContent = s.good + 'ms';
});

function onJudgeTestKey(e) {
    // only handle single-character keys (letters/numbers)
    const k = String(e.key || '').trim();
    if (!k) return;
    // Map key to any of the configured lane keys; if matches, record timing
    const km = Array.isArray(settings.keymap) ? settings.keymap : (String(settingKeymapEl && settingKeymapEl.value || 'd,f,j,k').split(',').map(s=>s.trim()));
    const pressedLower = k.length === 1 ? k.toLowerCase() : k.toLowerCase();
    if (!km.includes(pressedLower)) return; // ignore unrelated keys
    const now = performance.now();
    // find nearest beat time from baseTime
    const idx = Math.round((now - judgeTest.baseTime) / judgeTest.beatMs);
    const nearestBeat = judgeTest.baseTime + idx * judgeTest.beatMs;
    const delta = Math.round(now - nearestBeat); // ms (positive = late, negative = early)
    judgeTest.pressDeltas.push(delta);
    // show last and push update
    if (settingTestLast) settingTestLast.textContent = (delta >= 0 ? '+' : '') + delta + 'ms';
    // update canvas markers (we'll redraw in animation loop)
}

function drawJudgeCanvasClear() {
    try {
        if (!settingJudgeCanvas) return;
        const c = settingJudgeCanvas; const cc = c.getContext('2d');
        cc.clearRect(0,0,c.width,c.height);
        // draw judgement line
        cc.fillStyle = 'rgba(255,255,255,0.06)';
        cc.fillRect(0, c.height/2 - 1, c.width, 2);
        cc.fillStyle = '#777'; cc.font = '12px sans-serif'; cc.fillText('Beat', 8, 14);
    } catch(e){}
}

function drawJudgeCanvasLoop() {
    try {
        if (!settingJudgeCanvas) return;
        const c = settingJudgeCanvas; const cc = c.getContext('2d');
        const now = performance.now();
        cc.clearRect(0,0,c.width,c.height);
        // draw background lane area (game-like)
        const laneLeft = Math.round(c.width * 0.08);
        const laneRight = Math.round(c.width * 0.92);
        const laneTop = Math.round(c.height * 0.06);
        const laneBottom = Math.round(c.height * 0.86);
        // dark gradient
        const g = cc.createLinearGradient(0, laneTop, 0, laneBottom);
        g.addColorStop(0, '#0b0b0b'); g.addColorStop(1, '#0f0f0f');
        cc.fillStyle = g;
        cc.fillRect(laneLeft, laneTop, laneRight-laneLeft, laneBottom-laneTop);
        // lane dividers (4 lanes visual)
        const laneCount = 4;
        const laneW = (laneRight - laneLeft) / laneCount;
        cc.strokeStyle = 'rgba(255,255,255,0.03)'; cc.lineWidth = 1;
        for (let i=1;i<laneCount;i++) {
            const x = Math.round(laneLeft + i*laneW);
            cc.beginPath(); cc.moveTo(x, laneTop+6); cc.lineTo(x, laneBottom-6); cc.stroke();
        }
        // judgement line
        const judgeY = laneBottom - 44;
        cc.fillStyle = 'rgba(19,247,225,0.12)';
        cc.fillRect(laneLeft, judgeY-2, laneRight-laneLeft, 4);
        cc.fillStyle = 'rgba(19,247,225,0.9)'; cc.fillRect((laneLeft+laneRight)/2-6, judgeY-8, 12, 16);

        // moving note animation synced to beat
        if (judgeTest && judgeTest.beatMs > 0) {
            const phase = ((now - (judgeTest.baseTime || 0)) % judgeTest.beatMs) / judgeTest.beatMs;
            // note moves from top (above laneTop) to judgeY
            const noteY = laneTop - 20 + (judgeY - (laneTop - 20)) * phase;
            const noteX = Math.round((laneLeft + laneRight) / 2);
            // glow
            cc.beginPath(); cc.fillStyle = 'rgba(0,200,255,0.06)'; cc.arc(noteX, noteY, 22, 0, Math.PI*2); cc.fill();
            // note body
            cc.beginPath(); cc.fillStyle = '#00d0ff'; cc.ellipse(noteX, noteY, 20, 10, 0, 0, Math.PI*2); cc.fill();
            cc.strokeStyle = 'rgba(255,255,255,0.6)'; cc.lineWidth = 1; cc.stroke();
        }

        // show recent press deltas as small markers around center (0ms)
        const pxPerMs = 0.12; // visual scale for marker spacing
        const centerX = c.width / 2;
        cc.fillStyle = 'rgba(0,200,255,0.95)';
        const history = judgeTest.pressDeltas.slice(-24);
        for (let i=0;i<history.length;i++){
            const d = history[history.length - 1 - i];
            const x = centerX + d * pxPerMs;
            const y = c.height/2 + (i%2===0? -10:10);
            cc.beginPath(); cc.arc(x,y,6,0,Math.PI*2); cc.fill();
        }
        // draw center marker and label
        cc.fillStyle = 'rgba(255,255,255,0.95)'; cc.fillRect(centerX-1, c.height/2-8, 2, 16);
        cc.fillStyle = '#bbb'; cc.font = '11px sans-serif'; cc.fillText('0 ms', centerX+6, c.height/2 - 10);
        judgeTest.animationId = requestAnimationFrame(drawJudgeCanvasLoop);
    } catch(e) { judgeTest.animationId = requestAnimationFrame(drawJudgeCanvasLoop); }
}

function autosuggestJudgeWindows() {
    const arr = (judgeTest.pressDeltas || []).map(Math.abs).filter(n => typeof n === 'number' && isFinite(n));
    if (!arr || arr.length === 0) return null;
    arr.sort((a,b)=>a-b);
    const p25 = arr[Math.floor(arr.length * 0.25)] || arr[0];
    const p75 = arr[Math.floor(arr.length * 0.75)] || arr[arr.length-1];
    return { perfect: Math.max(10, Math.round(p25)), good: Math.max(Math.round(p75), Math.round(p25*1.6)) };
}

if (settingTestStartBtn) settingTestStartBtn.addEventListener('click', () => { startJudgeTest(); });
if (settingTestStopBtn) settingTestStopBtn.addEventListener('click', () => { stopJudgeTest(); });
if (settingTestAutosuggestBtn) settingTestAutosuggestBtn.addEventListener('click', () => {
    const s = autosuggestJudgeWindows();
    if (!s) { alert('테스트 데이터를 먼저 수집하세요.'); return; }
    if (settingTestSuggestPerfect) settingTestSuggestPerfect.textContent = s.perfect + 'ms';
    if (settingTestSuggestGood) settingTestSuggestGood.textContent = s.good + 'ms';
});
// (apply-suggest buttons were removed from the UI)


// Result screen handlers
const resultScreen = document.getElementById('result-screen');
const retryBtn = document.getElementById('retry-button');
const rsContinue = document.getElementById('rs-continue');
const rsBackToLobby = document.getElementById('rs-back-to-lobby');

if (retryBtn) retryBtn.addEventListener('click', () => { hideOverlay(resultScreen); restartGame(); });
if (rsBackToLobby) rsBackToLobby.addEventListener('click', () => { hideOverlay(resultScreen); exitToLobby(); });
if (rsContinue) rsContinue.addEventListener('click', () => { hideOverlay(resultScreen); exitToLobby(); });

function restartGame() {
    // reset some stats and start again
    score = 0; combo = 0; maxCombo = 0; hp = MAX_HP; perfectCount = 0; greatCount = 0; goodCount = 0; badCount = 0; missCount = 0;
    if (gameAudio) { try { gameAudio.currentTime = 0; } catch(e){} }
    startGame();
}

function exitToLobby() {
    // stop running game and return to member select screen
    isGameRunning = false; isGamePaused = false;
    if (gameAudio) try { gameAudio.pause(); gameAudio.currentTime = 0; } catch(e){}
    if (resultScreen) hideOverlay(resultScreen);
    if (pauseMenu) hideOverlay(pauseMenu);
    // show member select
    // Prefer opening the member select overlay when returning to lobby
    try {
        if (memberSelectScreen) {
            showOverlay(memberSelectScreen);
            renderCharacterList(); renderSelectedSlots(); updateStageBand();
        } else if (startScreen) {
            startScreen.style.display = 'flex';
        }
    } catch(e) { if (startScreen) startScreen.style.display = 'flex'; }
    if (settingsBtn) try { settingsBtn.style.display = ''; } catch(e){}
}

function endGame() {
    isGameRunning = false;
    if (gameAudio) try { gameAudio.pause(); } catch(e){}
    // populate result details
    try {
        document.getElementById('final-score').textContent = score.toLocaleString();
        document.getElementById('rs-max-combo').textContent = maxCombo;
        document.getElementById('rs-perfect').textContent = perfectCount;
        document.getElementById('rs-great').textContent = greatCount;
        document.getElementById('rs-good').textContent = goodCount;
        document.getElementById('rs-bad').textContent = badCount;
        document.getElementById('rs-miss').textContent = missCount;
        // determine rank based on accuracy
        const totalNotes = perfectCount + greatCount + goodCount + badCount + missCount;
        const perfectWeight = perfectCount * 100;
        const greatWeight = greatCount * 90;
        const goodWeight = goodCount * 60;
        const badWeight = badCount * 20;
        const missWeight = missCount * 0;
        const accuracy = totalNotes > 0 ? (perfectWeight + greatWeight + goodWeight + badWeight + missWeight) / (totalNotes * 100) : 0;
        
        let rank = 'F';
        if (accuracy >= 0.985) rank = 'SS';
        else if (accuracy >= 0.97) rank = 'S';
        else if (accuracy >= 0.93) rank = 'A';
        else if (accuracy >= 0.88) rank = 'B';
        else if (accuracy >= 0.8) rank = 'C';
        else if (accuracy >= 0.7) rank = 'D';
        document.getElementById('final-rank').textContent = rank;
    } catch (e) { console.warn('populate result failed', e); }
    showOverlay(resultScreen);
    if (settingsBtn) try { settingsBtn.style.display = ''; } catch(e){}
}

// Hook audio end to result
if (gameAudio) {
    gameAudio.addEventListener('ended', () => { endGame(); });
}
