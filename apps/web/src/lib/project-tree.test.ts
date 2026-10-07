import { describe, expect, it } from "vite-plus/test";
import {
  buildProjectTree,
  flattenProjectTree,
  getProjectFamily,
  listProjectsWithDepth,
} from "./project-tree";

const p = (id: string, parentProjectId: string | null = null) => ({
  id,
  parentProjectId,
});

describe("buildProjectTree", () => {
  it("nests children under their parent and keeps input order", () => {
    const tree = buildProjectTree([p("a"), p("b"), p("a1", "a"), p("a2", "a")]);
    expect(tree.map((node) => node.project.id)).toEqual(["a", "b"]);
    expect(tree[0]?.children.map((child) => child.id)).toEqual(["a1", "a2"]);
    expect(tree[1]?.children).toEqual([]);
  });

  it("shows a subproject as top-level when its parent is not visible", () => {
    const tree = buildProjectTree([p("kid", "hidden-parent"), p("other")]);
    expect(tree.map((node) => node.project.id)).toEqual(["kid", "other"]);
  });

  it("does not drop a project that points at itself", () => {
    expect(
      buildProjectTree([p("loop", "loop")]).map((node) => node.project.id),
    ).toEqual(["loop"]);
  });

  it("flattens parents before their children", () => {
    const tree = buildProjectTree([p("a1", "a"), p("b"), p("a")]);
    expect(flattenProjectTree(tree).map((project) => project.id)).toEqual([
      "b",
      "a",
      "a1",
    ]);
  });
});

describe("buildProjectTree depth", () => {
  it("keeps a grandchild top-level rather than hiding it", () => {
    const tree = buildProjectTree([p("a"), p("b", "a"), p("c", "b")]);
    expect(tree.map((node) => node.project.id)).toEqual(["a", "c"]);
    expect(tree[0]?.children.map((child) => child.id)).toEqual(["b"]);
  });
});

describe("getProjectFamily", () => {
  const projects = [p("a"), p("a1", "a"), p("a2", "a"), p("x", "gone")];

  it("returns the children of a parent", () => {
    const { parent, children } = getProjectFamily(projects, "a");
    expect(parent).toBeNull();
    expect(children.map((child) => child.id)).toEqual(["a1", "a2"]);
  });

  it("returns the parent of a subproject", () => {
    const { parent, children } = getProjectFamily(projects, "a1");
    expect(parent?.id).toBe("a");
    expect(children).toEqual([]);
  });

  it("returns no parent when it is not visible, or the project is unknown", () => {
    expect(getProjectFamily(projects, "x").parent).toBeNull();
    expect(getProjectFamily(projects, "nope")).toEqual({
      parent: null,
      children: [],
    });
  });
});

describe("listProjectsWithDepth", () => {
  it("lists parents followed by indented children", () => {
    expect(
      listProjectsWithDepth([p("a1", "a"), p("a"), p("b")]).map(
        ({ project, depth }) => `${depth}:${project.id}`,
      ),
    ).toEqual(["0:a", "1:a1", "0:b"]);
  });
});
