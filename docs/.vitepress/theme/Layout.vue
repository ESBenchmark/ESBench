<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { useRoute } from "vitepress";
import VPDefault from "vitepress/theme";

const Playground = defineAsyncComponent(() => import("../../playground/PlaygroundPage.vue"));

const route = useRoute();
const DefaultLayout = VPDefault.Layout;
</script>

<template>
	<Playground v-if='route.path === "/playground.html"'/>
	<DefaultLayout v-else/>
</template>
