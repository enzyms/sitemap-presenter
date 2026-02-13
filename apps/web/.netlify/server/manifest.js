export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.png","widget/widget.js"]),
	mimeTypes: {".png":"image/png",".js":"text/javascript"},
	_: {
		client: {start:"_app/immutable/entry/start.351zyK8m.js",app:"_app/immutable/entry/app.CwyrwViv.js",imports:["_app/immutable/entry/start.351zyK8m.js","_app/immutable/chunks/DvH0qfh5.js","_app/immutable/chunks/DQwv52WA.js","_app/immutable/chunks/BFHQo9yt.js","_app/immutable/chunks/Z1-nxOsN.js","_app/immutable/entry/app.CwyrwViv.js","_app/immutable/chunks/DQwv52WA.js","_app/immutable/chunks/C5VthK-H.js","_app/immutable/chunks/CmwIBMnq.js","_app/immutable/chunks/Z1-nxOsN.js","_app/immutable/chunks/ZpYGP8cY.js","_app/immutable/chunks/-FjUDsfB.js","_app/immutable/chunks/jaElYFwA.js","_app/immutable/chunks/Di2gU2k3.js","_app/immutable/chunks/BFHQo9yt.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js'))
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
				id: "/sites/[id]/feedback",
				pattern: /^\/sites\/([^/]+?)\/feedback\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
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
