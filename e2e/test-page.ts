/** Origin the test pages are served from. Requests to it never leave Playwright. */
export const SITE = 'http://inp-radar.test';

/**
 * A page with buttons that block the main thread for a given time on click,
 * so interactions have a predictable duration.
 */
export const PAGE = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>INP Radar test page</title></head>
  <body>
    <button id="slow" data-block="300">Slow</button>
    <button id="very-slow" data-block="600">Very slow</button>
    <button id="frozen" data-block="1500">Frozen</button>
    <script>
      for (const button of document.querySelectorAll('[data-block]')) {
        button.addEventListener('click', () => {
          const end = performance.now() + Number(button.dataset.block);
          while (performance.now() < end) {}
          button.textContent += ' ✓';
        });
      }
    </script>
  </body>
</html>`;
