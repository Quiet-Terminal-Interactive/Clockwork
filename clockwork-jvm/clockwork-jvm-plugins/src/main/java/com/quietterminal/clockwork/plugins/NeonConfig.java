package com.quietterminal.clockwork.plugins;

import java.util.Objects;

/** Neon networking configuration. */
public record NeonConfig(String playerName, String gameIdentifier) {

    private static final int MAX_PLAYER_NAME_LENGTH = 64;
    private static final int MAX_GAME_ID_LENGTH = 128;

    public NeonConfig {
        Objects.requireNonNull(playerName, "playerName");
        Objects.requireNonNull(gameIdentifier, "gameIdentifier");
        if (playerName.isBlank()) {
            throw new IllegalArgumentException("playerName must not be blank");
        }
        if (playerName.length() > MAX_PLAYER_NAME_LENGTH) {
            throw new IllegalArgumentException("playerName exceeds " + MAX_PLAYER_NAME_LENGTH + " characters");
        }
        if (gameIdentifier.isBlank()) {
            throw new IllegalArgumentException("gameIdentifier must not be blank");
        }
        if (gameIdentifier.length() > MAX_GAME_ID_LENGTH) {
            throw new IllegalArgumentException("gameIdentifier exceeds " + MAX_GAME_ID_LENGTH + " characters");
        }
    }

    public static Builder builder() {
        return new Builder();
    }

    /** Fluent builder for Neon config. */
    public static final class Builder {
        private String playerName = "Player";
        private String gameIdentifier = "clockwork-game";

        public Builder playerName(String playerName) {
            this.playerName = playerName;
            return this;
        }

        public Builder gameIdentifier(String gameIdentifier) {
            this.gameIdentifier = gameIdentifier;
            return this;
        }

        public NeonConfig build() {
            return new NeonConfig(playerName, gameIdentifier);
        }
    }
}
