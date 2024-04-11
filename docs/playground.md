---
layout: false
title: Playground
---

<ClientOnly>
    <PlaygroundWithLoader/>
</ClientOnly>

<script>
import { defineAsyncComponent } from "vue";
import LoadingFrame from "./playground/LoadingFrame.vue";

const asyncComponent = defineAsyncComponent({
    loader: () => import("./playground/PlaygroundPage.vue"),
    delay: 0,
    loadingComponent: LoadingFrame,
});
</script>

<script setup>
const PlaygroundWithLoader = asyncComponent;
</script>
