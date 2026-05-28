package com.aitrade.controller;

import com.aitrade.service.MarketDataService;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/market")
public class MarketDataController {

    private final MarketDataService marketDataService;

    public MarketDataController(MarketDataService marketDataService) {
        this.marketDataService = marketDataService;
    }

    /**
     * Single quote.
     * {symbol:.+} keeps dots in path variable (needed for SUNREIT.KL)
     *
     * GET /api/market/quote/VOO
     * GET /api/market/quote/SUNREIT.KL
     */
    @GetMapping("/quote/{symbol:.+}")
    public Mono<Map<String, Object>> getQuote(@PathVariable String symbol) {
        return marketDataService.fetchQuote(symbol.toUpperCase());
    }

    /**
     * Symbol search — resolves names/keywords to canonical tickers.
     * GET /api/market/search?q=sunreit
     * GET /api/market/search?q=apple
     * Returns [{symbol, name, exchange, type}]
     */
    @GetMapping("/search")
    public Mono<List<Map<String, Object>>> searchSymbols(@RequestParam String q) {
        return marketDataService.searchSymbols(q.trim());
    }

    /**
     * OHLCV + dividend chart data.
     * GET /api/market/chart/5176.KL?range=6M
     * range: 1W | 1M | 3M | 6M (default) | 1Y | 5Y
     */
    @GetMapping("/chart/{symbol:.+}")
    public Mono<Map<String, Object>> getChart(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "6M") String range) {
        return marketDataService.fetchChartData(symbol.toUpperCase(), range.toUpperCase());
    }

    /**
     * Dividend info for a stock: divRate, divYield, exDivDate, divDate.
     * GET /api/market/dividend/AAPL
     * GET /api/market/dividend/5176.KL
     */
    @GetMapping("/dividend/{symbol:.+}")
    public Mono<Map<String, Object>> getDividendInfo(@PathVariable String symbol) {
        return marketDataService.fetchDividendInfo(symbol.toUpperCase());
    }

    /**
     * Latest news headlines for a stock.
     * GET /api/market/news/AAPL
     * GET /api/market/news/1155.KL
     * Returns [{title, publisher, link, time}] — up to 5 items.
     */
    @GetMapping("/news/{symbol:.+}")
    public Mono<List<Map<String, Object>>> getNews(@PathVariable String symbol) {
        return marketDataService.fetchNews(symbol.toUpperCase());
    }

    /**
     * Batch quotes for portfolio refresh.
     * GET /api/market/quotes?symbols=SUNREIT.KL,VOO,MAYBANK.KL
     */
    @GetMapping("/quotes")
    public Mono<List<Map<String, Object>>> getQuotes(@RequestParam String symbols) {
        List<String> symbolList = Arrays.stream(symbols.split(","))
                .map(String::trim)
                .map(String::toUpperCase)
                .filter(s -> !s.isEmpty())
                .toList();
        return marketDataService.fetchQuotes(symbolList);
    }
}
