/*
 * SaudiCord, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { checkCompatibility } from "@api/CommunityPlugins";
import { t } from "@utils/esharqI18n";
import { React, useEffect, useState } from "@webpack/common";

import { Card, NoticeStrip, StatRow, StatusRow } from "./Card";

interface CommunityEntry {
    id: string;
    name: string;
    enabled: boolean;
    externals: string[];
    importedNames?: Record<string, string[]>;
}

interface MatrixRow {
    entry: CommunityEntry;
    report: ReturnType<typeof checkCompatibility>;
}

function native() {
    return (window as any).VencordNative?.communityPlugins;
}

/** Compatibility matrix for imported community plugins. */
export function CompatibilityMatrixPage() {
    const [entries, setEntries] = useState<CommunityEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = async () => {
        setLoading(true);
        setError(null);
        try {
            const api = native();
            if (!api?.list) throw new Error(t("هذه الصفحة متاحة في تطبيق سطح المكتب فقط.", "This page is only available in the desktop app."));
            const result = await api.list();
            setEntries(Array.isArray(result) ? result : []);
        } catch (e: any) {
            setError(String(e?.message ?? e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void refresh(); }, []);

    const rows: MatrixRow[] = entries.map(entry => ({
        entry,
        report: checkCompatibility(entry.externals ?? [], entry.importedNames)
    }));
    const blocked = rows.reduce((sum, row) => sum + row.report.blocked, 0);
    const missing = rows.reduce((sum, row) => sum + row.report.missing + row.report.incomplete, 0);
    const compatible = rows.filter(row => row.report.ok).length;

    return (
        <>
            <Card index={0}
                title={t("جدول توافق إضافات المجتمع", "Community plugin compatibility")}
                subtitle={t("يفحص الوحدات والأسماء التي تحتاجها الإضافات المستوردة مقابل بيئة سعودي كورد الحالية.", "Checks the modules and exported names required by imported plugins against the current SaudiCord runtime.")}
                badge={loading ? t("جارٍ الفحص", "Checking") : t("محدّث", "Up to date")}
                badgeTone={loading ? "info" : "ok"}>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                    <button type="button" onClick={() => void refresh()} disabled={loading}>
                        {t("إعادة الفحص", "Run check again")}
                    </button>
                </div>
                {error !== null && <NoticeStrip tone="danger">{error}</NoticeStrip>}
                <StatRow items={[
                    { label: t("الإضافات المستوردة", "Imported plugins"), value: String(entries.length) },
                    { label: t("متوافقة", "Compatible"), value: String(compatible) },
                    { label: t("وحدات محظورة", "Blocked modules"), value: String(blocked) },
                    { label: t("نواقص", "Missing exports/modules"), value: String(missing) }
                ]} />
                {loading ? (
                    <p>{t("جارٍ قراءة الإضافات…", "Reading plugins…")}</p>
                ) : rows.length === 0 ? (
                    <p>{t("ما فيه إضافات مجتمع مستوردة لفحصها حاليًا.", "There are no imported community plugins to check yet.")}</p>
                ) : rows.map(({ entry, report }, index) => (
                    <div key={entry.id} style={{ marginTop: 16 }}>
                        <StatusRow
                            index={index}
                            title={entry.name}
                            detail={t(
                                `${report.items.length} وحدة خارجية · ${entry.enabled ? "مفعّلة" : "معطّلة"}`,
                                `${report.items.length} external modules · ${entry.enabled ? "enabled" : "disabled"}`
                            )}
                            state={report.ok
                                ? { text: t("متوافق", "Compatible"), tone: "ok" }
                                : { text: t("يحتاج مراجعة", "Review needed"), tone: "danger" }}
                        />
                        {report.items.filter(item => item.status !== "ok" || (item.missingNames?.length ?? 0) > 0).map(item => (
                            <div key={item.specifier} style={{ marginInlineStart: 18, marginTop: 8, fontSize: 12 }}>
                                <strong>{item.specifier}</strong>
                                <div style={{ opacity: 0.7 }}>
                                    {item.reason ?? (item.missingNames?.length
                                        ? t(`أسماء غير متوفرة: ${item.missingNames.join(", ")}`, `Missing exports: ${item.missingNames.join(", ")}`)
                                        : item.status)}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </Card>
            <NoticeStrip>
                {t("التوافق لا يعني أن الإضافة آمنة؛ هذه الصفحة تفحص توفر الوحدات المطلوبة فقط. راجع فحص الحماية ومصدر الإضافة قبل تفعيلها.", "Compatibility does not mean a plugin is safe. This page only checks whether required modules are available. Review the security findings and source before enabling it.")}
            </NoticeStrip>
        </>
    );
}
