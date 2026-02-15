export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.png","widget/widget.js","widget.js"]),
	mimeTypes: {".png":"image/png",".js":"text/javascript"},
	_: {
		client: {start:"_app/immutable/entry/start.BWKiJlQU.js",app:"_app/immutable/entry/app.CzermNQu.js",imports:["_app/immutable/entry/start.BWKiJlQU.js","_app/immutable/chunks/DEWfprcg.js","_app/immutable/chunks/De8nCeAn.js","_app/immutable/chunks/BTm1wTkT.js","_app/immutable/entry/app.CzermNQu.js","_app/immutable/chunks/De8nCeAn.js","_app/immutable/chunks/DyAFWKsM.js","_app/immutable/chunks/Bgvzfm-y.js","_app/immutable/chunks/BTm1wTkT.js","_app/immutable/chunks/D31fIeEI.js","_app/immutable/chunks/vXkExHKf.js","_app/immutable/chunks/Cb9o6PuH.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js')),
			__memo(() => import('./nodes/7.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/sites",
				pattern: /^\/sites\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/sites/new",
				pattern: /^\/sites\/new\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/sites/[id]/feedback",
				pattern: /^\/sites\/([^/]+?)\/feedback\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/sites/[id]/map",
				pattern: /^\/sites\/([^/]+?)\/map\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/sites/[id]/settings",
				pattern: /^\/sites\/([^/]+?)\/settings\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 6 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
