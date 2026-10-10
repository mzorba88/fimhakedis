/**
 * Veritabanı şeması özellik anahtarları.
 *
 * Kolonlar canlı veritabanına 2026-10-10 eklendi; anahtar bilinçli olarak KAPALI.
 * SCHEMA_3B_APPLIED: docs/asama3b-migration-taslagi.sql canlı veritabanına
 * UYGULANDIĞINDA true yapılmalıdır. false iken uygulama yeni kolonlara
 * (contracts.price_basis, contracts.value_status, hakedisler.plan_links)
 * HİÇBİR ŞEY YAZMAZ; okurken de yoklarsa sorunsuz çalışır.
 */
export const SCHEMA_3B_APPLIED = false;
