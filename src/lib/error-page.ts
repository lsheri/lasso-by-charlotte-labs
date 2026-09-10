export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      /* Standalone document: it cannot import the app stylesheet, so the
         same palette is mirrored as local tokens and used only through them.
         KEEP IN SYNC BY HAND with the --nb-* palette in src/styles.css. */
      :root { --background: #fafaf8; --foreground: #16181a; --muted-foreground: #6b6e6c; --card: #ffffff; --border: #dadad5; --pencil: #b9bbb6; --ember: #2a2d2b; --radius-control: 6px; }
      body { font: 13px/1.5 system-ui, -apple-system, sans-serif; background: var(--background); color: var(--foreground); display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; background: var(--card); border: 1px solid var(--pencil); border-radius: var(--radius-control); }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: var(--muted-foreground); margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: var(--radius-control); font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: var(--ember); color: #ffffff; }
      .secondary { background: var(--card); color: var(--foreground); border-color: var(--pencil); }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Nothing you were doing was lost, and nothing was sent anywhere. Refreshing usually fixes it.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
