<script setup lang="ts">
import { useRoute } from "vitepress";
import VPDefault from "vitepress/theme";
import PlaygroundPage from "../../playground/PlaygroundPage.vue";

const route = useRoute();
const DefaultLayout = VPDefault.Layout;
</script>

<template>
	<PlaygroundPage v-if='route.path === "/playground.html"'/>
	<DefaultLayout v-else/>
</template>
