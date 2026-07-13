export default function Loading() {
  return (
    <main className="min-h-screen bg-[#f7f5fb] p-6">
      <div className="mx-auto grid max-w-6xl gap-4">
        <div className="ap-shimmer h-24 rounded-[22px]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="ap-shimmer h-32 rounded-[22px]" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="ap-shimmer h-80 rounded-[22px] lg:col-span-8" />
          <div className="ap-shimmer h-80 rounded-[22px] lg:col-span-4" />
        </div>
      </div>
    </main>
  );
}
