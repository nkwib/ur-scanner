<script>
  import '@fontsource/inter/400.css';
  import '@fontsource/inter/500.css';
  import '@fontsource/inter/600.css';
  import '@fontsource/inter/700.css';
  import '@fontsource/jetbrains-mono/400.css';
  import '@fontsource/jetbrains-mono/500.css';
  import '../styles/global.css';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';

  let { children } = $props();
</script>

<svelte:head>
  <!-- Apply stored theme before paint to avoid a flash. Fonts are self-hosted
       (@fontsource), so there are no external requests, matching the library's
       privacy stance. -->
  <script>
    (function () {
      try {
        var stored = localStorage.getItem('ur-scanner-theme');
        var theme =
          stored === 'light' || stored === 'dark'
            ? stored
            : window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light';
        document.documentElement.dataset.theme = theme;
      } catch (_) {}
    })();
  </script>
</svelte:head>

<div class="page-shell">
  <Header />
  <div class="page-content">
    {@render children()}
  </div>
  <Footer />
</div>

<style>
  .page-shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .page-content {
    flex: 1;
  }
</style>
