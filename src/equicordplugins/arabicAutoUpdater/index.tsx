/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { Devs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { Alerts, SettingsRouter } from "@webpack/common";

import gitHash from "~git-hash";

const logger = new Logger("ArabicAutoUpdater");
const REPO = "xxm-cmyk/SaifCord";
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const SEEN_KEY = "saifcord-last-seen-release";

let checked = false;

async function checkForUpdate() {
    if (checked) return;
    checked = true;

    try {
        const res = await fetch(API_URL, {
            headers: { Accept: "application/vnd.github+json" }
        });
        if (!res.ok) return;

        const data = await res.json();
        // SaifCord releases use versioned tags; target_commitish points to
        // the exact source commit used to build the release.
        const remoteVersion: string = data.tag_name ?? "";
        const remoteCommit: string = data.target_commitish ?? "";
        if (!remoteVersion || !/^[a-f0-9]{7,40}$/i.test(remoteCommit)) return;

        // Accept either a short or full local git hash without false update prompts.
        const local = gitHash.toLowerCase();
        const remote = remoteCommit.toLowerCase();
        if (local.startsWith(remote) || remote.startsWith(local)) return;

        // Migrate any old localStorage value to DataStore on first run. Discord removes
        // window.localStorage in the renderer (anti-token-theft), so a bare reference throws
        // ReferenceError — guard with typeof so the update check never fails because of it.
        if (typeof localStorage !== "undefined") {
            const legacyValue = localStorage.getItem(SEEN_KEY);
            if (legacyValue) {
                await DataStore.set(SEEN_KEY, legacyValue);
                localStorage.removeItem(SEEN_KEY);
            }
        }

        const lastSeen = await DataStore.get<string>(SEEN_KEY);
        if (lastSeen === remoteVersion) return;

        await DataStore.set(SEEN_KEY, remoteVersion);

        Alerts.show({
            title: t("تحديث جديد متاح!", "New update available!"),
            body: (
                <>
                    <p>{t("يتوفر إصدار جديد من", "A new version of")} <strong>{t("SaifCord", "SaifCord")}</strong>{t(" متاح.", " is available.")}</p>
                    <p>{t("الإصدار الحالي:", "Current version:")} <code>{gitHash.slice(0, 7)}</code></p>
                    <p>{t("الإصدار الجديد:", "New version:")} <code>{remoteVersion}</code></p>
                    <p>{t("هل تريد التحديث الآن؟", "Do you want to update now?")}</p>
                </>
            ),
            confirmText: t("تحديث الآن", "Update now"),
            cancelText: t("لاحقاً", "Later"),
            onConfirm: openUpdaterTab
        });
    } catch (e) {
        logger.error("فشل فحص التحديثات:", e);
    }
}

// "تحديث الآن" يفتح قسم "مُحدِّث SaifCord" داخل الإعدادات (لا يفتح المتصفّح) حيث يُطبّق المستخدم
// التحديث بنفسه عبر المحدّث المدمج. يرجع لصفحة الإصدارات فقط إن كان المحدّث معطّلاً أو على الويب.
function openUpdaterTab() {
    if (IS_WEB || IS_UPDATER_DISABLED) {
        VencordNative.native.openExternal(RELEASES_PAGE);
        return;
    }
    SettingsRouter.openUserSettings("equicord_updater_panel");
}

export default definePlugin({
    name: "ArabicAutoUpdater",
    description: "Checks the official SaifCord releases and notifies you when a new version is available",
    authors: [Devs.thororen],
    tags: ["Utility"],

    flux: {
        async CONNECTION_OPEN() {
            await checkForUpdate();
        }
    }
});
