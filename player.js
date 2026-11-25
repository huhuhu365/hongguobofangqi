'use strict';

const $ = selector => document.querySelector(selector);
const video = $('#video');
const form = $('#add');
const status = $('#status');
const genre = $('#genre');
const navigation = Array.from(document.querySelectorAll('[data-view]'));
const collator = new Intl.Collator('zh-CN', { numeric: true });
const key = 'shiji-library-v2';
const localFiles = new Map();
let library = [];
try {
  library = JSON.parse(localStorage.getItem(key) || '[]');
} catch {
  status.textContent = '无法读取之前的剧库。';
}
let view = 'watch';
let current;
let position = 0;
let objectUrl;

function save() {
  try {
    localStorage.setItem(key, JSON.stringify(library));
  } catch {
    status.textContent = '当前浏览器无法保存剧库，本次仍可观看。';
  }
}

function switchView(name) {
  view = name;
  const watch = name === 'watch';
  $('#watch').hidden = !watch;
  $('#catalog').hidden = watch;
  $('#heading').textContent = navigation.find(button => button.dataset.view === name).textContent;
  navigation.forEach(button => button.setAttribute('aria-current', String(button.dataset.view === name)));
  if (!watch) {
    video.pause();
    renderCatalog();
  }
}

function play(series, index = 0) {
  const item = series.episodes[index];
  if (!item) return;
  current = series;
  position = index;
  series.last = index;
  switchView('watch');
  video.pause();
  video.removeAttribute('src');
  video.load();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = undefined;
  const file = localFiles.get(item.id);
  if (file) objectUrl = URL.createObjectURL(file);
  const source = objectUrl || item.url;
  $('#empty').hidden = Boolean(source);
  $('#empty').textContent = '请重新导入本地视频';
  status.textContent = source ? '' : '浏览器重新打开后，需要用相同剧名重新导入本地视频。';
  if (source) {
    video.src = source;
    video.play().catch(error => {
      if (video.getAttribute('src') === source && error.name === 'NotAllowedError') {
        status.textContent = '点击播放按钮继续。';
      }
    });
  }
  renderPlayer();
}

function button(label, action) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.addEventListener('click', action);
  return element;
}

function renderPlayer() {
  $('#title').textContent = current.title;
  $('#episode').textContent = current.episodes[position].title;
  $('#previous').disabled = position === 0;
  $('#next').disabled = position >= current.episodes.length - 1;
  $('#favorite').disabled = false;
  $('#favorite').textContent = current.favorite ? '取消收藏' : '收藏';
  $('#episodes').replaceChildren(...current.episodes.map((episode, index) => {
    const entry = button(String(index + 1), () => play(current, index));
    entry.title = episode.title;
    entry.setAttribute('aria-label', episode.title);
    entry.setAttribute('aria-current', String(index === position));
    return entry;
  }));
}

function renderCatalog() {
  const selection = genre.value;
  const genres = Array.from(new Set(library.map(series => series.genre)));
  genre.replaceChildren(new Option('全部分类', ''), ...genres.map(name => new Option(name, name)));
  genre.value = genres.includes(selection) ? selection : '';
  const query = $('#query').value.trim().toLocaleLowerCase();
  let results = library.filter(series =>
    series.title.toLocaleLowerCase().includes(query) && (!genre.value || series.genre === genre.value));
  if (view === 'favorites') results = results.filter(series => series.favorite);
  if (view === 'history') results = results.filter(series => series.watched).sort((a, b) => b.watched - a.watched);
  if (view === 'rank') results.sort((a, b) => b.plays - a.plays);

  const container = $('#results');
  container.replaceChildren();
  if (results.length === 0) container.textContent = '没有符合条件的剧集。';
  results.forEach((series, index) => {
    const card = document.createElement('article');
    card.className = 'card';
    const title = document.createElement('h2');
    title.textContent = view === 'rank' ? String(index + 1) + ' · ' + series.title : series.title;
    const meta = document.createElement('p');
    meta.textContent = series.genre + ' · ' + series.episodes.length + ' 集' +
      (view === 'rank' ? ' · 本机播放 ' + series.plays + ' 次' : '');
    const last = series.last || 0;
    card.append(title, meta, button(last ? '播放第 ' + (last + 1) + ' 集' : '播放', () => play(series, last)));
    container.append(card);
  });
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  const title = data.get('series').trim();
  const files = Array.from($('#files').files).sort((a, b) => collator.compare(a.name, b.name));
  const link = data.get('url').trim();
  if (!title || (!files.length && !link) || (link && !/^https?:\/\//i.test(link))) {
    status.textContent = '请输入剧名，再选择视频文件或填写 HTTP(S) 视频直链。';
    return;
  }
  const series = library.find(entry => entry.title === title) ||
    { title, genre: data.get('genre'), episodes: [], plays: 0 };
  if (!library.includes(series)) library.push(series);
  let first = -1;
  const add = (episode, file) => {
    let index = series.episodes.findIndex(item => episode.url ? item.url === episode.url : !item.url && item.title === episode.title);
    if (index === -1) {
      index = series.episodes.length;
      series.episodes.push(episode);
    }
    if (file) localFiles.set(series.episodes[index].id, file);
    if (first === -1) first = index;
  };
  files.forEach(file => add({ id: crypto.randomUUID(), title: file.name }, file));
  if (link) add({ id: crypto.randomUUID(), title: '第 ' + (series.episodes.length + 1) + ' 集', url: link });
  form.reset();
  $('#import').open = false;
  save();
  play(series, first);
});

let countedSource;
video.addEventListener('playing', () => {
  if (!current || countedSource === video.src) return;
  countedSource = video.src;
  current.watched = Date.now();
  current.plays += 1;
  save();
});
video.addEventListener('loadstart', () => { countedSource = undefined; });
video.addEventListener('ended', () => {
  if ($('#auto').checked && position + 1 < current.episodes.length) play(current, position + 1);
});
video.addEventListener('error', () => {
  if (video.getAttribute('src')) status.textContent = '视频无法播放。请检查链接是否可直播，或尝试 H.264 编码的 MP4。';
});
$('#previous').addEventListener('click', () => play(current, position - 1));
$('#next').addEventListener('click', () => play(current, position + 1));
$('#favorite').addEventListener('click', () => {
  current.favorite = !current.favorite;
  save();
  renderPlayer();
});
$('#query').addEventListener('input', renderCatalog);
genre.addEventListener('change', renderCatalog);
navigation.forEach(entry => entry.addEventListener('click', () => switchView(entry.dataset.view)));
switchView('watch');
