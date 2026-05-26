package com.aitrade.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;

@RestController
@RequestMapping("/api/claude")
public class ClaudeProxyController {

    private final WebClient webClient;

    @Value("${claude.api.url}")
    private String claudeApiUrl;

    @Value("${claude.model}")
    private String claudeModel;

    public ClaudeProxyController(WebClient.Builder builder) {
        this.webClient = builder.build();
    }

    @PostMapping
    public Mono<Map> proxy(@RequestBody Map<String, Object> body,
                           @RequestHeader("X-Api-Key") String apiKey,
                           Authentication auth) {
        // Ensure the request uses the configured model
        body.put("model", claudeModel);

        return webClient.post()
                .uri(claudeApiUrl)
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class);
    }
}
