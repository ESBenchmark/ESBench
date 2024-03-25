<script setup lang="ts">
import { useData, useRoute } from "vitepress";
import VPDefault from "vitepress/theme";

const DefaultLayout = VPDefault.Layout;

const route = useRoute();
const data = useData();

// watchEffect(() => {
// 	if (route.path === "/playground.html") {
// 		data.frontmatter.value.title = "Playground | ESBench";
// 		document.title = "Playground | ESBench";
// 	}
// });
</script>

<template>
	<!--<ClientOnly v-if='route.path === "/playground.html"'><PlaygroundPage/></ClientOnly>-->
	<DefaultLayout />
</template>
