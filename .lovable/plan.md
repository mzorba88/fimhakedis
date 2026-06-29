
# Plan: Yüklenici ödeme takibi ve kesin hesap kolaylığı

Yapısal büyük bir değişiklik gerekmiyor. Veri modeline dokunmadan, mevcut ekranlara dört odaklı iyileştirme yapacağız. Tüm hesaplar mevcut `workEntries` (sözleşmeler) ve `subcontractorHakedisler` üzerinden türetilecek; yeni tablo/şema yok.

## 1) Altyükleniciler sayfasında "Proje Bazlı Cari Hesap" kartları
`src/pages/Subcontractors.tsx`

Seçili yüklenici detayında, mevcut iki tablonun (Sözleşmeler / Hakedişler) üstüne **proje bazlı kart grid'i** eklenecek. Aynı yüklenicinin birden çok projedeki durumu tek bakışta görülecek.

Her proje + para birimi kombinasyonu için bir kart:
- Proje adı, iş kalemi
- **Sözleşme Tutarı** (o projedeki tüm sözleşmelerin toplamı)
- **Onaylanan Hakediş** (ara + alelhesap + kesin hesap, onay durumu = onaylandı)
- **Ödenen** (`paidAmount` toplamı + `paymentStatus='odendi'` olanların `totalAmount`'u)
- **Kalan Ödenecek** = Onaylanan − Ödenen
- **Sözleşmeye Kalan** = Sözleşme − Onaylanan Hakediş
- Fazla ödeme durumunda kırmızı bilgilendirici rozet (engelleme YOK, sadece görsel)
- Kart tıklanınca aşağıdaki tablolar o projeye filtrelenir

Mevcut "SummaryBox" toplam özetin yanında kalır.

## 2) Hakediş formuna "Sözleşme Özet Paneli"
`src/pages/SubcontractorHakedis.tsx` — yeni/düzenleme dialog'unun en üstüne

Sözleşme seçildiği anda yukarıya yapışık bir bilgi paneli açılır:

```text
Bu sözleşmede şimdiye kadar
─────────────────────────────────────────────────
Sözleşme tutarı       :  1.000.000 ₺
Önceki hakedişler (4) :    620.000 ₺  (ara 3, alelhesap 1)
Önceki ödemeler       :    580.000 ₺
─────────────────────────────────────────────────
Onay bekleyen kalan   :     40.000 ₺
Sözleşmeye kalan       :    380.000 ₺   ← kesin hesapta net olarak görülür
```

- Düzenleme modunda mevcut hakediş hariç tutulur (kendi tutarını iki kez saymasın).
- "Kesin Hesap" tipi seçilirse panel başlığı **"Kesin Hesap Özeti"** olur; "Sözleşmeye Kalan" satırı vurgulu gösterilir ve form footer'ında "Önceki ödemeler düşülmüş kalan: X" satırı görünür.
- Bilgilendirici renkler kullanılır; hiçbir alan disable edilmez, kaydetme engellenmez.

## 3) Birim fiyat kalemlerinde kümülatif metraj + "Kalanı getir"
`src/pages/SubcontractorHakedis.tsx` — hakediş kalem tablosu

Her kalem satırına iki yeni read-only kolon eklenir, türetilmiş değerler:
- **Sözleşme Metrajı** (`contract.workItemEntries[i].quantity`)
- **Şimdiye Kadar Yapılan** (önceki hakedişlerin aynı `workItemEntryId` için `quantity` toplamı; düzenleme modunda mevcut kayıt hariç)
- **Kalan** = Sözleşme − Şimdiye Kadar

Kullanıcı sadece "Bu Hakediş Miktarı" sütununu girer. Yanına **"Kalanı getir"** butonu eklenir → `quantity = kalan` olarak doldurulur. Tablonun üstünde tek tıkla **"Tüm kalemler için kalanı getir"** butonu (özellikle kesin hesap için).

Kalemde "Kalan"ı aşan giriş kırmızı renkle vurgulanır ama bloklanmaz.

## 4) Hakediş listesinde sözleşme bazlı gruplama göstergesi
`src/pages/SubcontractorHakedis.tsx` — mevcut tablonun üstü

Filtre olarak bir sözleşme seçildiğinde, tablonun üstünde mini bir çubuk gösterilir:
```text
Sözleşme #2025-014 · ABC Yüklenici · A Projesi
Sözleşme 1.000.000 ₺ · Onaylanan 620.000 ₺ · Ödenen 580.000 ₺ · Kalan 380.000 ₺
```
Böylece hakediş eklerken bile sözleşme cari durumu görünür kalır.

## Teknik notlar (ihtiyaç olursa)

- Yeni yardımcı dosya: `src/utils/contractAccounting.ts`
  - `getContractAccount(contractId, allHakedisler, excludeHakedisId?)` → `{ contractTotal, approvedTotal, paidTotal, remainingApproved, remainingContract, byCurrency }`
  - `getCumulativeWorkItemQuantities(contractId, allHakedisler, excludeHakedisId?)` → `Map<workItemEntryId, number>`
  - Bütün hesaplar para birimi bazında yapılır; karışık para birimi durumunda kart başına bir para birimi.
- Hiçbir veri tabanı / şema değişikliği yok; mevcut Zustand store'dan beslenir.
- PDF/Excel raporları değişmiyor (sonra istenirse cari hesap kartları rapora da eklenebilir).
- Engelleyici fazla ödeme kontrolü yok — kullanıcı tercihi gereği sadece bilgilendirme.

## Etkilenen dosyalar
- `src/pages/Subcontractors.tsx` — proje bazlı cari hesap kart grid'i
- `src/pages/SubcontractorHakedis.tsx` — özet panel, kümülatif kolonlar, "kalanı getir" butonları, sözleşme bilgi çubuğu
- `src/utils/contractAccounting.ts` — yeni yardımcı (türetilmiş hesaplar)
