/*
 * SaudiCord Developers Page
 * Copyright notices for upstream projects remain in NOTICE.md and LICENSE files.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./developers.css";

import { OwnerCrownIcon } from "@components/Icons";
import { ChannelActionCreators, IconUtils, RestAPI, Toasts, UserStore, useEffect, useState } from "@webpack/common";

const OWNER_ID = "1457893719121596619";
const CDN = "https://cdn.discordapp.com";

interface DeveloperUser {
    id: string;
    username?: string;
    globalName?: string | null;
    global_name?: string | null;
    avatar?: string | null;
    discriminator?: string;
    getAvatarURL?: (guildId?: string | null, size?: number, canAnimate?: boolean) => string;
}

function getCachedOwner(): DeveloperUser | null {
    try {
        const current = UserStore.getCurrentUser() as DeveloperUser | undefined;
        if (current?.id === OWNER_ID) return current;
        return (UserStore.getUser(OWNER_ID) as DeveloperUser | undefined) ?? null;
    } catch {
        return null;
    }
}

function getAvatar(user: DeveloperUser): string {
    try {
        if (typeof user.getAvatarURL === "function")
            return user.getAvatarURL(null, 128, true);
    } catch { /* use the CDN fallback */ }

    if (user.avatar) {
        const extension = user.avatar.startsWith("a_") ? "gif" : "png";
        return `${CDN}/avatars/${user.id}/${user.avatar}.${extension}?size=128`;
    }

    return IconUtils.getDefaultAvatarURL(user.id, user.discriminator);
}

function showToast(message: string, type: string) {
    Toasts.show({ type, message, id: Toasts.genId() });
}

export function DevelopersPage() {
    const [developer, setDeveloper] = useState<DeveloperUser | null>(() => getCachedOwner());
    const [loading, setLoading] = useState(developer === null);
    const [busy, setBusy] = useState<"message" | "friend" | null>(null);

    useEffect(() => {
        if (getCachedOwner()) return;
        let active = true;

        RestAPI.get({ url: `/users/${OWNER_ID}` })
            .then((user: DeveloperUser) => {
                if (active && user?.id === OWNER_ID) setDeveloper(user);
            })
            .catch(() => {
                if (active) showToast("تعذّر تحميل بيانات المطوّر من ديسكورد.", Toasts.Type.FAILURE);
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => { active = false; };
    }, []);

    const openMessage = async () => {
        setBusy("message");
        try {
            await ChannelActionCreators.openPrivateChannel(OWNER_ID);
        } catch {
            showToast("تعذّر فتح المحادثة مع المطوّر.", Toasts.Type.FAILURE);
        } finally {
            setBusy(null);
        }
    };

    const sendFriendRequest = async () => {
        const current = UserStore.getCurrentUser();
        if (current?.id === OWNER_ID) {
            showToast("هذا حسابك الحالي؛ لا يمكنك إرسال طلب صداقة لنفسك.", Toasts.Type.MESSAGE);
            return;
        }

        setBusy("friend");
        try {
            await RestAPI.put({
                url: `/users/@me/relationships/${OWNER_ID}`,
                body: { type: 1 }
            });
            showToast("تم إرسال طلب الصداقة.", Toasts.Type.SUCCESS);
        } catch {
            showToast("تعذّر إرسال طلب الصداقة. قد يكون الطلب موجوداً بالفعل أو أن إعدادات الخصوصية تمنعه.", Toasts.Type.FAILURE);
        } finally {
            setBusy(null);
        }
    };

    const displayName = developer?.globalName ?? developer?.global_name ?? developer?.username ?? "المطوّر";
    const username = developer?.username ? `@${developer.username}` : "جارٍ تحميل اسم المستخدم…";

    return (
        <div className="saudicord-devs">
            <section className="saudicord-devs-card" aria-label="المطوّر">
                <div className="saudicord-devs-profile">
                    <div className="saudicord-devs-avatar-wrap">
                        {developer
                            ? <img className="saudicord-devs-avatar" src={getAvatar(developer)} alt="" />
                            : <div className="saudicord-devs-avatar saudicord-devs-avatar-placeholder" />}
                    </div>
                    <div className="saudicord-devs-identity">
                        <div className="saudicord-devs-name">
                            <span>{loading && !developer ? "جارٍ التحميل…" : displayName}</span>
                            <OwnerCrownIcon width={18} height={18} />
                        </div>
                        <div className="saudicord-devs-username">{username}</div>
                        <div className="saudicord-devs-role">مؤسس ومطوّر سعودي كورد</div>
                    </div>
                </div>

                <div className="saudicord-devs-actions">
                    <button type="button" onClick={openMessage} disabled={busy !== null}>
                        {busy === "message" ? "جارٍ الفتح…" : "رسالة"}
                    </button>
                    <button type="button" className="primary" onClick={sendFriendRequest} disabled={busy !== null}>
                        {busy === "friend" ? "جارٍ الإرسال…" : "طلب صداقة"}
                    </button>
                </div>
            </section>

            <section className="saudicord-devs-credits">
                <div className="saudicord-devs-credits-heading">
                    <h2>حقوق النشر</h2>
                    <p>سعودي كورد مشروع مشتق يجمع أعمالاً وتعديلات من مشاريع مفتوحة المصدر.</p>
                </div>

                <div className="saudicord-devs-credit-row">
                    <div><strong>SaudiCord</strong><span>تعديلات سعودي كورد وواجهته</span></div>
                    <small>xxm-cmyk</small>
                </div>
                <div className="saudicord-devs-credit-row">
                    <div><strong>Esharq</strong><span>الأعمال الأصلية والتعريب والواجهات والإضافات</span></div>
                    <small>LOSTSTR</small>
                </div>
                <div className="saudicord-devs-credit-row">
                    <div><strong>Equicord</strong><span>المشروع الأساسي ومساهماته</span></div>
                    <small>Equicord contributors</small>
                </div>
                <div className="saudicord-devs-credit-row">
                    <div><strong>Vencord</strong><span>الأساس البرمجي والمساهمات الأصلية</span></div>
                    <small>Vendicated and contributors</small>
                </div>

                <p className="saudicord-devs-legal">
                    تبقى حقوق أصحاب المشاريع وترويسات ملفاتهم وتراخيصهم محفوظة كما هي.
                    راجع ملفات NOTICE.md وLICENSE وTRADEMARK.md في المستودع للاطلاع على
                    الإسناد الكامل وشروط الاستخدام والتوزيع.
                </p>
            </section>
        </div>
    );
}
