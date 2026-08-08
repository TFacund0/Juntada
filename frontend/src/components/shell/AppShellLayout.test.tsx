import { describe, test, expect } from "vitest";
import { render } from "@testing-library/react";
import { AppShellLayout } from "./AppShellLayout";
import type { GameDef } from "../../games/gameTypes";

describe("AppShellLayout", () => {
  test('renders HeroBackdrop and jt-home-wrap wrapper for stepKey "picker"', () => {
    const { container } = render(
      <AppShellLayout stepKey="picker" game={null} inGameView={false} header={<div>header</div>} rest={<div>rest</div>} />,
    );
    expect(container.querySelector(".jt-home-wrap")).not.toBeNull();
    expect(container.querySelector("[aria-hidden]")).not.toBeNull();
  });

  test('renders ModePickerBackdrop and jt-mode-wrap jt-content-pad-top wrapper for stepKey starting with "modepicker-"', () => {
    const { container } = render(
      <AppShellLayout stepKey="modepicker-impostor" game={null} inGameView={false} header={<div>header</div>} rest={<div>rest</div>} />,
    );
    const wrap = container.querySelector(".jt-mode-wrap.jt-content-pad-top");
    expect(wrap).not.toBeNull();
  });

  test("default/game branch with wide=false renders jt-content-pad-top without jt-round-wrap-wide and keeps maxWidth", () => {
    const { container } = render(
      <AppShellLayout stepKey="local-config" game={null} inGameView={false} header={<div>header</div>} rest={<div>rest</div>} />,
    );
    const wrap = container.querySelector(".jt-content-pad-top") as HTMLElement;
    expect(wrap).not.toBeNull();
    expect(wrap.classList.contains("jt-round-wrap-wide")).toBe(false);
    expect(wrap.style.maxWidth).not.toBe("");
  });

  test("default/game branch with wide=true renders jt-round-wrap-wide and undefined maxWidth", () => {
    const game = { wideRoundView: true } as unknown as GameDef;
    const { container } = render(
      <AppShellLayout stepKey="local-round" game={game} inGameView={true} header={<div>header</div>} rest={<div>rest</div>} />,
    );
    const wrap = container.querySelector(".jt-content-pad-top.jt-round-wrap-wide") as HTMLElement;
    expect(wrap).not.toBeNull();
    expect(wrap.style.maxWidth).toBe("");
  });
});
