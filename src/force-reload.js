if (import.meta.hot) {
  let reloading = false;

  const reload = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };

  import.meta.hot.on("vite:beforeUpdate", reload);
  import.meta.hot.on("vite:beforeFullReload", reload);
}
