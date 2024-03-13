<template>
	<header :class='$style.header'>
		<h1>Try benchmarks in the browser</h1>
		or
		<a href='/playground.html'>Create</a>
	</header>
	<section :class='$style.cards'>
		<a
			v-for='(suite, i) of suites'
			:class='$style.suite'
			:href='"/playground.html?demo=" + i'
		>
			{{ suite.name }}
			<div>
				{{ suite.params }} params,
				{{ suite.cases }} cases
			</div>
		</a>
	</section>
</template>

<script setup lang="ts">
import suites from "./demo-suites.ts";
</script>

<style module>
.header {
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
</style>
