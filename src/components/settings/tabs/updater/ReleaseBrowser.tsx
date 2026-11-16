/*
 * SaudiCord, an Arabic-first Discord client mod
 * Copyright (c) 2026 SaudiCord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { Flex } from "@components/Flex";
import { Paragraph } from "@components/Paragraph";
import { Span } from "@components/Span";
import { t } from "@utils/esharqI18n";
import { React } from "@webpack/common";

const RELEASES_API = "https://api.github.com/repos/xxm-cmyk/SaudiCord/releases?per_page=12";

interface ReleaseAsset {
    name: string;
    browser_download_url: string;
}

interface GitHubRelease {
    id: number;
    name: string | null;
    tag_name: string;
    html_url: string;
    body: string | null;
    published_at: string | null;
    draft: boolean;
    prerelease: boolean;
    target_commitish: string;
    assets: ReleaseAsset[];
}

function openExternal(url: string) {
    if (IS_WEB) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
    }

    VencordNative.native.openExternal(url);
}

export default function ReleaseBrowser() {
    const [releases, setReleases] = React.useState<GitHubRelease[] | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(false);

    const loadReleases = React.useCallback(async () => {
        setLoading(true);
        setError(false);

        try {
            const response = await fetch(RELEASES_API, {
                headers: { Accept: "application/vnd.github+json" },
                cache: "no-store"
            });

            if (!response.ok)
                throw new Error(`GitHub returned ${response.status}`);

            const data = await response.json() as GitHubRelease[];
            setReleases(data.filter(release => !release.draft));
        } catch (err) {
            console.error("[SaudiCord] Failed to load releases", err);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadReleases();
    }, [loadReleases]);

    return (
        <Flex flexDirection="column" gap="0.75em">
            <Flex style={{ alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Paragraph color="text-subtle">
                    {t("الإصدارات المنشورة من مستودع سعودي كورد الرسمي.", "Published versions from the official SaudiCord repository.")}
                </Paragraph>
                <Button variant="link" onClick={() => void loadReleases()} disabled={loading}>
                    {loading
                        ? t("جارٍ الفحص…", "Checking…")
                        : t("تحديث القائمة", "Refresh list")}
                </Button>
            </Flex>

            {loading && releases === null && (
                <Paragraph>{t("جارٍ تحميل الإصدارات من GitHub…", "Loading releases from GitHub…")}</Paragraph>
            )}

            {error && (
                <Card variant="warning">
                    <Paragraph>
                        {t("تعذّر تحميل الإصدارات. تحقق من اتصالك وحاول مجدداً.", "Could not load releases. Check your connection and try again.")}
                    </Paragraph>
                </Card>
            )}

            {releases?.map((release, index) => {
                const installer = release.assets.find(asset => asset.name === "SaudiCord-Setup.exe");
                const title = release.name || release.tag_name;
                const date = release.published_at
                    ? new Date(release.published_at).toLocaleDateString("ar-SA", {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                    })
                    : t("تاريخ النشر غير متاح", "Publication date unavailable");
                const notes = (release.body || "").trim().slice(0, 320);

                return (
                    <Card key={release.id} style={{ gap: 8 }}>
                        <Flex style={{ alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <Span weight="semibold">{title}</Span>
                            <Span color={release.prerelease ? "text-warning" : "text-positive"} size="sm">
                                {release.prerelease
                                    ? t("نسخة تجريبية", "Pre-release")
                                    : release.id === releases.find(item => !item.prerelease)?.id
                                        ? t("أحدث إصدار مستقر", "Latest stable")
                                        : t("مستقر", "Stable")}
                            </Span>
                        </Flex>
                        <Paragraph color="text-subtle">{release.tag_name} · {date}</Paragraph>
                        {notes.length > 0 && (
                            <Paragraph>{notes}{release.body && release.body.length > notes.length ? "…" : ""}</Paragraph>
                        )}
                        <Flex style={{ alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {installer && (
                                <Button
                                    variant="primary"
                                    onClick={() => openExternal(installer.browser_download_url)}
                                >
                                    {t("تنزيل مثبت Windows", "Download Windows installer")}
                                </Button>
                            )}
                            <Button
                                variant="link"
                                onClick={() => openExternal(release.html_url)}
                            >
                                {t("تفاصيل الإصدار", "Release details")}
                            </Button>
                        </Flex>
                    </Card>
                );
            })}

            {!loading && !error && releases?.length === 0 && (
                <Paragraph>{t("لا توجد إصدارات منشورة حالياً.", "There are no published releases yet.")}</Paragraph>
            )}
        </Flex>
    );
}
