(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let installPrompt = null;
  const standalone = window.matchMedia('(display-mode: standalone)');
  const installed = () => standalone.matches || navigator.standalone === true;
  const updateInstall = () => { $('installBanner').hidden = installed(); };
  updateInstall();
  standalone.addEventListener?.('change', updateInstall);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    updateInstall();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    $('installBanner').hidden = true;
    $('installDialog').close();
  });
  function showInstallGuide() {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /Android/.test(navigator.userAgent);
    const inApp = /KAKAOTALK|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent);
    let steps;
    if (inApp) {
      $('installGuide').textContent = '앱 안의 브라우저에서는 설치가 제한될 수 있어요. 기본 브라우저에서 열어 주세요.';
      steps = ['현재 화면의 메뉴(⋯)에서 외부 브라우저로 열기를 선택하세요.', ios ? 'Safari에서 공유 버튼을 누르세요.' : 'Chrome에서 메뉴(⋮)를 누르세요.', '홈 화면에 추가 또는 앱 설치를 선택한 뒤 추가하세요.'];
    } else if (ios) {
      $('installGuide').textContent = 'iPhone·iPad에서는 Safari의 공유 메뉴로 홈 화면에 추가할 수 있어요.';
      steps = ['Safari에서 이 페이지를 여세요.', '공유 버튼(네모에서 위쪽 화살표)을 누르세요.', '홈 화면에 추가를 선택하고, 표시되면 웹 앱으로 열기를 켠 뒤 추가를 누르세요.'];
    } else if (android) {
      $('installGuide').textContent = 'Chrome 메뉴에서 앱을 홈 화면에 추가할 수 있어요.';
      steps = ['Chrome에서 이 페이지를 여세요.', '오른쪽 위 메뉴(⋮)를 누르세요.', '홈 화면에 추가 또는 앱 설치를 선택하세요.'];
    } else {
      $('installGuide').textContent = '브라우저의 설치 메뉴를 이용해 앱처럼 바로 실행하세요.';
      steps = ['Chrome·Edge에서는 주소창의 설치 아이콘 또는 메뉴의 앱 설치를 선택하세요.', 'Mac의 Safari에서는 파일 → Dock에 추가를 선택하세요.', '설치 메뉴가 보이지 않으면 지원되는 브라우저를 사용하거나 이 페이지를 북마크하세요.'];
    }
    $('installSteps').replaceChildren(...steps.map(text => {
      const li = document.createElement('li'); li.textContent = text; return li;
    }));
    $('installDialog').showModal();
  }
  $('installButton').addEventListener('click', async () => {
    if (!installPrompt) { showInstallGuide(); return; }
    const prompt = installPrompt;
    installPrompt = null;
    $('installButton').disabled = true;
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      if (result.outcome === 'accepted') $('installBanner').hidden = true;
    } catch { showInstallGuide(); }
    finally { $('installButton').disabled = false; }
  });
  document.querySelectorAll('[data-close]').forEach(button => {
    button.addEventListener('click', () => $(button.dataset.close).close());
  });
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The online learning app and manual installation guide still work.
    });
  }

  const dialog = $('authDialog');
  const form = $('authForm');
  let mode = 'login';
  let busy = false;
  let client = null;
  let setupMessage = '';
  const setMessage = (text, success = false) => {
    $('authMessage').textContent = text;
    $('authMessage').classList.toggle('success', success);
  };
  const renderUser = user => {
    const email = user?.email || '';
    $('userEmail').textContent = email;
    $('userEmail').title = email;
    $('userEmail').hidden = !email;
    $('loginButton').hidden = !!email;
    $('logoutButton').hidden = !email;
  };
  const setBusy = value => {
    busy = value;
    $('authSubmit').disabled = value || !client;
    $('authSwitch').disabled = value;
    $('closeAuth').disabled = value;
    $('authEmail').disabled = value || !client;
    $('authPassword').disabled = value || !client;
    $('authSubmit').textContent = value ? '처리 중…' : (mode === 'login' ? '로그인' : '회원가입');
  };
  function setMode(next) {
    mode = next;
    const signup = mode === 'signup';
    $('authTitle').textContent = signup ? '프랑스어의 첫걸음' : '다시 만나 반가워요';
    $('authDescription').textContent = signup ? '이메일로 가입하고 Bonjour!와 함께 시작하세요.' : '이메일로 로그인하고 프랑스어 공부를 시작하세요.';
    $('authSwitchLabel').textContent = signup ? '이미 계정이 있으신가요?' : '아직 계정이 없으신가요?';
    $('authSwitch').textContent = signup ? '로그인' : '회원가입';
    $('authPassword').autocomplete = signup ? 'new-password' : 'current-password';
    $('authPassword').minLength = signup ? 8 : 1;
    $('passwordHint').hidden = !signup;
    $('authPassword').value = '';
    setMessage(setupMessage);
    setBusy(false);
  }
  function closeAuth() { if (!busy) dialog.close(); }
  $('loginButton').addEventListener('click', () => {
    form.reset(); setMode('login'); dialog.showModal();
  });
  $('closeAuth').addEventListener('click', closeAuth);
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => { $('authPassword').value = ''; });
  $('authSwitch').addEventListener('click', () => { if (!busy) setMode(mode === 'login' ? 'signup' : 'login'); });
  function friendlyError(error) {
    const messages = {
      invalid_credentials: '이메일 또는 비밀번호를 확인해 주세요.',
      email_not_confirmed: '이메일 인증을 먼저 완료해 주세요. 받은 편지함과 스팸함을 확인하세요.',
      user_already_exists: '이미 가입된 이메일입니다. 로그인해 주세요.',
      email_exists: '이미 가입된 이메일입니다. 로그인해 주세요.',
      signup_disabled: '현재 회원가입이 중지되어 있습니다. 잠시 후 다시 시도해 주세요.',
      email_provider_disabled: '이메일 로그인이 아직 활성화되지 않았습니다.',
      weak_password: '더 안전한 비밀번호를 입력해 주세요. 8자 이상을 권장합니다.',
      over_email_send_rate_limit: '인증 메일 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
      over_request_rate_limit: '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
    };
    if (messages[error?.code]) return messages[error.code];
    if (!navigator.onLine || /fetch|network/i.test(error?.message || '')) return '인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
    return '요청을 완료하지 못했습니다. 입력 내용을 확인하거나 잠시 후 다시 시도해 주세요.';
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !client || !form.reportValidity()) return;
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    const signup = mode === 'signup';
    setMessage(''); setBusy(true);
    try {
      const { data, error } = signup
        ? await client.auth.signUp({ email, password, options: { emailRedirectTo: new URL('/', window.location.href).href } })
        : await client.auth.signInWithPassword({ email, password });
      if (error) { setMessage(friendlyError(error)); return; }
      $('authPassword').value = '';
      if (data.session?.user) {
        renderUser(data.session.user);
        dialog.close();
      } else if (signup) {
        setMessage('인증 메일을 확인해 주세요. 이미 가입한 이메일이라면 로그인해 주세요.', true);
      } else {
        setMessage('로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요.');
      }
    } catch (error) { setMessage(friendlyError(error)); }
    finally { setBusy(false); }
  });
  $('logoutButton').addEventListener('click', async () => {
    if (!client || $('logoutButton').disabled) return;
    $('logoutButton').disabled = true;
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      renderUser(null);
    } catch {
      if (typeof window.showToast === 'function') window.showToast('로그아웃하지 못했습니다. 다시 시도해 주세요.');
    } finally { $('logoutButton').disabled = false; }
  });
  const config = window.APP_CONFIG || {};
  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    setupMessage = '로그인 서비스를 준비하고 있습니다. 지금은 회원가입 없이 학습할 수 있어요.';
  } else if (!window.supabase?.createClient) {
    setupMessage = '로그인 서비스를 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.';
  } else {
    try {
      client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
      client.auth.onAuthStateChange((_event, session) => { renderUser(session?.user || null); });
    } catch {
      client = null;
      setupMessage = '로그인 연결을 확인하고 있습니다. 잠시 후 다시 시도해 주세요.';
    }
  }
  setMode('login');
})();
