export function setWindow() {
  // to disable context menu on the page
  document.oncontextmenu = () => false;
  window.addEventListener(
    'contextmenu',
    (e) => {
      e.preventDefault();
    },
    false
  );
  window.onunhandledrejection = (windowEvent) => {
    windowEvent.preventDefault();
    const reason = windowEvent.reason;
    const message = reason && (reason.stack || reason);
    if (message && message.indexOf('blocked') > 0) {
      console.warn('popup blocked');
    } else {
      console.warn('Unhandled rejection:', reason && (reason.stack || reason));
    }
  };
}
