<script lang="ts">
import "../app.css";
// The bundled fonts (DESIGN.md: no remote font requests). Each variable package's default CSS holds
// every subset behind `unicode-range`; Plex Mono is static, so only the two weights its tokens use.
import "@fontsource-variable/fraunces";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import { onMount } from "svelte";
import type { LayoutProps } from "./$types";

let { children }: LayoutProps = $props();

// A client-side signal that the app has hydrated, for the e2e tests to wait on.
onMount(() => {
	document.documentElement.dataset.hydrated = "";
});
</script>

{@render children()}
