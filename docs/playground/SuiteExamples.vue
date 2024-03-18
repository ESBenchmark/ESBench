<template>
	<section :class='$style.header'>
		<h1>Try benchmarks in the browser</h1>
		<VPButton href='/playground.html' text='Or Create New'/>
	</section>
	<section :class='$style.cards'>
		<a
			v-for='(suite, i) of suites'
			:key='suite.name'
			:class='$style.suite'
			:href='"/playground.html?demo=" + i'
		>
			{{ suite.name }}
			<span :class='$style.attrs'>
				{{ suite.params }} params,
				{{ suite.cases }} cases
			</span>
		</a>
	</section>
</template>

<script setup lang="ts">
import { VPButton } from "vitepress/theme";
import suites from "./demo-suites.ts";
</script>

<style module>
.header {
	display: flex;
	justify-content: space-between;
	margin: 30px 0;
}

.cards {
	display: grid;
	gap: 20px;
	grid-template-columns: repeat(auto-fill, 20em);
}

.suite {
	padding: 15px;
	border-radius: 6px;
	background: var(--vp-c-bg-alt);

	color: inherit !important;
	text-decoration: none !important;
}

.attrs {
	display: block;
	font-size: 0.875em;
	float: right;
	color: var(--vp-c-text-2);
}
</style>
