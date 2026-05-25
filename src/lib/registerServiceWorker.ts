export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    let unregistered = false;
    for (const registration of registrations) {
      await registration.unregister();
      unregistered = true;
    }
    if (unregistered) {
      window.location.reload();
    }
  } catch (err) {
    // Keep failure silent
  }

  // 新しいsw.jsもブラウザ側が自動更新チェックした際に自己消去するよう登録・更新を促す
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      void reg.update();
    }).catch(() => {});
  });
};
