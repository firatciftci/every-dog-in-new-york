import type { Park } from "./parks";

const RATE = 2;
const HOUR = 3600;

const pad = (n: number) => String(n).padStart(2, "0");

export type OffLeash = ReturnType<typeof offLeash>;

/**
 * Play always ends on the hour, so the park's start is the only number: the run is
 * however long it takes to reach it at RATE game seconds a second. Every reader of
 * the time asks this, and nothing else divides, multiplies or names an hour.
 */
export function offLeash(park: Park, isNight: boolean) {
  const start = park.startMinute * 60;
  const played = HOUR - start;
  const startHour = isNight ? 12 : 8;
  const endHour = isNight ? 1 : 9;

  return {
    isNight,
    startHour,
    endHour,
    startMinute: park.startMinute,
    seconds: played / RATE,
    gameSeconds: played,
    minutes: played / 60,
    spoken: isNight ? "One o'clock" : "Nine o'clock",
    words: isNight ? "9 pm to 1 am" : "6 to 9 am",
    tick(time: number) {
      return Math.min(time, played / RATE) * RATE;
    },
    at(gameSeconds: number) {
      const total = start + Math.floor(gameSeconds);
      const hour = total >= HOUR ? endHour : startHour;

      return `${hour}:${pad(Math.floor((total % HOUR) / 60))}:${pad(total % 60)}`;
    },
    stamp(minute: number) {
      const total = park.startMinute + minute;
      const hour = total >= 60 ? endHour : startHour;

      return `${hour}:${pad(total % 60)}`;
    },
  };
}
