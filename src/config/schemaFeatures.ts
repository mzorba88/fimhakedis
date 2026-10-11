/**
 * Veritabanı alanı özellik anahtarları.
 * Kolonlar (contracts.price_basis, contracts.value_status, hakedisler.plan_links)
 * canlı veritabanına 2026-10-10 eklendi (PROMPT_3D).
 */

/** Aşama 3E: sözleşmelerde price_basis / value_status okunur ve YAZILIR. */
export const CONTRACT_AGREEMENT_FIELDS_ENABLED = true;

/**
 * Aşama 4A: yeni hakediş ekranı (/hakedis-yeni) götürü aşama bağlantılarını yazar.
 * Yalnızca planLinks açıkça verilen kayıtlarda yazılır; eski formlar bu alanı göndermez.
 * NOT: aşım kontrolü tarayıcıda yapılır, veritabanında atomik kontrol yoktur.
 */
export const PLAN_LINKS_WRITE_ENABLED = true;

/** Aşama 4B: ancak hakedisler.alelhesap_nature migration doğrulandıktan sonra true yapılır. */
export const ALELHESAP_NATURE_WRITE_ENABLED = false;

/** Migration + sunucu doğrulaması yapılana kadar yeni aşama bağlantıları ve kesin hesap kaydı kapalı. */
export const PLAN_LINKS_ATOMIC_GUARD_ENABLED = false;
export const FINAL_SETTLEMENT_ATOMIC_GUARD_ENABLED = false;
