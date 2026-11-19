/*
 * SaudiCord community extension security inspection.
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { AcceptedFile } from "./validate";

export interface SecurityFinding {
    severity: "error" | "warning";
    rule: string;
    file: string;
    line: number;
    message: string;
    hint: string;
}

interface Rule {
    id: string;
    severity: SecurityFinding["severity"];
    pattern: RegExp;
    message: string;
    hint: string;
}

const RULES: readonly Rule[] = [
    {
        id: "credential-access",
        severity: "error",
        pattern: /(?:localStorage\s*\.\s*(?:getItem\s*\(\s*["'`][^"'`]*(?:token|auth|session)[^"'`]*["'`]|token\b)|sessionStorage\s*\.\s*getItem\s*\(\s*["'`][^"'`]*(?:token|auth)[^"'`]*["'`]|\bgetToken\s*\(\s*\)|webpackChunkdiscord_app)/i,
        message: "محاولة الوصول إلى رمز الحساب أو واجهة وحدات Discord الداخلية.",
        hint: "أزل أي قراءة مباشرة لرموز الدخول أو واجهات استخراجها."
    },
    {
        id: "cookie-access",
        severity: "error",
        pattern: /\bdocument\s*\.\s*cookie\b|\bcookieStore\s*\./i,
        message: "محاولة قراءة ملفات تعريف الارتباط التي قد تحتوي على بيانات جلسة.",
        hint: "لا تقرأ ملفات الارتباط أو بيانات جلسات تسجيل الدخول."
    },
    {
        id: "privileged-runtime",
        severity: "error",
        pattern: /(?:\bwindow\s*\.\s*require\s*\(|\brequire\s*\(\s*["'`]electron["'`]\s*\)|\bprocess\s*\.\s*(?:env|versions|mainModule)\b|\bipcRenderer\b|\bremote\s*\.\s*(?:require|app|process)\b)/i,
        message: "محاولة الوصول إلى واجهات العملية الأصلية أو جسر Electron من إضافة واجهة.",
        hint: "إضافات المجتمع تعمل في واجهة Discord ولا تحتاج واجهات Electron أو Node."
    },
    {
        id: "dynamic-execution",
        severity: "error",
        pattern: /\b(?:eval|Function)\s*\(|new\s+Function\s*\(|\bimport\s*\(\s*(?!["'`])/,
        message: "تنفيذ شيفرة ديناميكية أو استيراد بمسار محسوب؛ يصعب مراجعته والتحقق منه.",
        hint: "استخدم واردات ثابتة ومصدرًا واضحًا يمكن مراجعته."
    },
    {
        id: "native-process",
        severity: "error",
        pattern: /(?:from\s*["'`](?:node:)?(?:child_process|fs|net|dgram|worker_threads)["'`]|require\s*\(\s*["'`](?:node:)?(?:child_process|fs|net|dgram|worker_threads)["'`])/,
        message: "محاولة استيراد واجهات نظام أو عمليات أصلية غير متاحة لإضافة واجهة.",
        hint: "احذف استيرادات Node والعمليات الأصلية من إضافة المجتمع."
    },
    {
        id: "network-egress",
        severity: "warning",
        pattern: /\bfetch\s*\(|\bXMLHttpRequest\b|new\s+WebSocket\s*\(|\bnavigator\s*\.\s*sendBeacon\s*\(/,
        message: "الإضافة تتضمن اتصالًا شبكيًا؛ راجع الوجهة والبيانات المرسلة قبل التفعيل.",
        hint: "تحقق من نطاق الاتصال وسبب إرسال البيانات. لا تشغّل الإضافة إن لم تثق بالمصدر."
    },
    {
        id: "obfuscated-payload",
        severity: "warning",
        pattern: /\batob\s*\(|String\.fromCharCode\s*\(\s*(?:\d+\s*,\s*){8,}|(?:\\x[0-9a-f]{2}){12,}/i,
        message: "وجدت صيغة ترميز قد تُستخدم لإخفاء محتوى الشيفرة.",
        hint: "اكتب المنطق بصيغة مقروءة وراجع النص المفكوك يدويًا."
    }
];

function stripComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, block => block.replace(/[^\n]/g, " "))
        .split("\n")
        .map(line => line.replace(/(^|[^:])\/\/.*$/, "$1"))
        .join("\n");
}

/**
 * Static inspection only: this is a risk filter, not a sandbox or proof of safety.
 * Critical credential/dynamic/native-process patterns block import; network and
 * obfuscation patterns remain visible warnings for human review.
 */
export function inspectCommunityFiles(files: readonly AcceptedFile[]): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    for (const file of files) {
        if (!file.code) continue;
        const source = stripComments(file.text);
        for (const rule of RULES) {
            const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`;
            const pattern = new RegExp(rule.pattern.source, flags);
            for (const match of source.matchAll(pattern)) {
                const line = source.slice(0, match.index ?? 0).split("\n").length;
                findings.push({
                    severity: rule.severity,
                    rule: rule.id,
                    file: file.path,
                    line,
                    message: rule.message,
                    hint: rule.hint
                });
            }
        }
    }
    return findings;
}
