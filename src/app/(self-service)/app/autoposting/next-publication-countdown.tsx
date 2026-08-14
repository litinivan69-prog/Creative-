"use client";

import { useEffect, useMemo, useState } from "react";

function countdownLabel(target: number, now: number) {
  const difference = target - now;
  if (difference <= 0) return "Публикация — в ближайшие минуты";

  const totalMinutes = Math.ceil(difference / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `Через ${days} дн. ${hours} ч.`;
  if (hours > 0) return `Через ${hours} ч. ${minutes} мин.`;
  return `Через ${minutes} мин.`;
}

export function NextPublicationCountdown({
  scheduledDate,
  scheduledTime,
  initialNow,
}: {
  scheduledDate: string;
  scheduledTime: string;
  initialNow: number;
}) {
  const target = useMemo(
    () => new Date(`${scheduledDate}T${scheduledTime}:00+03:00`).getTime(),
    [scheduledDate, scheduledTime],
  );
  const [now, setNow] = useState(initialNow);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return <h2 className="text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">{countdownLabel(target, now)}</h2>;
}
