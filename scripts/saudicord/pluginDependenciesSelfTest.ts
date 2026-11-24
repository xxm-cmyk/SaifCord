/*
 * SaifCord — an independent, Arabic-first Discord client mod
 * Copyright (c) 2026 Saif and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";

import { resolvePluginDependencies } from "../../src/api/pluginDependencies";

function run(name: string, plugins: Record<string, { dependencies?: string[]; }>) {
    return resolvePluginDependencies(name, plugins);
}

{
    const result = run("Root", {
        Root: { dependencies: ["A"] },
        A: { dependencies: ["B"] },
        B: {}
    });
    assert.deepEqual(result.ordered, ["B", "A"]);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.cycles, []);
}

{
    const result = run("Root", {
        Root: { dependencies: ["A", "B"] },
        A: { dependencies: ["Shared"] },
        B: { dependencies: ["Shared"] },
        Shared: {}
    });
    assert.deepEqual(result.ordered, ["Shared", "A", "B"]);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.cycles, []);
}

{
    const result = run("Root", {
        Root: { dependencies: ["Missing"] }
    });
    assert.deepEqual(result.missing, [{ name: "Missing", requestedBy: "Root" }]);
    assert.deepEqual(result.ordered, []);
}

{
    const result = run("Root", {
        Root: { dependencies: ["A"] },
        A: { dependencies: ["B"] },
        B: { dependencies: ["A"] }
    });
    assert.deepEqual(result.cycles, [["A", "B", "A"]]);
}

{
    const result = run("Root", {
        Root: { dependencies: ["Root"] }
    });
    assert.deepEqual(result.cycles, [["Root", "Root"]]);
    assert.deepEqual(result.ordered, []);
}

{
    const result = run("Root", {
        Root: { dependencies: ["A", "A"] },
        A: {}
    });
    assert.deepEqual(result.ordered, ["A"]);
}

console.log("Plugin dependency graph self-test passed.");
