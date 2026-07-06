(() => {
  const storedTheme = localStorage.getItem('bt-theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = storedTheme || (prefersDark ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
