const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const installer = fs.readFileSync(path.join(root, 'install.js'), 'utf8');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
function setup(options = {}) {
  const nodes = new Map();
  class Element {
    constructor() { this.listeners = {}; this.value = ''; this.hidden = false; this.disabled = false; this.dataset = {}; this.classes = new Set(); this.classList = { toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name) }; }
    addEventListener(event, fn) { this.listeners[event] = fn; }
    async fire(event, data = {}) { return this.listeners[event]?.({ preventDefault() {}, ...data }); }
    showModal() { this.open = true; }
    close() { this.open = false; this.listeners.close?.(); }
    reset() { get('authEmail').value = ''; get('authPassword').value = ''; }
    reportValidity() { return true; }
    replaceChildren(...children) { this.children = children; }
  }
  function get(id) { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); }
  let authListener;
  const calls = [];
  const auth = {
    onAuthStateChange(fn) { authListener = fn; fn('INITIAL_SESSION', options.session || null); },
    async signInWithPassword(credentials) { calls.push(['login', credentials]); return options.result || { data: { session: { user: { email: credentials.email } } }, error: null }; },
    async signUp(credentials) { calls.push(['signup', credentials]); return options.result || { data: { session: null }, error: null }; },
    async signOut(args) { calls.push(['logout', args]); if (options.logoutError) return { error: new Error('offline') }; authListener('SIGNED_OUT', null); return { error: null }; }
  };
  const listeners = {};
  const navigations = [];
  const window = {
    APP_CONFIG: options.unconfigured ? {} : { supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'sb_publishable_test' },
    supabase: options.noCdn ? undefined : { createClient: () => ({ auth }) },
    matchMedia: () => ({ matches: !!options.standalone, addEventListener() {} }),
    addEventListener: (event, fn) => { listeners[event] = fn; },
    location: { href: 'https://bonjour.example/?code=do-not-forward#access_token=private', assign: url => navigations.push(url) },
    isSecureContext: true
  };
  const navigator = { userAgent: options.userAgent || 'Chrome', platform: options.platform || '', maxTouchPoints: options.maxTouchPoints || 0, onLine: true, serviceWorker: { register: async () => ({}) } };
  const context = vm.createContext({ window, navigator, document: { getElementById: get, querySelectorAll: () => [], createElement: () => new Element() }, URL });
  vm.runInContext(installer, context);
  if (!options.installOnly) vm.runInContext(source, context);
  return { get, calls, listeners, authListener, navigations };
}
test('successful login shows email and logout, clears password', async () => {
  const s = setup(); await s.get('loginButton').fire('click');
  s.get('authEmail').value = ' learner@example.com '; s.get('authPassword').value = 'testpassword';
  await s.get('authForm').fire('submit');
  assert.equal(s.calls[0][1].email, 'learner@example.com');
  assert.equal(s.get('userEmail').textContent, 'learner@example.com');
  assert.equal(s.get('loginButton').hidden, true);
  assert.equal(s.get('logoutButton').hidden, false);
  assert.equal(s.get('authDialog').open, false);
  assert.equal(s.get('authPassword').value, '');
  await s.get('logoutButton').fire('click');
  assert.equal(s.get('loginButton').hidden, false);
  assert.equal(s.get('userEmail').textContent, '');
});
test('signup without session requests email confirmation without showing signed-in state', async () => {
  const s = setup(); await s.get('loginButton').fire('click'); await s.get('authSwitch').fire('click');
  assert.equal(s.get('authPassword').minLength, 8);
  assert.equal(s.get('authPassword').autocomplete, 'new-password');
  s.get('authEmail').value = 'new@example.com'; s.get('authPassword').value = 'testpassword';
  await s.get('authForm').fire('submit');
  assert.equal(s.calls[0][0], 'signup');
  assert.equal(s.calls[0][1].options.emailRedirectTo, 'https://bonjour.example/');
  assert.match(s.get('authMessage').textContent, /인증 메일/);
  assert.equal(s.get('loginButton').hidden, false);
  assert.equal(s.get('authPassword').value, '');
});
test('invalid password leaves dialog open with helpful error and re-enables form', async () => {
  const s = setup({ result: { data: {}, error: { code: 'invalid_credentials' } } });
  await s.get('loginButton').fire('click'); await s.get('authForm').fire('submit');
  assert.equal(s.get('authDialog').open, true);
  assert.match(s.get('authMessage').textContent, /이메일 또는 비밀번호/);
  assert.equal(s.get('authSubmit').disabled, false);
});
test('restored session and auth state changes update account controls', () => {
  const s = setup({ session: { user: { email: 'restored@example.com' } } });
  assert.equal(s.get('userEmail').textContent, 'restored@example.com');
  s.authListener('SIGNED_OUT', null);
  assert.equal(s.get('loginButton').hidden, false);
  assert.equal(s.get('logoutButton').hidden, true);
});
test('missing configuration or CDN disables credentials with a clear message', async () => {
  for (const options of [{ unconfigured: true }, { noCdn: true }]) {
    const s = setup(options); await s.get('loginButton').fire('click');
    assert.equal(s.get('authSubmit').disabled, true);
    assert.equal(s.get('authPassword').disabled, true);
    assert.ok(s.get('authMessage').textContent.length > 10);
    await s.get('authForm').fire('submit'); assert.equal(s.calls.length, 0);
  }
});
test('iPhone gets Safari installation instructions', async () => {
  const s = setup({ userAgent: 'iPhone' }); await s.get('installButton').fire('click');
  assert.equal(s.get('installDialog').open, true);
  assert.match(s.get('installGuide').textContent, /Safari/);
  assert.match(s.get('installSteps').children.map(li => li.textContent).join(' '), /홈 화면에 추가/);
});
test('native prompt is used once, cancellation does not claim installed', async () => {
  const s = setup(); let prompts = 0;
  s.listeners.beforeinstallprompt({ preventDefault() {}, prompt: async () => { prompts++; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
  await s.get('installButton').fire('click');
  assert.equal(prompts, 1); assert.equal(s.get('installBanner').hidden, false);
  await s.get('installButton').fire('click');
  assert.equal(prompts, 1); assert.equal(s.get('installDialog').open, true);
  s.listeners.appinstalled(); assert.equal(s.get('installBanner').hidden, false);
});
test('standalone launch hides install banner', () => {
  assert.equal(setup({ standalone: true, userAgent: 'Android Chrome/130.0' }).get('installBanner').hidden, true);
});
test('Android Chrome has no menu popup while waiting and uses late installation event', async () => {
  const s = setup({ userAgent: 'Android Chrome/130.0', installOnly: true });
  await s.get('installButton').fire('click');
  assert.notEqual(s.get('installDialog').open, true);
  assert.match(s.get('installStatus').textContent, /설치 창을 준비/);
  let prompts = 0;
  s.listeners.beforeinstallprompt({ preventDefault() {}, prompt: async () => { prompts++; }, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  assert.equal(s.get('installButton').textContent, '앱 다운로드 ↗');
  await s.get('installButton').fire('click');
  assert.equal(prompts, 1);
  assert.notEqual(s.get('installDialog').open, true);
  assert.equal(s.get('installBanner').hidden, false);
  s.listeners.appinstalled(); assert.equal(s.get('installBanner').hidden, true);
});
test('Android embedded browser opens Chrome directly without forwarding auth tokens', async () => {
  const s = setup({ userAgent: 'Android Chrome/130.0 KAKAOTALK', installOnly: true });
  await s.get('installButton').fire('click');
  assert.notEqual(s.get('installDialog').open, true);
  assert.equal(s.navigations.length, 1);
  assert.match(s.navigations[0], /^intent:\/\/bonjour.example\/#Intent;/);
  assert.match(s.navigations[0], /package=com.android.chrome/);
  assert.doesNotMatch(s.navigations[0], /access_token|private|do-not-forward/);
});
test('prompt failures and cancelled installs on Android do not open instructions', async () => {
  for (const failing of [false, true]) {
    const s = setup({ userAgent: 'Android Chrome/130.0', installOnly: true });
    s.listeners.beforeinstallprompt({ preventDefault() {}, prompt: async () => { if (failing) throw new Error('NotAllowed'); }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    await s.get('installButton').fire('click');
    assert.notEqual(s.get('installDialog').open, true);
    assert.equal(s.get('installButton').disabled, false);
    assert.equal(s.get('installBanner').hidden, false);
  }
});
test('native installation is available without loading authentication code', async () => {
  const s = setup({ userAgent: 'Android Chrome/130.0', installOnly: true, noCdn: true });
  let prompted = false;
  s.listeners.beforeinstallprompt({ preventDefault() {}, prompt: async () => { prompted = true; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
  await s.get('installButton').fire('click'); assert.equal(prompted, true);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.indexOf('src="/install.js?') < html.indexOf('src="https://cdn.jsdelivr.net/npm/@supabase/'));
});
test('Windows browser keeps download and shortcut controls available', async () => {
  const s = setup({ platform: 'Win32', userAgent: 'Windows Chrome/130.0' });
  assert.equal(s.get('installBanner').hidden, false);
  assert.equal(s.get('pcShortcut').hidden, false);
  assert.equal(s.get('installButton').textContent, 'PC 앱 다운로드 ↗');
  await s.get('installButton').fire('click');
  assert.equal(s.get('installDialog').open, true);
  assert.equal(s.get('pcDownload').hidden, false);
  let count = 0;
  s.listeners.beforeinstallprompt({ preventDefault() {}, prompt: async () => { count++; }, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  await s.get('installButton').fire('click'); assert.equal(count, 1);
  s.listeners.appinstalled();
  assert.equal(s.get('installBanner').hidden, false);
  assert.equal(s.get('pcShortcut').hidden, false);
});
test('desktop installed app retains download entry while mobile hides it', async () => {
  const s = setup({ platform: 'Win32', standalone: true });
  assert.equal(s.get('installBanner').hidden, false);
  assert.equal(s.get('installButton').textContent, 'PC 앱 설치 안내');
  await s.get('installButton').fire('click');
  assert.equal(s.get('pcDownload').hidden, false);
  assert.equal(s.get('installDialog').open, true);
  assert.equal(setup({ userAgent: 'iPhone', standalone: true }).get('installBanner').hidden, true);
});
test('Windows shortcut points to production and is delivered as a download', () => {
  const shortcut = fs.readFileSync(path.join(root, 'downloads/Bonjour.url'), 'utf8');
  assert.match(shortcut, /^\[InternetShortcut\]\r?\nURL=https:\/\/franchmeet.vercel.app\//);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.ok(config.headers.find(rule => rule.source === '/downloads/Bonjour.url').headers.some(header => header.key === 'Content-Disposition' && header.value.includes('attachment')));
});
test('HTML inline syntax, DOM IDs and install assets are valid', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const [i, match] of [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].entries()) new vm.Script(match[1], { filename: 'inline-' + i });
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest')));
  for (const icon of manifest.icons) {
    const png = fs.readFileSync(path.join(root, icon.src));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16), width); assert.equal(png.readUInt32BE(20), height);
  }
});
