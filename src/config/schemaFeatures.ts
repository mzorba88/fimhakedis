/**
 * Veritabanı alanı özellik anahtarları.
 * Kolonlar (contracts.price_basis, contracts.value_status, hakedisler.plan_links)
 * canlı veritabanına 2026-10-10 eklendi (PROMPT_3D).
 */

/** Aşama 3E: sözleşmelerde price_basis / value_status okunur ve YAZILIR. */
export const CONTRACT_AGREEMENT_FIELDS_ENABLED = true;

/** Aşama 4'te yeni hakediş formuyla açılacak. false iken hakedisler.plan_links'e HİÇ yazılmaz. */
export const PLAN_LINKS_WRITE_ENABLED = false;
