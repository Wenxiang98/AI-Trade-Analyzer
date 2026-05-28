package com.aitrade.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

/**
 * Yahoo Finance service for Bursa Malaysia stocks.
 *
 * Flow:
 *   1. Visit finance.yahoo.com/quote/VOO  → capture Set-Cookie headers
 *   2. GET /v1/test/getcrumb (with cookies) → capture crumb + any extra cookies
 *   3. GET /v7/finance/quote?crumb=X       → live quote data
 *
 * Crumb + cookie pair is cached 25 minutes then auto-refreshed.
 *
 * Bursa Malaysia symbol format — use 4-digit numeric Bursa code + ".KL":
 *   5176.KL = Sunway REIT    1155.KL = Maybank
 *   1295.KL = Public Bank    1023.KL = CIMB
 */
@Service
public class YahooFinanceService {

    private static final Logger log = LoggerFactory.getLogger(YahooFinanceService.class);

    // Visit a known stock page (not root) — root often redirects to consent on servers
    private static final String YF_WARMUP  = "https://finance.yahoo.com/quote/VOO";
    private static final String YF_CRUMB   = "https://query1.finance.yahoo.com/v1/test/getcrumb";
    private static final String YF_QUOTE   = "https://query1.finance.yahoo.com/v7/finance/quote";
    private static final String YF_SEARCH  = "https://query1.finance.yahoo.com/v1/finance/search";
    private static final String YF_CHART   = "https://query1.finance.yahoo.com/v8/finance/chart";
    private static final Duration CRUMB_TTL = Duration.ofMinutes(25);

    private static final String USER_AGENT =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        + "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

    private final AtomicReference<String>  storedCookie = new AtomicReference<>("");
    private final AtomicReference<String>  storedCrumb  = new AtomicReference<>("");
    private final AtomicReference<Instant> crumbExpiry  = new AtomicReference<>(Instant.MIN);
    private volatile Mono<String> pendingRefresh = null;

    private final WebClient httpClient;

