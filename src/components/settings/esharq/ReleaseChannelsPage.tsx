/*
 * SaudiCord, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Link } from "@components/Link";
import { t } from "@utils/esharqI18n";
import { getRepo } from "@utils/updater";
import { React, useEffect, useState } from "@webpack/common";

import gitHash from "~git-hash";

import { Card, NoticeStrip, StatRow } from "./Card";

export function ReleaseChannelsPage() {
    const [repo, setRepo] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let active = true;
        void getRepo().then(value => {
            if (active) setRepo(value);
        }).catch(() => {
            if (active) setError(true);
        });
        return () => { active = false; };
    }, []);

    const repoName = repo?.split("/").slice(-2).join("/") ?? "xxm-cmyk/SaudiCord";

    return (
        <>
            <Card index={0}
                title={t("قنوات إصدار سعودي كورد", "SaudiCord release channels")}
                subtitle={t("تعرف على مصدر نسختك وروابط الإصدارات الرسمية.", "See your build source and the official release streams.")}>
                <StatRow items={[
                    { label: t("النسخة الحالية", "Current build"), value: gitHash },
                    { label: t("المستودع", "Repository"), value: repoName },
                    { label: t("حالة المصدر", "Source status"), value: error ? t("غير متاح", "Unavailable") : repo ? t("تم التحقق", "Resolved") : t("جارٍ التحميل", "Loading") }
                ]} />
                <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
                    <div>
                        <strong>{t("المستقر", "Stable")}</strong>
                        <p style={{ opacity: 0.7, margin: "5px 0 8px" }}>
                            {t("الإصدارات المنشورة والمناسبة للاستخدام اليومي.", "Published releases intended for everyday use.")}
                        </p>
                        <Link href="https://github.com/xxm-cmyk/SaudiCord/releases">{t("عرض الإصدارات الرسمية", "Browse official releases")}</Link>
                    </div>
                    <div>
                        <strong>{t("التطوير والمعاينة", "Development / Preview")}</strong>
                        <p style={{ opacity: 0.7, margin: "5px 0 8px" }}>
                            {t("تغييرات أحدث قد تحتوي على أخطاء، وهي موجهة للاختبار.", "Newer changes may contain bugs and are intended for testing.")}
                        </p>
                        <Link href="https://github.com/xxm-cmyk/SaudiCord/commits/main">{t("عرض سجل التطوير", "Browse development commits")}</Link>
                    </div>
                </div>
            </Card>
            <NoticeStrip tone="danger">
                {t("هذه الصفحة تعرض قنوات المصدر فقط؛ لا تبدّل قناة التحديث أو تثبّت نسخة أخرى تلقائيًا. استخدم مُثبّت الإصدار الذي تريده، وخذ نسخة احتياطية قبل الانتقال بين نسخ الاختبار والمستقرة.", "This page describes the release streams only. It does not switch update channels or install another build. Use the installer for the version you want, and back up your data before moving between preview and stable builds.")}
            </NoticeStrip>
        </>
    );
}
