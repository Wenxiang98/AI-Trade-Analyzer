package com.aitrade.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Yahoo Finance service for Bursa Malaysia stocks.
 *
 * Yahoo Finance requires a cookie + crumb pair to access their quote API.
 * This service maintains that session transparently by:
 *   1. Visiting finance.yahoo.com to obtain session cookies
 *   2. Calling /v1/test/getcrumb with those cookies to get the crumb token
 *   3. Caching cookie + crumb for 25 minutes, then refreshing
 *
 * Symbol format for Bursa Malaysia:
 *   Use the 4-digit Bursa numeric code + ".KL"
 *   Examples: 5176.KL (Sunway REIT), 1155.KL (Maybank), 1295.KL (Public Bank)
 *   Name-based symbols (e.g. MAYBANK.KL) are unreliable in Yahoo Finance — use numeric codes.
 */
@Service
public class YahooFinanceService {

    private static final Logger log = LoggerFactory.getLogger(YahooFinanceService.class);

    private static final String YF_HOME    = "https://finance.yahoo.com";
    private static final String YF_CRUMB   = "https://query1.finance.yahoo.com/v1/test/getcrumb";
    private static final String YF_QUOTE   = "https://query1.finance.yahoo.com/v7/finance/quote";
    private static final Duration CRUMB_TTL = Duration.ofMinutes(25);
    private static final String USER_AGENT =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        + "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

    // Shared cookie+crumb state (refreshed reactively when stale)
    private final AtomicReference<String> storedCookie = new AtomicReference<>("");
    private final AtomicReference<String> storedCrumb  = new AtomicReference<>("");
    private final AtomicReference<Instant> crumbExpiry = new AtomicReference<>(Instant.MIN);

    // volatile Mono so concurrent callers can share the single in-flight refresh
    private volatile Mono<String> pendingRefresh = null;

    private final WebClient httpClient;

    public YahooFinanceService() {
        // Increase Netty header buffer to 64 KB — Yahoo Finance sends large headers
        HttpClient netty = HttpClient.create()
                .httpResponseDecoder(spec -> spec.maxHeaderSize(64 * 1024))
                .followRedirect(true)
                .responseTimeout(Duration.ofSeconds(15));

        this.httpClient = WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(netty))
                .defaultHeader(HttpHeaders.USER_AGENT, USER_AGENT)
                .defaultHeader(HttpHeaders.ACCEPT, "*/*")
                .defaultHeader(HttpHeaders.ACCEPT_LANGUAGE, "en-US,en;q=0.9")
                .build();
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Fetch quotes for a list of Bursa Malaysia symbols (e.g. ["5176.KL","1155.KL"]).
     * Returns a list of maps with keys: symbol, name, price, change, changePct, currency.
     */
    public Mono<List<Map<String, Object>>> fetchQuotes(List<String> symbols) {
        if (symbols.isEmpty()) return Mono.just(Collections.emptyList());

        return getCrumb()
                .flatMap(crumb -> doFetchQuotes(symbols, crumb))
                .onErrorResume(e -> {
                    log.error("Yahoo Finance fetch failed: {}", e.getMessage());
                    // Return error maps for all requested symbols
                    List<Map<String, Object>> errors = symbols.stream()
                            .map(s -> errorMap(s, e.getMessage()))
                            .toList();
                    return Mono.just(errors);
                });
    }

    public Mono<Map<String, Object>> fetchQuote(String symbol) {
        return fetchQuotes(List.of(symbol))
                .map(list -> list.isEmpty() ? errorMap(symbol, "No data") : list.get(0));
    }

    // ── Cookie / crumb management ──────────────────────────────────────────────

    private Mono<String> getCrumb() {
        if (!storedCrumb.get().isEmpty() && Instant.now().isBefore(crumbExpiry.get())) {
            return Mono.just(storedCrumb.get());
        }
        return refreshCrumb();
    }

    private synchronized Mono<String> refreshCrumb() {
        // Double-check inside synchronized block
        if (!storedCrumb.get().isEmpty() && Instant.now().isBefore(crumbExpiry.get())) {
            return Mono.just(storedCrumb.get());
        }
        if (pendingRefresh != null) return pendingRefresh;

        log.info("Refreshing Yahoo Finance cookie + crumb...");

        pendingRefresh = visitHomepage()
                .flatMap(cookie -> fetchCrumb(cookie))
                .doFinally(sig -> pendingRefresh = null)
                .cache();   // replay result to concurrent subscribers

        return pendingRefresh;
    }

