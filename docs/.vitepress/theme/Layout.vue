<script setup lang="ts">
import { defineAsyncComponent, watchEffect } from "vue";
import { useRoute } from "vitepress";
import VPDefault from "vitepress/theme";

const DefaultLayout = VPDefault.Layout;
const PlaygroundPage = defineAsyncComponent(() => import("../../playground/PlaygroundPage.vue"));

const route = useRoute();

watchEffect(() => {
	if (route.path === "/playground.html") {
		document.title = "ESBench Playground";
	}
});
</script>

<template>
	<PlaygroundPage v-if='route.path === "/playground.html"'/>
	<DefaultLayout v-else/>
</template>
