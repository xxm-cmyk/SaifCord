/*
 * SaifCord — an independent, Arabic-first Discord client mod
 * Copyright (c) 2026 Saif and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";

import { resolvePluginDependencies } from "../../src/api/pluginDependencies";
import { getEntryPoint, isPluginFile, parseDevs, parseEquicordDevs, parseFile } from "../utils";

const ROOTS = [
    "src/plugins",
    "src/plugins/_api",
    "src/plugins/_core",
    "src/equicordplugins",
    "src/equicordplugins/_core",
    "src/esharqplugins"
];

const parseFailures: Array<{ path: string; error: string; }> = [];
const plugins: Array<{ name: string; path: string; dependencies: string[]; }> = [];

async function collectRoot(root: string) {
    let entries;
    try {
        entries = readdirSync(root, { withFileTypes: true }).filter(isPluginFile);
    } catch (error) {
        parseFailures.push({ path: root, error: String(error) });
        return;
    }

    for (const entry of entries) {
        try {
            const file = await getEntryPoint(root, entry);
            const [plugin] = await parseFile(file);
            plugins.push({
                name: plugin.name,
                path: plugin.filePath,
                dependencies: plugin.dependencies ?? []
            });
        } catch (error) {
            parseFailures.push({
                path: join(root, entry.name),
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}

async function main() {
    parseDevs();
    parseEquicordDevs();

    for (const root of ROOTS) await collectRoot(root);

    const byName = new Map<string, typeof plugins>();
    for (const plugin of plugins) {
        const group = byName.get(plugin.name) ?? [];
        group.push(plugin);
        byName.set(plugin.name, group);
    }

    const duplicates = [...byName.entries()]
        .filter(([, entries]) => entries.length > 1)
        .map(([name, entries]) => ({ name, paths: entries.map(entry => entry.path) }));

    const graph: Record<string, { dependencies: string[]; } | undefined> = {};
    for (const [name, entries] of byName) {
        graph[name] = { dependencies: entries[0].dependencies };
    }

    const missing = new Map<string, { name: string; requestedBy: string; }>();
    const cycles = new Map<string, string[]>();

    for (const plugin of plugins) {
        const result = resolvePluginDependencies(plugin.name, graph);
        for (const item of result.missing) {
            missing.set(`${item.requestedBy}\0${item.name}`, item);
        }
        for (const cycle of result.cycles) {
            const key = [...new Set(cycle.slice(0, -1))].sort().join("\0");
            cycles.set(key, cycle);
        }
    }

    const report = {
        roots: ROOTS,
        entrypointsParsed: plugins.length,
        uniquePluginNames: byName.size,
        duplicateNames: duplicates,
        missingDependencies: [...missing.values()],
        circularDependencies: [...cycles.values()],
        parseFailures
    };

    console.log(JSON.stringify(report, null, 2));

    const strict = process.argv.includes("--strict");
    if (strict && (duplicates.length || missing.size || cycles.size || parseFailures.length)) {
        process.exitCode = 1;
    }
}

main().catch(error => {
    console.error("Plugin audit failed:", error);
    process.exitCode = 1;
});
