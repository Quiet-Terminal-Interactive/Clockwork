package com.quietterminal.clockwork.renderer.assets;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AssetEntry(
        @JsonProperty("id") String id,
        @JsonProperty("file") String file,
        @JsonProperty("type") String type) {
}
