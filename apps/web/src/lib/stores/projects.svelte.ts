import type { Project, ProjectCachedData, PageNode, LinkEdge, FeedbackMarker } from '$lib/types';
import { getSupabase } from '$lib/services/supabase';
import { extractDomain } from '$lib/utils/parseUrl';

const STORAGE_KEY = 'sitemap-presenter-projects';
const CURRENT_PROJECT_KEY = 'sitemap-presenter-current-project';

function loadCurrentProjectId(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		return localStorage.getItem(CURRENT_PROJECT_KEY);
	} catch {
		return null;
	}
}

function saveCurrentProjectId(id: string | null): void {
	if (typeof window === 'undefined') return;
	try {
		if (id) {
			localStorage.setItem(CURRENT_PROJECT_KEY, id);
		} else {
			localStorage.removeItem(CURRENT_PROJECT_KEY);
		}
	} catch {
		// Storage unavailable
	}
}

function loadFromStorage(): Project[] {
	if (typeof window === 'undefined') return [];
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) return JSON.parse(stored);
	} catch {
		// Storage unavailable
	}
	return [];
}

function saveToStorage(projects: Project[]): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
	} catch {
		// Storage unavailable
	}
}

class ProjectsStore {
	projects = $state<Project[]>([]);
	currentProjectId = $state<string | null>(null);
	isLoaded = $state(false);

	initialize() {
		this.projects = loadFromStorage();

		const savedProjectId = loadCurrentProjectId();
		if (savedProjectId && this.projects.some((p) => p.id === savedProjectId)) {
			this.currentProjectId = savedProjectId;
		}

		this.isLoaded = true;
	}

	createProject(name: string, description: string, baseUrl: string): Project {
		const now = new Date().toISOString();
		const project: Project = {
			id: crypto.randomUUID(),
			name,
			description,
			baseUrl,
			createdAt: now,
			updatedAt: now
		};

		this.projects = [...this.projects, project];
		saveToStorage(this.projects);
		return project;
	}

	async createProjectWithSite(
		name: string,
		description: string,
		baseUrl: string
	): Promise<Project> {
		const now = new Date().toISOString();
		const domain = extractDomain(baseUrl);

		let siteId: string | undefined;
		let siteApiKey: string | undefined;
		try {
			const supabase = getSupabase();
			const { data: site, error } = await supabase
				.from('sites')
				.insert({ name, domain, settings: {} })
				.select('id, api_key')
				.single();

			if (!error && site) {
				siteId = site.id;
				siteApiKey = site.api_key;
			}
		} catch {
			// Supabase unavailable
		}

		const project: Project = {
			id: crypto.randomUUID(),
			name,
			description,
			baseUrl,
			createdAt: now,
			updatedAt: now,
			siteId,
			siteApiKey
		};

		this.projects = [...this.projects, project];
		saveToStorage(this.projects);
		return project;
	}

	async linkProjectToSite(projectId: string, siteId: string): Promise<boolean> {
		try {
			const supabase = getSupabase();
			const { data: site, error } = await supabase
				.from('sites')
				.select('id, api_key')
				.eq('id', siteId)
				.single();

			if (error || !site) return false;

			this.projects = this.projects.map((p) =>
				p.id === projectId
					? { ...p, siteId: site.id, siteApiKey: site.api_key, updatedAt: new Date().toISOString() }
					: p
			);
			saveToStorage(this.projects);
			return true;
		} catch {
			return false;
		}
	}

	updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'baseUrl'>>): void {
		this.projects = this.projects.map((p) =>
			p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
		);
		saveToStorage(this.projects);
	}

	deleteProject(id: string): void {
		this.projects = this.projects.filter((p) => p.id !== id);
		saveToStorage(this.projects);
		if (this.currentProjectId === id) {
			this.currentProjectId = null;
		}
	}

	cacheProjectData(
		id: string,
		nodes: PageNode[],
		edges: LinkEdge[],
		feedbackMarkers?: Record<string, FeedbackMarker[]>
	): void {
		this.projects = this.projects.map((p) => {
			if (p.id !== id) return p;

			const screenshotUrls: Record<string, string> = {};
			for (const node of nodes) {
				if (node.data.thumbnailUrl) {
					screenshotUrls[node.data.url] = node.data.thumbnailUrl;
				}
			}

			const existingMarkers = p.cachedData?.feedbackMarkers;
			const finalMarkers = feedbackMarkers !== undefined ? feedbackMarkers : existingMarkers;

			return {
				...p,
				lastCrawledAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				cachedData: { nodes, edges, screenshotUrls, feedbackMarkers: finalMarkers }
			};
		});
		saveToStorage(this.projects);
	}

	saveFeedbackMarkers(id: string, feedbackMarkers: Record<string, FeedbackMarker[]>): void {
		this.projects = this.projects.map((p) => {
			if (p.id !== id || !p.cachedData) return p;
			return {
				...p,
				updatedAt: new Date().toISOString(),
				cachedData: { ...p.cachedData, feedbackMarkers }
			};
		});
		saveToStorage(this.projects);
	}

	getCachedData(id: string): ProjectCachedData | null {
		const project = this.projects.find((p) => p.id === id);
		return project?.cachedData || null;
	}

	getProject(id: string): Project | undefined {
		return this.projects.find((p) => p.id === id);
	}

	selectProject(id: string | null): void {
		this.currentProjectId = id;
		saveCurrentProjectId(id);
	}

	clearCache(id: string): void {
		this.projects = this.projects.map((p) => {
			if (p.id !== id) return p;
			const { cachedData, ...rest } = p;
			return { ...rest, updatedAt: new Date().toISOString() };
		});
		saveToStorage(this.projects);
	}
}

export const projectsStore = new ProjectsStore();
