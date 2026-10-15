// -----------------------------------------------------------------------------
//  login.js — wires the login form to the auth flow.
// -----------------------------------------------------------------------------

// If already signed in, skip straight to the app.
if (isAuthed()) {
  location.href = 'dashboard.html';
}

const form = document.getElementById('login-form');
const alertBox = document.getElementById('alert');
const btn = document.getElementById('login-btn');

// Theme toggle (login page is standalone, no layout.js shell).
const themeBtn = document.getElementById('login-theme-btn');
function syncLoginThemeIcon() {
  if (!themeBtn) return;
  const icon = themeBtn.querySelector('.material-symbols-outlined');
  if (icon) icon.textContent = document.documentElement.classList.contains('dark') ? 'light_mode' : 'dark_mode';
}
if (themeBtn) themeBtn.addEventListener('click', () => { toggleTheme(); syncLoginThemeIcon(); });
syncLoginThemeIcon();

// Language toggle: translate all static labels and show the switch-to language.
function syncLoginLang() {
  applyStaticI18n(document);
  const label = document.getElementById('login-lang-label');
  if (label) label.textContent = getLang() === 'ar' ? 'English' : 'العربية';
}
const langBtn = document.getElementById('login-lang-btn');
if (langBtn) langBtn.addEventListener('click', toggleLang); // toggleLang persists + reloads
syncLoginLang();

function showError(msg) {
  alertBox.textContent = msg;
  alertBox.classList.remove('hidden');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.classList.add('hidden');

  const identifier = document.getElementById('identifier').value.trim();
  const password = document.getElementById('password').value;

  if (!identifier || !password) {
    showError(bi('Please enter your username and password.', 'يرجى إدخال اسم المستخدم وكلمة المرور.'));
    return;
  }

  btn.disabled = true;
  btn.textContent = bi('Signing in…', 'جارٍ الدخول…');

  try {
    await login(identifier, password);       // stores token + user, see auth.js
    location.href = 'dashboard.html';         // success -> go to the app
  } catch (err) {
    // Generic bilingual auth-failure message (deliberately does NOT reveal whether the
    // username or the password was wrong — matches the backend's generic 401 policy).
    showError(bi('Invalid username or password.', 'اسم المستخدم أو كلمة المرور غير صحيحة.'));
    btn.disabled = false;
    btn.textContent = bi('Sign in', 'دخول');
  }
});
