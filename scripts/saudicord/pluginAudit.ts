/*
 * SaifCord — an independent, Arabic-first Discord client mod
 * Copyright (c) 2026 Saif and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
    createSourceFile,
    isArrayLiteralExpression,
    isCallExpression,
    isExportAssignment,
    isIdentifier,
    isObjectLiteralExpression,
    isPropertyAssignment,
    isStringLiteral,
    ScriptTarget
} from "typescript";

import { resolvePluginDependencies } from "../../src/api/pluginDependencies";

const ROOTS = [
    "src/plugins",
    "src/plugins/_api",
    "src/plugins/_core",
    "src/equicordplugins",
    "src/equicordplugins/_api",
    "src/equicordplugins/_core",
    "src/esharqplugins"
];

interface AuditedPlugin {
    name: string;
    path: string;
    dependencies: string[];
    dependenciesKnown: boolean;
}

const parseFailures: Array<{ path: string; error: string; }> = [];
const plugins: AuditedPlugin[] = [];

function propertyName(property: any): string | undefined {
    if (!property.name) return;
    if (isIdentifier(property.name) || isStringLiteral(property.name)) return property.name.text;
}

function parsePlugin(filePath: string): AuditedPlugin {
    const source = createSourceFile(filePath, readFileSync(filePath, "utf8"), ScriptTarget.Latest, true);
    if (source.parseDiagnostics.length) {
        throw new Error(`TypeScript parse error: ${source.parseDiagnostics.length} diagnostic(s)`);
    }

    const statement = source.statements.find(isExportAssignment);
    if (!statement || !isCallExpression(statement.expression) || !isIdentifier(statement.expression.expression) || statement.expression.expression.text !== "definePlugin") {
        throw new Error("No default export calling definePlugin");
    }

    let config = statement.expression.arguments[0];
    if (!config || !isObjectLiteralExpression(config)) {
        throw new Error("definePlugin argument is not a static object literal");
    }

    const nameProperty = config.properties.find(property => propertyName(property) === "name");
    if (!nameProperty || !isPropertyAssignment(nameProperty) || !isStringLiteral(nameProperty.initializer)) {
        throw new Error("Plugin name is not a string literal");
    }

    const dependenciesProperty = config.properties.find(property => propertyName(property) === "dependencies");
    if (!dependenciesProperty) {
        return { name: nameProperty.initializer.text, path: filePath, dependencies: [], dependenciesKnown: true };
    }

    if (!isPropertyAssignment(dependenciesProperty) || !isArrayLiteralExpression(dependenciesProperty.initializer)) {
        return { name: nameProperty.initializer.text, path: filePath, dependencies: [], dependenciesKnown: false };
    }

    const dependencies: string[] = [];
    let dependenciesKnown = true;
    for (const element of dependenciesProperty.initializer.elements) {
        if (!isStringLiteral(element)) {
            dependenciesKnown = false;
            continue;
        }
        dependencies.push(element.text);
    }

    return {
        name: nameProperty.initializer.text,
        path: filePath.replaceAll("\\", "/"),
        dependencies,
        dependenciesKnown
    };
}

function findEntryPoint(root: string, entry: ReturnType<typeof readdirSync>[number]): string | undefined {
    if (!entry.isDirectory()) return;
    for (const fileName of ["index.ts", "index.tsx"]) {
        const candidate = join(root, entry.name, fileName);
        try {
            readFileSync(candidate);
            return candidate;
        } catch { /* try the next extension */ }
    }
}

async function collectRoot(root: string) {
    let entries;
    try {
        entries = readdirSync(root, { withFileTypes: true })
            .filter(entry => !entry.name.startsWith(".") && !entry.name.startsWith("_"));
    } catch (error) {
        parseFailures.push({ path: root, error: String(error) });
        return;
    }

    for (const entry of entries) {
        const filePath = findEntryPoint(root, entry);
        if (!filePath) continue;

        try {
            plugins.push(parsePlugin(filePath));
        } catch (error) {
            parseFailures.push({
                path: filePath,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}

async function main() {
    for (const root of ROOTS) await collectRoot(root);

    const byName = new Map<string, AuditedPlugin[]>();
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
        pluginsWithDynamicDependencies: plugins.filter(plugin => !plugin.dependenciesKnown).map(plugin => ({ name: plugin.name, path: plugin.path })),
        duplicateNames: duplicates,
        missingDependencies: [...missing.values()],
        circularDependencies: [...cycles.values()],
        parseFailures
    };

    console.log(JSON.stringify(report, null, 2));

    const strict = process.argv.includes("--strict");
    if (strict && (duplicates.length || missing.size || cycles.size || parseFailures.length || report.pluginsWithDynamicDependencies.length)) {
        process.exitCode = 1;
    }
}

main().catch(error => {
    console.error("Plugin audit failed:", error);
    process.exitCode = 1;
});
