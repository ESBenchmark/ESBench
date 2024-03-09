<template>
	<div v-if='open' :class='$style.container'>
		<aside :class='$style.menu'>
			<div
				v-for='history of summaries'
				:key='history.time.getTime()'
				:class='[
					$style.history,
					current === history && $style.active
				]'
				@click='current=history'
			>
				{{ history.name }}
				<time>{{ dtf.format(history.time) }}</time>
			</div>
		</aside>

		<button
			title='Back to playground'
			:class='$style.close'
			type='button'
			@click='open = false'
		>
			<IconX/>
		</button>

		<SuiteReport
			v-if='current'
			:class='$style.main'
			:result='current.result'
			:name='current.name'
		/>
		<div v-else :class='$style.empty'>
			No result found.
			Please run a benchmark first.
		</div>
	</div>
</template>

<script lang='ts'>
const dtf = new Intl.DateTimeFormat("sv", {
	month: "numeric",
	day: "numeric",
	year: "numeric",
	hour: "numeric",
	hour12: false,
	minute: "2-digit",
	second: "2-digit",
});
</script>

<script setup lang="ts">
import type { BenchmarkHistory } from "./PlaygroundPage.vue";
import { IconX } from "@tabler/icons-vue";
import { shallowRef, watch } from "vue";
import { useEventListener } from "@vueuse/core";
import { SuiteReport } from "../../reporter-html/src/index.ts";

interface ReportViewProps {
	summaries: BenchmarkHistory[];
}

const props = defineProps<ReportViewProps>();
const open = defineModel<boolean>({ required: true });

const current = shallowRef<BenchmarkHistory>();

watch(props, p => current.value ??= p.summaries[0]);

useEventListener(document, "keyup", event => {
	if (event.key === "Escape") open.value = false;
});
</script>

<style module>
.container {
	position: fixed;
	top: 0;
	left: 0;
	width: 100vw;
	height: 100vh;

	display: flex;
	background: white;
	z-index: 10;
}

.close {
	position: absolute;
	top: 10px;
	right: 10px;
	width: 40px;
	height: 40px;

	display: inline-flex;
	justify-content: center;
	align-items: center;

	border-radius: 50%;
	color: white;
	background: #c71d1d;
}

.menu {
	width: 320px;
	height: 100%;
	background: #f6f6f7;
}

.history {
	display: flex;
	flex-direction: column;

	margin: 10px 20px;
	padding: 8px;
	border-radius: 4px;
	cursor: pointer;

	&.active {
		color: white;
		background: #0f4a85;
	}
}

.main {
	flex: 1;
}

.empty {
	display: flex;
	flex: 1;
	justify-content: center;
	align-items: center;
}
</style>
