<template>
	<div :class='$style.container'>
		<h1 :class='$style.title'>{{ name }}</h1>

		<ChartSection
			:class='$style.main'
			:filter='filter'
			:summary='summary'
			:previous='previous'
		/>

		<section v-if='summary.notes.length' :class='$style.notes'>
			<p
				v-for='(note, i) of summary.notes.filter(isRelevant)'
				:key='i'
			>
				<IconAlertTriangleFilled
					v-if='note.type === "warn"'
					:class='$style.warn'
				/>
				<IconInfoCircleFilled
					v-else
					:class='$style.info'
				/>

				<template v-if='note.case'>
					{{ note.case[xAxis] }}:
				</template>
				{{ note.text }}
			</p>
		</section>

		<section :class='$style.vars'>
			<h2 :class='$style.title'>Variables</h2>

			<LabeledSelect
				v-for='[name, values] of summary.vars'
				:key='name'
				v-model='variables[name]'
				:label='name'
				:disabled='name === xAxis'
				:class='[
					$style.variable,
					name === xAxis && $style.active
				]'
				@click.self='xAxis = name'
			>
				<option v-for='v of values' :key='v'>{{ v }}</option>
			</LabeledSelect>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ResolvedNote, Summary, type ToolchainResult } from "esbench";
import { IconAlertTriangleFilled, IconInfoCircleFilled } from "@tabler/icons-vue";
import useDataFilter from "./useDataFilter.ts";
import LabeledSelect from "./LabeledSelect.vue";
import ChartSection from "./ChartSection.vue";

interface SuiteReportProps {
	name: string;
	result: ToolchainResult[];
	prev?: ToolchainResult[];
}

const props = withDefaults(defineProps<SuiteReportProps>(), {
	prev: () => ([]),
});

const summary = computed(() => new Summary(props.result));
const previous = computed(() => new Summary(props.prev));
const filter = useDataFilter(summary);

const { variables, matches, xAxis } = filter;

function isRelevant(note: ResolvedNote) {
	return !note.case || matches.value.includes(note.case);
}
</script>

<style module>
.container {
	display: grid;
	grid-template-areas: "header vars" "main vars" "notes vars";
	grid-template-rows: auto auto 1fr;
	grid-template-columns: 1fr 360px;
	margin-left: 20px;
}

.title {
	margin: 20px 0;
	font-size: 24px;
	font-weight: 600;
}

.main {
	grid-area: main;
}

.notes {
	grid-area: notes;
	overflow-y: auto;

	& > p {
		display: flex;
		gap: 0.5em;
	}
}

.note-icon {
	flex-shrink: 0;
	width: 24px;
	height: 24px;
}

.info {
	composes: note-icon;
	color: #3498db;
}

.warn {
	composes: note-icon;
	color: #f1c40f;
}

.vars {
	grid-area: vars;
	padding: 0 20px;
	overflow-y: auto;

	& > .title {
		margin-bottom: 20px;
	}
}

.variable {
	cursor: pointer;
	padding: 6px 12px 12px;
	border-radius: 8px;
	font-weight: 600;

	&.active {
		cursor: default;
		background: #bfe3ff;
	}
}
</style>
