import { describe, expect, test } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatFeed } from "../chat/ChatFeed";
import type { ChatFeedItem } from "../../utils/chatFeed";

const always = () => true;
const msg = (key: string, mine = false): ChatFeedItem => ({
  kind: "msg",
  key,
  playerId: mine ? "me" : "p2",
  name: mine ? "Yo" : "Beto",
  mine,
  close: false,
  text: `mensaje ${key}`,
});

// jsdom has no layout: fake the scroll box so "at the bottom" / "scrolled up" mean something.
function fakeScrollBox(el: HTMLElement, { scrollTop }: { scrollTop: number }) {
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: 1000 });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: 400 });
  el.scrollTop = scrollTop;
  fireEvent.scroll(el);
}

describe("ChatFeed", () => {
  test("shows the empty text only while the feed has no lines at all, like the reference", () => {
    const sys: ChatFeedItem = { kind: "sys", key: "sys", text: "Ana está dibujando…" };
    const { rerender } = render(<ChatFeed items={[]} emptyText="Todavía nadie escribió nada." canAnimate={always} />);
    expect(screen.getByText("Todavía nadie escribió nada.")).toBeInTheDocument();

    rerender(<ChatFeed items={[sys]} emptyText="Todavía nadie escribió nada." canAnimate={always} />);
    expect(screen.getByText("Ana está dibujando…")).toBeInTheDocument();
    expect(screen.queryByText("Todavía nadie escribió nada.")).not.toBeInTheDocument();
  });

  test("scrolled up: new messages don't move the list and pile up in a '↓ N nuevos' pill that goes back down", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ChatFeed items={[msg("1")]} emptyText="" canAnimate={always} />);
    const box = screen.getByText("mensaje 1").closest("[aria-live]") as HTMLElement;
    fakeScrollBox(box, { scrollTop: 100 });

    rerender(<ChatFeed items={[msg("1"), msg("2")]} emptyText="" canAnimate={always} />);
    expect(box.scrollTop).toBe(100);
    expect(screen.getByRole("button", { name: "↓ 1 nuevo" })).toBeInTheDocument();
    rerender(<ChatFeed items={[msg("1"), msg("2"), msg("3")]} emptyText="" canAnimate={always} />);
    expect(screen.getByRole("button", { name: "↓ 2 nuevos" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "↓ 2 nuevos" }));
    fakeScrollBox(box, { scrollTop: 600 });
    expect(screen.queryByRole("button", { name: /nuevo/ })).not.toBeInTheDocument();
  });

  test("my own message always takes me to the end, even when scrolled up", () => {
    const { rerender } = render(<ChatFeed items={[msg("1")]} emptyText="" canAnimate={always} />);
    const box = screen.getByText("mensaje 1").closest("[aria-live]") as HTMLElement;
    fakeScrollBox(box, { scrollTop: 100 });

    rerender(<ChatFeed items={[msg("1"), msg("2", true)]} emptyText="" canAnimate={always} />);
    expect(box.scrollTop).toBe(1000);
    expect(screen.queryByRole("button", { name: /nuevo/ })).not.toBeInTheDocument();
  });

  test("only messages arriving live animate in — not the history already there on mount", () => {
    const { rerender } = render(<ChatFeed items={[msg("1")]} emptyText="" canAnimate={always} />);
    rerender(<ChatFeed items={[msg("1"), msg("2")]} emptyText="" canAnimate={always} />);
    const line = (text: string) => screen.getByText(text).closest(".flex") as HTMLElement;
    expect(line("mensaje 1").className).not.toContain("animate-rl-msg-in");
    expect(line("mensaje 2").className).toContain("animate-rl-msg-in");
  });
});
