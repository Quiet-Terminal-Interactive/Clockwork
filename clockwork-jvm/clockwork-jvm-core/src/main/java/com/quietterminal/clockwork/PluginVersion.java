package com.quietterminal.clockwork;

/**
 * Semantic version triple (major.minor.patch) for plugin and engine compatibility checks.
 * Breaking API changes increment major; backwards-compatible additions increment minor.
 */
public record PluginVersion(int major, int minor, int patch) implements Comparable<PluginVersion> {

    public PluginVersion {
        if (major < 0 || minor < 0 || patch < 0) {
            throw new IllegalArgumentException("Version components must be non-negative.");
        }
    }

    public static PluginVersion of(int major, int minor, int patch) {
        return new PluginVersion(major, minor, patch);
    }

    public static PluginVersion parse(String version) {
        String[] parts = version.split("\\.", -1);
        if (parts.length != 3) {
            throw new IllegalArgumentException("Version must be major.minor.patch: " + version);
        }
        try {
            return of(Integer.parseInt(parts[0]), Integer.parseInt(parts[1]), Integer.parseInt(parts[2]));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid version string: " + version, e);
        }
    }

    /**
     * Returns true if the given engine version satisfies this minimum requirement.
     * Requires same major (same API family) and engine >= this version.
     */
    public boolean isMetBy(PluginVersion engineVersion) {
        return engineVersion.major == major && engineVersion.compareTo(this) >= 0;
    }

    @Override
    public int compareTo(PluginVersion other) {
        int cmp = Integer.compare(major, other.major);
        if (cmp != 0) return cmp;
        cmp = Integer.compare(minor, other.minor);
        if (cmp != 0) return cmp;
        return Integer.compare(patch, other.patch);
    }

    @Override
    public String toString() {
        return major + "." + minor + "." + patch;
    }
}
