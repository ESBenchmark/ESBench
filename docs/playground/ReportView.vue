<template>
	<dialog
		:class='$style.container'
		ref='self'
		@close='open = false'
	>
		<aside :class='$style.menu'>
			<div
				v-for='history of results'
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
			@click='handleCloseClick'
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
	</dialog>
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
import SuiteReport from "../../reporter-html/src/SuiteReport.vue";

export interface ReportViewProps {
	results: BenchmarkHistory[];
}

const props = defineProps<ReportViewProps>();
const open = defineModel<boolean>({ required: true });
const self = shallowRef<HTMLDialogElement>();
const current = shallowRef<BenchmarkHistory>();

watch(props, p => current.value ??= p.results[0]);

function handleCloseClick() {
	open.value = false;
	self.value!.close();
}

watch(open, isOpen => isOpen && self.value!.showModal());
</script>

<style module>
.container {
	max-width: 100vw;
	max-height: 100vh;
	width: 100vw;
	height: 100vh;

	margin: 0;
	padding: 0;
	border: none;

	background: white;
	z-index: 10;

	&[open] {
		display: flex;
	}
}

.close {
	position: absolute;
	top: 10px;
	right: 10px;
	padding: 4px;

	border-radius: 50%;
	color: white;
	background: #c71d1d;

	& > svg {
		width: 28px;
		height: 28px;
	}
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
