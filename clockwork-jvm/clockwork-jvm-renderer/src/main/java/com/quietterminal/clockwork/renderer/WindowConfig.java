package com.quietterminal.clockwork.renderer;

/** Window configuration for the renderer plugin. */
public record WindowConfig(String title, int width, int height, boolean vsync, boolean cursorLocked) {
    public static Builder builder() {
        return new Builder();
    }

    /** Fluent window config builder. */
    public static final class Builder {
        private String title = "Clockwork";
        private int width = 1280;
        private int height = 720;
        private boolean vsync = true;
        private boolean cursorLocked = false;

        public Builder title(String title) {
            this.title = title;
            return this;
        }

        public Builder width(int width) {
            this.width = width;
            return this;
        }

        public Builder height(int height) {
            this.height = height;
            return this;
        }

        public Builder vsync(boolean vsync) {
            this.vsync = vsync;
            return this;
        }

        /** Lock and hide the cursor for first-person mouse look. */
        public Builder cursorLocked(boolean cursorLocked) {
            this.cursorLocked = cursorLocked;
            return this;
        }

        public WindowConfig build() {
            return new WindowConfig(title, width, height, vsync, cursorLocked);
        }
    }
}
