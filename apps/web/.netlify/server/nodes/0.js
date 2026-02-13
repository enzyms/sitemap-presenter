

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.DpQINYEs.js","_app/immutable/chunks/CmwIBMnq.js","_app/immutable/chunks/DQwv52WA.js","_app/immutable/chunks/-FjUDsfB.js"];
export const stylesheets = ["_app/immutable/assets/0.DSY0uSvC.css"];
export const fonts = [];
