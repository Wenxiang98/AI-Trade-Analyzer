package com.aitrade.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Routes market-data requests to the appropriate provider:
 *
 *   US stocks / ETFs (VOO, SPY, AAPL …)  →  Twelve Data API (free, 800 req/day)
 *   Bursa Malaysia    (1155.KL, 5176.KL …)→  Yahoo Finance  (cookie + crumb session)
 *
 * Bursa Malaysia symbol format:
 *   Use the 4-digit Bursa numeric code + ".KL"
 *   1155.KL = Maybank    1295.KL = Public Bank   1023.KL = CIMB
 *   5176.KL = Sunway REIT  5347.KL = Tenaga      4197.KL = IHH
 *   Name-based symbols (SUNREIT.KL, MAYBANK.KL) are NOT reliable — always use numeric codes.
 */
@Service
public class MarketDataService {

    private static final Logger log = LoggerFactory.getLogger(MarketDataService.class);

    private final WebClient twelveDataClient;
    private final YahooFinanceService yahooFinanceService;

    @Value("${twelvedata.api.key}")
    private String apiKey;

    public MarketDataService(WebClient.Builder builder,
                             YahooFinanceService yahooFinanceService) {
        this.twelveDataClient = builder
                .baseUrl("https://api.twelvedata.com")
                .defaultHeader("User-Agent", "AITradeDesk/1.0")
                .build();
        this.yahooFinanceService = yahooFinanceService;
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    public Mono<List<Map<String, Object>>> searchSymbols(String query) {
        return yahooFinanceService.searchSymbols(query);
    }

    public Mono<Map<String, Object>> fetchQuote(String symbol) {
        String normalized = normalize(symbol);
        if (isMalaysian(normalized)) {
            log.info("Routing {} → Yahoo Finance (as {})", symbol, normalized);
            return yahooFinanceService.fetchQuote(normalized);
        }
        log.info("Routing {} → Twelve Data", normalized);
        return fetchFromTwelveData(normalized);
    }

    /**
     * Fetch OHLCV + dividend chart data.
     * Yahoo Finance v8/chart works globally (US + Bursa), so we always route here.
     */
    public Mono<Map<String, Object>> fetchChartData(String symbol, String range) {
        String normalized = normalize(symbol);
        log.info("Chart request: {} → {}, range={}", symbol, normalized, range);
        return yahooFinanceService.fetchChartData(normalized, range);
    }

    public Mono<Map<String, Object>> fetchDividendInfo(String symbol) {
        String normalized = normalize(symbol);
        log.info("Dividend info request: {} → {}", symbol, normalized);
        return yahooFinanceService.fetchDividendInfo(normalized);
    }

    public Mono<List<Map<String, Object>>> fetchNews(String symbol) {
        String normalized = normalize(symbol);
        log.info("News request: {} → {}", symbol, normalized);
        return yahooFinanceService.fetchNews(normalized, 5);
    }

    public Mono<List<Map<String, Object>>> fetchQuotes(List<String> symbols) {
        List<String> normalized = symbols.stream().map(this::normalize).toList();

        List<String> usSymbols = normalized.stream().filter(s -> !isMalaysian(s)).toList();
        List<String> mySymbols = normalized.stream().filter(this::isMalaysian).toList();

        Mono<List<Map<String, Object>>> usMono = usSymbols.isEmpty()
                ? Mono.just(List.of())
                : Flux.fromIterable(usSymbols).flatMap(this::fetchFromTwelveData).collectList();

        Mono<List<Map<String, Object>>> myMono = mySymbols.isEmpty()
                ? Mono.just(List.of())
                : yahooFinanceService.fetchQuotes(mySymbols);

        return Mono.zip(usMono, myMono, (us, my) -> {
            List<Map<String, Object>> combined = new ArrayList<>();
            combined.addAll(us);
            combined.addAll(my);
            return combined;
        });
    }

    // ── Twelve Data (US stocks) ────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Mono<Map<String, Object>> fetchFromTwelveData(String symbol) {
        String uri = "/quote?symbol=" + symbol + "&apikey=" + apiKey + "&dp=2";

        return twelveDataClient.get()
                .uri(uri)
                .retrieve()
                .bodyToMono(Map.class)
                .map(raw -> parseTwelveDataQuote((Map<String, Object>) raw, symbol))
                .onErrorResume(e -> {
                    log.error("Twelve Data error for {}: {}", symbol, e.getMessage());
                    return Mono.just(errorMap(symbol, e.getMessage()));
                });
    }

