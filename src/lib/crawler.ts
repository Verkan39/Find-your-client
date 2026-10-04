import * as cheerio from "cheerio";
import dns from "node:dns/promises";
import net from "node:net";
import type { CrawlResult, Socials } from "./types";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 FindYourClient/0.1";

const SOCIAL_HOSTS: [keyof Socials, RegExp][] = [
  ["instagram", /(?:^|\.)instagram\.com$/i],
  ["facebook", /(?:^|\.)(facebook\.com|fb\.com|fb\.me)$/i],
  ["linkedin", /(?:^|\.)linkedin\.com$/i],
  ["youtube", /(?:^|\.)(youtube\.com|youtu\.be)$/i],
  ["tiktok", /(?:^|\.)tiktok\.com$/i],
  ["x", /(?:^|\.)(twitter\.com|x\.com)$/i],
  ["whatsapp", /(?:^|\.)(wa\.me|whatsapp\.com|api\.whatsapp\.com)$/i],
  ["pinterest", /(?:^|\.)pinterest\.[a-z.]+$/i],
];

/** Fingerprints checked against raw HTML. Order matters only for display. */
const TECH: [string, RegExp][] = [
  ["WordPress", /wp-content|wp-includes/i],
  ["WooCommerce", /woocommerce/i],
  ["Elementor", /elementor/i],
  ["Wix", /wix\.com|wixstatic|_wixCssImports/i],
  ["Squarespace", /squarespace/i],
  ["Shopify", /cdn\.shopify\.com|Shopify\.theme/i],
  ["Webflow", /webflow/i],
  ["GoDaddy Builder", /godaddy|img1\.wsimg\.com/i],
  ["Weebly", /weebly/i],
  ["Joomla", /\/media\/jui\/|joomla/i],
  ["Drupal", /drupal/i],
  ["Next.js", /__NEXT_DATA__|\/_next\/static/i],
  ["React", /data-reactroot|react-dom/i],
  ["Vue", /data-v-[a-f0-9]{6,}|vue(\.min)?\.js/i],
  ["Angular", /ng-version=/i],
  ["Bootstrap", /bootstrap(\.min)?\.(css|js)/i],
  ["jQuery", /jquery[.-]?(\d[\d.]*)?(\.min)?\.js/i],
  ["Google Sites", /sites\.google\.com/i],
  ["Framer", /framerusercontent|framer\.com/i],
];

