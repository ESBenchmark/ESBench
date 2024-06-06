<template>
	<div :class='$style.dropdown'>
		<button :class='$style.button'>
			Table Options
			<span class='vpi-chevron-down text-icon'/>
		</button>
		<div :class='$style.menu'>
			<label :class='$style.option'>
				<input type='checkbox' v-model='options.stdDev'>StdDev
			</label>
			<label :class='$style.option'>
				<input type='checkbox' v-model='removeOutliers'>
				Remove Outliers
			</label>
			<label :class='$style.option'>
				<input type='checkbox' v-model='options.flexUnit'>
				Flex Unit
			</label>
			<label :class='$style.option'>
				<input
					type='checkbox'
					:checked='options.percentiles!.includes(50)'
					@input='togglePercentile'
				>
				50 Percentile
			</label>
			<label :class='$style.option'>
				<input
					type='checkbox'
					:checked='options.percentiles!.includes(75)'
					@input='togglePercentile'
				>
				75 Percentile
			</label>
			<label :class='$style.option'>
				Ratio Style:
				<select v-model='options.ratioStyle'>
					<option>trend</option>
					<option>value</option>
					<option>percentage</option>
				</select>
			</label>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PrintTableOptions } from "./ConsoleView.vue";

const options = defineModel<PrintTableOptions>({ required: true });

const removeOutliers = computed({
	get: () => Boolean(options.value.outliers),
	set: value => options.value.outliers = value ? "all" : false,
});

function togglePercentile(event: InputEvent) {
	const checkbox = event.currentTarget as HTMLInputElement;
	const p = parseInt(checkbox.parentElement!.textContent!);
	const percentiles = options.value.percentiles!;

	if (checkbox.checked) {
		percentiles.push(p);
		percentiles.sort((a, b) => a - b);
	} else {
		percentiles.splice(percentiles.indexOf(p), 1);
	}
}
</script>

<style module>
.dropdown {
	position: relative;

	&:is(:hover, :focus-within) > .menu {
		display: block;
	}
}

.button {
	display: inline-flex;
	align-items: center;
}

.menu {
	position: absolute;
	display: none;

	padding: 12px;
	border-radius: 4px;

	z-index: 1;
	color: var(--vp-c-text-1);
	background: var(--vp-c-bg-elv);;
	border: 1px solid var(--vp-c-divider);
	box-shadow: 0 8px 16px 0 rgba(0, 0, 0, 0.2);
}

.option {
	display: flex;
	white-space: nowrap;

	& > select {
		margin-left: 0.5em;
		padding: revert;
		border: revert;
		-webkit-appearance: revert;
	}
}
</style>
