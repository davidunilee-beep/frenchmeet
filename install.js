// Load before the optional authentication CDN so installation never waits for login.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const button = $('installButton');
  const status = $('installStatus');
  const android = /Android/i.test(navigator.userAgent);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const desktop = !android && !ios;
  const windows = desktop && !/Mac|Linux/i.test(navigator.platform || navigator.userAgent);
  const embedded = /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|; wv\)|\bwv\b/i.test(navigator.userAgent);
  const chrome = /Chrome\//i.test(navigator.userAgent) && !/SamsungBrowser|EdgA|OPR|Opera|Firefox|DuckDuckGo/i.test(navigator.userAgent) && !embedded;
  const display = window.matchMedia('(display-mode: standalone)');
  let promptEvent = null;
  let busy = false;
  let isInstalled = display.matches || navigator.standalone === true;
  function updateInstalled() {
    isInstalled = isInstalled || display.matches || navigator.standalone === true;
    // Keep the PC download entry available even when the browser reports installed.
    $('installBanner').hidden = !desktop && isInstalled;
    $('pcShortcut').hidden = !windows;
    if (desktop) {
      button.textContent = isInstalled ? 'PC 앱 설치 안내' : 'PC 앱 다운로드 ↗';
      status.textContent = isInstalled
        ? '앱이 설치되어 있어요. PC 바로가기도 저장할 수 있어요.'
        : 'PC 앱으로 설치하거나 바로가기를 저장하세요';
    }
  }
  updateInstalled();
  display.addEventListener?.('change', updateInstalled);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    promptEvent = event;
    button.disabled = false;
    isInstalled = false;
    button.textContent = desktop ? 'PC 앱 다운로드 ↗' : '앱 다운로드 ↗';
    status.textContent = '한 번 누르면 설치 창이 바로 열려요';
  });
  window.addEventListener('appinstalled', () => {
    promptEvent = null;
    isInstalled = true;
    updateInstalled();
    $('installDialog').close();
  });
  function openChrome() {
    const url = new URL(window.location.href);
    // Use only the current public page; never copy auth tokens into an intent.
    const page = url.origin + url.pathname;
    const intent = `intent://${url.host}${url.pathname}#Intent;scheme=${url.protocol.slice(0, -1)};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(page)};end`;
    status.textContent = 'Chrome으로 연결하고 있어요';
    window.location.assign(intent);
  }
  function showGuide() {
    $('installTitle').textContent = desktop ? 'PC에서 Bonjour! 바로 실행' : '홈 화면에서 바로 만나요';
    $('pcDownload').hidden = !windows;
    $('installGuide').textContent = ios
      ? 'Safari의 공유 버튼에서 홈 화면에 추가를 선택하세요.'
      : isInstalled ? (windows ? '이미 설치된 앱은 시작 메뉴에서 실행하세요. 바로가기 파일도 저장할 수 있어요.' : '이미 설치된 Bonjour! 앱을 실행하세요.')
      : windows ? '설치 창을 아직 사용할 수 없어요. 아래 버튼으로 PC 바로가기를 저장할 수 있어요.' : '브라우저의 설치 기능으로 Bonjour!를 앱처럼 실행할 수 있어요.';
    const steps = ios
      ? ['Safari에서 이 페이지를 여세요.', '공유 버튼을 누른 뒤 홈 화면에 추가를 선택하세요.', '추가를 누르면 홈 화면에서 Bonjour!를 실행할 수 있어요.']
      : ['Chrome·Edge에서는 주소창의 설치 아이콘을 선택하세요.', 'Mac의 Safari에서는 파일 → Dock에 추가를 선택하세요.'];
    $('installSteps').replaceChildren(...steps.map(text => {
      const li = document.createElement('li'); li.textContent = text; return li;
    }));
    if (!$('installDialog').open) $('installDialog').showModal();
  }
  button.addEventListener('click', async () => {
    if (busy) return;
    if (isInstalled) { if (desktop) showGuide(); return; }
    if (!promptEvent) {
      if (android) {
        if (!chrome) { openChrome(); return; }
        // Never replace Android installation with a menu-finding popup.
        status.textContent = '설치 창을 준비하고 있어요. 준비되면 다시 눌러 주세요.';
        button.textContent = '설치 다시 확인';
      } else { showGuide(); }
      return;
    }
    const event = promptEvent;
    promptEvent = null;
    busy = true;
    button.disabled = true;
    try {
      // Must run directly inside this click, before awaiting any other work.
      await event.prompt();
      const choice = await event.userChoice;
      status.textContent = choice.outcome === 'accepted'
        ? '설치 중이에요. 홈 화면에서 Bonjour!를 확인하세요.'
        : '설치를 취소했어요. 나중에 다시 설치할 수 있어요.';
      // Only appinstalled or standalone mode proves installation completed.
    } catch {
      status.textContent = '설치 창을 열지 못했어요. 잠시 후 다시 눌러 주세요.';
    } finally {
      busy = false;
      button.disabled = false;
    }
  });
  document.querySelectorAll('[data-close]').forEach(close => {
    close.addEventListener('click', () => $(close.dataset.close).close());
  });
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      if (android) status.textContent = '설치 준비를 위해 인터넷 연결을 확인해 주세요.';
    });
  }
})();
