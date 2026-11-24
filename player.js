'use strict';

const files = document.querySelector('#files');
const video = document.querySelector('#video');
const title = document.querySelector('#title');
const status = document.querySelector('#status');
const list = document.querySelector('#episodes');
const autoplay = document.querySelector('#auto');
const collator = new Intl.Collator('zh-CN', { numeric: true });
let episodes = [];
let current = -1;
let videoUrl;

function playEpisode(index) {
  const file = episodes[index];
  if (!file) return;

  if (videoUrl) URL.revokeObjectURL(videoUrl);
  videoUrl = URL.createObjectURL(file);
  current = index;
  title.textContent = file.name;
  status.textContent = '';
  for (const [position, row] of Array.from(list.children).entries()) {
    row.firstElementChild.setAttribute('aria-current', String(position === index));
  }

  const requestedUrl = videoUrl;
  video.src = videoUrl;
  video.play().catch(error => {
    if (videoUrl === requestedUrl && error.name === 'NotAllowedError') {
      status.textContent = '点击播放按钮继续。';
    }
  });
}

files.addEventListener('change', () => {
  if (!files.files.length) return;
  episodes = Array.from(files.files).sort((a, b) => collator.compare(a.name, b.name));
  list.replaceChildren();
  episodes.forEach((file, index) => {
    const row = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = file.name;
    button.addEventListener('click', () => playEpisode(index));
    row.append(button);
    list.append(row);
  });
  playEpisode(0);
});

video.addEventListener('ended', () => {
  if (current === episodes.length - 1) {
    status.textContent = '已播放到最后一集。';
  } else if (autoplay.checked) {
    playEpisode(current + 1);
  }
});

video.addEventListener('error', () => {
  status.textContent = '无法播放此视频。可以试试 H.264 编码的 MP4 文件。';
});
