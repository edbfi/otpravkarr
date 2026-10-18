<script lang="ts">
	import { css } from "#styled-system/css";
</script>

<svelte:head>
	<title>otpravkarr</title>
</svelte:head>

<!-- Placeholder until the landing and sign-in surface (.impeccable/surfaces/route.md) is built. -->
<main
	class={css({
		maxWidth: "readingMax",
		marginInline: "auto",
		paddingBlock: "hero",
		paddingInline: { base: "mobileGutter", tablet: "tabletGutter", desktop: "desktopGutter" },
	})}
>
	<p class={css({ textStyle: "label", color: "primary" })}>otpravkarr</p>
	<h1 class={css({ textStyle: "display", marginBlockStart: "section", textWrap: "balance" })}>
		Stream access.
	</h1>
	<p class={css({ marginBlockStart: "lg", color: "muted" })}>
		Sign-in with Plex is being rebuilt. Access is available to accepted friends of the server owner.
	</p>
</main>
