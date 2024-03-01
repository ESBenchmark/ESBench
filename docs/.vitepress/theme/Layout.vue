<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { useRoute } from "vitepress";
import VPDefault from "vitepress/theme";

const DefaultLayout = VPDefault.Layout;
const Playground = defineAsyncComponent(() => import("../../playground/Playground.vue"));

const route = useRoute();
</script>

<template>
	<Playground v-if='route.path === "/playground.html"'/>
	<DefaultLayout v-else/>
</template>
