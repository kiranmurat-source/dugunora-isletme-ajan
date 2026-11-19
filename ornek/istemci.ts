// Düğünora işletme MCP'sine bağlanan küçük örnek istemci (OAuth 2.1 + PKCE, dinamik istemci kaydı).
// Çalıştırma: npm install && npx tsx istemci.ts https://<panelde-gördüğünüz-adres>/mcp/isletme [işlem] [girdi-json]
// Örnek: npx tsx istemci.ts https://…/mcp/isletme talep_ac '{"talep_no":"DG-2027-001"}'  (işlem verilmezse gundem)
// Jeton yalnız bellekte tutulur; program kapanınca bağlantı yeniden onaylanır.
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientInformationMixed, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

const ADRES = new URL(process.argv[2] ?? "");
const PORT = 8976;
const DONUS = `http://127.0.0.1:${PORT}/geri`;

let istemciBilgisi: OAuthClientInformationMixed | undefined;
let jetonlar: OAuthTokens | undefined;
let dogrulayici = "";
const DURUM = randomBytes(16).toString("base64url"); // dönüşte aynısı beklenir (CSRF)

const saglayici: OAuthClientProvider = {
  redirectUrl: DONUS,
  state: () => DURUM,
  clientMetadata: { client_name: "Örnek işletme ajanı", redirect_uris: [DONUS], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" },
  clientInformation: () => istemciBilgisi,
  saveClientInformation: (b) => { istemciBilgisi = b; },
  tokens: () => jetonlar,
  saveTokens: (j) => { jetonlar = j; },
  redirectToAuthorization: (u) => { console.log(`\nBu adresi tarayıcıda açın, işletmenizi seçip "Bağlan"a basın:\n${u.href}\n`); },
  saveCodeVerifier: (v) => { dogrulayici = v; },
  codeVerifier: () => dogrulayici,
};

// Onay ekranından dönen kodu yerel adreste bekler.
function kodBekle(): Promise<string> {
  return new Promise((coz, reddet) => {
    const s = createServer((istek, yanit) => {
      const u = new URL(istek.url ?? "/", DONUS);
      if (u.pathname !== "/geri") { yanit.writeHead(404).end(); return; }
      // state uymayan istek (başka sekme vb.) akışı bitirmez; gerçek dönüş beklenmeye devam eder.
      if (u.searchParams.get("state") !== DURUM) { yanit.writeHead(400).end(); return; }
      const kod = u.searchParams.get("code");
      yanit.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end(kod ? "Bağlantı tamam, bu sekmeyi kapatabilirsiniz." : "Bağlantı onaylanmadı.");
      s.close();
      if (kod) coz(kod); else reddet(new Error(u.searchParams.get("error") ?? "kod yok"));
    }).listen(PORT, "127.0.0.1");
  });
}

async function bagla(): Promise<Client> {
  const istemci = new Client({ name: "ornek-isletme-ajani", version: "1.0.0" });
  try {
    await istemci.connect(new StreamableHTTPClientTransport(ADRES, { authProvider: saglayici }));
    return istemci;
  } catch (e) {
    if (!(e instanceof UnauthorizedError)) throw e;
  }
  const tasiyici = new StreamableHTTPClientTransport(ADRES, { authProvider: saglayici });
  await tasiyici.finishAuth(await kodBekle());
  const yeni = new Client({ name: "ornek-isletme-ajani", version: "1.0.0" });
  await yeni.connect(new StreamableHTTPClientTransport(ADRES, { authProvider: saglayici }));
  return yeni;
}

const istemci = await bagla();
const { tools } = await istemci.listTools();
console.log("İşlemler:", tools.map((t) => t.name).join(", "));
const islem = process.argv[3] ?? "gundem";
const sonuc = await istemci.callTool({ name: islem, arguments: JSON.parse(process.argv[4] ?? "{}") as Record<string, unknown> });
console.log(`${islem}:`, JSON.stringify(sonuc.structuredContent));
await istemci.close();
