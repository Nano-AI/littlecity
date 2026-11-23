import { describe, expect, test } from "vitest";
import { createMood, createTally } from "./mood";

describe("mood", () => {
  test("starts at rest", () => {
    expect(createMood().value).toBe(70);
  });

  test("a nuke craters it and a wedding lifts it", () => {
    const m = createMood();
    m.hit("nuke");
    expect(m.value).toBe(25);
    m.hit("scene");
    expect(m.value).toBe(31);
  });

  test("never below 0 or above 100", () => {
    const m = createMood();
    m.hit("ruin", 400);
    expect(m.value).toBe(0);
    const h = createMood(98);
    h.hit("festival");
    expect(h.value).toBe(100);
  });

  test("mending lifts it a little", () => {
    const m = createMood();
    m.hit("mend");
    expect(m.value).toBe(72);
  });

  test("drifts back to rest", () => {
    const m = createMood();
    m.hit("nuke");
    m.step(90);
    expect(m.value).toBeGreaterThan(50);
    expect(m.value).toBeLessThan(60);
    m.step(600);
    expect(Math.abs(m.value - 70)).toBeLessThan(0.5);
    const h = createMood();
    h.hit('festival', 10);
    expect(h.value).toBe(100);
    h.step(600);
    expect(Math.abs(h.value - 70)).toBeLessThan(0.5);
  });

  test("step(0) and negative dt change nothing", () => {
    const m = createMood();
    m.hit("nuke");
    m.step(0);
    m.step(-5);
    expect(m.value).toBe(25);
  });
});

describe("tally", () => {
  test("rotates through the non-zero counts in order, wrapping", () => {
    const t = createTally();
    expect(t.next()).toBeNull();
    t.add("nukes");
    t.add("loaves", 3);
    expect(t.next()).toEqual({ key: "loaves", n: 3 });
    expect(t.next()).toEqual({ key: "nukes", n: 1 });
    expect(t.next()).toEqual({ key: "loaves", n: 3 });
  });

  test("set to zero removes it from the rotation", () => {
    const t = createTally();
    t.set("burning", 4);
    t.add("fish");
    t.set("burning", 0);
    expect(t.get("burning")).toBe(0);
    expect(t.next()).toEqual({ key: "fish", n: 1 });
    expect(t.next()).toEqual({ key: "fish", n: 1 });
  });
});