    private Map<String, Object> parseTwelveDataQuote(Map<String, Object> raw, String symbol) {
        try {
            // Twelve Data returns {"code":400,"message":"..."} for errors
            if (raw.containsKey("code")) {
                String msg = (String) raw.getOrDefault("message", "Unknown error");
                log.warn("Twelve Data error for {}: {}", symbol, msg);
                return errorMap(symbol, msg);
            }

            double price     = parseDouble(raw.get("close"));
            double change    = parseDouble(raw.get("change"));
            double changePct = parseDouble(raw.get("percent_change"));
            String currency  = (String) raw.getOrDefault("currency", "USD");
            String name      = (String) raw.getOrDefault("name", symbol);

            Map<String, Object> result = new HashMap<>();
            result.put("symbol",    symbol);
            result.put("name",      name);
            result.put("price",     round(price));
            result.put("change",    round(change));
            result.put("changePct", round(changePct));
            result.put("currency",  currency);
            return result;

        } catch (Exception e) {
            log.error("Parse error for {}: {}", symbol, e.getMessage());
            return errorMap(symbol, "Parse error");
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /** Common Bursa Malaysia name-based aliases → numeric Bursa code */
    private static final Map<String, String> BURSA_ALIAS = Map.ofEntries(
        Map.entry("MAYBANK",  "1155"),
        Map.entry("CIMB",     "1023"),
        Map.entry("PBBANK",   "1295"),
        Map.entry("SUNREIT",  "5176"),
        Map.entry("TNB",      "5347"),
        Map.entry("TENAGA",   "5347"),
        Map.entry("IHH",      "4197"),
        Map.entry("AXIATA",   "6888"),
        Map.entry("MAXIS",    "6012"),
        Map.entry("DIGI",     "6947"),
        Map.entry("AIRASIA",  "5099"),
        Map.entry("GENTING",  "3182"),
        Map.entry("GENM",     "4715"),
        Map.entry("RHBBANK",  "1066"),
        Map.entry("AMBANK",   "1015"),
        Map.entry("HLBANK",   "5819"),
        Map.entry("PETGAS",   "6033"),
        Map.entry("HAPSENG",  "3034")
    );

    /**
     * Normalise a user-supplied symbol:
     *   - Trims whitespace and uppercases
     *   - Pure numeric → append ".KL"  (e.g. 1155 → 1155.KL)
     *   - Known Bursa name alias → map to numeric code + ".KL"  (e.g. SUNREIT → 5176.KL)
     *   - Everything else → returned as-is (e.g. AAPL, VOO, 5176.KL)
     */
    private String normalize(String symbol) {
        if (symbol == null) return "";
        String s = symbol.trim().toUpperCase();
        if (s.matches("\\d+"))          return s + ".KL";
        if (BURSA_ALIAS.containsKey(s)) return BURSA_ALIAS.get(s) + ".KL";
        return s;
    }

    private boolean isMalaysian(String symbol) {
        return symbol != null && symbol.toUpperCase().endsWith(".KL");
    }

    private double parseDouble(Object val) {
        if (val == null) return 0.0;
        try { return Double.parseDouble(val.toString()); }
        catch (NumberFormatException e) { return 0.0; }
    }

    private double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private Map<String, Object> errorMap(String symbol, String msg) {
        return Map.of("symbol", symbol, "error", msg != null ? msg : "Unknown error");
    }
}