const ANALYTICS: [string, RegExp][] = [
  ["Google Analytics", /gtag\(|google-analytics\.com|googletagmanager\.com\/gtag/i],
  ["Google Tag Manager", /googletagmanager\.com\/gtm|GTM-[A-Z0-9]+/i],
  ["Meta Pixel", /fbq\(|connect\.facebook\.net\/.*fbevents/i],
  ["Hotjar", /hotjar/i],
  ["Microsoft Clarity", /clarity\.ms/i],
  ["Plausible", /plausible\.io/i],
];

const BOOKING: [string, RegExp][] = [
  ["Calendly", /calendly\.com/i],
  ["OpenTable", /opentable\./i],
  ["Resy", /resy\.com/i],
  ["Fresha", /fresha\.com/i],
  ["Booksy", /booksy\.com/i],
  ["Setmore", /setmore\.com/i],
  ["SimplyBook", /simplybook/i],
  ["Square Appointments", /squareup\.com\/appointments|square\.site\/book/i],
  ["Acuity", /acuityscheduling/i],
  ["Practo", /practo\.com/i],
  ["Zocdoc", /zocdoc/i],
  ["Mindbody", /mindbody/i],
  ["Booking.com", /booking\.com/i],
  ["Zomato", /zomato\.com/i],
  ["Swiggy", /swiggy\.com/i],
  ["Uber Eats", /ubereats\.com/i],
  ["DoorDash", /doordash\.com/i],
  ["Deliveroo", /deliveroo\./i],
  ["Toast", /toasttab\.com/i],
  ["Native booking form", /(book|reserve)\s*(an?\s*)?(appointment|table|now|online|session|consultation)/i],
];

const ECOMMERCE: [string, RegExp][] = [
  ["Cart / checkout", /add[\s-]?to[\s-]?cart|\/cart\b|checkout/i],
  ["Razorpay", /razorpay/i],
  ["Stripe", /js\.stripe\.com/i],
  ["PayPal", /paypal\.com\/sdk|paypalobjects/i],
];

const CHAT: [string, RegExp][] = [
  ["WhatsApp button", /wa\.me\/|api\.whatsapp\.com\/send/i],
  ["Tawk.to", /tawk\.to/i],
  ["Intercom", /intercom/i],
  ["Crisp", /crisp\.chat/i],
  ["Tidio", /tidio/i],
  ["Zendesk", /zdassets|zendesk/i],
];

const EMPTY = (url: string): CrawlResult => ({
  ok: false, requestedUrl: url, https: url.startsWith("https://"), pagesCrawled: [], hasViewport: false,
  hasOpenGraph: false, jsonLdTypes: [], tech: [], analytics: [], booking: [], ecommerce: [], chat: [],
  socials: {}, emails: [], phones: [], hasContactForm: false, imagesWithoutAlt: 0, imagesTotal: 0,
  wordCount: 0, textSample: "", pageHeadings: [],
});

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.");
}

/** Websites come from crowd-sourced map data, so refuse anything that resolves to a private network. */
async function assertPublic(url: URL) {
  if (!/^https?:$/.test(url.protocol)) throw new Error("Unsupported protocol");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Refusing private host");
  const addrs = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((a) => a.address);
  if (addrs.some(isPrivateIp)) throw new Error("Refusing private address");
}

async function fetchPage(url: string, timeoutMs = 15_000) {
  let current = new URL(url);
  const started = Date.now();
  for (let hop = 0; hop < 6; hop++) {
    await assertPublic(current);
    const res = await fetch(current, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en" },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current);
      continue;
    }
    const type = res.headers.get("content-type") ?? "";
    const html = type.includes("html") || type === "" ? (await res.text()).slice(0, 2_000_000) : "";
    return { html, status: res.status, finalUrl: current.toString(), ms: Date.now() - started };
  }
  throw new Error("Too many redirects");
}

function humanError(e: unknown): string {
  const err = e as { name?: string; message?: string; cause?: { code?: string } };
  const code = err?.cause?.code ?? err?.message ?? "";
  if (err?.name === "TimeoutError") return "the site took too long to respond (timed out)";
  if (/ENOTFOUND|EAI_AGAIN/.test(code)) return "the domain no longer resolves (it may have expired)";
  if (/ECONNREFUSED/.test(code)) return "the server refused the connection";
  if (/CERT|SSL|TLS/i.test(code)) return "its security certificate is invalid";
  if (/ECONNRESET|socket/i.test(code)) return "the connection was dropped";
  if (/private/i.test(code)) return "it points to a private network address";
  return err?.message ? `it failed to load (${err.message})` : "it failed to load";
}

const uniq = <T,>(a: T[]) => [...new Set(a)];

function analyse(html: string, pageUrl: string, acc: CrawlResult, isHome: boolean) {
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);

  for (const [name, re] of TECH) if (re.test(html)) acc.tech.push(name);
  const generator = $('meta[name="generator"]').attr("content");
  if (generator) acc.tech.push(generator.split(/[;,]/)[0].trim().slice(0, 40));
  for (const [name, re] of ANALYTICS) if (re.test(html)) acc.analytics.push(name);
  for (const [name, re] of BOOKING) if (re.test(html)) acc.booking.push(name);
  for (const [name, re] of ECOMMERCE) if (re.test(html)) acc.ecommerce.push(name);
  for (const [name, re] of CHAT) if (re.test(html)) acc.chat.push(name);

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const items = Array.isArray(data) ? data : data["@graph"] ?? [data];
      for (const it of items) {
        const t = it?.["@type"];
        if (t) acc.jsonLdTypes.push(...(Array.isArray(t) ? t : [t]).map(String));
      }
    } catch {}
  });

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")!.trim();
    if (href.startsWith("mailto:")) {
      const e = href.slice(7).split("?")[0].trim();
      if (e) acc.emails.push(decodeURIComponent(e).toLowerCase());
      return;
    }
    if (href.startsWith("tel:")) {
      acc.phones.push(href.slice(4).replace(/[^\d+]/g, ""));
      return;
    }
    try {
      const u = new URL(href, base);
      for (const [k, re] of SOCIAL_HOSTS) {
        if (re.test(u.hostname) && !acc.socials[k]) {
          const path = u.pathname.replace(/\/+$/, "");
          if (k === "whatsapp" || (path && !/^\/(sharer|share|intent|plugins|dialog|tr)\b/i.test(path))) {
            acc.socials[k] = u.toString();
          }
        }
      }
    } catch {}
  });

  const textEmails = $("body").text().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];
  acc.emails.push(...textEmails.map((e) => e.toLowerCase()).filter((e) => !/\.(png|jpg|jpeg|webp|gif|svg)$/.test(e) && !e.includes("sentry")));

  if ($("form").filter((_, f) => $(f).find('input[type="email"], textarea, input[name*="phone" i]').length > 0).length) {
    acc.hasContactForm = true;
  }
  const imgs = $("img");
  acc.imagesTotal += imgs.length;
  acc.imagesWithoutAlt += imgs.filter((_, i) => !($(i).attr("alt") ?? "").trim()).length;

  const yearMatches = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1]));
  const validYears = yearMatches.filter((y) => y > 1995 && y <= new Date().getFullYear() + 1);
  if (validYears.length) acc.copyrightYear = Math.max(acc.copyrightYear ?? 0, ...validYears);

  acc.pageHeadings.push(...$("h1, h2").map((_, h) => $(h).text().replace(/\s+/g, " ").trim()).get().filter((t) => t && t.length < 120).slice(0, 8));

  $("script, style, noscript, svg, iframe").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  acc.wordCount += text ? text.split(" ").length : 0;
  if (acc.textSample.length < 6000) acc.textSample += (acc.textSample ? "\n\n" : "") + `[${base.pathname}] ` + text.slice(0, 2500);

  if (isHome) {
    acc.title = $("title").first().text().trim().slice(0, 200) || undefined;
    acc.metaDescription = $('meta[name="description"]').attr("content")?.trim().slice(0, 400) || undefined;
    acc.hasViewport = $('meta[name="viewport"]').length > 0;
    acc.hasOpenGraph = $('meta[property^="og:"]').length > 0;
    acc.language = $("html").attr("lang") || undefined;
  }
  return $;
}

