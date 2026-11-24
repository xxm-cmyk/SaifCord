/*
 * SaifCord — an independent, Arabic-first Discord client mod
 * Copyright (c) 2026 Saif and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface PluginDependencyNode {
    dependencies?: readonly string[];
}

export interface MissingPluginDependency {
    name: string;
    requestedBy: string;
}

export interface PluginDependencyResolution {
    /** Dependencies in start order: deepest dependencies first. */
    ordered: string[];
    missing: MissingPluginDependency[];
    cycles: string[][];
}

/**
 * Resolve a plugin's dependency graph without mutating plugin state.
 * The result is deterministic and safe to validate before starting anything.
 */
export function resolvePluginDependencies(
    rootName: string,
    plugins: Record<string, PluginDependencyNode | undefined>
): PluginDependencyResolution {
    const state = new Map<string, 1 | 2>();
    const stack: string[] = [];
    const ordered: string[] = [];
    const missing: MissingPluginDependency[] = [];
    const cycles: string[][] = [];
    const cycleKeys = new Set<string>();
    const missingKeys = new Set<string>();

    function visit(name: string, requestedBy: string) {
        const currentState = state.get(name);
        if (currentState === 2) return;

        if (currentState === 1) {
            const cycleStart = stack.indexOf(name);
            const cycle = [...stack.slice(cycleStart), name];
            const key = [...new Set(cycle.slice(0, -1))].sort().join("\0");
            if (!cycleKeys.has(key)) {
                cycleKeys.add(key);
                cycles.push(cycle);
            }
            return;
        }

        const plugin = plugins[name];
        if (!plugin) {
            const key = `${requestedBy}\0${name}`;
            if (!missingKeys.has(key)) {
                missingKeys.add(key);
                missing.push({ name, requestedBy });
            }
            return;
        }

        state.set(name, 1);
        stack.push(name);

        for (const dependency of plugin.dependencies ?? []) {
            visit(dependency, name);
        }

        stack.pop();
        state.set(name, 2);
        if (name !== rootName) ordered.push(name);
    }

    visit(rootName, rootName);

    return { ordered, missing, cycles };
}
