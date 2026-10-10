# Güvenlik Durumu (PROMPT_3C-1 kararı)

Karar: Kişisel hesaplı yeni giriş sistemine ve rol bazlı veritabanı politikalarına şimdilik GEÇİLMEYECEK. Mevcut rol kartlı giriş ekranı ve rol şifreleri kullanılmaya devam ediyor.

## Hâlâ AÇIK olan güvenlik açıkları (çözülmedi)
1. Rol şifreleri tarayıcıya gönderilen kodun içinde açık metin olarak duruyor; uygulamayı açabilen herkes bu şifreleri görebilir.
2. Giriş kontrolü yalnızca tarayıcıda yapılıyor; oturum bilgisi tarayıcı oturum deposunda duruyor ve elle değiştirilebilir.
3. Tüm tablolarda herkese açık erişim kuralı ("Allow all access") var: genel erişim anahtarını bilen herkes, veritabanı arayüzü üzerinden giriş yapmadan kayıtları okuyabilir, değiştirebilir ve silebilir.
4. Roller (Direktör / Muhasebe / Şantiye Yöneticisi) yalnızca ekranda uygulanıyor; veritabanı tarafında doğrulanmıyor.
5. İşlem geçmişindeki kullanıcı/rol bilgisi tarayıcıdan geliyor; sahte kayıt girilebilir.
6. Ödeme aşaması aşım kontrolü (mükerrer tahakkuk) yalnızca uygulamada yapılıyor.

## Gelecekteki geçişi kolaylaştıran yapı
- Tüm veritabanı erişimi tek bir servis katmanından geçiyor (rol kontrolleri ileride oraya ve veritabanı kurallarına taşınabilir).
- Rol isimleri tek bir tür tanımında; ileride ayrı bir kullanıcı-rol tablosuna eşlenebilir.
- Yeni kolonlar mevcut tablo kurallarını devralır; erişim kurallarında değişiklik yapılmadı.
