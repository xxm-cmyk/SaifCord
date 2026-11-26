/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { fetchBuffer, fetchJson } from "@main/utils/http";
import { IpcEvents } from "@shared/IpcEvents";
import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { ipcMain } from "electron";
import { writeFileSync } from "original-fs";

import gitHash from "~git-hash";
import gitRemote from "~git-remote";

import { ASAR_FILE, serializeErrors } from "./common";

const API_BASE = `https://api.github.com/repos/${gitRemote}`;
let PendingUpdate: string | null = null;

/**
 * The pending hash identifies the source commit embedded in the release title.
 * Release tags are versioned and may be reused when rebuilding the same version,
 * so the tag's original target_commitish is not a reliable build identifier.
 */
let PendingHash: string | null = null;

async function githubGetOnce<T = any>(endpoint: string) {
    return fetchJson<T>(API_BASE + endpoint, {
        headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": VENCORD_USER_AGENT
        }
    });
}

async function githubGet<T = any>(endpoint: string) {
    try {
        return await githubGetOnce<T>(endpoint);
    } catch (e: any) {
        const message = String(e?.message ?? e);
        if (/\b(4\d\d|5\d\d)\b/.test(message)) throw e;
        return await githubGetOnce<T>(endpoint);
    }
}

async function calculateGitChanges() {
    const isOutdated = await fetchUpdates();
    if (!isOutdated) return [];

    const data = await githubGet(`/compare/${gitHash}...${PendingHash ?? "HEAD"}`);

    return data.commits.map((c: any) => ({
        hash: c.sha,
        author: c.author?.login ?? c.commit?.author?.name ?? "Unknown Author",
        message: c.commit.message.split("\n")[0]
    }));
}

function sameCommit(a: string, b: string): boolean {
    const x = a.trim().toLowerCase();
    const y = b.trim().toLowerCase();
    if (!/^[0-9a-f]{7,40}$/.test(x) || !/^[0-9a-f]{7,40}$/.test(y)) return false;
    const n = Math.min(x.length, y.length);
    return x.slice(0, n) === y.slice(0, n);
}

async function fetchUpdates() {
    const data = await githubGet("/releases/latest");

    // Release titles use: "SaifCord <version> <short-source-commit>".
    const hash = String(data.name ?? "").trim().split(/\s+/).at(-1) ?? "";
    if (!/^[0-9a-f]{7,40}$/i.test(hash)) {
        throw new Error(`Release "${data.name}" does not include a valid source commit hash.`);
    }

    if (sameCommit(hash, gitHash)) {
        PendingUpdate = null;
        PendingHash = null;
        return false;
    }

    const asset = data.assets?.find(a => a.name === ASAR_FILE);
    if (!asset) {
        throw new Error(
            `Release "${data.name}" has no "${ASAR_FILE}" asset. ` +
            "Your Discord client type may not have a published build."
        );
    }

    PendingUpdate = asset.browser_download_url;
    PendingHash = hash;

    return true;
}

async function applyUpdates() {
    if (!PendingUpdate) return true;

    const data = await fetchBuffer(PendingUpdate);
    writeFileSync(__dirname, data, { flush: true });
    PendingHash = null;

    PendingUpdate = null;

    return true;
}

ipcMain.handle(IpcEvents.GET_REPO, serializeErrors(() => `https://github.com/${gitRemote}`));
ipcMain.handle(IpcEvents.GET_UPDATES, serializeErrors(calculateGitChanges));
ipcMain.handle(IpcEvents.UPDATE, serializeErrors(fetchUpdates));
ipcMain.handle(IpcEvents.BUILD, serializeErrors(applyUpdates));
