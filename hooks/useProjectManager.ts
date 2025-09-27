import { useCallback } from 'react';
import { Project } from '../types';

export const useProjectManager = () => {
    const storageKey = 'ai-codegen-projects';

    const saveProject = useCallback(async (project: Project): Promise<boolean> => {
        try {
            const saved = localStorage.getItem(storageKey);
            const projects: Project[] = saved ? JSON.parse(saved) : [];
            const existingIndex = projects.findIndex(p => p.id === project.id);
            
            let updated: Project[];
            if (existingIndex > -1) {
                projects[existingIndex] = project;
                updated = projects;
            } else {
                updated = [project, ...projects];
            }
            
            const finalProjects = updated.slice(0, 10); // Keep only the last 10 projects
            localStorage.setItem(storageKey, JSON.stringify(finalProjects));
            return true;
        } catch (error) {
            console.error('Failed to save project:', error);
            return false;
        }
    }, []);

    const loadProject = useCallback((projectId: string): Project | null => {
        try {
            const saved = localStorage.getItem(storageKey);
            const projects: Project[] = saved ? JSON.parse(saved) : [];
            return projects.find((p: Project) => p.id === projectId) || null;
        } catch (error)
        {
            console.error('Failed to load project:', error);
            return null;
        }
    }, []);

    const deleteProject = useCallback((projectId: string): Project[] => {
        try {
            const saved = localStorage.getItem(storageKey);
            const projects: Project[] = saved ? JSON.parse(saved) : [];
            const filtered = projects.filter((p: Project) => p.id !== projectId);
            localStorage.setItem(storageKey, JSON.stringify(filtered));
            return filtered;
        } catch (error) {
            console.error('Failed to delete project:', error);
            return [];
        }
    }, []);

    return { saveProject, loadProject, deleteProject };
};
