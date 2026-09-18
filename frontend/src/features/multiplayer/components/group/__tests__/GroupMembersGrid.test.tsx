import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GroupMembersGrid } from "../GroupMembersGrid";
import type { GroupPublicState } from "@juntada/shared-types";

type Member = GroupPublicState["members"][number];

function makeMember(id: string, overrides: Partial<Member> = {}): Member {
  return { id, name: id, online: true, ...overrides } as Member;
}

function makeGroup(overrides: Partial<GroupPublicState> = {}): GroupPublicState {
  return {
    code: "GRP01",
    name: "Mi grupo",
    hostId: "p1",
    members: [makeMember("p1")],
    instances: [],
    ...overrides,
  } as GroupPublicState;
}

describe("GroupMembersGrid", () => {
  test("shows the crown badge only for the host member", () => {
    const group = makeGroup({ hostId: "p1", members: [makeMember("p1"), makeMember("p2")] });
    render(<GroupMembersGrid group={group} myPlayerId="p2" isGroupHost={false} onTogglePlayerMenu={vi.fn()} />);

    expect(screen.getByTitle("Anfitrión")).toBeInTheDocument();
  });

  test("marks an offline member's status dot", () => {
    const group = makeGroup({ members: [makeMember("p1"), makeMember("p2", { online: false })] });
    render(<GroupMembersGrid group={group} myPlayerId="p1" isGroupHost={false} onTogglePlayerMenu={vi.fn()} />);

    expect(screen.getByTitle("Desconectado")).toBeInTheDocument();
    expect(screen.getByTitle("Conectado")).toBeInTheDocument();
  });

  test("labels the current player with '(vos)'", () => {
    const group = makeGroup({ members: [makeMember("p1")] });
    render(<GroupMembersGrid group={group} myPlayerId="p1" isGroupHost={false} onTogglePlayerMenu={vi.fn()} />);

    expect(screen.getByText(/p1/)).toHaveTextContent("p1 (vos)");
  });

  test("shows the options menu button only for the host, and only on other members", () => {
    const group = makeGroup({ members: [makeMember("p1"), makeMember("p2")] });
    const onTogglePlayerMenu = vi.fn();
    render(<GroupMembersGrid group={group} myPlayerId="p1" isGroupHost={true} onTogglePlayerMenu={onTogglePlayerMenu} />);

    expect(screen.queryByLabelText("Opciones para p1")).not.toBeInTheDocument();
    const menuBtn = screen.getByLabelText("Opciones para p2");
    menuBtn.click();
    expect(onTogglePlayerMenu).toHaveBeenCalledWith("p2");
  });

  test("hides the options menu button entirely when the current player is not the host", () => {
    const group = makeGroup({ members: [makeMember("p1"), makeMember("p2")] });
    render(<GroupMembersGrid group={group} myPlayerId="p1" isGroupHost={false} onTogglePlayerMenu={vi.fn()} />);

    expect(screen.queryByLabelText("Opciones para p2")).not.toBeInTheDocument();
  });
});
