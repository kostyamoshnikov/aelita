(() => {
  const button = document.getElementById('team-install');
  const installed = document.getElementById('team-installed');
  const instructions = document.getElementById('team-instructions');
  const help = document.getElementById('team-install-help');
  let deferredPrompt;

  function showInstalled() {
    button.hidden = true;
    instructions.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    installed.hidden = false;
  }

  function showInstructions() {
    const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    help.textContent = isAppleMobile
      ? 'Откройте эту страницу в Safari. Нажмите «Поделиться», затем «На экран Домой» и «Добавить».'
      : 'Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».';
    instructions.hidden = false;
    button.setAttribute('aria-expanded', 'true');
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
  });
  window.addEventListener('appinstalled', showInstalled);
  button.addEventListener('click', async () => {
    const prompt = deferredPrompt;
    if (!prompt) {
      showInstructions();
      return;
    }
    deferredPrompt = undefined;
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      if (result.outcome === 'accepted') showInstalled();
    } catch {
      showInstructions();
    }
  });

  const fromLauncher = new URLSearchParams(location.search).get('app') === 'team';
  if (fromLauncher && (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true)) {
    showInstalled();
  } else {
    button.hidden = false;
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/admin/team-sw.js', { scope: '/admin/', updateViaCache: 'none' })
      .catch(error => console.warn('Не удалось запустить рабочее приложение', error.name));
  }
})();
