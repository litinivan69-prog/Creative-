import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function privateAddress(address: string) {
  if (address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(address)) return false;
  const [a, b] = address.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

async function safeUrl(raw: string) {
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(candidate);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error("Укажите обычную ссылку на сайт.");
  if (url.hostname === "localhost" || isIP(url.hostname) && privateAddress(url.hostname)) throw new Error("Этот адрес нельзя проверить.");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => privateAddress(address))) throw new Error("Этот адрес нельзя проверить.");
  return url;
}

function decode(value: string) {
  return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\s+/g, " ").trim();
}

function content(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decode(match[1].replace(/<[^>]+>/g, " "));
  }
  return "";
}

async function fetchPage(initial: URL) {
  let url = initial;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, { redirect: "manual", headers: { "User-Agent": "Ribes brand setup/1.0" }, signal: AbortSignal.timeout(12000) });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Сайт не открылся.");
      url = await safeUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error("Сайт не открылся.");
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/html")) throw new Error("По ссылке нет страницы сайта.");
    return { html: (await response.text()).slice(0, 750_000), url };
  }
  throw new Error("Сайт перенаправляет слишком много раз.");
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { website?: string };
    const initial = await safeUrl(String(body.website ?? "").trim());
    const { html, url } = await fetchPage(initial);
    const title = content(html, [/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["'][^>]*>/i, /<title[^>]*>([\s\S]*?)<\/title>/i]);
    const description = content(html, [/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["'][^>]*>/i, /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*>/i]);
    const heading = content(html, [/<h1[^>]*>([\s\S]*?)<\/h1>/i]);
    const brandName = title.split(/\s+[|—–-]\s+/)[0]?.trim().slice(0, 160) || url.hostname.replace(/^www\./, "");
    const businessDescription = description.slice(0, 1000);
    const priorityOffer = (heading || description.split(/[.!?]/)[0] || "").slice(0, 700);
    if (!brandName && !businessDescription && !priorityOffer) throw new Error("На сайте не удалось найти описание. Заполните три коротких поля вручную.");
    return NextResponse.json({ ok: true, website: url.toString(), brandName, businessDescription, priorityOffer });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Не удалось прочитать сайт." }, { status: 400 });
  }
}
