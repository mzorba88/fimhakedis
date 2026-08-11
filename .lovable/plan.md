# Altyüklenici Cari Hesap Sistemi

Amaç: Aynı proje + aynı altyüklenici için girilen alelhesap, ara hakediş ve kesin hesap kayıtlarının tek bir hesap defterinde toplanması; mükerrer ödemenin engellenmesi; kesin hesapta önceki ödemelerin otomatik mahsubu.

Yapısal olarak veritabanını baştan kurmaya gerek yok. Mevcut tablolar korunuyor; eksik olan **birleşik cari hesap görünümü** ve **mahsup mantığı** ekleniyor.

## 1. İş Dosyası (Cari Hesap) kavramı

Her altyüklenici + proje çifti bir "iş dosyası" olarak ele alınır. Sözleşmeli ve sözleşmesiz (küçük iş) kayıtlar aynı dosyada toplanır; sözleşmesiz kayıtlar "Sözleşmesiz İşler" grubu altında gösterilir (kayıt girişinde zorunluluk getirilmez).

Dosya başlığında tek bakışta:

```text
ALTYÜKLENİCİ: MEHMET SEZER   PROJE: P-010 Villa Projesi        [TRY]
Sözleşme tutarı        1.000.000   (KDV dahil 1.200.000)
Toplam hakediş           720.000   (KDV dahil   864.000)
  - Ara hakediş          500.000
  - Alelhesap            220.000   <- mahsup edilecek
  - Kesin hesap                0
Ödenen                   650.000   (KDV dahil   780.000)
Onaylı ama ödenmemiş      70.000
Sözleşmeye kalan         280.000            [Kalanı tek tıkla kapat]
```

## 2. Hakediş tiplerinin netleşmesi

- **Alelhesap**: avans niteliğinde, üretime bağlı değil. Cari hesapta ayrı satır; kesin hesapta düşülür.
- **Ara hakediş**: dönemsel üretim (birim fiyat metrajı veya götürü dilim).
- **Kesin hesap**: dosyayı kapatır. Girişte toplam üretim tutarı hesaplanır ve mahsup tablosu otomatik gelir:

```text
Toplam üretim (metraj x birim fiyat)      950.000
(-) Önceki ara hakedişler                -500.000
(-) Önceki alelhesap ödemeleri           -220.000
= Bu kesin hesapta ödenecek               230.000   [düzenlenebilir]
```

Rakamlar otomatik hesaplanır, kullanıcı isterse üzerine yazabilir; elle değiştirilirse "otomatik hesaplanandan farklı" uyarısı çıkar (engellemez).

Bir dosyada kesin hesap varsa, aynı dosyaya yeni hakediş eklenmek istendiğinde uyarı verilir.

## 3. Mükerrer giriş koruması

Yeni hakediş kaydedilirken aynı altyüklenici + proje + (varsa) sözleşme için:
- Yakın tarihli ve aynı tutarlı kayıt varsa "Benzer kayıt mevcut" uyarısı gösterilir (kaydetmeyi engellemez).
- Birim fiyat kalemlerinde sözleşme metrajı aşılıyorsa kümülatif miktar uyarısı gösterilir (mevcut kümülatif altyapı kullanılır).

## 4. Kalanı tek tıkla kapatma

Cari hesap kartındaki **"Kalanı Kapat"** butonu, sözleşmenin kalan bakiyesi kadar bir hakediş kaydı oluşturur (tip seçimi: ara hakediş / kesin hesap), açıklaması otomatik doldurulur ve normal onay akışına girer. Onay sonrası ödeme işlemi her zamanki gibi Ödemeler sayfasından yapılır.

## 5. Ekranlar

- **Altyükleniciler sayfası**: mevcut kartlar, iş dosyası formatına göre yeniden düzenlenir; her dosyanın altında tüm hareketler tek zaman çizelgesinde listelenir (tarih, tip, no, açıklama, tutar, ödenen, bakiye — yürüyen bakiye kolonu ile).
- **Hakediş formu**: seçilen altyüklenici + proje için üst kısımda özet şerit (sözleşme, önceki hakedişler, alelhesap, ödenen, kalan).
- **Raporlar**: mevcut altyüklenici PDF/Excel raporuna hareket dökümü ve mahsup özeti eklenir.

## Teknik notlar

- `src/utils/contractAccounting.ts` genişletilir: sözleşmesiz kayıtları da kapsayan `getSubcontractorProjectLedger()` (tip kırılımı, yürüyen bakiye, mahsup hesabı). Para birimi bazında ayrım korunur, KDV dahil/hariç ikili gösterim sürer.
- Şema değişikliği gerekmez; `hakedis_type`, `paid_amount`, `payment_status` alanları yeterli. Tek olası ekleme: kesin hesapta mahsup edilen tutarın kaydı için `hakedisler.offset_amount` (numeric, opsiyonel) — mahsubun raporda izlenebilmesi için.
- Değişen dosyalar: `src/utils/contractAccounting.ts`, `src/pages/Subcontractors.tsx`, `src/pages/SubcontractorHakedis.tsx`, `src/components/MultiProjectHakedisDialog.tsx`, `src/utils/pdfGenerator.ts`, `src/utils/excelExport.ts`.
- Mevcut veri korunur; hiçbir kayıt silinmez veya taşınmaz.
