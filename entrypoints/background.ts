export default defineBackground(() => {
  // Clicking the toolbar icon opens the side panel instead of a popup, so it
  // stays open while you interact with the page.
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
});