const INTERESTING = /(about|contact|menu|service|treatment|book|appointment|pricing|price|rates|shop|product|team|doctor|courses|rooms|gallery|reservation|order)/i;

/** Crawl the homepage plus up to 4 of the most informative internal pages. */
export async function crawlSite(url: string): Promise<CrawlResult> {
  const acc = EMPTY(url);
  try {
    const home = await fetchPage(url);
    acc.status = home.status;
    acc.finalUrl = home.finalUrl;
    acc.https = home.finalUrl.startsWith("https://");
    acc.loadMs = home.ms;
    acc.htmlBytes = home.html.length;
    if (home.status >= 400 || !home.html) {
      acc.error = home.status >= 500 ? `the server returns an error (HTTP ${home.status})` : `the page returns HTTP ${home.status}`;
      return acc;
    }
    acc.ok = true;
    acc.pagesCrawled.push(home.finalUrl);
    const $ = analyse(home.html, home.finalUrl, acc, true);

    const origin = new URL(home.finalUrl).origin;
    const links = uniq(
      $("a[href]")
        .map((_, a) => {
          try {
            const u = new URL($(a).attr("href")!, home.finalUrl);
            u.hash = "";
            return u.origin === origin && INTERESTING.test(u.pathname) && !/\.(pdf|jpg|png|zip)$/i.test(u.pathname) ? u.toString() : null;
          } catch {
            return null;
          }
        })
        .get()
        .filter(Boolean) as string[],
    ).filter((u) => u !== home.finalUrl).slice(0, 4);

    const pages = await Promise.allSettled(links.map((l) => fetchPage(l, 12_000)));
    pages.forEach((p, i) => {
      if (p.status === "fulfilled" && p.value.status < 400 && p.value.html) {
        acc.pagesCrawled.push(links[i]);
        analyse(p.value.html, p.value.finalUrl, acc, false);
      }
    });
  } catch (e) {
    acc.error = humanError(e);
  }

  acc.tech = uniq(acc.tech);
  acc.analytics = uniq(acc.analytics);
  acc.booking = uniq(acc.booking);
  acc.ecommerce = uniq(acc.ecommerce);
  acc.chat = uniq(acc.chat);
  acc.jsonLdTypes = uniq(acc.jsonLdTypes);
  acc.emails = uniq(acc.emails).slice(0, 5);
  acc.phones = uniq(acc.phones.filter((p) => p.length >= 7)).slice(0, 5);
  acc.pageHeadings = uniq(acc.pageHeadings).slice(0, 16);
  return acc;
}