    public YahooFinanceService() {
        HttpClient netty = HttpClient.create()
                .httpResponseDecoder(spec -> spec.maxHeaderSize(64 * 1024))
                .followRedirect(true)
                .compress(true)   // auto-decompress gzip/deflate (needed for Yahoo Finance chart responses)
                .responseTimeout(Duration.ofSeconds(20));

        this.httpClient = WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(netty))
                .defaultHeader(HttpHeaders.USER_AGENT, USER_AGENT)
                .defaultHeader(HttpHeaders.ACCEPT_LANGUAGE, "en-US,en;q=0.9")
                // Accept-Encoding is set automatically by compress(true) — don't duplicate it
                .build();
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Search for stocks/ETFs by name or ticker.
     * Uses Yahoo Finance's public search endpoint — no cookies/crumb required.
     * Returns up to 6 matches: symbol, name, exchange, type.
     */
    @SuppressWarnings("unchecked")
    public Mono<List<Map<String, Object>>> searchSymbols(String query) {
        String uri = YF_SEARCH + "?q=" + urlEncode(query)
                + "&quotesCount=8&newsCount=0&listsCount=0&enableFuzzyQuery=true";
        return httpClient.get()
                .uri(uri)
                .header(HttpHeaders.ACCEPT, "application/json,*/*")
                .header("Referer", "https://finance.yahoo.com/")
                .retrieve()
                .bodyToMono(Map.class)
                .map(body -> parseSearchResponse((Map<String, Object>) body))
                .onErrorResume(e -> {
                    log.error("Yahoo Finance search failed for {}: {}", query, e.getMessage());
                    return Mono.just(Collections.emptyList());
                });
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseSearchResponse(Map<String, Object> body) {
        try {
            List<Map<String, Object>> quotes = (List<Map<String, Object>>) body.get("quotes");
            if (quotes == null) return Collections.emptyList();
            return quotes.stream()
                    .filter(q -> q.get("symbol") != null)
                    .filter(q -> {
                        String type = (String) q.get("quoteType");
                        return "EQUITY".equals(type) || "ETF".equals(type) || "MUTUALFUND".equals(type);
                    })
                    .map(q -> {
                        Map<String, Object> r = new HashMap<>();
                        r.put("symbol",   q.get("symbol"));
                        r.put("name",     q.getOrDefault("longname", q.getOrDefault("shortname", "")));
                        r.put("exchange", q.getOrDefault("exchDisp", ""));
                        r.put("type",     q.getOrDefault("typeDisp", ""));
                        return r;
                    })
                    .limit(6)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Search parse error: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public Mono<List<Map<String, Object>>> fetchQuotes(List<String> symbols) {
        if (symbols.isEmpty()) return Mono.just(Collections.emptyList());
        return getCrumb()
                .flatMap(crumb -> doFetchQuotes(symbols, crumb))
                .onErrorResume(e -> {
                    log.error("Yahoo Finance fetch failed: {}", e.getMessage());
                    return Mono.just(symbols.stream().map(s -> errorMap(s, e.getMessage())).toList());
                });
    }

    public Mono<Map<String, Object>> fetchQuote(String symbol) {
        return fetchQuotes(List.of(symbol))
                .map(list -> list.isEmpty() ? errorMap(symbol, "No data") : list.get(0));
    }

    // ── Chart data ────────────────────────────────────────────────────────────

    /**
     * Fetch OHLCV + dividend history for the given symbol and time range.
     * range: 1W | 1M | 3M | 6M | 1Y | 5Y
     * Returns: { symbol, currency, candles:[{time,open,high,low,close,volume}], dividends:[{time,amount}] }
     */
    @SuppressWarnings("unchecked")
    public Mono<Map<String, Object>> fetchChartData(String symbol, String range) {
        return getCrumb().flatMap(crumb -> {
            String[] p = rangeToParams(range);
            String uri = YF_CHART + "/" + urlEncode(symbol)
                    + "?interval=" + p[0]
                    + "&range=" + p[1]
                    + "&events=div%2Csplit"
                    + "&crumb=" + urlEncode(crumb);
            return httpClient.get()
                    .uri(uri)
                    .header(HttpHeaders.ACCEPT, "application/json,*/*")
                    .header("Referer", "https://finance.yahoo.com/")
                    .header("Cookie", storedCookie.get())
                    .retrieve()
                    .bodyToMono(Map.class)
                    .map(body -> parseChartResponse((Map<String, Object>) body, symbol))
                    .onErrorResume(e -> {
                        log.error("Chart fetch failed for {}: {}", symbol, e.getMessage());
                        return Mono.just(Map.of("error", e.getMessage() != null ? e.getMessage() : "Fetch failed"));
                    });
        }).onErrorResume(e -> {
            log.error("Chart crumb error for {}: {}", symbol, e.getMessage());
            return Mono.just(Map.of("error", "Auth failed: " + e.getMessage()));
        });
    }

    private String[] rangeToParams(String range) {
        return switch (range == null ? "" : range.toUpperCase()) {
            case "1W" -> new String[]{"1d",  "5d"};
            case "1M" -> new String[]{"1d",  "1mo"};
            case "3M" -> new String[]{"1d",  "3mo"};
            case "1Y" -> new String[]{"1d",  "1y"};
            case "5Y" -> new String[]{"1wk", "5y"};
            default   -> new String[]{"1d",  "6mo"};  // 6M
        };
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseChartResponse(Map<String, Object> body, String symbol) {
        try {
            Map<String, Object> chart = (Map<String, Object>) body.get("chart");
            if (chart == null) return Map.of("error", "No chart object in response");
            List<Map<String, Object>> results = (List<Map<String, Object>>) chart.get("result");
            if (results == null || results.isEmpty()) return Map.of("error", "No data for " + symbol);

            Map<String, Object> result = results.get(0);
            Map<String, Object> meta   = (Map<String, Object>) result.get("meta");
            String currency = meta != null ? (String) meta.getOrDefault("currency", "MYR") : "MYR";

            List<Number> timestamps = (List<Number>) result.get("timestamp");
            if (timestamps == null || timestamps.isEmpty()) return Map.of("error", "Empty timestamp array");

            Map<String, Object> indic = (Map<String, Object>) result.get("indicators");
            List<Map<String, Object>> quoteList = (List<Map<String, Object>>) indic.get("quote");
            Map<String, Object> q = quoteList.get(0);

            List<Number> opens   = (List<Number>) q.get("open");
            List<Number> highs   = (List<Number>) q.get("high");
            List<Number> lows    = (List<Number>) q.get("low");
            List<Number> closes  = (List<Number>) q.get("close");
            List<Number> volumes = (List<Number>) q.get("volume");

            List<Map<String, Object>> candles = new ArrayList<>();
            for (int i = 0; i < timestamps.size(); i++) {
                if (closes == null || i >= closes.size() || closes.get(i) == null) continue;
                Map<String, Object> candle = new HashMap<>();
                candle.put("time",   timestamps.get(i).longValue());
                candle.put("open",   round(toDouble(opens  != null && i < opens.size()   ? opens.get(i)   : null)));
                candle.put("high",   round(toDouble(highs  != null && i < highs.size()   ? highs.get(i)   : null)));
                candle.put("low",    round(toDouble(lows   != null && i < lows.size()    ? lows.get(i)    : null)));
                candle.put("close",  round(toDouble(closes.get(i))));
                candle.put("volume", volumes != null && i < volumes.size() && volumes.get(i) != null
                        ? volumes.get(i).longValue() : 0L);
                candles.add(candle);
            }

            // Parse dividends
            List<Map<String, Object>> dividends = new ArrayList<>();
            Map<String, Object> events = (Map<String, Object>) result.get("events");
            if (events != null) {
                Map<String, Object> divMap = (Map<String, Object>) events.get("dividends");
                if (divMap != null) {
                    for (Object val : divMap.values()) {
                        Map<String, Object> div = (Map<String, Object>) val;
                        Map<String, Object> d = new HashMap<>();
                        d.put("time",   ((Number) div.get("date")).longValue());
                        d.put("amount", round(toDouble(div.get("amount"))));
                        dividends.add(d);
                    }
                    dividends.sort(Comparator.comparingLong(d -> (Long) d.get("time")));
                }
            }

            Map<String, Object> response = new HashMap<>();
            response.put("symbol",    symbol);
            response.put("currency",  currency);
            response.put("candles",   candles);
            response.put("dividends", dividends);
            return response;

        } catch (Exception e) {
            log.error("Chart parse error for {}: {}", symbol, e.getMessage());
            return Map.of("error", "Parse error: " + e.getMessage());
        }
    }

    // ── Cookie / crumb lifecycle ───────────────────────────────────────────────

    private Mono<String> getCrumb() {
        if (!storedCrumb.get().isEmpty() && Instant.now().isBefore(crumbExpiry.get())) {
            return Mono.just(storedCrumb.get());
        }
        return refreshCrumb();
    }

    private synchronized Mono<String> refreshCrumb() {
        if (!storedCrumb.get().isEmpty() && Instant.now().isBefore(crumbExpiry.get())) {
            return Mono.just(storedCrumb.get());
        }
        if (pendingRefresh != null) return pendingRefresh;

        log.info("Refreshing Yahoo Finance cookie + crumb...");
        pendingRefresh = warmupSession()
                .flatMap(this::fetchCrumb)
                .doFinally(sig -> pendingRefresh = null)
                .cache();
        return pendingRefresh;
    }

    /**
     * Visit a specific Yahoo Finance stock page to obtain session cookies.
     * Using /quote/VOO is more reliable than the root URL on server environments
     * (the root often redirects to a GDPR consent page on non-browser clients).
     */
    private Mono<String> warmupSession() {
        return httpClient.get()
                .uri(YF_WARMUP)
                .header(HttpHeaders.ACCEPT, "text/html,application/xhtml+xml,*/*;q=0.8")
                .header("Sec-Fetch-Dest", "document")
                .header("Sec-Fetch-Mode", "navigate")
                .header("Sec-Fetch-Site", "none")
                .exchangeToMono(response -> {
                    String cookie = extractCookies(response.headers()
                            .asHttpHeaders()
                            .getOrDefault(HttpHeaders.SET_COOKIE, Collections.emptyList()));
                    storedCookie.set(cookie);
                    log.debug("Warmup cookies: {}", cookie.isEmpty() ? "(none)" : cookie);
                    return response.releaseBody().thenReturn(cookie);
                })
                .onErrorResume(e -> {
                    log.warn("Yahoo Finance warmup failed: {} — using cached cookie", e.getMessage());
                    return Mono.just(storedCookie.get());
                });
    }

    /**
     * GET /v1/test/getcrumb.  Also captures any extra cookies set in this response
     * and merges them with the session cookies for subsequent requests.
     */
    private Mono<String> fetchCrumb(String sessionCookie) {
        return httpClient.get()
                .uri(YF_CRUMB)
                .header(HttpHeaders.ACCEPT, "text/plain,*/*")
                .header("Referer", "https://finance.yahoo.com/")
                .header("Cookie", sessionCookie)
                .exchangeToMono(response -> {
                    // Merge any new cookies set by the crumb endpoint
                    List<String> extra = response.headers()
                            .asHttpHeaders()
                            .getOrDefault(HttpHeaders.SET_COOKIE, Collections.emptyList());
                    if (!extra.isEmpty()) {
                        String merged = mergeCookies(sessionCookie, extractCookies(extra));
                        storedCookie.set(merged);
                        log.debug("Crumb endpoint added {} extra cookies", extra.size());
                    }
                    return response.bodyToMono(String.class);
                })
                .filter(crumb -> crumb != null && !crumb.isBlank())
                .doOnNext(crumb -> {
                    storedCrumb.set(crumb);
                    crumbExpiry.set(Instant.now().plus(CRUMB_TTL));
                    log.info("Yahoo Finance crumb refreshed (valid 25 min)");
                })
                .switchIfEmpty(Mono.error(new RuntimeException("Empty crumb — Yahoo Finance session failed")))
                .onErrorResume(e -> {
                    log.error("Failed to fetch crumb: {}", e.getMessage());
                    return Mono.error(new RuntimeException("Yahoo Finance auth failed: " + e.getMessage()));
                });
    }

    // ── Quote fetch ────────────────────────────────────────────────────────────

    /**
     * Fetch quotes, with automatic single retry on 401.
     * Yahoo Finance crumbs can expire before the 25-min TTL on Railway.
     * On 401: clear stored crumb, re-run the full warmup+crumb flow, retry once.
     */
    private Mono<List<Map<String, Object>>> doFetchQuotes(List<String> symbols, String crumb) {
        return fetchQuotesWithCrumb(symbols, crumb)
                .onErrorResume(e -> {
                    if (e.getMessage() != null && e.getMessage().contains("401")) {
                        log.warn("Yahoo Finance 401 — crumb expired, forcing refresh and retrying once");
                        storedCrumb.set("");
                        return refreshCrumb()
                                .flatMap(newCrumb -> fetchQuotesWithCrumb(symbols, newCrumb));
                    }
                    return Mono.error(e);
                });
    }

    @SuppressWarnings("unchecked")
    private Mono<List<Map<String, Object>>> fetchQuotesWithCrumb(List<String> symbols, String crumb) {
        String symbolParam = String.join(",", symbols);
        String cookie = storedCookie.get();

        String uri = YF_QUOTE
                + "?symbols=" + symbolParam
                + "&crumb=" + urlEncode(crumb)
                + "&fields=regularMarketPrice,regularMarketChange,"
                + "regularMarketChangePercent,regularMarketTime,longName,financialCurrency";

        return httpClient.get()
                .uri(uri)
                .header(HttpHeaders.ACCEPT, "application/json,*/*")
                .header("Referer", "https://finance.yahoo.com/")
                .header("Cookie", cookie)
                .retrieve()
                .bodyToMono(Map.class)
                .map(body -> parseQuoteResponse((Map<String, Object>) body, symbols))
                .onErrorResume(e -> {
                    log.error("Yahoo Finance quote failed: {}", e.getMessage());
                    return Mono.error(e);
                });
    }

    // ── Response parsing ───────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseQuoteResponse(Map<String, Object> body,
                                                          List<String> requested) {
        try {
            Map<String, Object> qr = (Map<String, Object>) body.get("quoteResponse");
            if (qr == null) return errorList(requested, "No quoteResponse");

            List<Map<String, Object>> results = (List<Map<String, Object>>) qr.get("result");
            if (results == null || results.isEmpty()) return errorList(requested, "Empty result");

            List<Map<String, Object>> parsed = new ArrayList<>();
            for (Map<String, Object> item : results) {
                String sym = (String) item.get("symbol");
                Object ts  = item.get("regularMarketTime");
                if (ts != null) {
                    Instant dataTime = Instant.ofEpochSecond(((Number) ts).longValue());
                    if (Instant.now().minus(Duration.ofDays(7)).isAfter(dataTime)) {
                        log.warn("{}: stale data from {} — use numeric Bursa code (e.g. 5176.KL)", sym, dataTime);
                        parsed.add(errorMap(sym, "Stale data — use numeric Bursa code e.g. 5176.KL"));
                        continue;
                    }
                }
                parsed.add(toStandardMap(item));
            }
            return parsed;
        } catch (Exception e) {
            log.error("Parse error: {}", e.getMessage());
            return errorList(requested, "Parse error");
        }
    }

    private Map<String, Object> toStandardMap(Map<String, Object> item) {
        String sym      = (String) item.getOrDefault("symbol", "");
        String name     = (String) item.getOrDefault("longName", sym);
        double price    = toDouble(item.get("regularMarketPrice"));
        double change   = toDouble(item.get("regularMarketChange"));
        double chgPct   = toDouble(item.get("regularMarketChangePercent"));
        String currency = (String) item.getOrDefault("financialCurrency", "MYR");

        Map<String, Object> out = new HashMap<>();
        out.put("symbol",    sym);
        out.put("name",      name);
        out.put("price",     round(price));
        out.put("change",    round(change));
        out.put("changePct", round(chgPct));
        out.put("currency",  currency);
        return out;
    }

    // ── Cookie helpers ─────────────────────────────────────────────────────────

    /** Parse Set-Cookie header values into a single "name=value; name2=value2" string. */
    private String extractCookies(List<String> setCookieHeaders) {
        return setCookieHeaders.stream()
                .map(sc -> sc.split(";")[0].trim())
                .filter(p -> p.contains("="))
                .collect(Collectors.joining("; "));
    }

    /** Merge two cookie strings, giving precedence to the newer values. */
    private String mergeCookies(String existing, String newer) {
        if (existing.isEmpty()) return newer;
        if (newer.isEmpty()) return existing;

        // Build a map from existing, then overwrite with newer
        Map<String, String> map = new LinkedHashMap<>();
        parseCookieString(existing).forEach(map::put);
        parseCookieString(newer).forEach(map::put);

        return map.entrySet().stream()
                .map(e -> e.getKey() + "=" + e.getValue())
                .collect(Collectors.joining("; "));
    }

    private Map<String, String> parseCookieString(String cookieStr) {
        Map<String, String> map = new LinkedHashMap<>();
        for (String pair : cookieStr.split(";")) {
            pair = pair.trim();
            int eq = pair.indexOf('=');
            if (eq > 0) map.put(pair.substring(0, eq).trim(), pair.substring(eq + 1).trim());
        }
        return map;
    }

    // ── News ──────────────────────────────────────────────────────────────────

    /**
     * Fetch latest news headlines for a symbol.
     * Reuses the public YF_SEARCH endpoint with newsCount=N, quotesCount=0 — no crumb needed.
     * Returns a list of { title, publisher, link, time } maps.
     */
    @SuppressWarnings("unchecked")
    public Mono<List<Map<String, Object>>> fetchNews(String symbol, int count) {
        String uri = YF_SEARCH + "?q=" + urlEncode(symbol)
                + "&newsCount=" + count + "&quotesCount=0&listsCount=0";
        log.info("Fetching news for {}: {}", symbol, uri);

        return httpClient.get()
                .uri(uri)
                .header(HttpHeaders.ACCEPT, "application/json,*/*")
                .header("Referer", "https://finance.yahoo.com/")
                .retrieve()
                .bodyToMono(Map.class)
                .map(raw -> {
                    try {
                        List<Map<String, Object>> newsList =
                                (List<Map<String, Object>>) raw.get("news");
                        if (newsList == null) return List.<Map<String, Object>>of();
                        return newsList.stream()
                                .filter(n -> n.get("title") != null)
                                .map(n -> {
                                    Map<String, Object> item = new HashMap<>();
                                    item.put("title",     n.getOrDefault("title", ""));
                                    item.put("publisher", n.getOrDefault("publisher", ""));
                                    item.put("link",      n.getOrDefault("link", ""));
                                    item.put("time",      n.getOrDefault("providerPublishTime", 0));
                                    return (Map<String, Object>) item;
                                })
                                .limit(count)
                                .collect(Collectors.toList());
                    } catch (Exception e) {
                        log.error("News parse error for {}: {}", symbol, e.getMessage());
                        return List.<Map<String, Object>>of();
                    }
                })
                .onErrorResume(e -> {
                    log.error("News fetch error for {}: {}", symbol, e.getMessage());
                    return Mono.just(List.of());
                });
    }

    // ── Misc helpers ───────────────────────────────────────────────────────────

    private double toDouble(Object val) {
        if (val == null) return 0.0;
        try { return ((Number) val).doubleValue(); }
        catch (ClassCastException e) {
            try { return Double.parseDouble(val.toString()); } catch (NumberFormatException ex) { return 0.0; }
        }
    }

    private double round(double v) { return Math.round(v * 100.0) / 100.0; }

    private Map<String, Object> errorMap(String symbol, String msg) {
        return Map.of("symbol", symbol, "error", msg != null ? msg : "Unknown error");
    }

    private List<Map<String, Object>> errorList(List<String> symbols, String msg) {
        return symbols.stream().map(s -> errorMap(s, msg)).toList();
    }

    private String urlEncode(String s) {
        try { return java.net.URLEncoder.encode(s, "UTF-8"); }
        catch (Exception e) { return s; }
    }
}