    /**
     * GET finance.yahoo.com/  — captures the Set-Cookie header, discards the body
     * to avoid buffering the 2+ MB HTML page.
     */
    private Mono<String> visitHomepage() {
        return httpClient.get()
                .uri(YF_HOME + "/")
                .header(HttpHeaders.ACCEPT, "text/html,application/xhtml+xml,*/*")
                .exchangeToMono(response -> {
                    List<String> setCookies = response.headers()
                            .asHttpHeaders()
                            .getOrDefault(HttpHeaders.SET_COOKIE, Collections.emptyList());

                    // Build a Cookie header from the Set-Cookie values
                    String cookie = setCookies.stream()
                            .map(sc -> sc.split(";")[0].trim())   // "name=value" part only
                            .filter(p -> p.contains("="))
                            .reduce("", (a, b) -> a.isEmpty() ? b : a + "; " + b);

                    storedCookie.set(cookie);
                    log.debug("Yahoo Finance cookies captured ({} cookies)", setCookies.size());

                    // Release body without buffering it
                    return response.releaseBody().thenReturn(cookie);
                })
                .onErrorResume(e -> {
                    log.warn("Yahoo Finance homepage visit failed: {}", e.getMessage());
                    return Mono.just(storedCookie.get()); // use last-known cookie
                });
    }

    /**
     * GET /v1/test/getcrumb using the cookie obtained from the homepage visit.
     */
    private Mono<String> fetchCrumb(String cookie) {
        return httpClient.get()
                .uri(YF_CRUMB)
                .header("Cookie", cookie)
                .retrieve()
                .bodyToMono(String.class)
                .doOnNext(crumb -> {
                    storedCrumb.set(crumb);
                    crumbExpiry.set(Instant.now().plus(CRUMB_TTL));
                    log.info("Yahoo Finance crumb obtained: {} (valid for 25 min)", crumb);
                })
                .onErrorResume(e -> {
                    log.error("Failed to fetch Yahoo Finance crumb: {}", e.getMessage());
                    return Mono.error(new RuntimeException("Could not obtain Yahoo Finance crumb"));
                });
    }

    // ── Quote fetch ────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Mono<List<Map<String, Object>>> doFetchQuotes(List<String> symbols, String crumb) {
        String symbolParam = String.join(",", symbols);
        String cookie = storedCookie.get();

        return httpClient.get()
                .uri(YF_QUOTE + "?symbols=" + symbolParam + "&crumb=" + urlEncode(crumb)
                        + "&fields=regularMarketPrice,regularMarketChange,"
                        + "regularMarketChangePercent,regularMarketTime,longName,financialCurrency")
                .header("Cookie", cookie)
                .retrieve()
                .bodyToMono(Map.class)
                .map(body -> parseQuoteResponse((Map<String, Object>) body, symbols))
                .onErrorResume(e -> {
                    log.error("Yahoo Finance quote request failed: {}", e.getMessage());
                    // On auth error, force crumb refresh next time
                    if (e.getMessage() != null && e.getMessage().contains("401")) {
                        storedCrumb.set("");
                    }
                    return Mono.error(e);
                });
    }

    // ── Response parsing ───────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseQuoteResponse(Map<String, Object> body,
                                                          List<String> requestedSymbols) {
        try {
            Map<String, Object> quoteResponse = (Map<String, Object>) body.get("quoteResponse");
            if (quoteResponse == null) return errorList(requestedSymbols, "No quoteResponse");

            List<Map<String, Object>> results =
                    (List<Map<String, Object>>) quoteResponse.get("result");
            if (results == null || results.isEmpty()) {
                return errorList(requestedSymbols, "Empty result");
            }

            // Check if data is stale (>7 days old) — Yahoo Finance sometimes returns old data
            List<Map<String, Object>> parsed = new ArrayList<>();
            for (Map<String, Object> item : results) {
                String sym = (String) item.get("symbol");
                Object marketTime = item.get("regularMarketTime");
                if (marketTime != null) {
                    long epochSec = ((Number) marketTime).longValue();
                    Instant dataTime = Instant.ofEpochSecond(epochSec);
                    if (Instant.now().minus(Duration.ofDays(7)).isAfter(dataTime)) {
                        log.warn("{}: Yahoo Finance data is stale (from {}). "
                                + "Use the 4-digit Bursa code + .KL (e.g. 5176.KL)", sym, dataTime);
                        parsed.add(errorMap(sym, "Stale data — use numeric Bursa code (e.g. 5176.KL)"));
                        continue;
                    }
                }
                parsed.add(toStandardMap(item));
            }
            return parsed;

        } catch (Exception e) {
            log.error("Error parsing Yahoo Finance response: {}", e.getMessage());
            return errorList(requestedSymbols, "Parse error: " + e.getMessage());
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

    // ── Helpers ────────────────────────────────────────────────────────────────

    private double toDouble(Object val) {
        if (val == null) return 0.0;
        try { return ((Number) val).doubleValue(); }
        catch (ClassCastException e) {
            try { return Double.parseDouble(val.toString()); }
            catch (NumberFormatException ex) { return 0.0; }
        }
    }

    private double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private Map<String, Object> errorMap(String symbol, String msg) {
        return Map.of("symbol", symbol, "error", msg != null ? msg : "Unknown error");
    }

    private List<Map<String, Object>> errorList(List<String> symbols, String msg) {
        return symbols.stream().map(s -> errorMap(s, msg)).toList();
    }

    private String urlEncode(String s) {
        try {
            return java.net.URLEncoder.encode(s, "UTF-8");
        } catch (Exception e) {
            return s;
        }
    }
}
