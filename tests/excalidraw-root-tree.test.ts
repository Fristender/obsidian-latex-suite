import { describe, expect, it } from "vitest";
import { evalInObsidian } from "obsidian-integration-testing";
import { getTemporaryVault } from "obsidian-integration-testing/vitest-global-setup-plugin";
import TestPlugin from "./main";

type RootTreeResult = {
	rootName: string;
	rootParent: string | null;
	traversed: string[];
	brackets: { open: string; close: string; content: string }[];
};

/**
 * Excalidraw's LaTeX editor parses the document with the bare LaTeX parser, so
 * the LaTeX node is the root of the tree and has no parent. `iterateTreeCursor`
 * used to dereference that missing parent while walking up to the outermost
 * node, which made `autoEnlargeBrackets` throw after a snippet expanded and
 * left the triggering key (e.g. "/") inserted as well.
 */
describe("root LaTeX tree (Excalidraw-style)", () => {
	getTemporaryVault();

	it("traverseTree should find brackets in a parentless LaTeX node", async () => {
		const result = await evalInObsidian({
			input: { pluginId: "obsidian-latex-suite" },
			callback: ({ app, pluginId }): RootTreeResult => {
				const plugin = app.plugins.getPlugin(pluginId) as TestPlugin | null;
				if (!plugin) throw new Error("Plugin not found");
				const {
					latexParser,
					EquationText,
					iterateTreeCursor,
					traverseTree,
					pairBrackets,
				} = plugin.test;

				const eqn = "(\\sum)";
				const root = latexParser.parse(eqn).topNode;
				const doc = new EquationText(eqn, root.from, root.to);

				const traversed: string[] = [];
				for (const cursor of iterateTreeCursor(root, doc)) {
					traversed.push(`${cursor.name}(${cursor.from},${cursor.to})`);
				}

				const brackets = pairBrackets(traverseTree(root, doc))
					.filter((spec) => spec.kind === "bracket")
					.map((spec) => ({
						open: doc.slice(spec.open.from, spec.open.to),
						close: doc.slice(spec.close.from, spec.close.to),
						content: doc.slice(spec.open.to, spec.close.from),
					}));

				return {
					rootName: root.type.name,
					rootParent: root.parent?.type.name ?? null,
					traversed,
					brackets,
				};
			},
		});

		expect(result.rootName).toBe("LaTeX");
		expect(result.rootParent).toBeNull();
		expect(result.traversed).toContain("MathSpecialChar(0,1)");
		expect(result.traversed).toContain("MathSpecialChar(5,6)");
		// `autoEnlargeBrackets` needs this pair to be able to enlarge the brackets around `\sum`.
		expect(result.brackets).toEqual([{ open: "(", close: ")", content: "\\sum" }]);
	});
});
