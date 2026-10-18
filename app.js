'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const KEY = 'dudu-covers-used-v1';
  let records = [], filter = 'all', visibleLimit = 18, selected = null, toastTimer;
  let used = new Set();
  try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(value)) used = new Set(value.filter(Number.isInteger)); } catch {}
  const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function toast(message) { $('toast').textContent = message; if ($('detail').open) $('detail-meta').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2600); }
  function matching() {
    const query = $('search').value.trim().toLocaleLowerCase();
    const list = records.filter(item => (!query || (item.work + item.title + item.keywords).toLocaleLowerCase().includes(query)) && (filter === 'all' || used.has(item.id) === (filter === 'used')));
    return $('sort').value === 'name' ? list.sort((a,b) => a.work.localeCompare(b.work,'zh-CN')) : list;
  }
  function render() {
    const list = matching();
    $('gallery').innerHTML = list.slice(0, visibleLimit).map(item => `<article class="card" data-id="${item.id}"><button class="cover-open" data-action="open" aria-label="查看${escape(item.work)}大图"><img src="${item.preview}" alt="${escape(item.work)}漫画封面" width="880" height="495" loading="lazy" decoding="async"><span class="image-badge ${used.has(item.id) ? 'used-badge' : ''}">${used.has(item.id) ? '✓ 已使用' : '点击看原图'}</span></button><div class="card-body"><div class="card-heading"><h2>${escape(item.work)}</h2><span class="card-index">${String(item.id).padStart(3,'0')}</span></div><p class="card-title">${escape(item.title)}</p><div class="card-actions"><button class="btn primary" data-action="copy" aria-label="复制${escape(item.work)}标题">复制标题</button><a class="btn secondary" href="${item.cover}" download="${escape(item.filename)}" data-action="download" aria-label="下载${escape(item.work)}原图">下载原图</a></div><button class="mark-used" data-action="used" aria-label="${used.has(item.id) ? '取消' : '标记'}${escape(item.work)}已使用" aria-pressed="${used.has(item.id)}">${used.has(item.id) ? '✓ 已标记使用 · 点击撤销' : '用过这张？标记已用'}</button></div></article>`).join('');
    $('all-count').textContent = records.length;
    $('used-count').textContent = records.filter(item => used.has(item.id)).length;
    $('unused-count').textContent = records.length - Number($('used-count').textContent);
    $('result-count').textContent = `找到 ${list.length} 部`;
    $('empty').hidden = list.length > 0;
    $('load-more').hidden = list.length <= visibleLimit;
    $('load-more').textContent = `再显示 ${Math.max(0, Math.min(18, list.length - visibleLimit))} 部`;
    document.querySelectorAll('[data-filter]').forEach(button => { const active = button.dataset.filter === filter; button.classList.toggle('active',active); button.setAttribute('aria-pressed', String(active)); });
  }
  function openDetail(item) {
    selected = item;
    $('detail-name').textContent = item.work;
    $('detail-image').src = item.cover;
    $('detail-image').alt = item.work + '高清漫画封面';
    $('detail-title').value = item.title;
    $('detail-download').href = item.cover;
    $('detail-download').download = item.filename;
    $('detail-meta').textContent = `无损高清图 · ${item.width} × ${item.height} · 下载时保存为 PNG`;
    $('detail-used').textContent = used.has(item.id) ? '取消已用标记' : '标记已用';
    if (!$('detail').open) $('detail').showModal();
  }
  async function copyTitle(item) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(item.title);
      toast('标题已复制，可以粘贴了');
    } catch {
      openDetail(item);
      $('detail-title').focus(); $('detail-title').select();
      let copied = false; try { copied = document.execCommand('copy'); } catch {}
      toast(copied ? '标题已复制，可以粘贴了' : '请长按已选中的标题，选择复制');
    }
  }
  async function downloadPng(item, control) {
    if (control.dataset.busy) return;
    control.dataset.busy = '1';
    control.setAttribute('aria-disabled', 'true');
    const label = control.textContent;
    control.textContent = '正在准备 PNG…';
    let imageUrl;
    try {
      const response = await fetch(item.cover);
      if (!response.ok) throw new Error('Image unavailable');
      imageUrl = URL.createObjectURL(await response.blob());
      const image = new Image();
      image.src = imageUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      canvas.getContext('2d').drawImage(image, 0, 0);
      const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!png) throw new Error('PNG unavailable');
      const pngUrl = URL.createObjectURL(png);
      const link = document.createElement('a');
      link.href = pngUrl; link.download = item.filename;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(pngUrl), 60000);
      toast('PNG 已准备好；若浏览器打开图片，可长按保存');
    } catch {
      openDetail(item);
      toast('请长按大图保存，或稍后重试下载');
    } finally {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      control.textContent = label;
      control.removeAttribute('aria-disabled');
      delete control.dataset.busy;
    }
  }
  function toggleUsed(item) {
    used.has(item.id) ? used.delete(item.id) : used.add(item.id);
    let saved = true; try { localStorage.setItem(KEY, JSON.stringify([...used])); } catch { saved = false; }
    render();
    if (selected?.id === item.id) $('detail-used').textContent = used.has(item.id) ? '取消已用标记' : '标记已用';
    toast(saved ? (used.has(item.id) ? '已标记使用' : '已撤销标记') : '当前浏览器无法保存标记，关闭页面后会重置');
  }
  $('gallery').addEventListener('click', event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const item = records.find(item => item.id === Number(button.closest('[data-id]').dataset.id)); if (!item) return;
    if (button.dataset.action === 'open') openDetail(item);
    if (button.dataset.action === 'copy') copyTitle(item);
    if (button.dataset.action === 'used') toggleUsed(item);
    if (button.dataset.action === 'download') { event.preventDefault(); downloadPng(item, button); }
  });
  $('search').addEventListener('input', () => { visibleLimit = 18; render(); });
  $('sort').addEventListener('change', () => { visibleLimit = 18; render(); });
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; visibleLimit = 18; render(); }));
  $('load-more').addEventListener('click', () => { visibleLimit += 18; render(); });
  $('reset').addEventListener('click', () => { $('search').value = ''; filter = 'all'; visibleLimit = 18; render(); });
  $('detail-copy').addEventListener('click', () => selected && copyTitle(selected));
  $('detail-download').addEventListener('click', event => { event.preventDefault(); if (selected) downloadPng(selected, event.currentTarget); });
  $('detail-used').addEventListener('click', () => selected && toggleUsed(selected));
  $('close-detail').addEventListener('click', () => $('detail').close());
  for (const id of ['detail','motion-dialog']) $(id).addEventListener('click', event => { const box = $(id).getBoundingClientRect(); if (event.target === $(id) && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) $(id).close(); });
  $('open-motion').addEventListener('click', () => { $('motion-dialog').showModal(); $('motion-video').play().catch(() => {}); });
  $('close-motion').addEventListener('click', () => $('motion-dialog').close());
  $('motion-dialog').addEventListener('close', () => $('motion-video').pause());
  document.addEventListener('keydown', event => { if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !$('detail').open) { event.preventDefault(); $('search').focus(); } });
  fetch('data.json').then(response => { if (!response.ok) throw new Error('data'); return response.json(); }).then(data => { records = data; render(); }).catch(() => { $('gallery').innerHTML = '<p class="loading">素材暂时未能载入，请刷新页面重试。</p>'; $('result-count').textContent = '载入失败'; });
  fetch('videos/manifest.json').then(response => response.ok ? response.json() : null).then(value => { if (value?.ready) $('motion-section').hidden = false; }).catch(() => {});
})();
