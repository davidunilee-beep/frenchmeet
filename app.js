(() => {
  'use strict';
  const $ = id => document.getElementById(id);
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
