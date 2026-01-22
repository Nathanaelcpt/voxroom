export default function HomePage() {
  return (
    <section className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Live Rooms
        </h1>
        <p className="text-sm text-muted-foreground">
          Temukan room yang sedang live atau mulai siaranmu sendiri
        </p>
      </div>

      {/* Grid Live Rooms */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card */}
        {["andi", "budi", "charlie"].map((name) => (
          <div
            key={name}
            className="group rounded-xl border bg-card p-4 transition hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                {name[0].toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="font-medium">{name}</span>
                <span className="text-xs text-muted-foreground">
                  Live · Audio only
                </span>
              </div>
            </div>

            <button
              className="mt-4 w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground transition hover:opacity-90"
              onClick={() => {
                alert("Silakan login terlebih dahulu");
              }}
            >
              Join Room
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
