import { Config } from "@remotion/cli/config";

// Use a preinstalled Chrome/headless-shell when the default download host is unreachable.
Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE ?? "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell");
