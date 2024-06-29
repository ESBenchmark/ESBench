<template>
	<section :class='$style.header'>
		<h1>Try benchmarks in the browser</h1>
		<VPButton href='/playground.html' text='Or Create New'/>
	</section>
	<section :class='$style.cards'>
		<a
			v-for='suite of suites'
			:key='suite.name'
			:class='$style.suite'
			:href='"/playground?demo=" + suite.path'
		>
			<span>{{ suite.name }}</span>

			{{ suite.description }}

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
	grid-template-columns: repeat(auto-fit, minmax(18em, 1fr));
}

.suite {
	display: flex;
	flex-direction: column;
	gap: 5px;

	padding: 15px;
	border-radius: 6px;
	background: var(--vp-c-bg-alt);

	color: var(--vp-c-text-2) !important;
	font-weight: initial !important;
	text-decoration: none !important;

	& > span:first-child {
		display: block;
		font-size: 1.125em;
		font-weight: 600;
		color: var(--vp-c-text-1);
	}
}

.attrs {
	align-self: flex-end;
	margin-top: auto;
	font-size: 0.875em;
}
</style>
