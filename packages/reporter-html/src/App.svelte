<nav>
	{#each suites as [file, stages]}
		<a href={encodeURIComponent(file)}>{file}</a>
	{/each}
</nav>

<SuiteReport class="report" name={name} stages={stages}/>

<script lang="ts">
import type { ESBenchResult } from "@esbench/core/client";
import SuiteReport from "./SuiteReport.svelte";

export let result: ESBenchResult;

const suites = Object.entries(result);

const [name, stages] = suites[0];
</script>

<style>
nav {
    width: 320px;
}

.report {
	flex: 1;
}

a {
    padding: 10px;

	text-decoration: none;
	color: inherit;
}
</style>
