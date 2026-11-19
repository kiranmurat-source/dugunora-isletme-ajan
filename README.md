# Düğünora işletme MCP'si

Düğünora'daki işletmeler kendi yapay zeka ajanlarını (Claude, ChatGPT ya da kendi yazdıkları bir ajan) işletme hesaplarına bağlayabilir. Bağlantı [Model Context Protocol](https://modelcontextprotocol.io) (MCP) üzerinden kurulur. Ajan talepleri, teklifleri, takvimi ve fiyatları okur, taslak hazırlar. Çifte giden her şeyi işletme kendisi panelden gönderir.

Bu klasörde:

- `araclar.json`: işlemlerin adı, açıklaması, girdi şeması ve işaretleri. Sunucunun kendi listesinden üretilir, elle düzenlenmez.
- `ornek/`: OAuth ile bağlanıp işlemleri listeleyen ve gündemi okuyan küçük bir TypeScript istemcisi.
- `SECURITY.md`: güvenlik açığı bildirimi.

## Kimler bağlanabilir

- Yapay zeka bağlantısı Plus üyelikte açık.
- Bağlantıyı işletme panelinde hesabı olan bir kişi onaylar ve onay ekranında hangi işletme için bağlandığını seçer. Her bağlantı tek işletmeye aittir.
- Bağlı ajanlar ve yaptıkları işlemler İşletme panelinde **Yapay zeka bağlantıları** ekranında görünür. Bağlantı oradan kesilir, ajanın eklediği kayıtlar oradan geri alınır.

## Bağlanma

Bağlantı adresi İşletme panelinde **Yapay zeka bağlantıları** ekranında yazar (`https://…/mcp/isletme`).

**Claude ya da ChatGPT:** uygulamanın özel MCP bağlayıcısı ekleme bölümüne bu adresi yapıştırın. Uygulama sizi Düğünora onay ekranına götürür; işletmenizi seçip **Bağlan**'a basın. İstemci kaydı otomatik yapılır, ayrıca anahtar almanız gerekmez.

**Kendi ajanınız:** sunucu OAuth 2.1 kullanır.

| | |
|---|---|
| Kaynak bilgisi | `<taban>/.well-known/oauth-protected-resource/mcp/isletme` |
| Sunucu bilgisi | `<taban>/.well-known/oauth-authorization-server` |
| İstemci kaydı | dinamik (RFC 7591), gizli anahtar yok; dönüş adresi https ya da `http://localhost` / `http://127.0.0.1` |
| Yetki akışı | yetkilendirme kodu + PKCE (S256) |
| Kapsam | `isletme` |
| Aktarım | Streamable HTTP, yalnız `POST` |

`ornek/` klasöründeki istemci bu akışın tamamını yapar:

```sh
cd ornek
npm install
npx tsx istemci.ts https://<panelde-gördüğünüz-adres>/mcp/isletme
# başka bir işlem: npx tsx istemci.ts <adres> talep_ac '{"talep_no":"DG-2027-001"}'
```

## Örnek istek

Jeton alındıktan sonra her istek `Authorization: Bearer <jeton>` başlığıyla gider:

```sh
curl -s https://<taban>/mcp/isletme \
  -H "Authorization: Bearer $JETON" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"gundem","arguments":{}}}'
```

Yanıt, bugünkü yanıt bekleyen çift, randevu ve açık görev sayılarını verir.

## İşlemler

Tam liste ve girdi şemaları `araclar.json` içinde. Kısaca:

- **Okuma:** gündem, talep durumu sayıları, tek talebin ayrıntısı, teklifler, takvim ve boş saatler, görevler, anlaşma durumu, yorumlar, sayfa özeti, menü fiyatları, kampanyalar, dönem özeti, üyelik, ekip.
- **Taslak:** mesaj, teklif, yorum yanıtı, sayfa metni ve menü fiyatı. Taslak çifte, yoruma ya da sayfaya gitmez; işletme panelde açıp kendisi gönderir ya da kaydeder.
- **Önizleme + onay:** randevu, not ve takvim günü önce önizleme olarak hazırlanır, kullanıcı açıkça onaylarsa `isletme_onayla` ile kaydedilir.
- **Doğrudan:** görev ekleme ve tamamlama. Panelden geri alınabilir.
- **Temsilci:** Düğünora Ajans ekibinden temsilci isteme.

## Veri kuralları

- Çiftin telefonu ve e-postası hiçbir sonuçta yer almaz.
- Çiftin adı yalnız kısaltılmış (maskeli) döner; serbest metinlerdeki telefon ve e-posta gizlenir. Çift verisi dosya ya da toplu dışa aktarma olarak verilmez.
- Talep kapatma ve kampanyaya katılma yalnız İşletme panelinden yapılır.

## Sınırlar

- Bağlantı başına ve kullanıcı başına dakikalık istek sınırı vardır. Aşılırsa sunucu `429` ve `retry-after` başlığıyla yanıt verir; belirtilen süre kadar bekleyip tekrar deneyin.
- Jetonsuz ya da geçersiz jetonlu istek `401` alır. `www-authenticate` başlığındaki `resource_metadata` adresinden yetki akışı yeniden başlatılır.
- Bağlantı panelden kesilince jeton çalışmaz. Kişinin işletmedeki yetkisi kalkarsa ya da Plus üyelik biterse işlemler hata metniyle döner.
