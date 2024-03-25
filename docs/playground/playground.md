---
layout: false
title: Playground
---

<PlaygroundWithLoader/>

<script>import {defineAsyncComponent} from "vue";
import LoadingFrame from "./LoadingFrame.vue";

const asyncComponent = defineAsyncComponent({
    loader: () => import("./PlaygroundPage.vue"),
    delay: 0,
    loadingComponent: LoadingFrame,
});
</script>

<script setup>
const PlaygroundWithLoader = asyncComponent;
</script>
