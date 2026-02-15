import { init } from '../serverless.js';

export default init((() => {
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
		client: {start:"_app/immutable/entry/start.xSXFbn4r.js",app:"_app/immutable/entry/app.wq2S9-RH.js",imports:["_app/immutable/entry/start.xSXFbn4r.js","_app/immutable/chunks/DyJBPLKQ.js","_app/immutable/chunks/BLo43KAS.js","_app/immutable/chunks/D3NrjDgE.js","_app/immutable/entry/app.wq2S9-RH.js","_app/immutable/chunks/BLo43KAS.js","_app/immutable/chunks/DdCdvefo.js","_app/immutable/chunks/CNhPpPN1.js","_app/immutable/chunks/D3NrjDgE.js","_app/immutable/chunks/0hONZvJH.js","_app/immutable/chunks/eTW-jsbM.js","_app/immutable/chunks/BDf0qCrI.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('../server/nodes/0.js')),
			__memo(() => import('../server/nodes/1.js')),
			__memo(() => import('../server/nodes/2.js')),
			__memo(() => import('../server/nodes/3.js')),
			__memo(() => import('../server/nodes/4.js')),
			__memo(() => import('../server/nodes/5.js')),
			__memo(() => import('../server/nodes/6.js')),
			__memo(() => import('../server/nodes/7.js'))
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
})());

export const config = {
	path: "/*",
	excludedPath: "/.netlify/*",
	preferStatic: true
};
