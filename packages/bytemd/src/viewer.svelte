<script>
  import { getParser } from './utils';
  import Elements from './elements.svelte';

  export let value = '';
  export let plugins = [];

  $: parser = getParser(plugins);
  $: ast = parser.runSync(parser.parse(value));
  // $: console.log(ast);
</script>

<div class="markdown-body">
  <Elements nodes={ast.children} {plugins} />
</div>