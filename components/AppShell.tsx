export default function AppShell({
  sidebar,
  main,
  intelligence
}) {
  return (
    <div className="app-shell">

      <aside className="sidebar panel">
        {sidebar}
      </aside>

      <main className="main panel">
        {main}
      </main>

      <aside className="intel panel">
        {intelligence}
      </aside>

    </div>
  )
}