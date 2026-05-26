package com.aitrade.controller;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;

@RestController
@RequestMapping("/api/market")
public class MarketDataController {

    private final WebClient webClient;

    public MarketDataController(WebClient.Builder builder) {
        this.webClient = builder.build();
    }

    /**
     * Fetch quote for a ticker.
     * US stocks: VOO, SPY, AAPL
     * Bursa Malaysia: append .KL — e.g. SUNREIT.KL, MAYBANK.KL
     */
    @GetMapping("/quote/{symbol}")
    public Mono<Map> getQuote(@PathVariable String symbol, Authentication auth) {
        String url = "https://query1.finance.yahoo.com/v8/finance/chart/" + symbol
                + "?interval=1d&range=1d";

        return webClient.get()
                .uri(url)
                .header("User-Agent", "Mozilla/5.0")
                .retrieve()
                .bodyToMono(Map.class)
                .map(raw -> extractQuote(raw, symbol));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> extractQuote(Map<?, ?> raw, String symbol) {
        try {
            var chart = (Map<?, ?>) raw.get("chart");
            var result = (java.util.List<?>) chart.get("result");
            var first = (Map<?, ?>) result.get(0);
            var meta = (Map<String, Object>) first.get("meta");

            double price  = ((Number) meta.get("regularMarketPrice")).doubleValue();
            double prev   = ((Number) meta.get("chartPreviousClose")).doubleValue();
            double change = price - prev;
            double changePct = prev != 0 ? (change / prev) * 100 : 0;

            return Map.of(
                "symbol",    symbol,
                "price",     price,
                "change",    Math.round(change * 100.0) / 100.0,
                "changePct", Math.round(changePct * 100.0) / 100.0,
                "currency",  meta.getOrDefault("currency", "USD")
            );
        } catch (Exception e) {
            return Map.of("symbol", symbol, "error", "Failed to fetch price");
        }
    }
}
